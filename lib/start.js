module.exports = function(http, io) {
    return function() {
        http.start();
        io.start();
    }
}