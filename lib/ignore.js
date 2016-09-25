'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (ignore, clean = false) {
    if (!/string|undefined/.test(typeof condition) && !Array.isArray(condition)) {
        throw new Error('Invalid ignore condition');
    }

    let exclude = ['**/?(scss|sass|less|template|test|build|mock|node_modules)/**', '**/*.?(scss|sass|less|tpl|md)', '**/*.rm.*', 'npm-debug.log', 'package.json', 'bower.json', 'webpack.config.js', 'gulpfile.js', 'fis-conf.js'];

    if (typeof condition !== "undefined") {
        if (typeof ignore === "string") ignore = [ignore];
        exclude = clean ? ignore : exclude.concat(ignore);
    }

    return _through2.default.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            var ret = exclude.filter(function (str) {
                return (0, _minimatch2.default)(file.path, str, { matchBase: true });
            });
            if (ret.length === 0) {
                this.push(file);
            }
        }
        return callback();
    });
};

var _through = require('through2');

var _through2 = _interopRequireDefault(_through);

var _minimatch = require('minimatch');

var _minimatch2 = _interopRequireDefault(_minimatch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];