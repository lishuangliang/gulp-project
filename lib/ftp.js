'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (options) {
    /**
     * 配置选项
     * @type {{
     * clean: boolean 是否清理FTP目录,
     * config: {
     *      host: string,
     *      port: number,
     *      user: string,
     *      password: string
     * } || [object],
     * to: string 发布至FTP的路径
     * }}
     */
    options = Object.assign({
        clean: true,
        to: null,
        config: null
    }, options);

    if (options.config === null) {
        throw _utils2.default.error('Invalid ftp config');
    }

    if (options.to === null) {
        throw _utils2.default.error('Invalid ftp output path');
    }

    //FTP配置转换
    if (!Array.isArray(options.config)) {
        let hosts, config, key;
        if ((hosts = options.config.host.split(',')).length > 1) {
            options.config = hosts.map(function (host) {
                config = {};
                for (key in options.config) {
                    config[key] = options.config[key];
                }
                config.host = host.trim();
                return config;
            });
        } else {
            options.config = [options.config];
        }
    }

    //需要上传的文件集合
    var files = [];
    var stream = _through2.default.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        files.push(file);
        callback(null, file);
    }, function (callback) {
        to(files, options).then(callback).catch(err => {
            this.emit('error', err);
            callback();
        });
    });
    stream.resume();
    return stream;
};

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _ftp = require('ftp');

var _ftp2 = _interopRequireDefault(_ftp);

var _through = require('through2');

var _through2 = _interopRequireDefault(_through);

var _gulpUtil = require('gulp-util');

var _utils = require('./modules/utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

function sync(keys) {
    for (let key of keys) {
        _ftp2.default.prototype[key + 'Sync'] = function (...args) {
            return new Promise(resolve => {
                args.push(function (err) {
                    resolve(err);
                });
                this[key].apply(this, args);
            });
        };
    }
}

sync(['mkdir', 'rmdir', 'put']);

/**
 * 上传文件至FTP
 * @param {Array} files 需要上传的文件列表
 * @param {String} to 上传至FTP的工作目录
 * @param {Object} config ftp配置
 * @param {Boolean} clean 是否清理工作目录
 * @returns {Promise}
 */
function upload(files, to, config, clean) {
    return new Promise(function (resolve, reject) {
        const client = new _ftp2.default();
        client.on('error', reject);
        client.on('ready', _asyncToGenerator(function* () {
            let err, file, destPath;
            if (clean) yield client.rmdirSync(to, true); //清理工作目录
            if (err = yield client.mkdirSync(to, true)) return reject(err); //创建项目目录

            for (file of files) {
                destPath = _path2.default.join(to, _path2.default.dirname(file.relative), _path2.default.basename(file.relative)); //输出路径

                if (err = yield client.mkdirSync(_path2.default.dirname(destPath), true)) {
                    return reject(err); //创建文件目录失败
                } else if (err = yield client.putSync(file.contents, destPath)) {
                    return reject(err); //上传文件失败
                }
            }
            client.end();
            resolve(); //上传全部文件成功
        }));
        client.connect(config);
    });
}

/**
 * 上传操作开始
 * @param {Array} files 需要上传的文件列表
 * @param {Object} options ftp选项配置
 * @returns {Promise}
 */
function to(files, options) {
    return new Promise((() => {
        var _ref2 = _asyncToGenerator(function* (resolve, reject) {
            let config, startTime;
            for (config of options.config) {
                startTime = Date.now();
                (0, _gulpUtil.log)("Starting", _util2.default.format("'%s'...", _gulpUtil.colors.cyan('upload files to ftp ' + config.host)));
                try {
                    yield upload(files, options.to, config, options.clean);
                } catch (e) {
                    reject(e);
                }
                (0, _gulpUtil.log)("Finished", _util2.default.format("'%s'", _gulpUtil.colors.cyan('upload files to ftp ' + config.host), 'after', _gulpUtil.colors.magenta(_utils2.default.formatTimeUnit(Date.now() - startTime))));
            }
            resolve();
        });

        return function (_x, _x2) {
            return _ref2.apply(this, arguments);
        };
    })());
}

module.exports = exports['default'];