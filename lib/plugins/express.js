// jshint esversion: 6
(function(){
    'use strict';

    var express = require('express');
    var bodyParser = require('body-parser');
    var cors = require('cors');

    function Express(app) {
        this.app = app;
        app.express = express();
    }

    Express.prototype.startup = function(app, done) {
        console.log('Starting Up Express server');
        // Setup Public Dir
        if (app.get('HTTP_PUBLIC_DIR')) {
            app.express.use(express.static(app.get('HTTP_PUBLIC_PATH')));
        }
        // Setup Body Parsers
        app.express.use(bodyParser.json());
        app.express.use(bodyParser.urlencoded({
            extended: true
        }));
        // Setup CORS
        var origin = (app.get('HTTP_ORIGIN') == '*:*' ? true : app.get('HTTP_ORIGIN'));
        if (origin) {
            app.express.use(cors({
                origin: origin,
                credentials: true
            }));
        }
        done();
    };

    module.exports = Express;

}).call(global);