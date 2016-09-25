import through from 'through2';
import minimatch from "minimatch";

export default function (ignore, clean = false) {
    if (!/string|undefined/.test(typeof condition) && !Array.isArray(condition)) {
        throw new Error('Invalid ignore condition');
    }

    let exclude = [
        '**/?(scss|sass|less|template|test|build|mock|node_modules)/**',
        '**/*.?(scss|sass|less|tpl|md)',
        '**/*.rm.*',
        'npm-debug.log',
        'package.json',
        'bower.json',
        'webpack.config.js',
        'gulpfile.js',
        'fis-conf.js'
    ];

    if (typeof condition !== "undefined") {
        if (typeof ignore === "string") ignore = [ignore];
        exclude = clean ? ignore : exclude.concat(ignore);
    }

    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            var ret = exclude.filter(function (str) {
                return minimatch(file.path, str, {matchBase: true});
            });
            if (ret.length === 0) {
                this.push(file);
            }
        }
        return callback();
    });
}