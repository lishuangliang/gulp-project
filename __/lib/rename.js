'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (obj) {
    return _through2.default.obj(function (file, encoding, callback) {
        file.path = (0, _rename2.default)(file.path, obj);
        callback(null, file);
    });
};

var _through = require('through2');

var _through2 = _interopRequireDefault(_through);

var _rename = require('./modules/rename');

var _rename2 = _interopRequireDefault(_rename);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];