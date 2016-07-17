// jshint esversion: 6
(function(){
    'use strict';

    var SocketIO = require('socket.io');
    var _ = require('underscore');
    var sift = require('sift');

    function WebSockets(app) {
        this.app = app;
        this.connMap = {};
        this.lastSocketKey = 0;
        app.io = SocketIO();
    }

    WebSockets.prototype.startup = function(app, done) {
        console.log(`Starting Up WebSockets`);
        var self = this;

        app.io.on('connection', function(socket) {
            var key = ++self.lastSocketKey;
            self.connMap[key] = socket;

            // Set subscription to false
            socket.subscribed = false;

            // Set Path a.k.a DB Table
            socket.path = socket.handshake.query.path;

            // Bind ACL
            app.acl.bindSocket(socket);

            // remove from connMap on close
            socket.conn.on('close', function() {
                delete self.connMap[key];
            });
        });

        app.pubsub.on('castmydata#*', function(channel, data) {
            var parts = channel.split('#')[1];
            var path = parts.split(':')[0];
            var method = parts.split(':')[1];
            var clientId = channel.split(':')[2];
            _.each(app.io.sockets.sockets, function(socket) {
                if (socket.id == clientId) return;
                if (socket.path == path) {
                    if (method == 'broadcast') {
                        if (socket.channels && socket.channels.indexOf(data.channel) > -1) {
                            socket.emit('broadcast', data);
                        }
                    } else if (
                        ['post', 'put'].indexOf(method) > -1
                    ) {
                        if (socket.filter) {
                            data = sift(socket.filter, [data]);
                            if (data.length === 0) {
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
        });

        done();
        // sockets are bound to http server inside lib/plugins/http
    };

    WebSockets.prototype.shutdown = function(app, done) {
        console.log(`Shutting Down WebSockets`);
        _.each(this.connMap, function(socket) {
            socket.conn.close();
            socket.onclose('CastMyData is closing');
        });
        done();
    };

    module.exports = WebSockets;

}).call(global);