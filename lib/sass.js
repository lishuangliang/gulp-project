const pth = require('path');
const {spawn} = require('child_process');
const through = require('through2');
const sass = require('./modules/node-sass');
const utils = require('./modules/utils');

const PLUGIN_NAME = 'gulp-project.sass';

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
            let code = spawn(pathToGlobalSass, [file.path].concat(args), {env: sass.env});
            code.stdout.on('data', (data)=> {
                file.contents = data;
                file.path = file.path.replace(/\.(sass|scss)$/, '.css'); //改变文件后缀
                this.push(file);
            });
            code.on('error', (err)=> this.emit('error', utils.error(PLUGIN_NAME, err)));
            code.on('close', ()=> cb());
        } else {
            cb(file);
        }
    });
};