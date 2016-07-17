// jshint esversion: 6
(function(){
    'use strict';

    var sift = require('sift');
    var _ = require('underscore');
    var underscoreDeepExtend = require('underscore-deep-extend');
    _.mixin({
        deepExtend: underscoreDeepExtend(_)
    });
    var async = require('async');

    function WebsocketsHandlers(app) {
        this.app = app;
    }

    WebsocketsHandlers.prototype.startup = function(app, done) {
        var self = this;

        console.log('Starting Up Websockets Handlers');

        app.io.on('connection', function(socket) {
            if (typeof global.it != 'function') {
                console.log(`Client connected: ${socket.id}/${socket.path}`);
            }

            function cmderror(err) {
                err = {
                    message: err.message,
                    stack: err.stack
                };
                socket.emit('cmderror', err);
            }

            function sync(records) {
                socket.acl.sync(function(err) {
                    if (err) {
                        socket.emit('denied:sync');
                        return cmderror(err);
                    }
                    async.eachSeries(records, function(_record, done) {
                        app.db.find(socket.path, _record.id, function(err, record) {
                            if (err) return done(err);
                            if (record) {
                                if (!_record.meta.deletedAt) {
                                    socket.acl.put(record, _record, function(err) {
                                        if (err) {
                                            socket.emit('denied:put:' + record.id, record);
                                            cmderror(err);
                                            return done(null);
                                        }
                                        record = _.deepExtend(record, _record, {
                                            meta: {
                                                updatedAt: Date.now(),
                                                synced: true
                                            }
                                        });
                                        app.db.put(socket.path, record.id, record, function(err, record) {
                                            if (err) return done(err);
                                            socket.emit('receipt:put', record);
                                            app.pubsub.emit('castmydata#' + socket.path + ':put:' + socket.id, record);
                                            done(null);
                                        });
                                    });
                                } else {
                                    socket.acl.delete(record, function(err) {
                                        if (err) {
                                            socket.emit('denied:put:' + record.id, record);
                                            cmderror(err);
                                            return done(null);
                                        }
                                        record.meta = record.meta || {};
                                        _.each(record, function(value, key) {
                                            if (['id', 'meta'].indexOf(key) == -1) {
                                                delete record[key];
                                            }
                                        });
                                        record.meta = _.extend(record.meta, {
                                            deletedAt: Date.now(),
                                            synced: true
                                        });
                                        app.db.delete(socket.path, id, function(err) {
                                            if (err) return cmderror(err);
                                            app.db.post(socket.path, record, function(err, record) {
                                                if (err) return cmderror(err);
                                                socket.emit('receipt:delete', record);
                                                app.pubsub.emit('castmydata#' + socket.path + ':delete:' + socket.id, record);
                                            });
                                        });
                                    });
                                }
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
                                    app.db.post(socket.path, _record, function(err, record) {
                                        if (err) return done(err);
                                        socket.emit('receipt:post', record);
                                        app.pubsub.emit('castmydata#' + socket.path + ':post:' + socket.id, record);
                                        done(null);
                                    });
                                });
                            }
                        });
                    }, function(err) {
                        if (err) {
                            console.log(err);
                        }
                        socket.acl.all(socket.filter, function(err) {
                            if (err) {
                                socket.emit('denied:sync');
                                return cmderror(err);
                            }
                            app.db.where(socket.path, socket.filter, function(err, records) {
                                if (err) return cmderror(err);
                                socket.emit('sync', records);
                            });
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
                    });
                    app.db.post(socket.path, record, function(err, record) {
                        if (err) return cmderror(err);
                        socket.emit('receipt:post', record);
                        app.pubsub.emit('castmydata#' + socket.path + ':post:' + socket.id, record);
                    });
                });
            }

            function put(_record) {
                app.db.find(socket.path, _record.id, function(err, record) {
                    if (err) return cmderror(err);
                    if (!record) return cmderror(new Error('Not Found'));
                    socket.acl.put(record, _record, function(err) {
                        if (err) {
                            socket.emit('denied:put:' + record.id, record);
                            return cmderror(err);
                        }
                        record = _.deepExtend(record, _record, {
                            meta: {
                                updatedAt: Date.now(),
                                synced: true
                            }
                        });
                        app.db.put(socket.path, record.id, record, function(err, record) {
                            if (err) return cmderror(err);
                            socket.emit('receipt:put', record);
                            app.pubsub.emit('castmydata#' + socket.path + ':put:' + socket.id, record);
                        });
                    });
                });
            }

            function del(id) {
                app.db.find(socket.path, id, function(err, record) {
                    if (err) return cmderror(err);
                    if (!record) return cmderror(new Error('Not Found'));
                    socket.acl.delete(record, function(err) {
                        if (err) {
                            socket.emit('denied:delete:' + id, record);
                            return cmderror(err);
                        }
                        record.meta = record.meta || {};
                        _.each(record, function(value, key) {
                            if (['id', 'meta'].indexOf(key) == -1) {
                                delete record[key];
                            }
                        });
                        record.meta = _.extend(record.meta, {
                            deletedAt: Date.now(),
                            synced: true
                        });
                        app.db.delete(socket.path, id, function(err) {
                            if (err) return cmderror(err);
                            app.db.post(socket.path, record, function(err, record) {
                                if (err) return cmderror(err);
                                socket.emit('receipt:delete', record);
                                app.pubsub.emit('castmydata#' + socket.path + ':delete:' + socket.id, record);
                            });
                        });
                    });
                });
            }

            function clear() {
                socket.acl.clear(function(err) {
                    if (err) {
                        socket.emit('denied:clear');
                        return cmderror(err);
                    }
                    if (err) return cmderror(err);
                    app.db.clear(socket.path, function(err) {
                        if (err) return cmderror(err);
                        if (typeof global.it != 'function') {
                            console.log(`DB cleared: ${socket.path}`);
                        }
                        socket.emit('receipt:clear');
                        app.pubsub.emit('castmydata#' + socket.path + ':clear:' + socket.id, null);
                    });
                });
            }

            function notSubscribed() {
                cmderror(new Error('You have to subscribe first!'));
            }
            socket.on('subscribe', function(options) {
                // subscription can only be called once
                if (socket.subscribed)
                    return;
                if (typeof global.it != 'function') {
                    console.log(`Client subscribed: ${socket.id}/${socket.path}`);
                }
                socket.filter = options.filter || {};

                // use removeAllListeners because sometimes notSubscribe
                // has already been binded (in the case of reconnection)
                socket.removeAllListeners('sync');
                socket.removeAllListeners('post');
                socket.removeAllListeners('put');
                socket.removeAllListeners('delete');
                socket.removeAllListeners('clear');
                socket.on('sync', sync);
                socket.on('post', post);
                socket.on('put', put);
                socket.on('delete', del);
                socket.on('clear', clear);
                socket.subscribed = true;
                socket.emit('subscribe');
            });
            socket.on('unsubscribe', function() {
                socket.removeAllListeners('sync');
                socket.removeAllListeners('post');
                socket.removeAllListeners('put');
                socket.removeAllListeners('delete');
                socket.removeAllListeners('clear');
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
            socket.on('listen', function(channel) {
                socket.acl.listen(channel, function(err) {
                    if (err) {
                        socket.emit('denied:listen:' + channel);
                        return cmderror(err);
                    }
                    socket.channels = (socket.channels || []);
                    if (socket.channels.indexOf(channel) == -1) {
                        socket.channels.push(channel);
                    }
                    socket.emit('receipt:listen', channel);
                });
            });
            socket.on('unlisten', function(channel) {
                socket.acl.unlisten(channel, function(err) {
                    if (err) {
                        socket.emit('denied:unlisten:' + channel);
                        return cmderror(err);
                    }
                    socket.channels = (socket.channels || []);
                    var index = socket.channels.indexOf(channel);
                    if (index > -1) {
                        socket.channels.splice(index, 1);
                    }
                    socket.emit('receipt:unlisten', channel);
                });
            });
            socket.on('broadcast', function(request) {
                if (!request.channel) return cmderror(new Error('Broadcast must have a channel'));
                socket.acl.broadcast(request, function(err) {
                    if (err) {
                        socket.emit('denied:broadcast');
                        return cmderror(err);
                    }
                    if (err) return cmderror(err);
                    socket.emit('receipt:broadcast', request);
                    app.pubsub.emit('castmydata#' + socket.path + ':broadcast:' + socket.id, request);
                });
            });
        });
        done();
    };

    module.exports = WebsocketsHandlers;

}).call(global);