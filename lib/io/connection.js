var redis = require('../redis');
var sift = require('sift');
var _ = require('underscore');

module.exports = function(io, options) {
    var db = options.db;
    var getRecords = function(path, socket, callback) {
        db.all(path, function(err, records) {
            if (err) return;
            if (socket.options && socket.options.filter) {
                records = sift(socket.options.filter, records);
            }
            callback(records);
        });
    };
    io.on('connection', function(socket) {
        socket.on('join', function(request) {
            if (request.path) {
                socket.options = request.options;
                getRecords(request.path, socket, function(records) {
                    socket.emit('records', records);
                    socket.join(request.path);
                });
            }
        });
        socket.on('leave', function(data) {
            if (data.path) {
                socket.leave(data.path);
            }
        });
        socket.on('all', function(path) {
            if (path) {
                getRecords(path, socket, function(records) {
                    socket.emit('records', records);
                });
            }
        });
        socket.on('post', function(request) {
            db.post(request.path, request.payload, function(err, record) {
                if (err) return;
                redis.publisher.publish('castmydata', JSON.stringify({
                    path: request.path,
                    method: 'post',
                    payload: record
                }));
            });
        });
        socket.on('put', function(request) {
            db.put(request.path, request.id, request.payload, function(err, record) {
                if (err) return;
                redis.publisher.publish('castmydata', JSON.stringify({
                    path: request.path,
                    id: request.id,
                    payload: record,
                    method: 'put',
                }));
            });
        });
        socket.on('delete', function(request) {
            db.delete(request.path, request.id, function(err, record, index) {
                redis.publisher.publish('castmydata', JSON.stringify({
                    path: request.path,
                    id: request.id,
                    method: 'delete',
                    payload: record
                }))
            });
        });
        socket.on('broadcast', function(request) {
            redis.publisher.publish('castmydata', JSON.stringify({
                method: 'broadcast',
                path: request.path,
                payload: request.payload
            }))
        });
    });

    redis.subscriber.subscribe('castmydata');
    redis.subscriber.on('message', function(channel, data) {
        if (channel == 'castmydata') {
            data = JSON.parse(data);
            _.each(io.sockets.sockets, function(socket) {
                if (
                    socket.options &&
                    socket.options.filter &&
                    ['post', 'put', 'delete'].indexOf(data.method) > -1 &&
                    Object.keys(socket.rooms).indexOf(data.path) > -1
                ) {
                    if (sift(socket.options.filter, [data.payload]).length > 0) {
                        socket.emit(data.method, {
                            id: data.id,
                            payload: data.payload
                        });
                    }
                } else {
                    socket.emit(data.method, {
                        id: data.id,
                        payload: data.payload
                    });
                }
            });
        }
    });
}