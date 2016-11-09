const pth = require('path');
const through = require('through2');
const {File} = require('gulp-util');
const processor = require('./modules/processor');

const PLUGIN_NAME = 'gulp-project.compile';

/**
 * 编译文件
 * @param options
 * @returns {*}
 */
module.exports = function (options) {
    processor.init(Object.assign({
        PLUGIN_NAME: PLUGIN_NAME
    }, options)); //设置处理程序配置项

    return through.obj(function (file, enc, cb) {
        if (file.isBuffer()) {
            let newFile = processor.compile(file.path);

            this.push(new File({
                base: file.cwd,
                path: pth.join(file.cwd, newFile.release),
                contents: newFile.content
            }));
        }

        cb();
    });
};