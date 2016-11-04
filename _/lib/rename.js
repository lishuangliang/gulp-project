const through = require('through2');
const rename = require('./modules/rename');

module.exports = function () {
    return through.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isBuffer()) {
            file.path = rename(file.path, setting);
        }
        callback(null, file);
    });
};