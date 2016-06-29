
var acl = function(socket) {
    this.socket = socket;
}

acl.prototype.sync = function(callback) {
    callback(null);
}

acl.prototype.post = function(record, callback) {
    callback(null);
}

acl.prototype.put = function(id, record, callback) {
    callback(null);
}

acl.prototype.delete = function(id, callback) {
    callback(null);
}

acl.prototype.clear = function(callback) {
    callback(null);
}

acl.prototype.broadcast = function(request, callback) {
    callback(null);
}

module.exports = acl;

