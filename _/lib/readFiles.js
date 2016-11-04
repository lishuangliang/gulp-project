const through = require('through2');

module.exports = function (cb) {
    //读取到的文件
    var files = [];
    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            files.push(file);
        }
        callback();
    }, function (callback) {
        cb(files, callback);
    });
};