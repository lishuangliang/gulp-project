import through from 'through2';
import minimatch from "minimatch";
import utils from './modules/utils';

export default function (exclude, options) {
    if (!/string|undefined/.test(typeof exclude) && !Array.isArray(exclude)) {
        throw new Error('Invalid exclude condition');
    }

    options = Object.assign({
        clean: false,
        cwd: process.cwd()
    }, options instanceof Boolean ? {clean: options} : options);

    let patterns = [
        '**/{scss,sass,less,template,test,build,mock,node_modules}/**',
        '**/{*.?(scss|sass|less|tpl|md),*.rm.*}',
        '{npm-debug.log,package.json,bower.json,webpack.config.js,gulpfile.js,fis-conf.js}'
    ];

    if (typeof exclude !== "undefined") {
        if (typeof exclude === "string") exclude = [exclude];
        patterns = (clean ? exclude : patterns.concat(exclude)).map((pattern)=> utils.unrelative(options.cwd, pattern));
    }

    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            var ret = patterns.filter(function (pattern) {
                if (pattern instanceof RegExp) {
                    return pattern.test(file.path);
                } else {
                    return minimatch(file.path, pattern, {matchBase: true});
                }
            });
            if (ret.length === 0) {
                this.push(file);
            }
        }
        return callback();
    });
}