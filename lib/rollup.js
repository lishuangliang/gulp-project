'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (options, clean) {
    options = Object.assign({
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
    var cssCode = null;

    //默认插件
    var plugins = [(0, _rollupPluginNodeResolve2.default)(options.nodeResolve), (0, _rollupPluginVue2.default)({
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
        css: typeof options.vue.css === 'Object' && options.vue.css !== null || options.vue.css === true ? function (styleText, styleNode) {
            if (styleText) {
                cssCode = '';
                for (let path of Object.keys(styleNode)) {
                    let content = styleNode[path].content;
                    //scss编译
                    content = _nodeSass2.default.renderSync({
                        outputStyle: 'compressed',
                        indentedSyntax: false,
                        data: content,
                        file: path
                    }).css.toString();

                    //如果内联css则处理image base64
                    if (typeof options.vue.css === 'Object' && options.vue.css.inline) {
                        content = styleInlineImage(path, content);
                    }

                    cssCode += content;
                }
            }
        } : false
    }), (0, _rollupPluginBabel2.default)(options.babel)];

    //添加插件
    if (options.plugins.length > 0) {
        if (clean) {
            plugins = options.plugins;
        } else {
            plugins = plugins.concat(options.plugins);
        }
    }

    //检测是否安装了babel preset插件
    if (options.babel.presets && !clean) {
        for (let name of options.babel.presets) {
            if (!_fs2.default.existsSync(_path2.default.join(process.cwd(), './node_modules/babel-preset-' + name))) {
                throw 'not have npm install --save babel-preset-' + name;
            }
        }
    }

    return _through2.default.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(_utils2.default.error('Cannot use streamed file', file.path));
        }

        if (file.isBuffer()) {
            if (/\.(vue|js)$/.test(file.path)) {
                cssCode = '';

                (0, _rollup.rollup)({
                    entry: file.path,
                    plugins: plugins
                }).then(bundle => {
                    var code = bundle.generate(options.generate).code;

                    //rename处理
                    if (options.rename) file.path = (0, _rename2.default)(file.path, options.rename);

                    //.vue to .js
                    if (/^\.vue$/.test(_path2.default.extname(file.path))) file.path = _path2.default.join(_path2.default.dirname(file.path), _path2.default.parse(file.path).name + '.js');

                    //处理.vue的css code
                    if ((typeof options.vue.css === 'Object' || options.vue.css === true) && cssCode) {
                        if (typeof options.vue.css === 'Object' && options.vue.css.inline && options.vue.css.load) {
                            code = `${ options.vue.css.load }(${ JSON.stringify(cssCode).replace(/\\n/g, '') });\n${ code }`; //追加code
                        } else if (options.vue.css === true || typeof options.vue.css === 'Object' && !options.vue.css.inline) {
                            let cssPath = _path2.default.join(_path2.default.dirname(file.path), _path2.default.parse(file.path).name + '.css');

                            //rename处理
                            if (options.rename) cssPath = (0, _rename2.default)(cssPath, options.rename);

                            //追加code
                            if (options.vue.css.load) code = `${ options.vue.css.load }(__uri('${ _path2.default.relative(file.path, cssPath) }'));\n${ code }`;

                            //生成 css file
                            this.push(new _gulpUtil.File({
                                base: process.cwd(),
                                path: cssPath,
                                contents: new Buffer(cssCode)
                            }));
                        }
                    }

                    file.contents = new Buffer(code);

                    this.push(file);
                    callback();
                }).catch(error => {
                    console.log(error);
                    callback();
                });
            } else {
                callback(null, file);
            }
        }
    });
};

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _through = require('through2');

var _through2 = _interopRequireDefault(_through);

var _rollup = require('rollup');

var _rollupPluginVue = require('rollup-plugin-vue');

var _rollupPluginVue2 = _interopRequireDefault(_rollupPluginVue);

var _rollupPluginBabel = require('rollup-plugin-babel');

var _rollupPluginBabel2 = _interopRequireDefault(_rollupPluginBabel);

var _rollupPluginNodeResolve = require('rollup-plugin-node-resolve');

var _rollupPluginNodeResolve2 = _interopRequireDefault(_rollupPluginNodeResolve);

var _nodeSass = require('node-sass');

var _nodeSass2 = _interopRequireDefault(_nodeSass);

var _css = require('css');

var _css2 = _interopRequireDefault(_css);

var _gulpUtil = require('gulp-util');

var _utils = require('./modules/utils');

var _utils2 = _interopRequireDefault(_utils);

var _rename = require('./modules/rename');

var _rename2 = _interopRequireDefault(_rename);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 处理css inline js 中的inline base64 image
 * @param {String} path 文件地址
 * @param {String} content 文件内容
 * @returns {String} 处理后文件内容
 */
function styleInlineImage(path, content) {
    let code = _css2.default.parse(content);

    for (let rule of (code.stylesheet || code).rules) {
        if (rule.type === 'rule') {
            for (let declaration of rule.declarations) {
                if (declaration.type !== 'declaration') continue;
                let match = declaration.value.match(/url\(['|"]([\s\S]*?)\?__inline['|"]\)/);
                if (match && _utils2.default.isRelativePath(match[1])) {
                    let inlinePath = _utils2.default.inlinePath(path, match[1]).absolute;
                    declaration.value = declaration.value.replace(match[1] + '?__inline', _utils2.default.base64(_fs2.default.readFileSync(inlinePath), inlinePath)); //转换为base64
                }
            }
        }
    }

    return _css2.default.stringify(code, { compress: true });
}

module.exports = exports['default'];