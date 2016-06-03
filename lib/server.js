var dotenv = require('dotenv').config();
var fs = require('fs');
var path = require('path');
var redis = require('redis');
var redisConfigs = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    db: process.env.REDIS_DB,
    password: process.env.REDIS_PASS || undefined,
};
var client = redis.createClient(redisConfigs);
var publisher = redis.createClient(redisConfigs);
var subscriber = redis.createClient(redisConfigs);
var cors = require('cors');
var uuid = require('uuid');
var bodyParser = require('body-parser');
var express = require('express');
var api = express();
var http;

if(process.env.IGNORE_INDEX .toLowerCase() == 'false') {
    try {
        fs.statSync(path.join(__dirname, 'public', 'index.html'));
        console.log('WARNING: index.html file found in public directory. This file is meant to be only for demo purpose. Please delete in production.');
    } catch (e){}
}

if(process.env.HTTP_SECURE.toLowerCase() == 'true') {
    http = require("https").createServer({
        cert: fs.readFileSync(process.env.HTTPS_CERT_FILE),
        key: fs.readFileSync(process.env.HTTPS_CERT_KEY),
        passphrase: process.env.HTTPS_KEY_PASS || undefined
    }, api);
} else {
    http = require("http").createServer(api);
}
var io = require('socket.io')(http);

io.set('origins', process.env.HTTP_ORIGIN);
if(process.env.HTTP_ORIGIN == '*:*') {
    api.use(cors({
        origin: true,
        credentials: true
    }));
} else {
    api.use(cors({
        origin: process.env.HTTP_ORIGIN,
        credentials: true
    }));
}

api.use(bodyParser.json());
api.use(bodyParser.urlencoded({
    extended: true
}));
api.use(express.static('public'));

var findById = function(path, id, callback) {
    var _index = 0;
    client.lrange(path, 0, -1, function(err, records) {
        var record = records.map(function(record) {
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

io.on('connection', function(socket) {
    socket.on('join', function(path) {
        if(path) {
            client.lrange(path, 0, -1, function(err, records) {
                if (err) return;
                records = records.map(function(record) {
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
            publisher.publish('castmydata', JSON.stringify({
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
            for (var key in request.payload) {
                record[key] = request.payload[key];
            }
            client.lset(request.path, index, JSON.stringify(record));
            publisher.publish('castmydata', JSON.stringify({
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
                    publisher.publish('castmydata', JSON.stringify({
                        path: request.path,
                        id: request.id,
                        method: 'delete',
                    }))
                });
            });
        });
    });
});

subscriber.subscribe('castmydata');
subscriber.on('message', function(channel, data){
    if(channel == 'castmydata') {
        data = JSON.parse(data);
        io.to(data.path).emit(data.method, {
            id: data.id,
            payload: data.payload
        });
    }
});

function start(fn) {
    if(process.env.API_ENABLED && process.env.API_ENABLED.toLowerCase() == 'true') {
        require('./api')(api, client, publisher);
    } else {
        console.log('RESTful API Disabled');
    }
    return http.listen(process.env.HTTP_PORT, process.env.HTTP_BIND_ADDR, function(){
        var scheme = 'http';
        if(process.env.HTTP_SECURE.toLowerCase() == 'true') {
            scheme = 'https';
        }
        console.log(`CastMyData http listening on: ${scheme}://${process.env.HTTP_BIND_ADDR}:${process.env.HTTP_PORT}`);
        if(fn)
            fn(http);
    });
}

module.exports = {
    start,
    io,
    api,
    http
}