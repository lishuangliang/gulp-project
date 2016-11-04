const through = require('through2');
const minimatch = require('minimatch');
const utils = require('./modules/utils');

module.exports = function (exclude, clean) {
    if (!/string|undefined/.test(typeof exclude) && !Array.isArray(exclude)) {
        throw new Error('Invalid exclude condition');
    }

    let patterns = [
        '**/{scss,sass,less,template,test,build,mock,node_modules}/**',
        '**/{*.?(scss|sass|less|tpl|md),*.rm.*}',
        '{npm-debug.log,package.json,bower.json,webpack.config.js,gulpfile.js,fis-conf.js,yarn.lock}'
    ];

    //合并规则
    if (typeof exclude !== "undefined") {
        if (typeof exclude === "string") exclude = [exclude];
        patterns = (clean ? exclude : patterns.concat(exclude)).map((pattern)=> utils.unrelative(pattern));
    }
    console.log(patterns);

    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            //匹配规则
            if (patterns.filter((pattern) => pattern instanceof RegExp ? pattern.test(file.path) : minimatch(file.path, pattern, {matchBase: true})).length === 0) {
                this.push(file);
            }
        }
        return callback();
    });
};