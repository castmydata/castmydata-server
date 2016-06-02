# CastMyData Server

**Realtime database in one line.**

```javascript
NgCastMyDataEndpoint('testendpoint').bindToScope($scope, 'records');
// that's all folks!
```

## Requirements
- Redis Server [link](http://redis.io/)


## Features

- Realtime client that syncs data with the server automatically using socket.io.
- RESTful HTTP API

## How to use

run `npm start` to start the server in background. Then navigate to [http://localhost:8080](http://localhost:8080) to view a sample client.

run `npm stop` to stop the running server

run `npm restart` to restart the server

## Configuration

Configurations are set in the `.env` file

Redis	Configuration:

- REDIS_HOST: Your Redis host. e.g. 127.0.0.1
- REDIS_PORT: Your Redis port. e.g. 6379
- REDIS_DB: Your Redis database. e.g. 0
- REDIS_PASS: Your Redis database password.

HTTP Configuration:

- HTTP_ORIGIN: CORS origin. e.g. \*:\* [more](http://stackoverflow.com/a/21711242)
- HTTP_PORT: Binding port. e.g. 8080
- HTTP_BIND_ADDR: Binding address. e.g. localhost
- HTTP_SECURE: Use HTTPS. e.g. true
- HTTPS_CERT_FILE: Path to SSL certificate. e.g. ./certs/server.crt
- HTTPS_CERT_KEY: Path to SSL certificate private key. e.g. ./certs/server.key
- HTTPS_KEY_PASS: Password for private key

API Configuration:

- API_ENABLED: Enable / disable RESTful API. e.g. true
- API_TOKEN: Random string for RESTful API calls

## RESTful API

All API calls to the server must have the `Authorization` header set to `Bearer xxx` where `xxx` is the `API_TOKEN` string in your server `.env` file.

You will get a `403 HTTP Error` if the `Authorization` header is not sent or is invalid:


```json
"Forbidden"
```

All requests' URL will begin with `/db/{dbname}` where `{dbname}` is your database name. The database will be auto created.

Once you have CastMyData server running, you can test it here: 

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/0a8e30c96e64022e8860#?env%5BCastMyData2%5D=W3sia2V5Ijoic2VydmVyIiwidmFsdWUiOiJodHRwOi8vbG9jYWxob3N0OjgwODAiLCJ0eXBlIjoidGV4dCIsImVuYWJsZWQiOnRydWUsImhvdmVyZWQiOmZhbHNlfSx7ImtleSI6InRva2VuIiwidmFsdWUiOiJCZWFyZXIgaWVpTEhJdk5DVm5lM0NZMkVpRFdLMDg5bFdvNlF1VTMiLCJ0eXBlIjoidGV4dCIsImVuYWJsZWQiOnRydWUsImhvdmVyZWQiOmZhbHNlfV0=)

Be sure to change the server URL and Authorization token to match your environment.

### GET /db/some-db

Returns all records in the database `some-db`. 

**Request:**

```bash
$ curl -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" http://localhost:8080/db/some-db
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
$ curl -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" http://localhost:8080/db/some-db/7cb5696c-af0d-48c4-b48c-dfd457509b5e
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

Create new record inside `some-db`. If the data sent does not have an ID, the system will generate one for you.

**Request:**

```bash
$ curl -X POST -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" http://localhost:8080/db/testendpoint -d "name=Bread"
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
$ curl -X PUT -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" http://localhost:8080/db/some-db/a92981dd-395e-488f-97a0-43398e6b0c61 -d "name=Fish"
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
$ curl -X DELETE -H "Authorization:Bearer ieiLHIvNCVne3CY2EiDWK089lWo6QuU3" http://localhost:8080/db/some-db/a92981dd-395e-488f-97a0-43398e6b0c61
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

## CastMyData Clients

Javascript:

- `castmydata.js` vanilla CastMyCode javascript client. Can be used on both client-side and server-side.
- `ng-castmydata.js` Angular 1 extensions for CastMyCode client.

## License

The MIT License (MIT)
Copyright (c) 2016 Zulfa Juniadi bin Zulkifli

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.










