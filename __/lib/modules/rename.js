'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (path, obj) {
    var parsedPath = {
        dirname: _path2.default.dirname(path),
        basename: _path2.default.basename(path, _path2.default.extname(path)),
        extname: _path2.default.extname(path)
    };

    if (typeof obj === "string" && obj !== '') {
        return obj;
    } else if (typeof obj === 'function') {
        obj(parsedPath);
        return _path2.default.join(parsedPath.dirname, parsedPath.basename + parsedPath.extname);
    } else if (typeof obj === 'object' && obj !== undefined && obj !== null) {
        let info = Object.assign({ prefix: '', suffix: '' }, parsedPath);
        return _path2.default.join(info.dirname, info.prefix + info.basename + info.suffix + info.extname);
    } else {
        return path;
    }
};

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];