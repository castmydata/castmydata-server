var redis = require('../redis');
var sift = require('sift');
var _ = require('underscore');
var async = require('async');
var acl = require('./acl');

module.exports = function(http, io, options) {
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

        socket.path = socket.handshake.query.path;
        var aclOptions = {};
        if(options.acl && options.acl[socket.path]) {
            aclOptions = options.acl[socket.path];
        }
        socket.acl = new acl(socket, aclOptions);

        socket.subscribed = false;
        if (typeof global.it != 'function') {
            console.log(`Client connected: ${socket.id}/${socket.path}`);
        }

        function cmderror(err) {
            var err = {
                message: err.message,
                stack: err.stack
            }
            socket.emit('cmderror', err);
        }

        function sync(records) {
            socket.acl.sync(function(err) {
                if (err) {
                    socket.emit('denied:sync');
                    return cmderror(err);
                }
                async.eachSeries(records, function(_record, done) {
                    db.find(socket.path, _record.id, function(err, record) {
                        if (err) return done(err);
                        if (record) {
                            socket.acl.put(record.id, _record, function(err) {
                                if (err) {
                                    socket.emit('denied:put:' + record.id, record);
                                    cmderror(err);
                                    return done(null);
                                }
                                record = _.extend(record, _record, {
                                    meta: {
                                        updatedAt: Date.now(),
                                        synced: true
                                    }
                                });
                                db.put(socket.path, record.id, record, function(err, record) {
                                    if (err) return done(err);
                                    done(null);
                                });
                            });
                        } else {
                            socket.acl.post(_record, function(err) {
                                if (err) {
                                    socket.emit('denied:post:' + _record.id);
                                    cmderror(err);
                                    return done(null);
                                }
                                _record.meta.updatedAt = Date.now();
                                _record.meta.createdAt = Date.now();
                                _record.meta.synced = true;
                                db.post(socket.path, _record, function(err, record) {
                                    if (err) return done(err);
                                    done(null);
                                });
                            });
                        }
                    })
                }, function(err) {
                    if (err) {
                        console.log(err);
                    }
                    db.all(socket.path, function(err, records) {
                        if (err) return cmderror(err);
                        if (socket.filter) {
                            records = sift(socket.filter, records);
                        }
                        socket.emit('sync', records);
                    });
                });
            });
        }

        function post(record) {
            socket.acl.post(record, function(err) {
                if (err) {
                    socket.emit('denied:post:' + record.id);
                    return cmderror(err);
                }
                record.meta = record.meta || {};
                record.meta = _.extend(record.meta, {
                    synced: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    deletedAt: null,
                })
                db.post(socket.path, record, function(err, record) {
                    if (err) return cmderror(err);
                    socket.emit('receipt:post', record);
                    redis.publisher.publish('castmydata#' + socket.path + ':post:' + socket.id, JSON.stringify(record));
                });
            })
        }

        function put(_record) {
            db.find(socket.path, _record.id, function(err, record) {
                if (err) return cmderror(err);
                if (!record) return socket.emit('cmderror', new Error('Not Found'));
                socket.acl.put(record, _record, function(err) {
                    if (err) {
                        socket.emit('denied:put:' + record.id, record);
                        return cmderror(err);
                    }
                    record.meta = _.extend(record.meta, {
                        updatedAt: Date.now(),
                        synced: true
                    });
                    record = _.extend(record, _record);
                    db.put(socket.path, record.id, record, function(err, record) {
                        if (err) return cmderror(err);
                        socket.emit('receipt:put', record);
                        redis.publisher.publish('castmydata#' + socket.path + ':put:' + socket.id, JSON.stringify(record));
                    });
                });
            })
        }

        function del(id) {
            db.find(socket.path, id, function(err, record) {
                if (err) return cmderror(err);
                if (!record) return socket.emit('cmderror', new Error('Not Found'));
                socket.acl.delete(record, function(err) {
                    if (err) {
                        socket.emit('denied:delete:' + id, record);
                        return cmderror(err);
                    }
                    record.meta = record.meta || {};
                    _.each(record, function(value, key){
                        if(['id', 'meta'].indexOf(key) == -1) {
                            delete record[key];
                        }
                    });
                    record.meta = _.extend(record.meta, {
                        deletedAt: Date.now(),
                        synced: true
                    });
                    db.delete(socket.path, id, function(err){
                        if (err) return cmderror(err);
                        db.post(socket.path, record, function(err, record) {
                            if (err) return cmderror(err);
                            socket.emit('receipt:delete', record);
                            redis.publisher.publish('castmydata#' + socket.path + ':delete:' + socket.id, JSON.stringify(record));
                        });
                    })
                });
            })
        }

        function clear() {
            socket.acl.clear(function(err) {
                if (err) {
                    socket.emit('denied:clear');
                    return cmderror(err);
                }
                if (err) return cmderror(err);
                db.clear(socket.path, function(err) {
                    if (err) return cmderror(err);
                    if (typeof global.it != 'function') {
                        console.log(`DB cleared: ${socket.path}`)
                    }
                    socket.emit('receipt:clear');
                    redis.publisher.publish('castmydata#' + socket.path + ':clear:' + socket.id, 'null');
                });
            })
        }

        function notSubscribed() {
            socket.emit('cmderror', new Error('You have to subscribe first!'));
        }
        socket.on('subscribe', function(options) {
            // subscription can only be called once
            if (socket.subscribed)
                return;
            if (typeof global.it != 'function') {
                console.log(`Client subscribed: ${socket.id}/${socket.path}`);
            }
            socket.filter = options.filter;

            socket.removeListener('sync', notSubscribed);
            socket.removeListener('post', notSubscribed);
            socket.removeListener('put', notSubscribed);
            socket.removeListener('delete', notSubscribed);
            socket.removeListener('clear', notSubscribed);
            socket.on('sync', sync);
            socket.on('post', post);
            socket.on('put', put);
            socket.on('delete', del);
            socket.on('clear', clear);
            socket.subscribed = true;
            socket.emit('subscribe');
        });
        socket.on('unsubscribe', function() {
            socket.removeListener('sync', sync);
            socket.removeListener('post', post);
            socket.removeListener('put', put);
            socket.removeListener('delete', del);
            socket.removeListener('clear', clear);
            socket.on('sync', notSubscribed);
            socket.on('post', notSubscribed);
            socket.on('put', notSubscribed);
            socket.on('delete', notSubscribed);
            socket.on('clear', notSubscribed);
            socket.filter = null;
            socket.subscribed = false;
            socket.emit('unsubscribe');
        });

        socket.on('sync', notSubscribed);
        socket.on('post', notSubscribed);
        socket.on('put', notSubscribed);
        socket.on('delete', notSubscribed);
        socket.on('clear', notSubscribed);
        socket.on('listen', function(channel){
            socket.acl.listen(channel, function(err) {
                if (err) {
                    socket.emit('denied:listen:' + channel);
                    return cmderror(err);
                }
                socket.channels = (socket.channels || []);
                if(socket.channels.indexOf(channel) == -1) {
                    socket.channels.push(channel);
                }
                socket.emit('receipt:listen', channel);
            });
        });
        socket.on('unlisten', function(channel){
            socket.acl.unlisten(channel, function(err) {
                if (err) {
                    socket.emit('denied:unlisten:' + channel);
                    return cmderror(err);
                }
                socket.channels = (socket.channels || []);
                var index = socket.channels.indexOf(channel);
                if(index > -1) {
                    socket.channels.splice(index, 1);
                }
                socket.emit('receipt:unlisten', channel);
            });
        });
        socket.on('broadcast', function(request) {
            if (!request.channel) return socket.emit('cmderror', new Error('Broadcast must have a channel'));
            socket.acl.broadcast(request, function(err) {
                if (err) {
                    socket.emit('denied:broadcast');
                    return cmderror(err);
                }
                if (err) return cmderror(err);
                socket.emit('receipt:broadcast', request);
                request = JSON.stringify(request);
                redis.publisher.publish('castmydata#' + socket.path + ':broadcast:' + socket.id, request);
            });
        });
    });

    redis.subscriber.psubscribe('castmydata#*');
    redis.subscriber.on('pmessage', function(pattern, channel, data) {
        if (pattern == 'castmydata#*') {
            var parts = channel.split('#')[1];
            var path = parts.split(':')[0];
            var method = parts.split(':')[1];
            var clientId = channel.split(':')[2];
            data = JSON.parse(data);
            _.each(io.sockets.sockets, function(socket) {
                if(socket.id == clientId) return;
                if (socket.path == path) {
                    if(method == 'broadcast') {
                        if(socket.channels && socket.channels.indexOf(data.channel) > -1) {
                            socket.emit('broadcast', data);
                        }
                    } else if (
                        ['post', 'put'].indexOf(method) > -1
                    ) {
                        if (socket.filter) {
                            data = sift(socket.filter, [data]);
                            if (data.length == 0) {
                                return;
                            }
                            data = data.pop();
                        }
                        socket.emit(method, data);
                    } else {
                        socket.emit(method, data);
                    }
                }
            });
        }
    });
}