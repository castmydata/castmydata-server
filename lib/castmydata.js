// jshint esversion: 6
(function(){
    'use strict';
    var async = require('async');
    var _ = require('underscore');
    var ude = require('underscore-deep-extend');
    _.mixin({
        deepExtend: ude(_)
    });
    var go = require('getobject');

    function CastMyData(options) {
        var self = this;
        this.started = false;
        if (!options) {
            options = {};
        }
        this.options = _.deepExtend({
            config: {},
            acl: {},
            middlewares: {},
        }, options);
        this.scheme = (this.get('HTTP_SECURE') == 'true') ?
            'https' :
            'http';
        this.plugins = [];
        this.startups = [];
        this.shutdowns = [];

        // Require ACL Rules Class
        this.ACLRules = require('./acl-rules');

        // Require Express ACL Middlware
        this.ACLMiddleware = require('./acl-middlware');

        // PubSub Plugin
        this.register(new(require('./plugins/pubsub'))(this));

        // DB Plugin
        this.register(new(require('./plugins/db'))(this));

        // Require ACL
        this.register(new(require('./plugins/acl'))(this));

        // Express Plugin
        this.register(new(require('./plugins/express'))(this));

        // Express Handlers Plugin
        if (this.get('API_ENABLED')) {
            this.register(new(require('./plugins/express-handlers'))(this));
        }

        // Require redirector http server
        if (this.get('REDIR_TO_HTTPS')) {
            this.register(new(require('./plugins/redirector'))(this));
        }

        // Require Websockets
        this.register(new(require('./plugins/websockets'))(this));

        // Require Websockets Handlers
        this.register(new(require('./plugins/websockets-handlers'))(this));

        // Require main http server
        this.register(new(require('./plugins/http'))(this));
    }

    CastMyData.prototype.get = function(path, defaults) {
        var value = (go.get(this.options.config, path) || go.get(process.env, path)) + '';
        switch (value) {
            case 'true':
                value = true;
                break;
            case 'undefined':
                value = undefined;
                break;
            case 'null':
            case 'false':
                value = false;
                break;
        }
        if (!value && defaults) {
            value = defaults;
        }
        return value;
    };

    CastMyData.prototype.set = function(path, value) {
        go.set(path, value, this.app.options.config, true);
        return this.get(path);
    };

    CastMyData.prototype.startPlugins = function() {
        var self = this;
        return this;
    };

    CastMyData.prototype.register = function(plugin) {
        if (plugin.register) {
            plugin.register.call(plugin, this);
        }
        if (plugin.startup) {
            this.startups.push(plugin.startup.bind(plugin));
        }
        if (plugin.shutdown) {
            this.shutdowns.unshift(plugin.shutdown.bind(plugin));
        }
        if (this.started) {
            if (plugin.startup) {
                plugin.startup(this, function() {});
            }
        }
        return this;
    };

    CastMyData.prototype.startup = function(callback) {
        var self = this;
        callback = callback || function() {};
        async.eachSeries(this.startups, function(startup, callback) {
            startup(self, callback);
        }, function() {
            self.http.startup(self, callback);
        });
        this.started = true;
        return this;
    };

    CastMyData.prototype.shutdown = function(callback) {
        var self = this;
        callback = callback || function() {};
        async.eachSeries(this.shutdowns, function(startup, callback) {
            startup(self, callback);
        }, callback.bind(this));
        return this;
    };

    module.exports = CastMyData;

}).call(global);