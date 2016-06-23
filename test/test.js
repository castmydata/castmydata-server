var should = require('should');
var request = require('request');
var url = 'http://localhost:8080';
var apiUrl = url + '/db/testendpoint/';
var dotenv = require('dotenv').config({
    path: './.castmydata.env'
});
var client = require('../../castmydata-jsclient/src/castmydata');
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
        endpoint = new client.Endpoint(url, 'testendpoint');
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

    it('should deny api request without auth token', function(done){
        request(apiUrl, function(error, response, body){
            response.statusCode.should.eql(403);
            body.should.eql('Forbidden');
            done();
        });
    });

    var id;
    it('should be able to create a new record', function(done) {
        api.post(apiUrl, function(error, response, body){
            var data = JSON.parse(body);
            response.statusCode.should.eql(201);
            data.should.have.propertyByPath('response', 'title').eql('Buy Milk');
            data.response.id.should.be.ok();
            id = data.response.id;
            done();
        }).form({
            title: 'Buy Milk',
        });
    });

    it('should be able list all records', function(done){
        api.get(apiUrl, function(err, response, body){
            var data = JSON.parse(body);
            response.statusCode.should.eql(200);
            data.should.have.property('response');
            data.response.length.should.be.ok();
            done();
        });
    });

    it('should be able to get a record by id', function(done){
        api.get(apiUrl + id, function(err, response, body){
            var data = JSON.parse(body);
            response.statusCode.should.eql(200);
            data.should.have.propertyByPath('response', 'title').eql('Buy Milk');
            data.response.id.should.be.eql(id);
            done();
        });
    });

    it('should be able to update a record by id', function(done){
        api.put(apiUrl + id, function(err, response, body){
            var data = JSON.parse(body);
            response.statusCode.should.eql(200);
            data.should.have.propertyByPath('response', 'title').eql('Buy Eggs');
            data.response.id.should.be.eql(id);
            done();
        }).form({
            title: 'Buy Eggs',
        });
    });

    it('should be able to delete a record by id', function(done){
        api.delete(apiUrl + id, function(err, response, body){
            var data = JSON.parse(body);
            response.statusCode.should.eql(200);
            data.response.id.should.be.eql(id);
            done();
        });
    });

    it('should be able to broadcast data', function(done){
        api.post(apiUrl + 'broadcast', function(err, response, body){
            response.statusCode.should.eql(200);
            done();
        }).form({
            payload: 'Hello World',
        });
    });

    it('should be able to subscribe', function(done){
        endpoint.subscribe().should.be.ok();
        endpoint.on('records', function(data){
            data.should.be.an.Array();
            done();
        }).should.be.ok();
    });

    var id;
    it('should be able to create a record', function(done){
        endpoint.on('post', function(data){
            data.should.have.property('title').eql('Buy Milk');
            data.id.should.be.ok();
            id = data.id;
            done();
        });
        endpoint.post({
            title: 'Buy Milk'
        });
    });

    it('should be able to update a record by id', function(done){
        endpoint.on('put', function(data){
            data.should.have.property('title').eql('Buy Bread');
            data.id.should.eql(id);
            done();
        }).should.be.ok();
        endpoint.put(id, {
            title: 'Buy Bread'
        }).should.be.ok();
    });

    it('should be able to delete a record by id', function(done){
        endpoint.on('delete', function(data){
            data.should.have.property('title').eql('Buy Bread');
            data.id.should.eql(id);
            done();
        }).should.be.ok();
        endpoint.delete(id).should.be.ok();
    });

    it('should be able to send broadcasts', function(done){
        endpoint.on('broadcast', function(message){
            message.should.have.property('payload').eql('Hello World!');
            done();
        }).should.be.ok();
        endpoint.broadcast({
            payload: 'Hello World!'
        }).should.be.ok();
    });

    it('should be able to unsubscribe', function(done){
        endpoint.unsubscribe().should.be.ok();
        done();
    });

    it('should be able to close connection', function(done){
        endpoint.close().should.be.ok();
        done();
    });
});