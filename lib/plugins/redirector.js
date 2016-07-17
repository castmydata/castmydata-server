// jshint esversion: 6
(function(){
    "use strict";

    var _ = require('underscore');

    function Redirector(app) {
        this.app = app;
        this.socketMap = {};
        this.lastSocketKey = 0;
    }

    Redirector.prototype.register = function(app) {
        console.log('Registering HTTP Redirector Server');
        app.redirector = require('http').createServer(function(req, res) {
            res.writeHead(302, {
                'Location': `${app.get('REDIR_URL')}${req.url}`
            });
            res.end();
        });
    };

    Redirector.prototype.startup = function(app, callback) {
        var self = this;
        console.log('Starting Up HTTP Redirector Server');
        app.redirector.listen(app.get('REDIR_TO_HTTPS_PORT', 8080), app.get('HTTP_BIND_ADDR', 'localhost'), callback);
        app.redirector.on('connection', function(socket) {
            var key = ++self.lastSocketKey;
            self.socketMap[key] = socket;
            socket.on('close', function() {
                delete self.socketMap[key];
            });
        });
    };

    Redirector.prototype.shutdown = function(app, callback) {
        console.log('Shutting Down HTTP Redirector Server');
        _.each(this.socketMap, function(socket) {
            socket.destroy();
        });
        app.redirector.close(callback);
    };

    module.exports = Redirector;

}).call(global);