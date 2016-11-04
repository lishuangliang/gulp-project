const pth = require('path');
const url = require('url');
const minimatch = require('minimatch');
const cbml = require('cbml');
const cheerio = require('cheerio');
const CSS = require('CSS');
const CleanCSS = require('clean-css');
const {minify} = require('uglify-js');
const utils = require('./utils');
const readFile = require('./file');

/**
 * 文件处理配置
 * @type {{
     * hash: boolean 是否使用hash,
     * env: number 环境变量用于开发环境切换,
     * release: null 发布地址转换,
     * url: null 访问地址转换
     * }}
 */
var config = {
    hash: false,
    env: 0,
    release: null,
    uri: null
};

module.exports = {
    /**
     * 初始化
     * @param setting
     */
    init(setting) {
        config = Object.assign(config, setting);
    },
    /**
     * 编译文件 不会重复编译
     * @param file
     */
    compile(file) {
        if (file.compile) return;

        let contents = file.content;

        if (file.isHtml || /^\.(css|js)$/.test(file.ext)) {
            contents = this.dev(contents.toString()); //去除开发标记

            if (file.isHtml) {
                contents = this.extHtml(contents, file);
            } else if (/^\.css$/.test(file.ext)) {
                contents = this.extCss(contents, file);
            } else if (/^\.js/.test(file.ext)) {
                contents = this.extJs(contents, file);
            }

            contents = new Buffer(contents); //转换为buffer
        }

        file.content = contents;
        file.compile = true; //修改状态

        this.uri(file); //设置发布和访问地址
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
                        isLink = url.parse(pattern).protocol;
                    if (!isLink) pattern = utils.unrelative(pattern); //转换为物理路径
                    //满足匹配规则
                    if (/\$[01]$/.test(pattern) && minimatch(file.path, key, {matchBase: true})) {
                        pattern = pattern.replace(/\$0$/, file.subpath);
                        pattern = pattern.replace(/\$1$/, file.base);
                        if (isLink) {
                            let info = url.parse(pattern);
                            info.pathname = info.pathname.replace(/\/\//g, '/');
                            pattern = url.format(info);

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

        file.uri = utils.unifiedPathSep(file.uri); //格式化访问路径
    },
    /**
     * 查询html标签
     * @param {jQuery|HTMLElement} code html代码
     * @param {String} selector 选择器
     * @param {Fucntion} callback 回调函数
     * @returns {jQuery|HTMLElement}
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
     * 循环css code
     * @param {Object} code css parse
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
     * 读取内联文件
     * @param {String} inlinePath 内联文件 基于 主文件的相对路径
     * @param {String} dir 主文件的目录
     */
    readInlineFile(inlinePath, dir) {
        if (utils.isLocalPath(inlinePath)) {
            inlinePath = pth.isAbsolute(inlinePath) ? pth.join(process.cwd(), inlinePath) : pth.resolve(dir, inlinePath);
        }
        let file = readFile(inlinePath);
        this.compile(file); //编译

        return file;
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
     * 格式化html代码
     * @param contents
     * @param file
     * @returns {HTMLElement}
     */
    extHtml(contents, file) {
        let $ = cheerio.load(contents, {decodeEntities: false}),
            map = {'link': {}, 'script': {}};

        //html中嵌入页面文件
        this.eachHtml($, 'link[rel="import"]', (el)=> {
            let href = el.attr('href');
            if (/\?__inline$/.test(href)) {
                href = href.replace(/\?__inline$/, '');

                if (utils.config.HTML_FILE_EXTS.test(href) && utils.isLocalPath(href)) {
                    let f = this.readInlineFile(href, file.dir);
                    el.before(f.content.toString()).remove();
                }
            }
        });
        //html中嵌入样式文件
        this.eachHtml($, 'link[rel="stylesheet"]', (el)=> {
            let href = el.attr('href');

            if (/\.css\?__inline$/.test(href) && utils.isLocalPath(href)) {
                let f = this.readInlineFile(href, file.dir);
                el.before(`<style>${f.content.toString()}</style>`).remove();
            }
        });
        //html中嵌入脚本资源
        this.eachHtml($, 'script[src$=".js?__inline"]', (el)=> {
            let src = el.attr('src');

            if (utils.isLocalPath(src)) {
                let f = this.readInlineFile(src, file.dir);
                el.before(`<script>${f.content.toString()}</script>`).remove();
            }
        });
        //对脚本进行处理
        this.eachHtml($, 'script', (el)=> {
            if (el.attr('src') === undefined && /^(undefined|text\/javascript)$/.test(el.attr('type'))) {
                el.text(this.extJs(el.text(), file));
            }
        });
        //html中嵌入图片base64和svg
        this.eachHtml($, 'img[src$="?__inline"]', (el)=> {
            let src = el.attr('src');

            if (utils.isLocalPath(src)) {
                let f = this.readInlineFile(src, file.dir);

                if (/\.svg\?__inline/.test(src)) {
                    let svg = $(utils.compressHTML(f.content.toString())); //压缩svg
                    if (el.attr('class') !== undefined) svg.attr('class', el.attr('class'));
                    el.before(svg).remove();
                } else if (utils.isImageFile(src)) {
                    el.attr('src', f.getBase64());
                }
            }
        });
        //资源定位
        this.eachHtml($, 'link,script,a,iframe,img,embed,audio,video,object,source', (el, tag)=> {
            let attr = /link|a/.test(tag) ? 'href' : 'src';

            for (let name of [attr, 'data-' + attr]) {
                let url = el.attr(name);
                if (utils.isLocalPath(url)) {
                    if (/\.html$/.test(url)) {
                        url = pth.isAbsolute(url) ? pth.join(process.cwd(), url) : pth.resolve(file.dir, url);
                        el.attr(name, '/' + pth.relative(process.cwd(), url));
                    } else {
                        let f = this.readInlineFile(url, file.dir);
                        el.attr(name, f.uri);
                    }
                }
            }
        });
        //html 请求合并
        this.eachHtml($, 'link[concat],script[concat]', (el, tag)=> {
            let path = el.attr(tag === 'link' ? 'href' : 'src'),
                info = url.parse(path),
                key = `${el.attr('concat') || 'default'}_${info.auth || ''}${info.host || ''}`;

            map[tag][key] = map[tag][key] || {el: el, paths: [], elements: []};
            map[tag][key].paths.push(path);
            map[tag][key].elements.push(el);
        });
        for (let tag in map) {
            for (let key in map[tag]) {
                if (map[tag][key].paths.length > 1) {
                    let path = this.concat(map[tag][key].paths);
                    map[tag][key].el.before(tag === 'link' ? `<link rel="stylesheet" href="${path}"/>` : `<script src="${path}"></script>`);
                } else {
                    map[tag][key].el.removeAttr('concat');
                }
                for (let el of map[tag][key].elements) {
                    el.remove();
                }
            }
        }
        //删除html注释和多余的换行符
        contents = $.html().replace(/<!-[\s\S]*?-->/g, '').replace(/\n\s{1,}\n/g, '\n');
        //压缩html中的js和css
        contents = this.eachHtml(contents, 'style,script', (el, tag)=> {
            let code = el.text();
            if (tag === 'style') {
                code = new CleanCSS().minify(code).styles;
            } else if (tag === 'script' && el.attr('src') === undefined && /^(undefined|text\/javascript)$/.test(el.attr('type'))) {
                code = minify(code, {fromString: true}).code;
            }
            el.text(code);
        });

        return contents;
    },
    /**
     * 格式化css代码
     * @param contents
     * @param file
     * @returns {String}
     */
    extCss(contents, file) {
        let code = CSS.parse(contents);

        this.eachStyle(code, (declaration)=> {
            declaration.value = declaration.value.replace(/url\([\s\S]*?\)/g, (m)=> {
                let url = utils.stringQuote(m.replace(/^url\(/, '').replace(/\)$/, '')).rest;
                if (utils.isLocalPath(url) && !pth.isAbsolute(url)) {
                    let f = this.readInlineFile(url, file.dir);

                    if (/\?__inline$/.test(url) && f.isImage) {
                        m = m.replace(url, f.getBase64());
                    } else {
                        m = m.replace(url, f.uri);
                    }
                }
                return m;
            });
        });

        contents = CSS.stringify(code);
        contents = new CleanCSS().minify(contents).styles; //压缩代码

        return contents;
    },
    /**
     * 格式化js代码
     * @param contents
     * @param file
     * @returns {String}
     */
    extJs(contents, file) {
        contents = contents.replace(utils.config.SCRIPT_INLINE_REGEXP, (m, comment, type, value)=> {
            if (/^__(inline|_?uri|hash)$/.test(type)) {
                let info = utils.stringQuote(value);
                if (utils.isLocalPath(info.rest)) {
                    let f = this.readInlineFile(info.rest, file.dir);
                    if (/__inline/.test(type)) {
                        m = f.content.toString();
                    } else if (/___?uri/.test(type)) {
                        m = info.quote + f.uri + info.quote;
                    } else if (/__hash/.test(type)) {
                        m = info.quote + f.getHash() + info.quote;
                    }
                }
            }
            return m;
        });

        try {
            contents = minify(contents, {fromString: true}).code;
        } catch (e) {
            //压缩失败就不用理会
        }
        return contents;
    }
};