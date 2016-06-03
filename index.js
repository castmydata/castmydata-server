var castmydata = require('./lib/castmydata');

// The express castmydata is exposed 
castmydata.api.use(function(req, res, next){
    // console.log('express middleware');
    next();
});

// And so is the socket.io castmydata
castmydata.io.use(function(socket, next){
    // console.log('socket.io middlware');
    next();
});

// And so is the http castmydata
castmydata.http.on('connect', function(){
  // do something
});

// OK LETS GO!
castmydata.start();