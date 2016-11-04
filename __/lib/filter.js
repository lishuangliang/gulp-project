'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (exclude, options) {
    if (!/string|undefined/.test(typeof exclude) && !Array.isArray(exclude)) {
        throw new Error('Invalid exclude condition');
    }

    options = Object.assign({
        clean: false,
        cwd: process.cwd()
    }, options instanceof Boolean ? { clean: options } : options);

    let patterns = ['**/{scss,sass,less,template,test,build,mock,node_modules}/**', '**/{*.?(scss|sass|less|tpl|md),*.rm.*}', '{npm-debug.log,package.json,bower.json,webpack.config.js,gulpfile.js,fis-conf.js}'];

    if (typeof exclude !== "undefined") {
        if (typeof exclude === "string") exclude = [exclude];
        patterns = (clean ? exclude : patterns.concat(exclude)).map(pattern => _utils2.default.unrelative(options.cwd, pattern));
    }

    return _through2.default.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            var ret = patterns.filter(function (pattern) {
                if (pattern instanceof RegExp) {
                    return pattern.test(file.path);
                } else {
                    return (0, _minimatch2.default)(file.path, pattern, { matchBase: true });
                }
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

var _utils = require('./modules/utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];