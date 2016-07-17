// jshint esversion: 6
(function(){
    'use strict';

    var _ = require('underscore');

    function ACLMiddleware(app, path, rules) {
        this.app = app;
        this.path = path;
        this.rules = rules;
        this.defaults = app.options.middlewares[path] || {};
        _.each(this.defaults, function(method, name) {
            self[name] = method;
        });
    }

    ACLMiddleware.prototype.dbFind = function(res, id, callback) {
        this.app.db.find(this.path, id, function(err, record) {
            if (err) return self.dbError(err, res);
            if (!record) return self.notFoundError(res);
            callback(res);
        });
    };

    ACLMiddleware.prototype.notFoundError = function(res) {
        res.status(404).json({
            message: 'Record Not Found',
        });
    };

    ACLMiddleware.prototype.accessDenied = function(res) {
        res.status(403).json({
            message: 'Access Denied',
        });
    };

    ACLMiddleware.prototype.dbError = function(err, res) {
        res.status(500).json({
            message: 'Database Error',
            error: err.message,
            stack: err.stack
        });
    };

    ACLMiddleware.prototype.all = function(req, res, next) {
        var self = this;
        var query = req.query.query || {};
        this.rules.all(query, function(err) {
            if (err) return self.accessDenied();
            next();
        });
    };

    ACLMiddleware.prototype.find = function(req, res, next) {
        var self = this;
        this.dbFind(res, req.params.id, function(record) {
            self.rules.find(record, function(err) {
                if (err) return self.accessDenied(res);
                next();
            });
        });
    };

    ACLMiddleware.prototype.post = function(req, res, next) {
        var self = this;
        this.rules.post(req.body, function(err) {
            if (err) return self.accessDenied(res);
            next();
        });
    };

    ACLMiddleware.prototype.put = function(req, res, next) {
        var self = this;
        this.dbFind(res, req.params.id, function(record) {
            self.rules.put(record, req.body, function(err) {
                if (err) return self.accessDenied(res);
                next();
            });
        });
    };

    ACLMiddleware.prototype.delete = function(req, res, next) {
        var self = this;
        this.dbFind(res, req.params.id, function(record) {
            self.rules.delete(record, function(err) {
                if (err) return self.accessDenied(res);
                next();
            });
        });
    };

    ACLMiddleware.prototype.clear = function(req, res, next) {
        var self = this;
        this.rules.clear(function(err) {
            if (err) return self.accessDenied(res);
            next();
        });
    };

    ACLMiddleware.prototype.broadcast = function(req, res, next) {
        var self = this;
        this.rules.broadcast(req.body, function(err) {
            if (err) return self.accessDenied(res);
            next();
        });
    };

    module.exports = ACLMiddleware;

}).call(global);