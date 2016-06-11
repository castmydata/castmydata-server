var dotenv = require('dotenv').config({path: './.castmydata.env'});

// Require api
var http = require('./lib/api')();

// Require socket.io
var io = require('./lib/io')(http.server);

// Startup script
var start = require('./lib/start')(http, io);

// Use middleware
var use = require('./lib/use')(http, io);

module.exports = {
    start: start,
    api: http.api,
    http: http.server,
    io,
    use: use
}