module.exports = function(http, io) {
    return function(options) {
        var options = options || {};
        if(!options.db) {
            options.db = new (require('./db/redis-db'));
        }
        http.start(options);
        io.start(options);
    }
}