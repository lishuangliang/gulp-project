'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

/**
 * 获取可用的token
 * @returns {String|Null}
 */
let token = (() => {
    var _ref = _asyncToGenerator(function* () {
        //第一次使用 去校验token并获取使用次数
        if (AUTH_TOKEN == null) {
            AUTH_TOKEN = {};

            let startTime = Date.now();
            (0, _gulpUtil.log)("Starting", _util2.default.format("'%s'...", _gulpUtil.colors.cyan('check token')));

            for (let token of process.env.AUTH_TOKENS.split(',')) {
                AUTH_TOKEN[token] = yield compressionCount(token);
            }

            (0, _gulpUtil.log)("Finished", _util2.default.format("'%s'", _gulpUtil.colors.cyan('check token')), 'after', _gulpUtil.colors.magenta(_utils2.default.formatTimeUnit(Date.now() - startTime)));
        }

        for (let token in AUTH_TOKEN) {
            if (AUTH_TOKEN[token] < 480) return token;
        }
        return null;
    });

    return function token() {
        return _ref.apply(this, arguments);
    };
})();

exports.default = function (path, contents) {
    return new Promise((() => {
        var _ref2 = _asyncToGenerator(function* (resolve, reject) {
            try {
                const name = _path2.default.basename(path),
                      startTime = Date.now();

                _tinify2.default.key = yield token(); //设置token
                if (_tinify2.default.key === null) return reject('没有可以使用的token');

                (0, _gulpUtil.log)("Starting", _util2.default.format("'%s'...", _gulpUtil.colors.cyan('compress ' + name)));
                let source = _tinify2.default.fromBuffer(contents);
                source.obj.toBuffer(function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        AUTH_TOKEN[_tinify2.default.key] = _tinify2.default.compressionCount; //更新使用次数
                        source.file.then(function (res) {
                            //读取压缩信息
                            let info = JSON.parse(res.toString());
                            (0, _gulpUtil.log)("Finished", _util2.default.format("'%s'", _gulpUtil.colors.cyan('compress ' + name), 'after', _gulpUtil.colors.magenta(_utils2.default.formatTimeUnit(Date.now() - startTime))), _gulpUtil.colors.green(_util2.default.format('%s -> %s', _utils2.default.formatSizeUnits(info.input.size), _utils2.default.formatSizeUnits(info.output.size))));
                            resolve(data);
                        });
                    }
                });
            } catch (e) {
                reject(e);
            }
        });

        return function (_x, _x2) {
            return _ref2.apply(this, arguments);
        };
    })());
};

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _tinify = require('tinify');

var _tinify2 = _interopRequireDefault(_tinify);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _gulpUtil = require('gulp-util');

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

/**
 * 修改tinify原生函数fromBuffer 使其通过file获取到文件信息
 * @param string
 * @returns {*}
 */
_tinify2.default.Source.fromBuffer = function (string) {
    var response = _tinify2.default.client.request("post", "/shrink", string);
    var location = response.get("headers").get("location");
    return {
        obj: new _tinify2.default.Source(location),
        file: response.get("body")
    };
};

var AUTH_TOKEN = null;

/**
 * 获取token当月已经使用次数
 * https://tinypng.com/developers/reference#compression-count
 * @param {String} token
 * @returns {Promise}
 */
function compressionCount(token) {
    return new Promise(function (resolve, reject) {
        (0, _request2.default)({
            url: 'https://api.tinypng.com/shrink',
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + new Buffer('api:' + token).toString('base64')
            }
        }, function (err, res, body) {
            if (err || JSON.parse(body).error === 'Unauthorized') {
                reject(err || 'invalid token: ' + token);
            } else {
                resolve(res.caseless.dict['compression-count']);
            }
        });
    });
};
module.exports = exports['default'];