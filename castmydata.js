var dotenv = require('dotenv').config({path: './.castmydata.env'});

// Require api
var http = require('./lib/api')();

// Require socket.io
var io = require('./lib/io')(http.server);

module.exports = {
    start: http.start,
    api: http.api,
    http: http.server,
    io
}