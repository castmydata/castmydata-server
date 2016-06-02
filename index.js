var dotenv = require('dotenv').config();
var fs = require('fs');
var path = require('path');
var redis = require('redis');
var _ = require('lodash');
var redisConfigs = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    db: process.env.REDIS_DB,
    password: process.env.REDIS_PASS || undefined,
};
var client = redis.createClient(redisConfigs);
var pub = redis.createClient(redisConfigs);
var sub = redis.createClient(redisConfigs);
var cors = require('cors');
var uuid = require('uuid');
var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var server;
var startupMessage;

if(process.env.HTTP_SECURE.toLowerCase() == 'true') {
    server = require("https").createServer({
        cert: fs.readFileSync(process.env.HTTPS_CERT_FILE),
        key: fs.readFileSync(process.env.HTTPS_CERT_KEY),
        passphrase: process.env.HTTPS_KEY_PASS || undefined
    }, app);
    startupMessage = `CastMyData server listening on: https://${process.env.HTTP_BIND_ADDR}:${process.env.HTTP_PORT}`;
} else {
    server = require("http").createServer(app);
    startupMessage = `CastMyData server listening on: http://${process.env.HTTP_BIND_ADDR}:${process.env.HTTP_PORT}`;
}
var io = require('socket.io')(server);

try {
    fs.statSync(path.join(__dirname, 'public', 'index.html'));
    console.log('WARNING: index.html file found in public directory. This file is meant to be only for demo purpose. Please delete in production.');
} catch (e){}

io.set('origins', process.env.HTTP_ORIGIN);
if(process.env.HTTP_ORIGIN == '*:*') {
    app.use(cors({
        origin: true,
        credentials: true
    }));
} else {
    app.use(cors({
        origin: process.env.HTTP_ORIGIN,
        credentials: true
    }));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static('public'));

var findById = function(path, id, callback) {
    var _index = 0;
    client.lrange(path, 0, -1, function(err, records) {
        var record = _.map(records, function(record) {
            return JSON.parse(record);
        }).filter(function(record, index) {
            if (record.id == id) {
                _index = index;
                return true;
            }
            return false;
        }).pop();
        callback(null, record, _index);
    })
}

if(process.env.API_ENABLED && process.env.API_ENABLED.toLowerCase() == 'true') {

    if (!process.env.API_TOKEN || process.env.API_TOKEN == 'RANDOM STRING HERE')
        throw "Invalid API_TOKEN in .env";

    app.use(function(req, res, next){
        if(req.get('Authorization') !== ('Bearer ' + process.env.API_TOKEN)) {
            return res.sendStatus(403);
        }
        next();
    });

    var response = function(res, data, status) {
        var status = status || 200;
        res
            .status(status)
            .json({
                response: data
            });
    }

    var handleError = function(err, res) {
        console.error(err);
        return res
            .status(500)
            .json({
                error: err
            });
    }

    app.post('/db/:path', function(req, res) {
        if(!req.body.id)
            req.body.id = uuid.v4();
        client.lpush(req.params.path, JSON.stringify(req.body), function(err) {
            if (err) return handleError(err, res);
            pub.publish('castmydata', JSON.stringify({
                path: req.params.path,
                method: 'post',
                payload: req.body
            }))
            response(res, req.body, 201);
        })
    });

    app.delete('/db/:path/:id', function(req, res) {
        findById(req.params.path, req.params.id, function(err, record, index) {
            if (err) return handleError(err, res);
            if (!record) return res.sendStatus(404);
            client.lset(req.params.path, index, '__deleted__', function(err){
                if (err) return handleError(err, res);
                client.lrem(req.params.path, 0, '__deleted__', function(err){
                    if (err) return handleError(err, res);
                    pub.publish('castmydata', JSON.stringify({
                        path: req.params.path,
                        id: req.params.id,
                        method: 'delete',
                    }))
                    res.sendStatus(200);
                });
            });
        });
    });

    app.put('/db/:path/:id', function(req, res) {
        findById(req.params.path, req.params.id, function(err, record, index) {
            if (err) return handleError(err, res);
            if (!record) return res.sendStatus(404);
            record = _.extend(record, req.body);
            client.lset(req.params.path, index, JSON.stringify(record));
            pub.publish('castmydata', JSON.stringify({
                path: req.params.path,
                id: req.params.id,
                payload: record,
                method: 'put',
            }))
            response(res, record);
        });
    });

    app.get('/db/:path', function(req, res) {
        client.lrange(req.params.path, 0, -1, function(err, records) {
            if (err) return handleError(err, res);
            records = _.map(records, function(record) {
                var record = JSON.parse(record);
                return record;
            });
            response(res, records);
        });
    });

    app.get('/db/:path/:id', function(req, res) {
        findById(req.params.path, req.params.id, function(err, record) {
            if (err) return handleError(err, res);
            if (!record) return res.sendStatus(404);
            response(res, record);
        });
    });

} else {
    console.log('RESTful API Disabled');
}

io.on('connection', function(socket) {
    socket.on('join', function(path) {
        if(path) {
            client.lrange(path, 0, -1, function(err, records) {
                if (err) return;
                records = _.map(records, function(record) {
                    var record = JSON.parse(record);
                    return record;
                });
                socket.emit('records', records);
                socket.join(path);
            });
        }
    });

    socket.on('leave', function(data){
        if(path) {
            socket.leave(path);
        }
    });

    socket.on('post', function(request){
        if(!request.payload.id)
            request.payload.id = uuid.v4();

        client.lpush(request.path, JSON.stringify(request.payload), function(err) {
            if (err) return;
            pub.publish('castmydata', JSON.stringify({
                path: request.path,
                method: 'post',
                payload: request.payload
            }));
        });
    });

    socket.on('put', function(request){
        findById(request.path, request.id, function(err, record, index) {
            if (err) return;
            if (!record) return;

            record = _.extend(record, request.payload);
            client.lset(request.path, index, JSON.stringify(record));
            pub.publish('castmydata', JSON.stringify({
                path: request.path,
                id: request.id,
                payload: record,
                method: 'put',
            }));
        });
    });

    socket.on('delete', function(request){
        findById(request.path, request.id, function(err, record, index) {
            if (err) return;
            if (!record) return;

            client.lset(request.path, index, '__deleted__', function(err){
                if (err) return;
                client.lrem(request.path, 0, '__deleted__', function(err){
                    if (err) return;
                    pub.publish('castmydata', JSON.stringify({
                        path: request.path,
                        id: request.id,
                        method: 'delete',
                    }))
                });
            });
        });
    });

});

sub.subscribe('castmydata');
sub.on('message', function(channel, data){
    if(channel == 'castmydata') {
        data = JSON.parse(data);
        io.to(data.path).emit(data.method, {
            id: data.id,
            payload: data.payload
        });
    }
});

server.listen(process.env.HTTP_PORT, process.env.HTTP_BIND_ADDR, function(){
    console.log(startupMessage);
});