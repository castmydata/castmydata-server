module.exports = function(http, io) {
    return function(middleware) {
        middleware.init(http, io);
    }
}