var dotenv = require('dotenv').config();

// Require api
var http = require('./api')();

// Require socket.io
var io = require('./io')(http.server);

module.exports = {
    start: http.start,
    api: http.api,
    http: http.server,
    io
}