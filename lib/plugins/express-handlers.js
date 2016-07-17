// jshint esversion: 6
(function(){
    'use strict';

    var _ = require('underscore');
    var express = require('express');

    function ExpressHandlers (app) {
        this.app = app;
    }

    ExpressHandlers.prototype.response = function(res, data, status) {
        res.status(status || 200).json({
            response: data
        });
    };

    ExpressHandlers.prototype.handleError = function(err, res) {
        res.status(500).json({
            error: err.message,
            stack: err.stack
        });
    };

    ExpressHandlers.prototype.startup = function(app, done) {
        var router = express.Router();
        var self = this;

        console.log('Starting Up Express Handlers');

        // Check for Auth Token
        if (app.get('API_USE_TOKEN')) {
            if (!app.get('API_TOKEN') || app.get('API_TOKEN') == 'RANDOM STRING HERE')
                throw "Invalid API_TOKEN in .env";
            router.use(function(req, res, next) {
                if (req.get('Authorization') !== ('Bearer ' + app.get('API_TOKEN'))) {
                    return res.sendStatus(403);
                }
                next();
            });
        }

        // Bind ACL
        app.acl.bindMiddleware(router);

        router.get('/:path', function(req, res) {
            var query = req.query.query || {};
            app.db.where(req.params.path, query, function(err, records) {
                if (err) return self.handleError(err, res);
                self.response(res, records);
            });
        });

        router.get('/:path/clear', function(req, res) {
            app.db.clear(req.params.path, function(err) {
                if (err) return self.handleError(err, res);
                self.response(res);
            });
        });

        router.get('/:path/:id', function(req, res) {
            app.db.find(req.params.path, req.params.id, function(err, record) {
                if (err) return self.handleError(err, res);
                if (!record) return res.sendStatus(404);
                self.response(res, record);
            });
        });

        router.post('/:path', function(req, res) {
            req.body.meta = req.body.meta || {};
            _.extend(req.body.meta, {
                synced: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                deletedAt: null,
            });
            app.db.post(req.params.path, req.body, function(err, record) {
                if (err) return self.handleError(err, res);
                app.pubsub.emit('castmydata#' + req.params.path + ':post', record);
                self.response(res, record, 201);
            });
        });

        router.put('/:path/:id', function(req, res) {
            app.db.put(req.params.path, req.params.id, req.body, function(err, record) {
                if (err) return self.handleError(err, res);
                app.pubsub.emit('castmydata#' + req.params.path + ':put', record);
                self.response(res, record);
            });
        });

        router.delete('/:path/:id', function(req, res) {
            app.db.delete(req.params.path, req.params.id, function(err, record) {
                if (err) return self.handleError(err, res);
                app.pubsub.emit('castmydata#' + req.params.path + ':delete', record);
                self.response(res, record);
            });
        });

        router.post('/:path/broadcast', function(req, res) {
            if (!req.body.payload) return res.sendStatus(400);
            if (!req.body.channel) return res.sendStatus(400);
            app.pubsub.emit('castmydata#' + req.params.path + ':broadcast', {
                channel: req.body.channel,
                payload: req.body.payload,
            });
            res.sendStatus(200);
        });

        app.express.use('/db', router);

        done(null);
    };

    module.exports = ExpressHandlers;

}).call(global);