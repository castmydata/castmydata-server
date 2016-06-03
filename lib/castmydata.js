var dotenv       = require('dotenv').config();
var fs           = require('fs');
var path         = require('path');
var redis        = require('redis');
var redisConfigs = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    db: process.env.REDIS_DB,
    password: process.env.REDIS_PASS || undefined,
};
var client       = redis.createClient(redisConfigs);
var publisher    = redis.createClient(redisConfigs);
var subscriber   = redis.createClient(redisConfigs);

if(process.env.IGNORE_INDEX .toLowerCase() == 'false') {
    try {
        fs.statSync(path.join(__dirname, 'public', 'index.html'));
        console.log('WARNING: index.html file found in public directory. This file is meant to be only for demo purpose. Please delete in production.');
    } catch (e){}
}

var http = require('./api')(client, publisher);
var io = require('./io')(http.server, client, publisher, subscriber);

module.exports = {
    start: http.start,
    api: http.api,
    http: http.server,
    io
}