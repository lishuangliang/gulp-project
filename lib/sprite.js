'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (options) {
    /**
     * 配置选项
     * @type {*}
     */
    options = Object.assign({
        padding: 20,
        algorithm: 'binary-tree',
        rename: null
    }, options);

    //需要合并的文件
    var files = [];
    return _through2.default.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isBuffer() && _utils2.default.isImageFile(file.path)) {
            files.push(file.path);
        }

        callback(null, file);
    }, function (callback) {
        if (files.length > 1) {
            _spritesmith2.default.run(Object.assign({
                src: files
            }, options), (err, result) => {
                if (err) {
                    this.emit('error', err);
                } else {
                    console.log(result.coordinates);

                    let spritePath = _path2.default.join(_path2.default.dirname(files[0]), 'sprite_' + _utils2.default.md5(result.image) + '.png');

                    //rename处理
                    if (options.rename) spritePath = (0, _rename2.default)(spritePath, options.rename);

                    this.push(new _gulpUtil.File({
                        base: _path2.default.dirname(spritePath),
                        path: spritePath,
                        contents: result.image
                    }));
                }
                callback();
            });
        } else {
            callback();
        }
    });
};

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _spritesmith = require('spritesmith');

var _spritesmith2 = _interopRequireDefault(_spritesmith);

var _through = require('through2');

var _through2 = _interopRequireDefault(_through);

var _gulpUtil = require('gulp-util');

var _utils = require('./modules/utils');

var _utils2 = _interopRequireDefault(_utils);

var _rename = require('./modules/rename');

var _rename2 = _interopRequireDefault(_rename);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];