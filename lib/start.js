module.exports = function(http, io) {
    return function(options, callback) {
        if (typeof options == 'function') {
            callback = options;
            options = {};
        } else if (typeof options == 'undefined') {
            callback = function(){};
            options = {};
        }
        
        var start = function() {
            http.start(options, function() {
                io.start(options, function() {
                    if (callback)
                        callback();
                });
            });
        };

        if (!options.db) {
            options.db = require('./db/redis-db');;
        }
        var db = new options.db(options, function(){
            process.nextTick(function(){
                options.db = db;
                start();
            });
        });
    }
}