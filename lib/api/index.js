module.exports = function() {

    var express    = require('express');
    var bodyParser = require('body-parser');
    var routes     = require('./routes');
    var redis      = require('../redis');
    var path       = require('path');
    var http       = null;
    var api        = express();
    var fs         = require('fs');

    // use public directory
    if(process.env.HTTP_PUBLIC_DIR.toLowerCase() == 'true') {
        api.use(express.static('./public'));

        // check for index.html
        if(process.env.IGNORE_INDEX .toLowerCase() == 'false') {
            try {
                fs.statSync(path.join(__dirname, 'public', 'index.html'));
                console.log('WARNING: index.html file found in public directory. This file is meant to be only for demo purpose. Please delete in production.');
            } catch (e){}
        }
    }

    // launch HTTP or HTTPS server
    if(process.env.HTTP_SECURE.toLowerCase() == 'true') {
        http = require("https").createServer({
            cert: fs.readFileSync(process.env.HTTPS_CERT_FILE),
            key: fs.readFileSync(process.env.HTTPS_CERT_KEY),
            passphrase: process.env.HTTPS_KEY_PASS || undefined
        }, api);
    } else {
        http = require("http").createServer(api);
    }

    // Setup Body Parsers
    api.use(bodyParser.json());
    api.use(bodyParser.urlencoded({
        extended: true
    }));

    // Startup Functions
    var start = function(options) {
        routes.start(api, options);
        return http.listen(process.env.HTTP_PORT, process.env.HTTP_BIND_ADDR, function(){
            var scheme = 'http';
            if(process.env.HTTP_SECURE.toLowerCase() == 'true') {
                scheme = 'https';
            }
            console.log(`CastMyData http listening on: ${scheme}://${process.env.HTTP_BIND_ADDR}:${process.env.HTTP_PORT}`);
        });
    }

    return {
        server: http,
        start,
        api
    }
}