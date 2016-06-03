var _ = require('lodash');
var uuid = require('uuid');

module.exports = function(app, client, publisher) {

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
            publisher.publish('castmydata', JSON.stringify({
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

    app.put('/db/:path/:id', function(req, res) {
        findById(req.params.path, req.params.id, function(err, record, index) {
            if (err) return handleError(err, res);
            if (!record) return res.sendStatus(404);
            record = _.extend(record, req.body);
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
}