var utils      = require('../utils');
var redis      = require('../redis');
var cors       = require('cors');
var uuid       = require('uuid');


module.exports = {
    start: function(api) {

        // Load API stuff only if API_ENABLED is true
        if(process.env.API_ENABLED && process.env.API_ENABLED.toLowerCase() == 'true') {
            
            // Check for Auth Token
            if (!process.env.API_TOKEN || process.env.API_TOKEN == 'RANDOM STRING HERE')
                throw "Invalid API_TOKEN in .env";

            api.use(function(req, res, next){
                if(req.get('Authorization') !== ('Bearer ' + process.env.API_TOKEN)) {
                    return res.sendStatus(403);
                }
                next();
            });

            // Setup CORS
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

            api.get('/db/:path', function(req, res) {
                redis.client.lrange(req.params.path, 0, -1, function(err, records) {
                    if (err) return utils.handleError(err, res);
                    records = records.map(function(record) {
                        var record = JSON.parse(record);
                        return record;
                    });
                    utils.response(res, records);
                });
            });

            api.get('/db/:path/:id', function(req, res) {
                utils.findById(req.params.path, req.params.id, function(err, record) {
                    if (err) return utils.handleError(err, res);
                    if (!record) return res.sendStatus(404);
                    utils.response(res, record);
                });
            });

            api.post('/db/:path', function(req, res) {
                if(!req.body.id)
                    req.body.id = uuid.v4();
                redis.client.lpush(req.params.path, JSON.stringify(req.body), function(err) {
                    if (err) return utils.handleError(err, res);
                    redis.publisher.publish('castmydata', JSON.stringify({
                        path: req.params.path,
                        method: 'post',
                        payload: req.body
                    }))
                    utils.response(res, req.body, 201);
                })
            });

            api.put('/db/:path/:id', function(req, res) {
                utils.findById(req.params.path, req.params.id, function(err, record, index) {
                    if (err) return utils.handleError(err, res);
                    if (!record) return res.sendStatus(404);
                    for(var key in req.body) {
                        record[key] = req.body[key];
                    }
                    redis.client.lset(req.params.path, index, JSON.stringify(record));
                    redis.publisher.publish('castmydata', JSON.stringify({
                        path: req.params.path,
                        id: req.params.id,
                        payload: record,
                        method: 'put',
                    }))
                    utils.response(res, record);
                });
            });

            api.delete('/db/:path/:id', function(req, res) {
                utils.findById(req.params.path, req.params.id, function(err, record, index) {
                    if (err) return utils.handleError(err, res);
                    if (!record) return res.sendStatus(404);
                    redis.client.lset(req.params.path, index, '__deleted__', function(err){
                        if (err) return utils.handleError(err, res);
                        redis.client.lrem(req.params.path, 0, '__deleted__', function(err){
                            if (err) return utils.handleError(err, res);
                            redis.publisher.publish('castmydata', JSON.stringify({
                                path: req.params.path,
                                id: req.params.id,
                                method: 'delete',
                            }))
                            res.sendStatus(200);
                        });
                    });
                });
            });

            api.post('/db/:path/broadcast', function(req, res) {
                if(!req.body.payload) return res.sendStatus(400);
                redis.publisher.publish('castmydata', JSON.stringify({
                    path: req.params.path,
                    payload: req.body.payload,
                    method: 'broadcast',
                }));
                res.sendStatus(200);
            });
        } else {
            console.log('RESTful API Disabled');
        }
    }
}