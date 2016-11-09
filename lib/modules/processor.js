const pth = require('path');
const url = require('url');
const minimatch = require('minimatch');
const cbml = require('cbml');
const cheerio = require('cheerio');
const CSS = require('CSS');
const CleanCSS = require('clean-css');
const minifyJS = require('uglify-js').minify;
const minifyHTML = require('html-minifier').minify;
const {log, colors} = require('gulp-util');
const utils = require('./utils');
const readFile = require('./file');

//script标记匹配规则
const SCRIPT_INLINE_REGEXP = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(__inline|__uri|__hash)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g;

/**
 * 文件处理配置
 * @type {{
     * hash: boolean 是否使用hash,
     * release: null 发布地址转换,
     * uri: null 访问地址转换,
     * trigger: {
     *   env: number 环境变量用于开发环境切换,
     * } 代码块处理触发器
     * }}
 */
var config = null;

module.exports = {
    /**
     * 初始化
     * @param setting
     */
    init(setting) {
        /**
         * 处理文件匹配规则
         * @param {Object|Null} obj
         * @returns {{}}
         */
        function _(obj) {
            let o = {};
            for (let key in obj) {
                o[utils.toAbsolute(key)] = obj[key];
            }
            return o;
        }

        config = Object.assign({
            hash: false,
            release: null,
            uri: null,
            trigger: {
                env: 0
            },
            PLUGIN_NAME: ''
        }, setting);
        if (config instanceof Object && config.release instanceof Object) config.release = _(config.release);
        if (config instanceof Object && config.uri instanceof Object) config.uri = _(config.uri);
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
                this.eachStyle(rule, callback);
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
                    if ((node.tag === 'debug' && config.trigger.env != 0) || (node.tag === 'remove' && !node.attrs.trigger && config.trigger.env == 0)) {
                        node.value = '';
                    } else if (node.tag === 'remove' && node.attrs.trigger) {
                        let trigger = node.attrs.trigger,
                            match = trigger.match(/@([a-z]*?)+(\s*?)/g);
                        if (match) {
                            for (let m of match) {
                                let v = config.trigger[m.replace('@', '')];
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
     * 编译文件 设置文件发布路径以及访问路径
     * @param file
     */
    uri(file) {
        //根据匹配规则对路径进行转换
        function _(patterns) {
            let _path = '';
            if (patterns instanceof Object) {
                for (let key in patterns) {
                    let pattern = patterns[key],
                        info = utils.parsePath(pattern);

                    if (info.isLocalPath) pattern = utils.toAbsolute(pattern); //转换为物理路径

                    //满足匹配规则
                    if (/\$[01]$/.test(pattern) && minimatch(file.path, key, {matchBase: true})) {
                        pattern = pattern.replace(/\$0$/, file.subpath);
                        pattern = pattern.replace(/\$1$/, file.base);
                        if (!info.isLocalPath) {
                            pattern = pattern.replace(/\/\//g, '/');
                        } else {
                            pattern = pth.join(pth.sep, pth.relative(process.cwd(), pattern)); //转换为相对于项目的绝对路径
                        }
                        _path = pattern;
                    }
                }
            }
            return _path;
        }

        //重设发布和访问路径
        let _release = _(config.release),
            _uri = _(config.uri);

        if (_release) {
            file.release = _release;
            file.uri = _release;
        }
        if (_uri) file.uri = _uri;

        //文件是否是资源文件
        if (file.isRes) {
            if (config.hash) {
                let name = `${file.name}_${file.getHash()}${file.ext}`;
                file.release = pth.join(pth.dirname(file.release), name);
                file.uri = pth.join(pth.dirname(file.uri), name);
            } else {
                file.uri += `?v=${file.getHash()}`;
            }
        }
    },
    /**
     * 合并请求
     * @param {Array} paths 需要合并的路径队列
     * @returns {string}
     */
    concat(paths) {
        let url, len, dir, path;
        paths = paths.map((path)=> {
            url = path.split('/');
            len = Math.min(url.length, len || 100000);
            return url;
        });

        for (var i = 0; i < len; i++) {
            dir = 0;
            for (let path of paths) {
                if (dir === 0) dir = path[i];
                if (dir !== path[i]) dir = -1;
            }
            if (dir === -1) break;
        }

        path = paths[0].slice(0, i).join('/') + '/??';

        paths.forEach(function (arr) {
            path += arr.slice(i).join('/') + ',';
        });

        path = path.substring(0, path.length - 1).replace(/\\/g, '/');

        return path;
    },
    /**
     * 编译文件 不会重复编译
     * @param {String} path 文件地址
     * @returns {*}
     */
    compile(path) {
        let file = readFile(path);

        if (!file.compile) {
            //打印编译信息
            log('Compile', colors.blue(file.path));
            file.compile = true; //修改状态

            let contents = file.content;

            if (file.isHtml || /^\.(css|js|svgz?)$/.test(file.ext)) {
                contents = this.dev(contents.toString()); //去除开发标记

                if (file.isHtml) {
                    contents = contents.replace(/<!-[\s\S]*?-->/g, '').replace(/\n\s{1,}\n/g, '\n'); //删除html注释和多余的换行符
                    contents = this.extHTML(contents, file);
                } else if (/^\.css$/.test(file.ext)) {
                    contents = this.extCSS(contents, file);
                } else if (/^\.js$/.test(file.ext)) {
                    contents = this.extJS(contents, file);
                } else if (/^\.svgz?$/.test(file.ext)) {
                    //对svg进行压缩
                    contents = minifyHTML(contents, {
                        removeComments: true,
                        collapseWhitespace: true
                    });
                }

                contents = new Buffer(contents); //转换为buffer
            }

            file.content = contents;
            this.uri(file);
        }

        return file;
    },
    /**
     * 标准化处理 js 内容
     * @param contents
     * @param file
     * @returns {*|void|string|XML}
     */
    extJS(contents, file) {
        contents = contents.replace(SCRIPT_INLINE_REGEXP, (m, comment, type, value)=> {
            if (/^__(inline|uri|hash)$/.test(type)) {
                let str = utils.stringQuote(value),
                    inlinePath = utils.inlinePath(file.path, str.rest);

                if (inlinePath) {
                    let inlineFile = this.compile(inlinePath.origin);

                    if (/^__uri$/.test(type)) {
                        m = str.quote + utils.formatPath(inlineFile.uri, inlinePath.query, inlinePath.hash) + str.quote; //转换发布路径
                    } else if (/^__hash$/.test(type)) {
                        m = str.quote + inlineFile.getHash() + str.quote; //转换指纹
                    } else {
                        let inlineContent = inlineFile.content.toString();

                        if (/^\.(js|json)$/.test(inlineFile.ext)) { //插入脚本
                            m = inlineFile.content;
                        } else if (inlineFile.isImage) { //插入图片
                            m = str.quote + inlineFile.getBase64() + trQuote.quote
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
                } else {
                    m = value;
                }
            }

            return m;
        });

        try {
            contents = minifyJS(contents, {fromString: true}).code;
        } catch (e) {
            //压缩失败就不用理会
        }
        return contents;
    },
    /**
     * 标准化处理 css 内容
     * @param contents
     * @param file
     * @returns {*|void|string|XML}
     */
    extCSS(contents, file) {
        let code = CSS.parse(contents);

        var getURL = (url)=> {
            url = url.replace(/^url\(/, '').replace(/\)$/, '');

            let str = utils.stringQuote(url),
                inlinePath = utils.inlinePath(file.path, str.rest);

            if (inlinePath) {
                let inlineFile = this.compile(inlinePath.origin);
                if (/\?__inline$/.test(str.rest) && inlineFile.isImage) {
                    return str.quote + inlineFile.getBase64() + str.quote; //转换为base64
                } else {
                    return str.quote + utils.formatPath(inlineFile.uri, inlinePath.query, inlinePath.hash) + str.quote; //转换为发布地址
                }
            }
            return url;
        };

        //插入base64图片 和 资源定位
        this.eachStyle(code, function (declaration, rule) {
            let match = declaration.value.match(/url\([\s\S]*?\)/g);

            if (/^import$/.test(rule.type) && match) {
                rule.import = `url(${getURL(match[0])})`;
            } else if (match) {
                for (let m of match) {
                    declaration.value = declaration.value.replace(m, `url(${getURL(match[0])})`);
                }
            }
        });

        contents = CSS.stringify(code);
        contents = new CleanCSS().minify(contents).styles; //压缩代码

        return contents;
    },
    /**
     * 标准化处理 html 内容
     * @param contents
     * @param file
     * @returns {*|void|string|XML}
     */
    extHTML(contents, file) {
        let $ = cheerio.load(contents, {decodeEntities: false});

        //html中嵌入页面文件
        //<link rel="import" href="文件地址?_inline" />
        this.eachHtml($, 'link[rel="import"]', (el)=> {
            let href = el.attr('href'),
                inlinePath = utils.inlinePath(file.path, href);

            if (inlinePath) {
                let inlineFile = this.compile(inlinePath.origin, file.path);

                if (inlineFile.isHtml) el.before(inlineFile.content.toString()).remove();
            }
        });

        //对内嵌脚本进行处理
        this.eachHtml($, 'script', (el)=> {
            if (el.attr('src') === undefined && /^(undefined|text\/javascript)$/.test(el.attr('type'))) {
                el.text(this.extJS(el.text(), file));
            }
        });

        //对内嵌样式进行处理
        this.eachHtml($, 'style', (el)=> {
            if (el.text().trim()) {
                el.text(this.extCSS(el.text(), file));
            }
        });

        //html嵌入样式文件
        //<link rel="stylesheet" href="文件地址?_inline" />
        this.eachHtml($, 'link[rel="stylesheet"]', (el)=> {
            let href = el.attr('href'),
                inlinePath = utils.inlinePath(file.path, href);

            if (/\.css\?__inline$/.test(href) && inlinePath) {
                let inlineFile = this.compile(inlinePath.origin, file.path);

                el.before(`<style>${inlineFile.content.toString()}</style>`).remove();
            }
        });

        //html中嵌入脚本资源
        //<script href="文件地址?_inline"></script>
        this.eachHtml($, 'script[src$=".js?__inline"]', (el)=> {
            let src = el.attr('src'),
                inlinePath = utils.inlinePath(file.path, src);

            if (inlinePath) {
                let inlineFile = this.compile(inlinePath.origin, file.path);

                el.before(`<script>${inlineFile.content.toString()}</script>`).remove();
            }
        });

        //html中嵌入图片base64和svg
        //<img src="图片地址?__inline" />
        this.eachHtml($, 'img[src$="?__inline"]', (el)=> {
            let src = el.attr('src'),
                inlinePath = utils.inlinePath(file.path, src);

            if (inlinePath) {
                let inlineFile = this.compile(inlinePath.origin, file.path);

                if (inlineFile.isImage) {
                    if (/^\.svgz?$/i.test(inlineFile.ext)) {
                        let svg = $(inlineFile.content.toString());
                        if (el.attr('class') !== undefined) svg.attr('class', el.attr('class'));
                        if (el.attr('style') !== undefined) svg.attr('style', el.attr('style'));
                        el.before(svg).remove();
                    } else {
                        el.attr('src', inlineFile.getBase64());
                    }
                }
            }
        });

        //资源定位
        this.eachHtml($, 'link,script,a,iframe,img,embed,audio,video,object,source', (el, tag)=> {
            let attr = /link|a/.test(tag) ? 'href' : 'src';

            for (let name of [attr, 'data-' + attr]) {
                let url = el.attr(name),
                    inlinePath = utils.inlinePath(file.path, url);

                if (inlinePath) {
                    let inlineFile = this.compile(inlinePath.origin, file.path);
                    el.attr(name, utils.formatPath(inlineFile.uri, inlinePath.query, inlinePath.hash));
                }
            }
        });

        //html 请求合并
        var CONCAT_MAP = {'link': {}, 'script': {}};
        this.eachHtml($, 'link[concat],script[concat]', (el, tag)=> {
            let path = el.attr(tag === 'link' ? 'href' : 'src'),
                info = utils.parsePath(path),
                key = `${el.attr('concat') || 'default'}_${info.auth || ''}${info.host || ''}`;

            CONCAT_MAP[tag][key] = CONCAT_MAP[tag][key] || {el: el, paths: [], elements: []};
            CONCAT_MAP[tag][key].paths.push(path);
            CONCAT_MAP[tag][key].elements.push(el);
        });

        for (let tag in CONCAT_MAP) {
            for (let key in CONCAT_MAP[tag]) {
                if (CONCAT_MAP[tag][key].paths.length > 1) {
                    let path = this.concat(CONCAT_MAP[tag][key].paths);
                    CONCAT_MAP[tag][key].el.before(tag === 'link' ? `<link rel="stylesheet" href="${path}"/>` : `<script src="${path}"></script>`);
                } else {
                    CONCAT_MAP[tag][key].el.removeAttr('concat');
                }
                for (let el of CONCAT_MAP[tag][key].elements) {
                    el.remove();
                }
            }
        }

        return $.html();
    }
};