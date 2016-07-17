// Load environment variables
var dotenv = require('dotenv').config({
    path: './.castmydata.env'
});

var CastMyData = require('./lib/castmydata');
var castmydata = new CastMyData();

// Load plugins
// Plugins are loaded before startup of expressjs and socket.io
castmydata.register({
    register: function(app) {
        console.log('Registering Custom Plugin');
        // register will be call when the plugin is loaded
    },
    startup: function(app, done) {
        console.log('Starting Up Custom Plugin');
        // startup is called when the server.startup is called
        // app.http: CastMyData http server
        // app.express: CastMyData api server (express app)
        // app.io: CastMyData socket.io server
        // app.options: Options passed during CastMyData's instantiation
        // Do Something Here
        done(); // Call done when plugin has been loaded
    },
    shutdown: function(app, done) {
        console.log('Shutting Down Custom Plugin');
        done();
    }
});

// The express instance is exposed
castmydata.express.use(function(req, res, next) {
    // console.log('express middleware');
    next();
});

// And so is the socket.io instance
castmydata.io.use(function(socket, next) {
    // console.log('socket.io middlware');
    next();
});

// // And so is the http instance
castmydata.http.on('connect', function() {
    // do something
});

// OK LETS GO!
castmydata.startup();

process.on('SIGINT', function() {
    console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
    castmydata.shutdown(function(){
        process.exit();
    });
});