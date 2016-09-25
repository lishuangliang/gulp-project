'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (options, tokens, compress = false) {
    //tinify 图片压缩tokens
    process.env.AUTH_TOKENS = tokens || ['L5Iyfv0_IJkc26IFIxfkUcUBmo9bE-xH', 'o3u-F7z6a0Ik2540_f0nyMgauqWGyIUM', 'kcSI-3W3Ktvkl-m6WoGULcrynTA_X6Ig', 'sM5ymb1YuwI5TkFKQNPyiS6t0kMsRT3p'];
    //是否使用tinify压缩
    process.env.COMPRESS = compress ? '1' : '';

    //编译选项
    process.env.COMPILE = JSON.stringify(Object.assign({
        cwd: process.cwd(),
        www: '',
        hash: true,
        env: 0
    }, options));

    return _through2.default.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(_utils2.default.error('Cannot use streamed file', file.path));
        }

        if (file.isBuffer()) {
            (0, _gulpUtil.log)('Compile', _gulpUtil.colors.blue(file.path));
            file.files = []; //用来存储副文件
            compile(file).then(file => {
                for (let f of file.files) {
                    this.push(f); //添加副文件
                }
                delete file.files; //移除
                this.push(file); //添加主文件
                callback();
            }).catch(err => {
                callback(err, null);
            });
        } else {
            callback(null, file);
        }
    });
};

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _through = require('through2');

var _through2 = _interopRequireDefault(_through);

var _utils = require('./modules/utils');

var _utils2 = _interopRequireDefault(_utils);

var _gulpUtil = require('gulp-util');

var _processor = require('./modules/processor');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

function compile(file) {
    return new Promise((() => {
        var _ref = _asyncToGenerator(function* (resolve, reject) {
            try {
                let info = _path2.default.parse(file.path),
                    contents = yield _utils2.default.read(file.path, file.contents);

                file.dir = info.dir;
                file.ext = info.ext;
                file.contents = contents instanceof Buffer ? contents : new Buffer(contents); //初始化

                //html 内容嵌入 http请求合并 处理区块裁剪 资源定位
                if (_utils2.default.isHtmlFile(file.path)) {
                    yield (0, _processor.html)(file);
                }

                //css base64嵌入 资源定位
                if (/^\.css$/.test(file.ext)) {
                    yield (0, _processor.css)(file);
                }

                //js 内容嵌入 处理区块裁剪 资源定位
                if (/^\.js$/.test(file.ext)) {
                    yield (0, _processor.js)(file);
                }

                //对资源文件添加md5戳
                if (JSON.parse(process.env.COMPILE).hash && _utils2.default.isResFile(file.path)) {
                    file.path = _path2.default.join(file.dir, info.name + '_' + _utils2.default.md5(contents) + file.ext);
                }
            } catch (e) {
                return reject(e);
            }

            resolve(file);
        });

        return function (_x, _x2) {
            return _ref.apply(this, arguments);
        };
    })());
}

module.exports = exports['default'];