const pth = require('path');
const through = require('through2');
const {File, log, colors} = require('gulp-util');
const utils = require('./modules/utils');
const readFile = require('./modules/file');
const processor = require('./modules/processor');

/**
 * 处理文件匹配规则
 * @param {Object|Null} obj
 * @returns {{}}
 */
function unrelative(obj) {
    let o = {};
    for (let key in obj) {
        o[utils.unrelative(key)] = obj[key];
    }
    return o;
}

module.exports = function (options) {
    if (options instanceof Object && options.release instanceof Object) options.release = unrelative(options.release);
    if (options instanceof Object && options.uri instanceof Object) options.uri = unrelative(options.uri);
    processor.init(options); //设置处理程序配置项

    return through.obj(function (obj, encoding, callback) {
        if (obj.isBuffer()) {
            let startTime = Date.now(),
                file = readFile(obj.path);

            processor.compile(file); //编译文件

            this.push(new File({
                base: obj.cwd,
                path: pth.join(obj.cwd, file.release),
                contents: file.content
            }));

            //打印编译信息
            log('Compile', colors.blue(file.subpath), 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime)));
        }

        callback();
    });
};