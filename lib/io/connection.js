var uuid  = require('uuid');
var redis = require('../redis');
var utils = require('../utils');
var sift = require('sift');
var _ = require('underscore');

var getRecords = function(path, socket, callback) {
    redis.client.lrange(path, 0, -1, function(err, records) {
        if (err) return;
        records = records.map(function(record) {
            var record = JSON.parse(record);
            return record;
        });
        if(socket.options && socket.options.filter) {
            records = sift(socket.options.filter, records);
        }
        callback(records);
    });
};

module.exports = function(io) {

    io.on('connection', function(socket) {
        socket.on('join', function(request) {
            if (request.path) {
                socket.options = request.options;
                getRecords(request.path, socket, function(records){
                    socket.emit('records', records);
                    socket.join(request.path);
                });
            }
        });
        socket.on('all', function(path) {
            if (path) {
                getRecords(path, socket, function(records){
                    socket.emit('records', records);
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
                            payload: record
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
            _.each(io.sockets.sockets, function(socket){
                if(
                    socket.options && 
                    socket.options.filter && 
                    ['post', 'put', 'delete'].indexOf(data.method) > -1 &&
                    Object.keys(socket.rooms).indexOf(data.path) > -1
                ) {
                    if(sift(socket.options.filter, [data.payload]).length > 0) {
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