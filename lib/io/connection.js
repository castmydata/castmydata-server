var uuid  = require('uuid');
var redis = require('../redis');
var utils = require('../utils');

module.exports = function(io) {

    io.on('connection', function(socket) {
        socket.on('join', function(path) {
            if (path) {
                redis.client.lrange(path, 0, -1, function(err, records) {
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
        socket.on('leave', function(data) {
            if (path) {
                socket.leave(path);
            }
        });
        socket.on('post', function(request) {
            if (!request.payload.id)
                request.payload.id = uuid.v4();
            redis.client.lpush(request.path, JSON.stringify(request.payload), function(err) {
                if (err) return;
                redis.publisher.publish('castmydata', JSON.stringify({
                    path: request.path,
                    method: 'post',
                    payload: request.payload
                }));
            });
        });
        socket.on('put', function(request) {
            utils.findById(request.path, request.id, function(err, record, index) {
                if (err) return;
                if (!record) return;
                for (var key in request.payload) {
                    record[key] = request.payload[key];
                }
                redis.client.lset(request.path, index, JSON.stringify(record));
                redis.publisher.publish('castmydata', JSON.stringify({
                    path: request.path,
                    id: request.id,
                    payload: record,
                    method: 'put',
                }));
            });
        });
        socket.on('delete', function(request) {
            utils.findById(request.path, request.id, function(err, record, index) {
                if (err) return;
                if (!record) return;
                redis.client.lset(request.path, index, '__deleted__', function(err) {
                    if (err) return;
                    redis.client.lrem(request.path, 0, '__deleted__', function(err) {
                        if (err) return;
                        redis.publisher.publish('castmydata', JSON.stringify({
                            path: request.path,
                            id: request.id,
                            method: 'delete',
                        }))
                    });
                });
            });
        });
        socket.on('broadcast', function(request){
            redis.publisher.publish('castmydata', JSON.stringify({
                method: 'broadcast',
                path: request.path,
                payload: request.payload
            }))
        });
    });

    redis.subscriber.subscribe('castmydata');
    redis.subscriber.on('message', function(channel, data){
        if(channel == 'castmydata') {
            data = JSON.parse(data);
            io.to(data.path).emit(data.method, {
                id: data.id,
                payload: data.payload
            });
        }
    });
}