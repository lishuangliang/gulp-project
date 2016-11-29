const pth = require('path');
const fs = require('fs');
const through = require('through2');
const {rollup} = require('rollup');
const vue = require('rollup-plugin-vue');
const babel = require('rollup-plugin-babel');
const nodeResolve = require('rollup-plugin-node-resolve');
const {replaceExtension} = require('gulp-util');
const sass = require('node-sass');
const styleInject = require('./modules/style-inject');
const processor = require('./modules/processor');

const PLUGIN_NAME = 'gulp-project.rollup';

const injectStyleFuncCode = styleInject.toString().replace(/styleInject/, '__$styleInject');

module.exports = function (options) {
    options = Object.assign({
        clean: false,
        generate: {
            format: 'iife',
            useStrict: true
        },
        plugins: [],
        nodeResolve: {},
        vue: '__$styleInject',
        babel: {
            presets: ['es2015-loose-rollup']
        },
        compile: {}
    }, options);

    //.vue css code
    var cssCode = null;

    //默认插件
    var plugins = [
        nodeResolve(options.nodeResolve),
        vue({
            compileTemplate: true,
            css: options.vue === '__$styleInject' ? function (styleText, styleNode) {
                if (styleText) {
                    cssCode = '';
                    for (let path of Object.keys(styleNode)) {
                        let contents = styleNode[path].content.trim();
                        //编译sass
                        if (contents && /^scss|sass$/.test(styleNode[path].lang)) {
                            contents = sass.renderSync({
                                outputStyle: 'compressed',
                                indentedSyntax: false,
                                data: contents,
                                file: path
                            }).css.toString();
                        }
                        //格式化css
                        if (contents) {
                            contents = processor.extCSS(contents, {path: path});
                        }
                        cssCode += contents;
                    }
                }
            } : options.vue
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

    //初始化处理程序
    processor.init(Object.assign({
        PLUGIN_NAME: PLUGIN_NAME
    }, options.compile));

    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            if (/\.(vue|js|es|es6)$/.test(file.path)) {
                rollup({
                    entry: file.path,
                    plugins: plugins
                }).then((bundle) => {
                    var code = bundle.generate(options.generate).code;

                    if (options.vue === '__$styleInject' && cssCode) {
                        code = `(function () {\n${injectStyleFuncCode}\n__$styleInject(${JSON.stringify(cssCode)})\n}());\n${code}`;
                    }

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