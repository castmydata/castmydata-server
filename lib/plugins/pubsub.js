// jshint esversion: 6
(function(){
    'use strict';

    var PubSub = function(app) {
        this.app = app;
    };

    PubSub.prototype.register = function(app) {
        if (!app.options.pubsub) {
            app.options.pubsub = new(require('./redis-pubsub'))(app);
        }
        app.pubsub = app.options.pubsub;
        console.log(`Registering ${app.pubsub.name} PubSub`);
    };

    PubSub.prototype.startup = function(app, callback) {
        console.log(`Starting Up ${app.pubsub.name} PubSub`);
        if (app.pubsub.startup) {
            app.pubsub.startup(app, callback);
        }
    };

    PubSub.prototype.shutdown = function(app, callback) {
        console.log(`Shutting Down ${app.pubsub.name} PubSub`);
        if (app.pubsub.shutdown) {
            app.pubsub.shutdown(app, callback);
        }
    };

    module.exports = PubSub;

}).call(global);