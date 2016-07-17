// jshint esversion: 6
(function(){
    'use strict';

    function DB(app) {
        this.app = app;
    }

    DB.prototype.register = function(app) {
        if (!app.options.db) {
            app.options.db = new(require('./redis-db'))(app);
        }
        app.db = app.options.db;
        console.log(`Registering ${app.db.name} Database`);
        if (app.db.register) {
            app.db.register(app);
        }
    };

    DB.prototype.startup = function(app, callback) {
        console.log(`Starting Up ${app.db.name} Database`);
        app.db.startup(app, callback);
    };

    DB.prototype.shutdown = function(app, callback) {
        console.log(`Shutting Down ${app.db.name} Database`);
        app.db.shutdown(app, callback);
    };

    module.exports = DB;

}).call(this);