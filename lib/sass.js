const through = require('through2');
const sass = require('node-sass');
const utils = require('./modules/utils');

const PLUGIN_NAME = 'gulp-project.sass';

/**
 * 编译sass文件
 * @returns {*}
 */
module.exports = function () {
    return through.obj(function (file, enc, cb) {
        if (file.isBuffer() && /\.(sass|scss)$/.test(file.path)) {
            let result = sass.renderSync({
                outputStyle: 'compressed',
                indentedSyntax: false,
                data: file.contents.toString('utf8'),
                file: file.path
            });

            if (result.css) {
                file.contents = result.css;
                file.path = file.path.replace(/\.(sass|scss)$/, '.css'); //改变文件后缀
                this.push(file);
            } else {
                this.emit('error', utils.error(PLUGIN_NAME, result));
            }

            cb();
        } else {
            cb(file);
        }
    });
};