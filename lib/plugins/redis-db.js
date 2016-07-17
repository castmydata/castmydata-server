// jshint esversion: 6
(function(){
    'use strict';

    var uuid = require('uuid');
    var sift = require('sift');
    var _ = require('underscore');
    var ude = require('underscore-deep-extend');
    _.mixin({
        deepExtend: ude(_)
    });

    function RedisDatabase(app) {
        this.app = app;
        this.name = 'Redis';
        this.client = null;
    }

    RedisDatabase.prototype = {
        all: function(table, callback) {
            this.client.hgetall(table, function(err, records) {
                if (err) return callback(err);
                if (!records) {
                    records = [];
                }
                records = _.map(records, function(record) {
                    return JSON.parse(record);
                });
                callback(null, records);
            });
            return this;
        },
        where: function(table, filter, callback) {
            this.all(table, function(err, records) {
                if (err) return callback(err);
                records = sift(filter, records);
                callback(null, records);
            });
            return this;
        },
        find: function(table, id, callback) {
            this.client.hget(table, id, function(err, record) {
                if (err) return callback(err);
                record = JSON.parse(record);
                callback(null, record);
            });
            return this;
        },
        post: function(table, record, callback) {
            if (!record.id) {
                record.id = uuid.v4();
            }
            this.client.hset(table, record.id, JSON.stringify(record), function(err) {
                if (err) return callback(err);
                callback(null, record);
            });
            return this;
        },
        put: function(table, id, record, callback) {
            var self = this;
            this.find(table, id, function(err, model) {
                if (err) return callback(err);
                if (!model) return callback(new Error(`No records found with id ${id} on table ${table}`));
                model = _.deepExtend(model, record);
                self.client.hset(table, id, JSON.stringify(model), function(err) {
                    if (err) return callback(err);
                    callback(null, model);
                });
            });
            return this;
        },
        delete: function(table, id, callback) {
            var self = this;
            this.find(table, id, function(err, record) {
                if (err) return callback(err);
                if (!record) return callback(new Error(`No records found with id ${id} on table ${table}`));
                self.client.hdel(table, record.id, function(err) {
                    if (err) return callback(err);
                    callback(null, record);
                });
            });
            return this;
        },
        clear: function(table, callback) {
            this.client.del(table, function(err) {
                if (err) return callback(err);
                callback(null);
            });
            return this;
        },
        startup: function(app, callback) {
            this.client = require('redis').createClient({
                host: app.get('REDIS_HOST'),
                port: app.get('REDIS_PORT'),
                db: app.get('REDIS_DB'),
                password: app.get('REDIS_PASS') || undefined,
            });
            callback();
        },
        shutdown: function(app, callback) {
            this.client.quit();
            callback(null);
        }
    };

    module.exports = RedisDatabase;

}).call(this);