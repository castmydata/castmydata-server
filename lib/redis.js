var redis = require('redis');
var redisConfigs = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    db: process.env.REDIS_DB,
    password: process.env.REDIS_PASS || undefined,
};
var publisher = redis.createClient(redisConfigs);
var subscriber = redis.createClient(redisConfigs);

module.exports = {
    publisher,
    subscriber
}