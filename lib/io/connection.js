var redis = require('../redis');
var sift = require('sift');
var _ = require('underscore');
var underscoreDeepExtend = require('underscore-deep-extend');
_.mixin({
    deepExtend: underscoreDeepExtend(_)
});
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
        socket.acl = new acl(socket);

        socket.subscribed = false;
        if (typeof global.it != 'function') {
            console.log(`Client connected: ${socket.id}/${socket.path}`);
        }

        function sync(records) {
            socket.acl.sync(function(err) {
                if (err) return socket.emit('error', err);
                async.eachSeries(records, function(_record, done) {
                    db.find(socket.path, _record.id, function(err, record) {
                        if (err) return done(err);
                        if (record) {
                            record = _.deepExtend(record, _record, {
                                meta: {
                                    updatedAt: Date.now(),
                                    synced: true
                                }
                            });
                            db.put(socket.path, record.id, record, function(err, record) {
                                if (err) return done(err);
                                done(null);
                            });
                        } else {
                            _record.meta.updatedAt = Date.now();
                            _record.meta.createdAt = Date.now();
                            _record.meta.synced = true;
                            db.post(socket.path, _record, function(err, record) {
                                if (err) return done(err);
                                done(null);
                            });
                        }
                    })
                }, function(err) {
                    if (err) {
                        console.log(err);
                    }
                    db.all(socket.path, function(err, records) {
                        if (err) return socket.emit('error', err);
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
                if (err) return socket.emit('error', err);
                record.meta = record.meta || {};
                _.extend(record.meta, {
                    synced: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    deletedAt: null,
                })
                db.post(socket.path, record, function(err, record) {
                    if (err) return socket.emit('error', err);
                    redis.publisher.publish('castmydata#' + socket.path + ':post', JSON.stringify(record));
                });
            })
        }

        function put(record) {
            socket.acl.put(record.id, record, function(err) {
                if (err) return socket.emit('error', err);
                record = _.deepExtend(record, {
                    meta: {
                        updatedAt: Date.now(),
                        synced: true
                    }
                });
                db.put(socket.path, record.id, record, function(err, record) {
                    if (err) return socket.emit('error', err);
                    redis.publisher.publish('castmydata#' + socket.path + ':put', JSON.stringify(record));
                });
            })
        }

        function del(id) {
            socket.acl.delete(id, function(err) {
                if (err) return socket.emit('error', err);
                db.find(socket.path, id, function(err, record) {
                    if (err) return callback(err);
                    if (!record) return callback(new Error('Not Found'));
                    record.attributes = {};
                    record.meta.deletedAt = Date.now();
                    record.meta.synced = true;
                    db.put(socket.path, id, record, function(err, record) {
                        if (err) return socket.emit('error', err);
                        redis.publisher.publish('castmydata#' + socket.path + ':delete', JSON.stringify(record));
                    });
                });
            })
        }

        function clear() {
            socket.acl.clear(function(err) {
                if (err) return socket.emit('error', err);
                db.clear(socket.path, function(err) {
                    if (typeof global.it != 'function') {
                        console.log(`DB cleared: ${socket.path}`)
                    }
                    if (err) return socket.emit('error', err);
                    redis.publisher.publish('castmydata#' + socket.path + ':clear', 'null');
                });
            })
        }

        function notSubscribed() {
            socket.emit('cmderror', 'You have to subscribe first!');
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
            socket.on('sync', sync);
            socket.on('post', post);
            socket.on('put', put);
            socket.on('delete', del);
            socket.on('clear', clear);
            socket.subscribed = true;
        });
        socket.on('unsubscribe', function() {
            socket.removeListener('sync', sync);
            socket.removeListener('post', post);
            socket.removeListener('put', put);
            socket.removeListener('delete', del);
            socket.on('sync', notSubscribed);
            socket.on('post', notSubscribed);
            socket.on('put', notSubscribed);
            socket.on('delete', notSubscribed);
            socket.on('clear', notSubscribed);
            socket.subscribed = false;
        });

        socket.on('sync', notSubscribed);
        socket.on('post', notSubscribed);
        socket.on('put', notSubscribed);
        socket.on('delete', notSubscribed);
        socket.on('clear', notSubscribed);
        socket.on('broadcast', function(request) {
            socket.acl.broadcast(function(err) {
                if (err) return socket.emit('error', err);
                redis.publisher.publish('castmydata#' + socket.path + ':broadcast', JSON.stringify({
                    payload: request.payload
                }))
            });
        });
    });

    redis.subscriber.psubscribe('castmydata#*');
    redis.subscriber.on('pmessage', function(pattern, channel, data) {
        if (pattern == 'castmydata#*') {
            var parts = channel.split('#')[1];
            var path = parts.split(':')[0];
            var method = parts.split(':')[1];
            data = JSON.parse(data);
            _.each(io.sockets.sockets, function(socket) {
                if (socket.path == path) {
                    if (
                        ['post', 'put'].indexOf(method) > -1
                    ) {
                        if(socket.filter) {
                            if(sift(socket.filter, [data]).length == 0) {
                                return;
                            }
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