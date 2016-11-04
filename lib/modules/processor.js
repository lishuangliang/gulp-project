const pth = require('path');
const url = require('url');
const minimatch = require('minimatch');
const cbml = require('cbml');
const cheerio = require('cheerio');
const CSS = require('CSS');
const CleanCSS = require('clean-css');
const minifyJS = require('uglify-js').minify;
const minifyHTML = require('html-minifier').minify;
const utils = require('./utils');
const readFile = require('./file');

//script标记匹配规则
const SCRIPT_INLINE_REGEXP_INLINE = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(__inline)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g;
const SCRIPT_INLINE_REGEXP_URI = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(___?uri|__hash)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g;

/**
 * 文件处理配置
 * @type {{
     * hash: boolean 是否使用hash,
     * env: number 环境变量用于开发环境切换,
     * release: null 发布地址转换,
     * uri: null 访问地址转换
     * }}
 */
var config = {
    hash: false,
    env: 0,
    release: null,
    uri: null,
    PLUGIN_NAME: ''
};

/**
 * 处理文件匹配规则
 * @param {Object|Null} obj
 * @returns {{}}
 */
function unrelative(obj) {
    let o = {};
    for (let key in obj) {
        o[utils.toAbsolute(key)] = obj[key];
    }
    return o;
}

module.exports = {
    /**
     * 初始化
     * @param setting
     */
    init(setting) {
        config = Object.assign(config, setting);
        if (config instanceof Object && config.release instanceof Object) config.release = unrelative(config.release);
        if (config instanceof Object && config.uri instanceof Object) config.uri = unrelative(config.uri);
    },
    /**
     * 循环css values
     * @param {Object} code css对象
     * @param {Function} callback 回调函数
     */
    eachStyle(code, callback) {
        for (let rule of (code.stylesheet || code).rules) {
            if (/^(rule|font-face)$/.test(rule.type)) {
                for (let declaration of rule.declarations) {
                    if (declaration.type !== 'declaration') continue;
                    callback(declaration, rule);
                }
            } else if (rule.type === 'media') {
                eachStyle(rule, callback);
            } else if (rule.type === 'import') {
                callback({value: rule.import}, rule);
            }
        }
    },
    /**
     * 循环html 标签
     * @param {String|jQuery} code 待处理代码
     * @param {String} selector 选择器
     * @param {Function} callback 回调
     * @returns {String|jQuery} 处理完成后的代码
     */
    eachHtml(code, selector, callback) {
        let $ = typeof(code) === "string" ? cheerio.load(code, {decodeEntities: false}) : code,
            elements = $(selector);
        for (let i = 0; i < elements.length; i++) {
            callback(elements.eq(i), elements.eq(i)[0].tagName);
        }
        return typeof(code) === "string" ? $.html() : $;
    },
    /**
     * 编译文件 不会重复编译
     * @param {String} path 文件地址
     * @returns {*}
     */
    compile(path) {
        let file = readFile(path);

        if (!file.compile) {
            let contents = file.content;

            if (file.isHtml || /^\.(css|js|svgz?)$/.test(file.ext)) {
                contents = this.dev(contents.toString()); //去除开发标记

                if (file.isHtml) {
                    let $ = cheerio.load(contents, {decodeEntities: false});
                } else if (/^\.css$/.test(file.ext)) {
                    contents = this.styleInlineImage(contents, file);
                } else if (/^\.js/.test(file.ext)) {
                    contents = this.scriptUrlFormat(contents, file);
                    contents = this.scriptInlineFile(contents, file);
                }

                contents = new Buffer(contents); //转换为buffer
            }

            file.content = contents;
            file.compile = true; //修改状态
        }

        return file;
    },
    /**
     * 清理开发内容 用来切换release版本和debug版本
     * debug env != 0 -> 移除
     * remove env == 0 -> 移除
     * remove trigger -> 移除
     * @param {String} contents 待处理内容
     * @returns {String} 处理后的内容
     */
    dev(contents) {
        function buildBlock(obj) {
            if (!obj) return '';

            obj = typeof obj === "string" ? cbml.parse(obj) : obj;

            let value = '';

            for (let node of obj.nodes) {
                if (node.type === 'block') {
                    if ((node.tag === 'debug' && config.env != 0) || (node.tag === 'remove' && !node.attrs.trigger && config.env == 0)) {
                        node.value = '';
                    } else if (node.tag === 'remove' && node.attrs.trigger) {
                        let trigger = node.attrs.trigger,
                            match = trigger.match(/@([a-z]*?)+(\s*?)/g);
                        if (match) {
                            for (let m of match) {
                                let v = config[m.replace('@', '')];
                                trigger = trigger.replace(m, typeof v === "string" ? `'${v.replace(/'/g, "\\'")}'` : v);
                            }
                        }

                        if (eval(trigger)) {
                            node.value = '';
                        }
                    } else if (node.nodes.length > 1) {
                        node.value = buildBlock(node);
                    }
                }
                value += node.value;
            }

            return value;
        }

        return buildBlock(contents);
    },
    /**
     * 脚本插入脚本，JSON，图片，文本文件 __inline('文件地址')
     * @param {String} contents
     * @param {Object} file
     * @returns {string}
     */
    scriptInlineFile(contents, file) {
        return contents.replace(SCRIPT_INLINE_REGEXP_INLINE, (m, comment, type, value)=> {
            let strQuote = utils.stringQuote(value),
                inlinePath = utils.inlinePath(file.path, strQuote.rest);

            if (inlinePath) {
                let inlineFile = readFile(inlinePath.origin),
                    inlineContent = inlineFile.content;

                if (/^\.(js|json)$/.test(inlineFile.ext)) { //插入脚本
                    m = inlineFile.content;
                } else if (inlineFile.isImage) { //插入图片
                    m = strQuote.quote + utils.base64(inlineFile.content, inlinePath.absolute) + trQuote.quote
                } else if (inlineFile.isText) { //插入文本文件
                    if (/^\.css$/.test(inlineFile.ext)) {
                        inlineContent = new CleanCSS().minify(inlineContent).styles; //压缩css
                    } else if (inlineFile.isHtml) {
                        if (/<\/script>/.test(inlineContent)) {
                            throw utils.error(config.PLUGIN_NAME, `${inlinePath.absolute}: 该html文件包含script标签, 无法嵌入到 ${file.path} 中。`);
                        }
                        inlineContent = minifyHTML(inlineContent, {
                            removeComments: true,
                            collapseWhitespace: true
                        });
                    }
                    m = JSON.stringify(inlineContent);
                }
            }
            return m;
        });
    },
    /**
     * 脚本__hash(文件地址)和__uri(文件地址)路径转换为绝对路径
     * @param {String} contents
     * @param {Object} file
     * @returns {string}
     */
    scriptUrlFormat(contents, file) {
        return contents.replace(SCRIPT_INLINE_REGEXP_URI, (m, comment, type, value)=> {
            let strQuote = utils.stringQuote(value),
                inlinePath = utils.inlinePath(file.path, strQuote.rest);

            if (inlinePath) {
                m = `${type}(${strQuote.quote + inlinePath.absolute + strQuote.quote})`;
            } else {
                m = '';
            }

            return m;
        });
    },
    /**
     * 样式中嵌入base64图片 图片地址?__inline
     * @param {String} contents
     * @param {Object} file
     * @returns {string}
     */
    styleInlineImage(contents, file) {
        let code = CSS.parse(contents);

        //插入base64图片
        eachStyle(code, function (declaration, rule) {
            let match = declaration.value.match(/url\([\s\S]*?\)/g);
            if (match) {
                for (let m of match) {
                    let url = m.replace(/^url\(/, '').replace(/\)$/, ''),
                        strQuote = utils.stringQuote(url),
                        inlinePath = utils.inlinePath(file.path, strQuote.rest);

                    if (inlinePath && /\?__inline$/.test(inlinePath.absolute)) {
                        let inlineFile = readFile(inlinePath.origin);

                        declaration.value = declaration.value.replace(url, inlineFile.getBase64()); //转换为base64
                    }
                }
            }
        });

        return CSS.stringify(code);
    },
    htmlInlineImage($, file) {
        return this.eachHtml($, 'img[src$="?__inline"]', function (el) {
            let src = el.attr('src'),
                inlinePath = utils.inlinePath(file.path, src);

            if (inlinePath) {
                let inlineFile = readFile(inlinePath.origin);

                if (/svgz?/i.test(inlineFile.ext)) {
                    let svg = $(inlineFile.content);
                    if (el.attr('class') !== undefined) svg.attr('class', el.attr('class'));
                    el.before(svg).remove();
                } else {
                    el.attr('src', inlineFile.getBase64());
                }
            }
        });
    }
};