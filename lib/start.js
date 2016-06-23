module.exports = function(http, io) {
    return function(options, callback) {
        if(typeof options == 'function') {
            callback = options;
            options = {};
        } else if (typeof options == 'undefined') {
            options = {};
        }
        if (!options.db) {
            options.db = new(require('./db/redis-db'));
        }
        http.start(options, function(){
            io.start(options, function(){
                if(callback)
                    callback();
            });
        });
    }
}