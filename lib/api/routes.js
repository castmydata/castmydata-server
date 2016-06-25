var redis = require('../redis');
var cors = require('cors');
var _ = require('underscore');
var response = function(res, data, status) {
    var status = status || 200;
    res
        .status(status)
        .json({
            response: data
        });
};
var handleError = function(err, res) {
    console.error(err);
    return res
        .status(500)
        .json({
            error: err
        });
}

module.exports = {
    start: function(api, options) {

        var db = options.db;

        // Load API stuff only if API_ENABLED is true
        if (process.env.API_ENABLED && process.env.API_ENABLED.toLowerCase() == 'true') {

            // Check for Auth Token
            if (!process.env.API_TOKEN || process.env.API_TOKEN == 'RANDOM STRING HERE')
                throw "Invalid API_TOKEN in .env";

            api.use(function(req, res, next) {
                if (req.get('Authorization') !== ('Bearer ' + process.env.API_TOKEN)) {
                    return res.sendStatus(403);
                }
                next();
            });

            // Setup CORS
            if (process.env.HTTP_ORIGIN == '*:*') {
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
                db.all(req.params.path, function(err, records) {
                    if (err) return handleError(err, res);
                    response(res, records);
                });
            });

            api.get('/db/:path/:id', function(req, res) {
                db.find(req.params.path, req.params.id, function(err, record) {
                    if (err) return handleError(err, res);
                    if (!record) return res.sendStatus(404);
                    response(res, record);
                });
            });

            api.post('/db/:path', function(req, res) {
                req.body.meta = req.body.meta || {};
                _.extend(req.body.meta, {
                    synced: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    deletedAt: null,
                })
                db.post(req.params.path, req.body, function(err, record) {
                    if (err) return handleError(err, res);
                    redis.publisher.publish('castmydata#' + req.params.path + ':post', JSON.stringify(record))
                    response(res, record, 201);
                })
            });

            api.put('/db/:path/:id', function(req, res) {
                db.put(req.params.path, req.params.id, req.body, function(err, record) {
                    if (err) return handleError(err, res);
                    redis.publisher.publish('castmydata#' + req.params.path + ':put', JSON.stringify(record));
                    response(res, record);
                });
            });

            api.delete('/db/:path/:id', function(req, res) {
                db.delete(req.params.path, req.params.id, function(err, record) {
                    if (err) return handleError(err, res);
                    redis.publisher.publish('castmydata#' + req.params.path + ':delete', JSON.stringify(record));
                    response(res, record);
                });
            });

            api.post('/db/:path/broadcast', function(req, res) {
                if (!req.body.payload) return res.sendStatus(400);
                redis.publisher.publish('castmydata#' + req.params.path + ':broadcast', JSON.stringify({
                    payload: req.body.payload,
                }));
                res.sendStatus(200);
            });
        } else {
            console.log('RESTful API Disabled');
        }
    }
}