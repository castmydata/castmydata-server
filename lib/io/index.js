module.exports = function(http) {

    var connection = require('./connection');

    // Create socket.io server
    var io = require('socket.io')(http);

    // Setup CORS
    io.set('origins', process.env.HTTP_ORIGIN);

    io.start = function() {
        connection(io);
    }

    return io;
}