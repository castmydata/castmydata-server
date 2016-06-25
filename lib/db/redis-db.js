var client = require('redis').createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    db: process.env.REDIS_DB,
    password: process.env.REDIS_PASS || undefined,
});
var uuid = require('uuid');
var _ = require('underscore');
var underscoreDeepExtend = require('underscore-deep-extend');
_.mixin({
    deepExtend: underscoreDeepExtend(_)
});

var RedisDatabase = function() {}

RedisDatabase.prototype = {
    all: function(table, callback) {
        var that = this;
        client.hgetall(table, function(err, records) {
            if (err) return callback(err);
            if (!records) {
                records = {};
            }
            records = _.map(records, function(record) {
                return JSON.parse(record);
            });
            callback(null, records);
        });
        return this;
    },
    find: function(table, id, callback) {
        var that = this;
        var _index = 0;
        client.hget(table, id, function(err, record) {
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
        client.hset(table, record.id, JSON.stringify(record), function(err) {
            if (err) return callback(err);
            callback(null, record);
        });
        return this;
    },
    put: function(table, id, record, callback) {
        this.find(table, id, function(err, model) {
            if (err) return callback(err);
            if (!model) return callback(new Error('Not Found'));
            model = _.deepExtend(model, record, {
                meta: {
                    updatedAt: Date.now(),
                    synced: true
                }
            });
            client.hset(table, id, JSON.stringify(model), function(err) {
                if (err) return callback(err);
                callback(null, model);
            });
        });
        return this;
    },
    delete: function(table, id, callback) {
        var that = this;
        this.find(table, id, function(err, record) {
            if (err) return callback(err);
            if (!record) return callback(new Error('Not Found'));
            record.attributes = {};
            record.meta.deletedAt = Date.now();
            record.meta.synced = true;
            client.hset(table, record.id, JSON.stringify(record), function(err) {
                if (err) return callback(err);
                callback(null, record);
            });
        });
        return this;
    },
    clear: function(table, callback) {
        var that = this;
        client.del(table, function(err) {
            if (err) return callback(err);
            callback(null);
        });
        return this;
    },
}

module.exports = RedisDatabase;