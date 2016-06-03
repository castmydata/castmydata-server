var redis = require('./redis');

module.exports = {
    findById: function(path, id, callback) {
        var _index = 0;
        redis.client.lrange(path, 0, -1, function(err, records) {
            var record = records.map(function(record) {
                return JSON.parse(record);
            }).filter(function(record, index) {
                if (record.id == id) {
                    _index = index;
                    return true;
                }
                return false;
            }).pop();
            callback(null, record, _index);
        })
    },
    response: function(res, data, status) {
        var status = status || 200;
        res
            .status(status)
            .json({
                response: data
            });
    },
    handleError: function(err, res) {
        console.error(err);
        return res
            .status(500)
            .json({
                error: err
            });
    }
}