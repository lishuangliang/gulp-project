const pth = require('path');
const fs = require('fs');
const {exec} = require('child_process');
const through = require('through2');
const sass = require('./modules/node-sass');
const utils = require('./modules/utils');

const PLUGIN_NAME = 'gulp-project.sass';

/**
 * 编译sass文件
 * @param {Object} options 查看sass命令行参数 不支持-o 和 --output
 * @returns {*}
 */
module.exports = function (options) {
    options = Object.assign({
        '--output-style': 'compressed',
    }, options);
    delete options['-o'];
    delete options['--output'];

    let pathToGlobalSass = pth.join(sass.path, 'bin', 'node-sass'),
        args = [];

    for (let key in options) {
        args.push(key);
        args.push(options[key]);
    }

    return through.obj(function (file, enc, cb) {
        if (file.isBuffer() && /\.(sass|scss)$/.test(file.path)) {
            //使用全局sass编译文件的控制台信息被裁剪 未找到解决方案 maxBuffer不能解决
            //所以只能设置输出 在提取内容
            exec(`${pathToGlobalSass} ${args.join(' ')} ${file.path} -o ${file.dirname}`, {
                maxBuffer: 2000 * 1024,
                env: sass.env
            }, (err, stdout, stderr)=> {
                if (err) {
                    this.emit('error', utils.error(PLUGIN_NAME, err));
                } else {
                    let path = file.path.replace(/\.(sass|scss)$/, '.css'); //文件输出路径
                    if (fs.existsSync(path)) {
                        file.contents = fs.readFileSync(path);
                        file.path = file.path.replace(/\.(sass|scss)$/, '.css'); //改变文件后缀
                        this.push(file);
                        fs.unlinkSync(path); //删除输出文件
                    }
                }
                cb();
            });
        } else {
            cb(file);
        }
    });
};