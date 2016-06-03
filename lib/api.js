module.exports = function() {

    var bodyParser = require('body-parser');
    var express    = require('express');
    var utils      = require('./utils');
    var redis      = require('./redis');
    var uuid       = require('uuid');
    var path       = require('path');
    var http       = null;
    var cors       = require('cors');
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

    // Load API stuff only if API_ENABLED is true
    if(process.env.API_ENABLED && process.env.API_ENABLED.toLowerCase() == 'true') {
        
        // Check for Auth Token
        if (!process.env.API_TOKEN || process.env.API_TOKEN == 'RANDOM STRING HERE')
            throw "Invalid API_TOKEN in .env";

        api.use(function(req, res, next){
            if(req.get('Authorization') !== ('Bearer ' + process.env.API_TOKEN)) {
                return res.sendStatus(403);
            }
            next();
        });

        // Setup CORS
        if(process.env.HTTP_ORIGIN == '*:*') {
            api.use(cors({
                origin: true,
                credentials: true
            }));
        } else {
            api.use(cors({
                origin: process.env.HTTP_ORIGIN,
                credentials: true
            }));
        }

        // Setup Body Parsers
        api.use(bodyParser.json());
        api.use(bodyParser.urlencoded({
            extended: true
        }));

        api.post('/db/:path', function(req, res) {
            if(!req.body.id)
                req.body.id = uuid.v4();
            redis.client.lpush(req.params.path, JSON.stringify(req.body), function(err) {
                if (err) return utils.handleError(err, res);
                redis.publisher.publish('castmydata', JSON.stringify({
                    path: req.params.path,
                    method: 'post',
                    payload: req.body
                }))
                utils.response(res, req.body, 201);
            })
        });

        api.delete('/db/:path/:id', function(req, res) {
            utils.findById(req.params.path, req.params.id, function(err, record, index) {
                if (err) return utils.handleError(err, res);
                if (!record) return res.sendStatus(404);
                redis.client.lset(req.params.path, index, '__deleted__', function(err){
                    if (err) return utils.handleError(err, res);
                    redis.client.lrem(req.params.path, 0, '__deleted__', function(err){
                        if (err) return utils.handleError(err, res);
                        redis.publisher.publish('castmydata', JSON.stringify({
                            path: req.params.path,
                            id: req.params.id,
                            method: 'delete',
                        }))
                        res.sendStatus(200);
                    });
                });
            });
        });

        api.put('/db/:path/:id', function(req, res) {
            utils.findById(req.params.path, req.params.id, function(err, record, index) {
                if (err) return utils.handleError(err, res);
                if (!record) return res.sendStatus(404);
                for(var key in req.body) {
                    record[key] = req.body[key];
                }
                redis.client.lset(req.params.path, index, JSON.stringify(record));
                redis.publisher.publish('castmydata', JSON.stringify({
                    path: req.params.path,
                    id: req.params.id,
                    payload: record,
                    method: 'put',
                }))
                utils.response(res, record);
            });
        });

        api.get('/db/:path', function(req, res) {
            redis.client.lrange(req.params.path, 0, -1, function(err, records) {
                if (err) return utils.handleError(err, res);
                records = records.map(function(record) {
                    var record = JSON.parse(record);
                    return record;
                });
                utils.response(res, records);
            });
        });

        api.get('/db/:path/:id', function(req, res) {
            utils.findById(req.params.path, req.params.id, function(err, record) {
                if (err) return utils.handleError(err, res);
                if (!record) return res.sendStatus(404);
                utils.response(res, record);
            });
        });
    } else {
        console.log('RESTful API Disabled');
    }

    // Startup Functions
    var start = function(fn) {
        return http.listen(process.env.HTTP_PORT, process.env.HTTP_BIND_ADDR, function(){
            var scheme = 'http';
            if(process.env.HTTP_SECURE.toLowerCase() == 'true') {
                scheme = 'https';
            }
            console.log(`CastMyData http listening on: ${scheme}://${process.env.HTTP_BIND_ADDR}:${process.env.HTTP_PORT}`);
            if(fn)
                fn(http);
        });
    }

    return {
        server: http,
        start,
        api
    }
}