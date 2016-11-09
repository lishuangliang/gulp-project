const pth = require('path');
const fs = require('fs');
const through = require('through2');
const {rollup} = require('rollup');
const vue = require('rollup-plugin-vue');
const babel = require('rollup-plugin-babel');
const nodeResolve = require('rollup-plugin-node-resolve');
const {replaceExtension} = require('gulp-util');

const PLUGIN_NAME = 'gulp-project.rollup';

module.exports = function (options) {
    options = Object.assign({
        clean: false,
        generate: {
            format: 'iife',
            useStrict: true
        },
        plugins: [],
        nodeResolve: {},
        vue: false,
        babel: {
            presets: ['es2015-loose-rollup']
        }
    }, options);

    //默认插件
    var plugins = [
        nodeResolve(options.nodeResolve),
        vue({
            htmlMinifier: {
                customAttrSurround: [[/@/, new RegExp('')], [/:/, new RegExp('')]],
                collapseWhitespace: true,
                removeComments: true,
                collapseBooleanAttributes: false,
                removeAttributeQuotes: true,
                removeRedundantAttributes: false,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeOptionalTags: true
            },
            compileTemplate: false,
            css: options.vue.css
        }),
        babel(options.babel)
    ];

    //添加插件
    if (options.plugins.length > 0) {
        if (options.clean) {
            plugins = options.plugins;
        } else {
            plugins = plugins.concat(options.plugins);
        }
    }

    //检测是否安装了babel preset插件
    if (options.babel.presets && !options.clean) {
        for (let name of options.babel.presets) {
            if (!fs.existsSync(pth.join(process.cwd(), './node_modules/babel-preset-' + name))) {
                throw 'not have npm install --save babel-preset-' + name;
            }
        }
    }

    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            if (/\.(vue|js|es|es6)$/.test(file.path)) {
                rollup({
                    entry: file.path,
                    plugins: plugins
                }).then((bundle) => {
                    var code = bundle.generate(options.generate).code;

                    //.vue to .js
                    if (/^\.vue$/.test(pth.extname(file.path))) file.path = replaceExtension(file.path, '.js');

                    file.contents = new Buffer(code);

                    this.push(file);
                    callback();
                }).catch((err) => {
                    console.log(err);
                    callback();
                });
            } else {
                callback(null, file);
            }
        }
    });
};