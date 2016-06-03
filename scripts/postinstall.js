var path = require("path");
var randomstring = require("randomstring");
var token = randomstring.generate();
var fs = require('fs');

var contents = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8').replace('RANDOM STRING HERE', token);
fs.writeFileSync('.castmydata.env', contents);

console.log('Done... API Token is: ' + token);