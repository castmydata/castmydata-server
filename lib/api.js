var uuid = require('uuid');

module.exports = function(client, publisher) {

    var cors         = require('cors');
    var bodyParser   = require('body-parser');
    var express      = require('express');
    var api          = express();
    var http;

    api.use(express.static('./public'));

    if(process.env.HTTP_SECURE.toLowerCase() == 'true') {
        http = require("https").createServer({
            cert: fs.readFileSync(process.env.HTTPS_CERT_FILE),
            key: fs.readFileSync(process.env.HTTPS_CERT_KEY),
            passphrase: process.env.HTTPS_KEY_PASS || undefined
        }, api);
    } else {
        http = require("http").createServer(api);
    }

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

    if(process.env.API_ENABLED && process.env.API_ENABLED.toLowerCase() == 'true') {

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
    
        if (!process.env.API_TOKEN || process.env.API_TOKEN == 'RANDOM STRING HERE')
            throw "Invalid API_TOKEN in .env";

        api.use(function(req, res, next){
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

        api.post('/db/:path', function(req, res) {
            if(!req.body.id)
                req.body.id = uuid.v4();
            client.lpush(req.params.path, JSON.stringify(req.body), function(err) {
                if (err) return handleError(err, res);
                publisher.publish('castmydata', JSON.stringify({
                    path: req.params.path,
                    method: 'post',
                    payload: req.body
                }))
                response(res, req.body, 201);
            })
        });

        api.delete('/db/:path/:id', function(req, res) {
            findById(req.params.path, req.params.id, function(err, record, index) {
                if (err) return handleError(err, res);
                if (!record) return res.sendStatus(404);
                client.lset(req.params.path, index, '__deleted__', function(err){
                    if (err) return handleError(err, res);
                    client.lrem(req.params.path, 0, '__deleted__', function(err){
                        if (err) return handleError(err, res);
                        publisher.publish('castmydata', JSON.stringify({
                            path: req.params.path,
                            id: req.params.id,
                            method: 'delete',
                        }))
                        res.sendStatus(200);
                    });
                });
            });
        });

        api.put('/db/:path/:id', function(req, res) {
            findById(req.params.path, req.params.id, function(err, record, index) {
                if (err) return handleError(err, res);
                if (!record) return res.sendStatus(404);
                for(var key in req.body) {
                    record[key] = req.body[key];
                }
                client.lset(req.params.path, index, JSON.stringify(record));
                publisher.publish('castmydata', JSON.stringify({
                    path: req.params.path,
                    id: req.params.id,
                    payload: record,
                    method: 'put',
                }))
                response(res, record);
            });
        });

        api.get('/db/:path', function(req, res) {
            client.lrange(req.params.path, 0, -1, function(err, records) {
                if (err) return handleError(err, res);
                records = records.map(function(record) {
                    var record = JSON.parse(record);
                    return record;
                });
                response(res, records);
            });
        });

        api.get('/db/:path/:id', function(req, res) {
            findById(req.params.path, req.params.id, function(err, record) {
                if (err) return handleError(err, res);
                if (!record) return res.sendStatus(404);
                response(res, record);
            });
        });
    } else {
        console.log('RESTful API Disabled');
    }

    var start = function(fn) {
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

    return {
        server: http,
        start,
        api
    }
}