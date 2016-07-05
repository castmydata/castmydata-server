
var acl = function(socket, defaults) {
    this.socket = socket;
    if(defaults.sync) {
        this.sync = defaults.sync;
    }
    if(defaults.post) {
        this.post = defaults.post;
    }
    if(defaults.put) {
        this.put = defaults.put;
    }
    if(defaults.delete) {
        this.delete = defaults.delete;
    }
    if(defaults.clear) {
        this.clear = defaults.clear;
    }
    if(defaults.listen) {
        this.listen = defaults.listen;
    }
    if(defaults.unlisten) {
        this.unlisten = defaults.unlisten;
    }
    if(defaults.broadcast) {
        this.broadcast = defaults.broadcast;
    }
}

acl.prototype.sync = function(callback) {
    callback(null);
}

acl.prototype.post = function(newData, callback) {
    callback(null);
}

acl.prototype.put = function(oldData, newData, callback) {
    callback(null);
}

acl.prototype.delete = function(oldData, callback) {
    callback(null);
}

acl.prototype.clear = function(callback) {
    callback(null);
}

acl.prototype.listen = function(channel, callback) {
    callback(null);
}

acl.prototype.unlisten = function(channel, callback) {
    callback(null);
}

acl.prototype.broadcast = function(request, callback) {
    callback(null);
}

module.exports = acl;

