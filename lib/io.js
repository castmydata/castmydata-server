var uuid         = require('uuid');

module.exports = function(http, client, publisher, subscriber) {
    var io = require('socket.io')(http);
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

    io.set('origins', process.env.HTTP_ORIGIN);

    io.on('connection', function(socket) {
        socket.on('join', function(path) {
            if (path) {
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
        socket.on('leave', function(data) {
            if (path) {
                socket.leave(path);
            }
        });
        socket.on('post', function(request) {
            if (!request.payload.id)
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
        socket.on('put', function(request) {
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
        socket.on('delete', function(request) {
            findById(request.path, request.id, function(err, record, index) {
                if (err) return;
                if (!record) return;
                client.lset(request.path, index, '__deleted__', function(err) {
                    if (err) return;
                    client.lrem(request.path, 0, '__deleted__', function(err) {
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

    return io;
}