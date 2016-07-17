// jshint esversion: 6
(function() {
    'use strict';

    var _ = require('underscore');

    function ACLRules(app, path) {
        this.app = app;
        var self = this;
        var defaults = {
            all: function(query, callback) {
                callback(null);
            },
            find: function(oldData, callback) {
                callback(null);
            },
            sync: function(callback) {
                callback(null);
            },
            post: function(newData, callback) {
                callback(null);
            },
            put: function(oldData, newData, callback) {
                callback(null);
            },
            delete: function(oldData, callback) {
                callback(null);
            },
            clear: function(callback) {
                callback(null);
            },
            listen: function(channel, callback) {
                callback(null);
            },
            unlisten: function(channel, callback) {
                callback(null);
            },
            broadcast: function(request, callback) {
                callback(null);
            }
        };
        _.each(defaults, function(method, name){
            self[name] = method;
        });
        _.each(app.options.acl[path], function(method, name) {
            self[name] = method;
        });
    }

    module.exports = ACLRules;

}).call(global);