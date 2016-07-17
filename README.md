# CastMyData Server

**Realtime database in a jiffy.**

## Table Of Contents

1. [Features](#features)
2. [Available Plugins](#available-plugins)
3. [Available Clients](#available-clients)
4. [Requirements](#requirements)
5. [Installation](#installation)
6. [How To Use](#how-to-use)
8. [Plugin](#plugin)
7. [Access Control Lists](#access-control-lists)
9. [Data Storage](#data-storage)
10. [Configuration](#configuration)
11. [RESTful API](#restful-api)
12. [Testing](#testing)
13. [License](#license)

## Features

- Realtime client that syncs data with the server automatically using socket.io.
- Broadcasting messages
- RESTful HTTP API
- Server side access control list
- Plugin System

## Available Plugins

1. [MongoDB Backend for CastMyData](https://github.com/castmydata.castmydata-mongodb)

## Available Clients

1. [Javascript Client for CastMyData](https://github.com/castmydata/castmydata-jsclient)


## Requirements

- Redis Server: [link](http://redis.io/)
- NodeJS & NPM
- Git


## Installation

As a package:

```bash
$ npm install --save castmydata-server
$ node node_modules/castmydata-server/setup
$ npm run setup
```

As a base project:

```bash
$ git clone https://github.com/castmydata/castmydata-server.git && cd castmydata-server
$ npm install
$ npm run setup
```

Using Docker:

```bash
docker run -d --name redis -p 6374 redis:3
docker run -d -p 8080 --link redis --name castmydata-server zulfajuniadi/castmydata-server
```

A `.castmydata.env` file will be created in your directory that has configuration for castmydata-server.



## How To Use

As a package:

```javascript
// Load environment variables
var dotenv = require('dotenv').config({
    path: './.castmydata.env'
});

var CastMyData = require('castmydata-server');
var castmydata = new CastMyData({
    // options
});


// Load plugins
// Plugins are loaded according to 
castmydata.register({
    register: function(app, done) {
        // app.http: CastMyData http server
        // app.express: CastMyData api server (express app)
        // app.io: CastMyData socket.io server
        // Do Something Here
        done(); // Call done when plugin has been loaded
    }
});

// The express instance is exposed 
castmydata.express.use(function(req, res, next){
    // console.log('express middleware');
    next();
});

// And so is the socket.io instance
castmydata.io.use(function(socket, next){
    // console.log('socket.io middlware');
    next();
});

// And so is the http instance
castmydata.http.on('connect', function(){
  // do something
});

// OK LETS GO!
castmydata.start();
```

As a base project:

run `npm start` to start the server in background. Then navigate to [http://localhost:8080](http://localhost:8080) to view a sample client.

run `npm stop` to stop the running server

run `npm restart` to restart the server


## Plugin

Plugins are a core feature in CastMyData. In fact, most of the application logic behind CastMyData is [implemented as plugins](https://github.com/castmydata/castmydata-server/tree/master/lib/plugins).

CastMyData features a plugin system that are loaded during the application instantiation. Your custom plugins will be after all the core plugins has been loaded. This means that you;ll have access to express, socket.io, pubsub, nodejs http instance and all other goodies that's running in the background.

The plugin should have three functions: `register`, `startup`, and `shutdown`.

Sample plugin:

```javascript
// SamplePlugin.js
function SamplePlugin(app){
    this.app = app;
};
// Code executed when the plugin is first instantiated
SamplePlugin.prototype.register = function(app) {}
// Code executed when castmydata.start() is called
SamplePlugin.prototype.startup = function(app, done) {
    done();
}
// Code executed when castmydata.shutdown() is called
SamplePlugin.prototype.shutdown = function(app, done) {
    done();
}

module.exports = SamplePlugin;
```

Sample usage:

```javascript
var castmydata = new CastMyData();
var SamplePlugin = require('sample-plugin');
castmydata.register(new SamplePlugin(castmydata));
```

## Access Control Lists

ACL can be configured during the instantiation of the server as so:

```javascript
new castmydata({
  acl: {
    'some-db': {
      put: function(oldData, newData, callback) {
      	// only allow author to update own record
      	if(oldData.user.id != this.user().id) {
          return callback(new Error('Invalid Request'));
        }
        callback(null);
      },
    }
  }
});
```

ACL callbacks provided are:

- sync => (callback)
- post => (newData, callback)
- put => (oldData, newData, callback)
- delete => (oldData, callback)
- clear => (callback)
- listen => (channel, callback)
- unlisten => (channel, callback)
- broadcast => (request, callback)

To deny an action, call the callback with an Error argument as: `callback(new Error('Some Error'))`. If the callback is called without a first argument, the request will be processed.

In the event of the ACL error, the record will be reverted to it's original state.

## Data Storage

By default CastMyData will use Redis as the default storage. You can change the data store to your preferred choice by supplying the `db` property during start:

```js
var SomeDatabase = require('some-database');
var castmydata = new CastMyData({
    db: SomeDatabase
});
```

The database should be a Javascript function that will be instantiated during the app registering.

The database should implement all the following methods:

- register => function(app)
- startup => function(app, callback)
- all => function(tableName, callback)
- where => function(tableName, filter, callback) // filter is based on [siftJS](https://github.com/crcn/sift.js)
- find => function(tableName, id, callback)
- post => function(tableName, record, callback)
- put => function(tableName, id, record, callback)
- delete => function(tableName, id, callback)
- clear => function(tableName, callback)
- shutdown => function(app, callback)

You can view the [redis database](https://github.com/castmydata/castmydata-server/blob/master/lib/db/redis-db.js) as an example implementation.

## Configuration

### Configuration using .env file

Configurations are primarily set within the `.castmydata.env` file

Redis Configuration:

- REDIS_HOST: Your Redis host. e.g. 127.0.0.1
- REDIS_PORT: Your Redis port. e.g. 6379
- REDIS_DB: Your Redis database. e.g. 0
- REDIS_PASS: Your Redis database password.

HTTP Configuration:

- HTTP_PUBLIC_DIR: Serve files from the public path. e.g. true
- HTTP_ORIGIN: CORS origin. e.g. \*:\* [more](http://stackoverflow.com/a/21711242)
- HTTP_PORT: Binding port. e.g. 8080
- HTTP_BIND_ADDR: Binding address. e.g. localhost
- HTTP_SECURE: Use HTTPS. e.g. true
- HTTPS_CERT_FILE: Path to SSL certificate. e.g. ./certs/server.crt
- HTTPS_CERT_KEY: Path to SSL certificate private key. e.g. ./certs/server.key
- HTTPS_KEY_PASS: Password for private key
- REDIR_TO_HTTPS: Fire up a HTTP server to redirect traffic to HTTPS
- REDIR_TO_HTTPS_PORT: The HTTP redirect server port

API Configuration:

- API_ENABLED: Enable / disable RESTful API. e.g. true
- API_TOKEN: Random string for RESTful API calls

Others:

- IGNORE_INDEX: Ignore index.html file inside your public directory. e.g. false


### Configuration using the `options.config` argument

Alternatively, configurations can be overriddedn via the app `options.config` argument:

```javascript
var castmydata = new CastMyData({
    config: {
        // this will override REDIS_HOST value set 
        // in the .castmydata.env file
        REDIS_HOST: '127.0.0.1' ,
        facebook: {
            appId: 'xxxxxxx',
            accessToken: '',
        }
    }
})
```

### Get & set application config

The application configuration can be accessed via the `app.get` method. This may be useful if you want to access your configuration via a plugin or database. The `app.get` method takes two arguments:

1. The config key you want to access.
2. A default value should the config key return a falsy value

```javascript
// some plugin startup function
SomePlugin.prototype.startup = function(app, done) {
    var host = app.get('REDIS_HOST', '127.0.0.1');
    var port = app.get('REDIS_PORT', 6379); // returns 6379 as default
}
```

To access nested keys, you may use dot notation:

```javascript
FacebookAuth.prototype.startup = function(app, done) {
    var appId = app.get('facebook.appId'); // returns 'xxxxxxx'
}
```


You are able to change the application configs via the `app.set`:

```javascript

FacebookAuth.prototype.startup = function(app, done) {
    app.set('facebook.accessToken', 'yyyyyyy');
    
    console.log(app.get('facebook'));
    // returns {
    //    appId: "xxxxxxx",
    //    accessToken: "yyyyyyy"
    // }
} 
```


## RESTful API

All API calls to the server must have the `Authorization` header set to `Bearer xxx` where `xxx` is the `API_TOKEN` string in your server `.env` file.

> You will get a `403 HTTP Error` if the `Authorization` header is not sent or is  invalid

All requests' URL will begin with `/db/{dbname}` where `{dbname}` is your database name. The database will be auto created.

Once you have CastMyData server running, you can test it here: 

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/0a8e30c96e64022e8860#?env%5BCastMyData2%5D=W3sia2V5Ijoic2VydmVyIiwidmFsdWUiOiJodHRwOi8vbG9jYWxob3N0OjgwODAiLCJ0eXBlIjoidGV4dCIsImVuYWJsZWQiOnRydWUsImhvdmVyZWQiOmZhbHNlfSx7ImtleSI6InRva2VuIiwidmFsdWUiOiJCZWFyZXIgaWVpTEhJdk5DVm5lM0NZMkVpRFdLMDg5bFdvNlF1VTMiLCJ0eXBlIjoidGV4dCIsImVuYWJsZWQiOnRydWUsImhvdmVyZWQiOmZhbHNlfV0=)

> Be sure to change the server URL and Authorization token to match your environment.

### GET /db/some-db

Returns all records in the database `some-db`. 

**Request:**

```bash
$ curl -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" \
	http://localhost:8080/db/some-db
```

**Success Response:**

HTTP Code: 200

```json
{
  "response": [
    {
      "name": "Milk",
      "id": "2c90354c-e1dc-4bd0-846f-a83e78d79088"
    },
    {
      "name": "Eggs",
      "id": "7cb5696c-af0d-48c4-b48c-dfd457509b5e"
    }
  ]
}
```

### GET /db/some-db/some-id

Find record with id of `some-id` in the database `some-db`. 

**Request:**

```bash
$ curl -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" \
	http://localhost:8080/db/some-db/7cb5696c-af0d-48c4-b48c-dfd457509b5e
```

**Success Response:**

HTTP Code: 200

```json
{
  "response": {
    "name": "Eggs",
    "id": "7cb5696c-af0d-48c4-b48c-dfd457509b5e"
  }
}
```

**Failed Response (Not Found):**

HTTP Code: 404

```json
"Not Found"
```

### POST /db/some-db

Create new record inside `some-db`. 

> If the data sent does not have an id property, the system will generate one for you.

**Request:**

```bash
$ curl -X POST -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" \
	-d "name=Bread" \
	http://localhost:8080/db/some-db
```

**Success Response:**

HTTP Code: 201

```json
{
  "response": {
    "name": "Bread",
    "id": "a92981dd-395e-488f-97a0-43398e6b0c61"
  }
}
```

### PUT /db/some-db/some-id

Updates a record in `some-db` by `some-id`.

**Request:**

```bash
$ curl -X PUT -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" \
	-d "name=Fish" \
	http://localhost:8080/db/some-db/a92981dd-395e-488f-97a0-43398e6b0c61
```

**Success Response:**

HTTP Code: 200

```json
{
  "response": {
    "name": "Fish",
    "id": "a92981dd-395e-488f-97a0-43398e6b0c61"
  }
}
```

**Failed Response (Not Found):**

HTTP Code: 404

```json
"Not Found"
```

### DELETE /db/some-db/some-id

Deletes a record in `some-db` by `some-id`.

**Request:**

```bash
$ curl -X DELETE -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" \
	http://localhost:8080/db/some-db/a92981dd-395e-488f-97a0-43398e6b0c61
```

**Success Response:**

HTTP Code: 200

```json
"OK"
```

**Failed Response (Not Found):**

HTTP Code: 404

```json
"Not Found"
```

### POST /db/some-db/broadcast

Broadcasts a message to all clients connected to `some-db`

**Request:**

```bash
$ curl -X POST -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" \
	-d "payload=Hello!" \
	http://localhost:8080/db/testendpoint
```

**Success Response:**

HTTP Code: 200

```json
"OK"
```

**Failed Response (Missing Payload Parameter):**

HTTP Code: 400

```json
"Bad Request"
```

## Testing

```bash
$ npm test
  
  CastMyData Tests
  
    ✓ should be able to get root (42ms)
    ✓ should deny api request without auth token
    ✓ should be able to create a new record (40ms)
    ✓ should be able list all records
    ✓ should be able to get a record by id
    ✓ should be able to update a record by id
    ✓ should be able to delete a record by id
    ✓ should be able to clear db
    ✓ should be able to broadcast data
    ✓ should be able to subscribe
    ✓ should be able to listen to a channel
    ✓ should be able to send broadcasts
    ✓ should be able to unlisten to a channel
    ✓ should be able to create a record
    ✓ should be able to find a record by id
    ✓ should be able to query an endpoint
    ✓ should be able to update query models when a new record is created
    ✓ should be able to update a record by id
    ✓ should be able to delete a record by id
    ✓ should be able to clear db
    ✓ should be able to unsubscribe
    ✓ should be able to close connection
    
  22 passing (1s)
```

## License

The MIT License (MIT)
Copyright (c) 2016 Zulfa Juniadi bin Zulkifli

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


