module.exports = function(http, io) {
    return function(callback) {
        http.stop(function(){
            if(callback)
                callback();
        });
    }
}