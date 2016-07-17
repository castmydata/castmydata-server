// jshint esversion: 6
(function(){
    'use strict';

    var redis = require('redis');
    var uuid = require('uuid');
    var EventEmitter = require('events').EventEmitter;
    var util = require('util');

    function Listener(options) {
        this.callback = options.callback;
        this.once = options.once;
        this.pattern = new RegExp(options.pattern);
    }

    Listener.prototype = Object.create(EventEmitter.prototype);

    Listener.prototype.respond = function(channel, data) {
        if (this.pattern.test(channel)) {
            this.callback(channel, data);
            if (this.once) {
                this.emit('unbind');
            }
        }
    };

    Listener.prototype.respondOff = function(channel, callback) {
        if (this.pattern.test(channel) && this.callback == callback) {
            this.emit('unbind');
        }
    };

    Listener.prototype.respondOffAll = function(channel) {
        if (this.pattern.test(channel)) {
            this.emit('unbind');
        }
    };

    function RedisPubSub(app) {
        var self = this;
        this.app = app;
        this.name = 'Redis';
        this.listeners = [];
        this.redisConfigs = {
            host: app.get('REDIS_HOST', 'localhost'),
            port: app.get('REDIS_PORT', 6379),
            db: app.get('REDIS_DB', 0),
            password: app.get('REDIS_PASS') || undefined,
        };
    }

    RedisPubSub.prototype.createListener = function(options) {
        var self = this;
        var listener = new Listener(options);
        listener.on('unbind', function() {
            var index = self.listeners.indexOf(listener);
            if (index > -1) {
                self.listeners.splice(index, 1);
            }
        });
        return listener;
    };

    RedisPubSub.prototype.startup = function(app, done) {
        var self = this;
        this.publisher = redis.createClient(this.redisConfigs);
        this.subscriber = redis.createClient(this.redisConfigs);
        this.subscriber.psubscribe('*');
        this.subscriber.on('pmessage', function(pattern, channel, data) {
            data = JSON.parse(data);
            self.listeners.forEach(function(listener) {
                listener.respond(channel, data);
            });
        });
        done();
    };

    RedisPubSub.prototype.on = function(pattern, callback) {
        var listener = this.createListener({
            pattern: pattern,
            callback: callback,
            once: false
        });
        this.listeners.push(listener);
        return this;
    };

    RedisPubSub.prototype.once = function(pattern, callback) {
        var listener = this.createListener({
            pattern: pattern,
            callback: callback,
            once: true
        });
        this.listeners.push(listener);
        return this;
    };

    RedisPubSub.prototype.removeListener =
    RedisPubSub.prototype.off = function(pattern, callback) {
        this.listeners.forEach(function(listener) {
            listener.respondOff(channel);
        });
    };

    RedisPubSub.prototype.removeAllListener =
    RedisPubSub.prototype.offAll = function(channel) {
        this.listeners.forEach(function(listener) {
            listener.respondOffAll(channel);
        });
    };

    RedisPubSub.prototype.emit = function(channel, data) {
        data = JSON.stringify(data);
        this.publisher.publish(channel, data);
        return this;
    };

    RedisPubSub.prototype.shutdown = function(app, callback) {
        this.publisher.quit();
        this.subscriber.quit();
        callback();
    };

    module.exports = RedisPubSub;

}).call(global);