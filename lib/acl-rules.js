// jshint esversion: 6
(function() {
    'use strict';

    var _ = require('underscore');

    function ACLRules(app, path) {
        var self = this;
        this.app = app;
        this.defaults = app.options.acl[path] || {};
        _.each(this.defaults, function(method, name) {
            self[name] = method;
        });
    }

    ACLRules.prototype.all = function(query, callback) {
        callback(null);
    };

    ACLRules.prototype.find = function(oldData, callback) {
        callback(null);
    };

    ACLRules.prototype.sync = function(callback) {
        callback(null);
    };

    ACLRules.prototype.post = function(newData, callback) {
        callback(null);
    };

    ACLRules.prototype.put = function(oldData, newData, callback) {
        callback(null);
    };

    ACLRules.prototype.delete = function(oldData, callback) {
        callback(null);
    };

    ACLRules.prototype.clear = function(callback) {
        callback(null);
    };

    ACLRules.prototype.listen = function(channel, callback) {
        callback(null);
    };

    ACLRules.prototype.unlisten = function(channel, callback) {
        callback(null);
    };

    ACLRules.prototype.broadcast = function(request, callback) {
        callback(null);
    };

    module.exports = ACLRules;

}).call(global);