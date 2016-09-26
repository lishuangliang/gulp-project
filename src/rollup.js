import pth from 'path';
import fs from 'fs';
import through from 'through2';
import {rollup} from 'rollup'
import vue from 'rollup-plugin-vue';
import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import sass from 'node-sass';
import css from 'css';
import {File} from 'gulp-util';
import utils from './modules/utils';
import rename from './modules/rename';

/**
 * 处理css inline js 中的inline base64 image
 * @param {String} path 文件地址
 * @param {String} content 文件内容
 * @returns {String} 处理后文件内容
 */
function styleInlineImage(path, content) {
    let code = css.parse(content);

    for (let rule of (code.stylesheet || code).rules) {
        if (rule.type === 'rule') {
            for (let declaration of rule.declarations) {
                if (declaration.type !== 'declaration') continue;
                let match = declaration.value.match(/url\(['|"]([\s\S]*?)\?__inline['|"]\)/);
                if (match && utils.isRelativePath(match[1])) {
                    let inlinePath = utils.inlinePath(path, match[1]).absolute;
                    declaration.value = declaration.value.replace(match[1] + '?__inline', utils.base64(fs.readFileSync(inlinePath), inlinePath)); //转换为base64
                }
            }
        }
    }

    return css.stringify(code, {compress: true});
}

export default function (options, clean) {
    options = Object.assign({
        rename: null,
        generate: {
            format: 'cjs'
        },
        plugins: [],
        nodeResolve: {},
        vue: {
            inline: true,
            load: 'loadCSS',
            compileTemplate: false
        },
        babel: {
            presets: ['es2015-loose-rollup']
        }
    }, options);

    //.vue css code
    var cssCode = null;

    //默认插件
    var plugins = [
        nodeResolve(options.nodeResolve),
        vue({
            compileTemplate: options.vue && options.vue.compileTemplate ? true : false,
            css: options.vue ? function (styleText, styleNode) {
                if (styleText) {
                    cssCode = '';
                    for (let path of Object.keys(styleNode)) {
                        let content = styleNode[path].content;
                        //scss编译
                        content = sass.renderSync({
                            outputStyle: 'compressed',
                            indentedSyntax: false,
                            data: content,
                            file: path
                        }).css.toString();

                        if (options.vue.css) { //如果内联css则处理image base64
                            content = styleInlineImage(path, content);
                        }

                        cssCode += content;
                    }
                }
            } : false
        }),
        babel(options.babel)
    ];

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
            if (!fs.existsSync(pth.join(process.cwd(), './node_modules/babel-preset-' + name))) {
                throw 'not have npm install --save babel-preset-' + name;
            }
        }
    }

    return through.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(utils.error('Cannot use streamed file', file.path));
        }

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
                    if (/^\.vue$/.test(pth.extname(file.path))) file.path = pth.join(pth.dirname(file.path), pth.parse(file.path).name + '.js');

                    //处理.vue的css code
                    if (options.vue && cssCode) {
                        if (options.vue.inline) {
                            code = `${options.vue.load}(${JSON.stringify(cssCode).replace(/\\n/g, '')});\n${code}`; //追加code
                        } else {
                            let cssPath = pth.join(pth.dirname(file.path), pth.parse(file.path).name + '.css');

                            //rename处理
                            if (options.rename) cssPath = rename(cssPath, options.rename);

                            //追加code
                            code = `${options.vue.load}(__uri('${pth.relative(file.path, cssPath)}'));\n${code}`;

                            //生成 css file
                            this.push(new File({
                                base: process.cwd(),
                                path: cssPath,
                                contents: new Buffer(cssCode)
                            }));
                        }
                    }

                    file.contents = new Buffer(code);

                    this.push(file);
                    callback();
                }).catch((error) => {
                    console.log(error);
                    callback();
                });
                ;
            } else {
                callback(null, file);
            }
        }
    });
}

