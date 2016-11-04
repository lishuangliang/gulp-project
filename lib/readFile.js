const through = require('through2');

const PLUGIN_NAME = 'gulp-project.readFile';

/**
 * 读取文件
 * @param {Function} callback 回调函数
 * @returns {*}
 */
module.exports = function (callback) {
    var files = []; //文件列表

    return through.obj(function (file, enc, cb) {
        if (file.isBuffer()) {
            files.push(file);
        }

        this.push(file);

        cb();
    }, function (cb) {
        callback(files, cb);
    });
};
