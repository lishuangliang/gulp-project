const through = require('through2');
const rename = require('./modules/rename');

const PLUGIN_NAME = 'gulp-project.rename';

module.exports = function (obj) {
    return through.obj(function (file, enc, cb) {
        file.path = rename(file.path, obj);

        if (file.sourceMap) {
            file.sourceMap.file = file.relative;
        }

        cb(null, file);
    });
};