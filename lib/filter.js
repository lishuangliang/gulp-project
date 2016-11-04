const through = require('through2');
const minimatch = require('minimatch');
const utils = require('./modules/utils');

const PLUGIN_NAME = 'gulp-project.filter';

/**
 * 文件过滤
 * @param {Array,RegExp} exclude 排除规则
 * @param {Boolean} clean 是否清除默认规则
 * @returns {*}
 */
module.exports = function (exclude, clean) {
    if (!/string|undefined/.test(typeof exclude) && !Array.isArray(exclude)) {
        throw utils.error(PLUGIN_NAME, 'Invalid exclude condition!');
    }

    //默认规则
    let rules = [
        '**/{scss,sass,less,template,test,build,mock,node_modules}/**',
        '**/{*.?(scss|sass|less|tpl|md),*.rm.*}',
        '{npm-debug.log,package.json,bower.json,webpack.config.js,gulpfile.js,fis-conf.js,yarn.lock,gulp.compression.lock}'
    ];

    //合并规则
    if (typeof exclude !== "undefined") {
        if (typeof exclude === "string") exclude = [exclude];
        rules = (clean ? exclude : rules.concat(exclude)).map((rule)=> utils.toAbsolute(rule));
    }

    return through.obj(function (file, enc, cb) {
        if (file.isBuffer()) {
            //匹配规则
            if (rules.filter((rule) => rule instanceof RegExp ? rule.test(file.path) : minimatch(file.path, rule, {matchBase: true})).length === 0) {
                this.push(file);
            }
        }

        return cb();
    });
};