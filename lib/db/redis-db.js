var client = require('redis').createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    db: process.env.REDIS_DB,
    password: process.env.REDIS_PASS || undefined,
});
var uuid  = require('uuid');
var _  = require('underscore');

var RedisDatabase = function() {}

RedisDatabase.prototype = {
    all: function(table, callback) {
        var that = this;
        client.lrange(table, 0, -1, function(err, records) {
            if (err) return callback(err);
            records = records.map(function(record) {
                return JSON.parse(record);
            });
            callback(null, records);
        });
        return this;
    },
    find: function(table, id, callback) {
        var that = this;
        var _index = 0;
        client.lrange(table, 0, -1, function(err, records) {
            if (err) return callback(err);
            var record = records.map(function(record) {
                return JSON.parse(record);
            }).filter(function(record, index) {
                if (record.id == id) {
                    _index = index;
                    return true;
                }
                return false;
            }).pop();
            callback(null, record, _index);
        });
        return this;
    },
    post: function(table, data, callback) {
        if(!data.id) {
            data.id = uuid.v4();
        }
        client.lpush(table, JSON.stringify(record), function(err) {
            if (err) return callback(err);
            callback(null, record);
        });
        return this;
    },
    put: function(table, id, data, callback) {
        this.find(table, id, function(err, record, index){
            if (err) return callback(err);
            if (!record) return callback(new Error('Not Found'));

            record = _.extendOwn(record, data);
            client.lset(table, index, JSON.stringify(record), function(err){
                if (err) return callback(err);
                callback(null, record);
            });
        });
        return this;
    },
    delete: function(table, id, callback) {
        var that = this;
        this.find(table, id, function(err, record, index){
            if(err) return callback(err);
            if (!record) return callback(new Error('Not Found'));
            
            client.lset(table, index, '__deleted__', function(err) {
                if (err) return callback(err);
                client.lrem(table, 0, '__deleted__', function(err) {
                    if (err) return callback(err);
                    callback(null, record);
                });
            });
        });
        return this;
    },
}

module.exports = RedisDatabase;