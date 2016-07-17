// jshint esversion: 6
(function(){
    "use strict";

    var _ = require('underscore');
    var fs = require('fs');

    function HTTPServer(app) {
        var self = this;
        this.app = app;
        this.connMap = {};
        this.lastSocketKey = 0;
        if (app.get('HTTPS_CERT_FILE')) {
            app.http = require('https').createServer({
                cert: fs.readFileSync(app.get('HTTPS_CERT_FILE')),
                key: fs.readFileSync(app.get('HTTPS_CERT_KEY')),
                passphrase: app.get('HTTPS_KEY_PASS')
            }, app.express);
        } else {
            app.http = require('http').createServer(app.express);
        }
        app.http.startup = function(app, done) {
            console.log('Starting Up HTTP Server');
            // Socket.io must be attached after expressjs
            app.io.attach(app.http);
            app.http.on('connection', function(socket) {
                var key = ++self.lastSocketKey;
                self.connMap[key] = socket;
                socket.on('close', function() {
                    delete self.connMap[key];
                });
            });
            app.http.listen(app.get('HTTP_PORT', 8080), app.get('HTTP_BIND_ADDR', 'localhost'), function() {
                var scheme = app.get('HTTP_SECURE') ?
                    'https' :
                    'http';
                if (typeof global.it != 'function') {
                    console.log(`CastMyData http listening on: ${app.scheme}://${app.get('HTTP_BIND_ADDR', 'localhost')}:${app.get('HTTP_PORT', 8080)}`);
                }
                done();
            });
        };
    }

    HTTPServer.prototype.shutdown = function(app, done) {
        console.log('Shutting Down HTTP Server');
        _.each(this.connMap, function(socket) {
            socket.destroy();
        });
        app.http.close();
        done();
    };

    module.exports = HTTPServer;

}).call(global);