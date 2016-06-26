var should = require('should');
var client = require('castmydata-jsclient');
var request = require('request');
var url = 'http://localhost:8080';
var apiUrl = url + '/db/mochatest/';
var dotenv = require('dotenv').config({
    path: './.castmydata.env'
});
var endpoint;

describe('CastMyData Tests', function() {

    var castmydata = require('../castmydata');

    this.timeout(5000);

    var api = request.defaults({
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Bearer ' + process.env.API_TOKEN
        }
    })

    before(function(done) {
        endpoint = new client.Endpoint(url, 'mochatest');
        castmydata.start(done);
    });

    after(function(done) {
        this.timeout = 10000;
        endpoint.close();
        castmydata.stop(done);
    });

    it('should be able to get root', function(done) {
        request(url, function(error, response, body) {
            response.statusCode.should.eql(200);
            body.should.startWith('<!DOCTYPE html>');
            done();
        });
    });

    it('should deny api request without auth token', function(done) {
        request(apiUrl, function(error, response, body) {
            response.statusCode.should.eql(403);
            body.should.eql('Forbidden');
            done();
        });
    });

    var id;
    it('should be able to create a new record', function(done) {
        api.post(apiUrl, function(error, response, body) {
            var data = JSON.parse(body);
            response.statusCode.should.eql(201);
            data.should.have.propertyByPath('response', 'attributes', 'title').eql('Buy Milk');
            data.should.have.propertyByPath('response', 'meta', 'createdAt').should.be.ok();
            data.response.id.should.be.ok();
            id = data.response.id;
            done();
        }).form({
            attributes: {
                title: 'Buy Milk'
            }
        });
    });

    it('should be able list all records', function(done) {
        api.get(apiUrl, function(err, response, body) {
            var data = JSON.parse(body);
            response.statusCode.should.eql(200);
            data.should.have.property('response');
            data.response.length.should.be.ok();
            done();
        });
    });

    it('should be able to get a record by id', function(done) {
        api.get(apiUrl + id, function(err, response, body) {
            var data = JSON.parse(body);
            response.statusCode.should.eql(200);
            data.should.have.propertyByPath('response', 'attributes', 'title').eql('Buy Milk');
            data.should.have.propertyByPath('response', 'meta', 'createdAt').should.be.ok();
            data.response.id.should.be.eql(id);
            done();
        });
    });

    it('should be able to update a record by id', function(done) {
        api.put(apiUrl + id, function(err, response, body) {
            var data = JSON.parse(body);
            response.statusCode.should.eql(200);
            data.should.have.propertyByPath('response', 'attributes', 'title').eql('Buy Eggs');
            data.should.have.propertyByPath('response', 'meta', 'updatedAt').should.be.ok();
            data.response.id.should.be.eql(id);
            done();
        }).form({
            attributes: {
                title: 'Buy Eggs'
            }
        });
    });

    it('should be able to delete a record by id', function(done) {
        api.delete(apiUrl + id, function(err, response, body) {
            var data = JSON.parse(body);
            response.statusCode.should.eql(200);
            data.response.id.should.be.eql(id);
            data.should.have.propertyByPath('response', 'meta', 'deletedAt').should.be.ok();
            done();
        });
    });

    it('should be able to clear db', function(done) {
        api.get(apiUrl + 'clear', function(err, response) {
            response.statusCode.should.eql(200);
            done();
        });
    });

    it('should be able to broadcast data', function(done) {
        api.post(apiUrl + 'broadcast', function(err, response, body) {
            response.statusCode.should.eql(200);
            done();
        }).form({
            payload: 'Hello World',
        });
    });

    it('should be able to subscribe', function(done) {
        this.slow(2000);
        endpoint.subscribe().should.be.ok();

        function handle(data) {
            data.should.be.an.Array();
            endpoint.off('sync', handle).should.be.ok();
            done();
        }
        endpoint.on('sync', handle).should.be.ok();
    });

    var id;
    it('should be able to create a record', function(done) {
        function handle(data) {
            data.should.have.propertyByPath('attributes', 'title').eql('Buy Eggs');
            data.should.have.propertyByPath('meta', 'createdAt').should.be.ok();
            data.id.should.be.ok();
            id = data.id;
            endpoint.off('post', handle).should.be.ok();
            done();
        }
        endpoint.on('post', handle);
        endpoint.post({
            attributes: {
                title: 'Buy Eggs'
            }
        });
    });

    it('should be able to find a record by id', function(done) {
        var model = endpoint.find(id);
        model.should.be.ok();
        model.id.should.eql(id);
        done();
    });

    var query;
    it('should be able to query an endpoint', function(done) {
        query = endpoint.where(function(model) {
            return model.attributes.title == 'Buy Eggs';
        });
        query.models.length.should.be.eql(1);
        query.models[0].id.should.eql(id);
        done();
    });

    var id2;
    it('should be able to update query models when a new record is created', function(done) {
        function handle(data) {
            query.models.length.should.be.eql(2);
            id2 = data.id;
            endpoint.off('post', handle).should.be.ok();
            done();
        }
        query.on('post', handle);
        endpoint.post({
            attributes: {
                title: 'Buy Eggs'
            }
        });
    });

    it('should be able to update a record by id', function(done) {
        function handle(data) {
            data.should.have.propertyByPath('attributes', 'title').eql('Buy Bread');
            data.should.have.propertyByPath('meta', 'updatedAt').should.be.ok();
            data.id.should.eql(id);
            query.models.length.should.eql(1);
            endpoint.off('put', handle).should.be.ok();
            done();
        }
        endpoint.on('put', handle).should.be.ok();
        endpoint.put(id, {
            attributes: {
                title: 'Buy Bread'
            }
        }).should.be.ok();
    });

    it('should be able to delete a record by id', function(done) {
        function handleEndpoint(data) {
            data.should.have.propertyByPath('attributes').should.not.have.property('name');
            data.should.have.propertyByPath('meta', 'deletedAt').should.be.ok();
            data.id.should.eql(id2);
            endpoint.off('delete', handleEndpoint);
        }

        function handleQuery(data) {
            query.models.length.should.eql(0);
            query.off('delete', handleQuery).should.be.ok();
            done();
        }
        endpoint.on('delete', handleEndpoint).should.be.ok();
        query.on('delete', handleQuery).should.be.ok();
        endpoint.delete(id2).should.be.ok();
    });

    it('should be able to send broadcasts', function(done) {
        endpoint.on('broadcast', function(message) {
            message.should.have.property('payload').eql('Hello World!');
            done();
        }).should.be.ok();
        endpoint.broadcast({
            payload: 'Hello World!'
        }).should.be.ok();
    });

    it('should be able to clear db', function(done) {
        endpoint.on('clear', function() {
            endpoint.models.length.should.eql(0);
            done();
        }).should.be.ok();
        endpoint.clear().should.be.ok();
    });

    it('should be able to close connection', function(done) {
        endpoint.close().should.be.ok();
        done();
    });
});