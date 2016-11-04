const pth = require('path');
const fs = require('fs');
const through = require('through2');
const {rollup} = require('rollup');
const vue = require('rollup-plugin-vue');
const babel = require('rollup-plugin-babel');
const nodeResolve = require('rollup-plugin-node-resolve');
const {File, replaceExtension} = require('gulp-util');
const utils = require('./modules/utils');
const rename = require('./modules/rename');


module.exports = function (options) {
    options = Object.assign({
        clean: false,
        rename: null,
        generate: {
            format: 'iife',
            useStrict: true
        },
        plugins: [],
        nodeResolve: {},
        vue: {
            // css: {
            //     inline: false,
            //     load: 'require'
            // },
            css: false,
            compileTemplate: false,
            htmlMinifier: null
        },
        babel: {
            presets: ['es2015-loose-rollup']
        }
    }, options);

    //.vue css code
    var cssCode = null,
        cssType = 'css';

    //默认插件
    var plugins = [
        nodeResolve(options.nodeResolve),
        vue({
            htmlMinifier: Object.assign({
                customAttrSurround: [[/@/, new RegExp('')], [/:/, new RegExp('')]],
                collapseWhitespace: true,
                removeComments: true,
                collapseBooleanAttributes: false,
                removeAttributeQuotes: true,
                removeRedundantAttributes: false,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeOptionalTags: true
            }, options.vue.htmlMinifier),
            compileTemplate: options.vue.compileTemplate,
            css: (typeof options.vue.css === 'Object' && options.vue.css !== null) || options.vue.css === true ? function (styleText, styleNode) {
                if (styleText) {
                    cssCode = '';
                    for (let path of Object.keys(styleNode)) {
                        cssCode += styleNode[path].content;
                    }
                }
            } : false
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
            if (/\.(vue|js)$/.test(file.path)) {
                cssCode = '';

                rollup({
                    entry: file.path,
                    plugins: plugins
                }).then((bundle) => {
                    var code = bundle.generate(options.generate).code;

                    //rename处理
                    if (options.rename) file.path = rename(file.path, options.rename);

                    //.vue to .js
                    if (/^\.vue$/.test(pth.extname(file.path))) file.path = replaceExtension(file.path, '.js');

                    //处理.vue的css code
                    if ((typeof options.vue.css === 'Object' || options.vue.css === true) && cssCode) {
                        if (typeof options.vue.css === 'Object' && options.vue.css.inline && options.vue.css.load) {
                            code = `${options.vue.css.load}(${JSON.stringify(cssCode).replace(/\\n/g, '')});\n${code}`; //追加code
                        }
                    }

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