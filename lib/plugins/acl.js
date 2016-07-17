// jshint esversion: 6
(function(){
    'use strict';

    function ACL(app) {
        this.app = app;
        this.acls = {};
        this.middlewares = {};
        app.acl = this;
    }

    ACL.prototype.register = function(app) {
        console.log('Registering ACL');
    };

    ACL.prototype.bindSocket = function(socket) {
        var self = this;
        socket.acl = new this.app.ACLRules(this.app, socket.path);
        Object.keys(socket.acl).forEach(function (name) {
            if(typeof socket.acl[name] === 'function'){
                socket.acl[name].bind(socket);
            }
        });
    };

    ACL.prototype.bindMiddleware = function(router) {
        var self = this;
        router.use(function(req, res, next) {
            var parts = req.path.split('/');
            var path = parts[1];
            if (!self.acls[path]) {
                self.acls[path] = new self.app.ACLRules(self.app, path);
            }
            if (!self.middlewares[path]) {
                self.middlewares[path] = new self.app.ACLMiddleware(self.app, path, self.acls[path]);
            }
            var method = req.method.toLowerCase();
            switch (req.method) {
                case 'GET':
                    if (req.path.endsWith('/clear'))
                        return self.middlewares[path].clear(req, res, next);
                    req.params.id = parts[2];
                    if (req.params.id)
                        return self.middlewares[path].find(req, res, next);
                    self.middlewares[path].all(req, res, next);
                    break;
                case 'POST':
                    if (req.path.endsWith('/broadcast'))
                        return self.middlewares[path].broadcast(req, res, next);
                    self.middlewares[path].post(req, res, next);
                    break;
                case 'PUT':
                case 'DELETE':
                    req.params.id = parts[2];
                    self.middlewares[path][method](req, res, next);
                    break;
                default:
                    next();
            }
        });
    };

    module.exports = ACL;

}).call(global);