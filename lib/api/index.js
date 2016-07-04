module.exports = function() {

    var express = require('express');
    var bodyParser = require('body-parser');
    var routes = require('./routes');
    var redis = require('../redis');
    var path = require('path');
    var url = require('url');
    var http = null;
    var api = express();
    var fs = require('fs');

    // use public directory
    if (process.env.HTTP_PUBLIC_DIR.toLowerCase() == 'true') {
        api.use(express.static('./public'));

        // check for index.html
        if (process.env.IGNORE_INDEX.toLowerCase() == 'false') {
            try {
                fs.statSync(path.join(__dirname, 'public', 'index.html'));
                console.log('WARNING: index.html file found in public directory. This file is meant to be only for demo purpose. Please delete in production.');
            } catch (e) {}
        }
    }

    // launch HTTP or HTTPS server
    if (process.env.HTTP_SECURE.toLowerCase() == 'true') {
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
    var start = function(options, callback) {
        routes.start(api, options);
        return http.listen(process.env.HTTP_PORT, process.env.HTTP_BIND_ADDR, function() {
            var scheme = 'http';
            if (process.env.HTTP_SECURE.toLowerCase() == 'true') {
                scheme = 'https';
            }
            if (typeof global.it != 'function') {
                console.log(`CastMyData http listening on: ${scheme}://${process.env.HTTP_BIND_ADDR}:${process.env.HTTP_PORT}`);
            }
            if (callback) {
                if(scheme == 'https' && process.env.REDIR_TO_HTTPS.toLowerCase() == 'true') {
                    require('http').createServer(function(req, res){
                        var parts = url.parse(req.url);
                        res.writeHead(302, {
                            'Location': `https://${parts.hostname}:${process.env.HTTP_PORT}${parts.path}`
                        });
                        res.end();
                    }).listen(process.env.REDIR_TO_HTTPS_PORT, process.env.HTTP_BIND_ADDR, callback)
                } else {
                    callback();
                }
            }
        });
    }

    return {
        server: http,
        stop: function(callback) {
            http.close(function() {
                if (callback)
                    callback();
            });
        },
        start,
        api
    }
}