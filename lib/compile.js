const pth = require('path');
const through = require('through2');
const {File, log, colors} = require('gulp-util');
const processor = require('./modules/processor');

const PLUGIN_NAME = 'gulp-project.compile';

module.exports = function (options) {
    processor.init({
        PLUGIN_NAME: PLUGIN_NAME
    }, options); //设置处理程序配置项

    return through.obj(function (file, enc, cb) {
        if (file.isBuffer()) {
            //打印编译信息
            log('Compile', colors.blue(file.subpath));

            let newFile = processor.compile(file.path);

            this.push(new File({
                base: obj.cwd,
                path: pth.join(obj.cwd, newFile.release),
                contents: newFile.content
            }));
        }

        cb();
    });
};