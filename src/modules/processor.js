import util from 'util';
import pth from 'path';
import cheerio from 'cheerio';
import CSS from 'css';
import CleanCSS from 'clean-css';
import {minify} from 'uglify-js';
import cbml from 'cbml';
import utils from './utils';

//脚本嵌入资源方法匹配正则
const scriptInlineRegexp = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(__inline|___?uri|__hash)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g

/**
 * 清理开发内容 用来切换release版本和debug版本
 * @param {String} contents 待处理内容
 * @returns {String} 处理后的内容
 */
function dev(contents) {
    let options = JSON.parse(process.env.COMPILE);

    function buildBlock(obj) {
        if (!obj) {
            return '';
        }

        obj = typeof obj === "string" ? cbml.parse(obj) : obj;

        let value = '';

        for (let node of obj.nodes) {
            if (node.type === 'block') {
                //debug env != 0 -> 移除
                //remove env == 0 -> 移除
                //remove trigger -> 移除
                if ((node.tag === 'debug' && options.env != 0) || (node.tag === 'remove' && !node.attrs.trigger && options.env == 0)) {
                    node.value = '';
                } else if (node.tag === 'remove' && node.attrs.trigger) {
                    let trigger = node.attrs.trigger,
                        match = trigger.match(/@([a-z]*?)+(\s*?)/g);
                    if (match) {
                        for (let m of match) {
                            let v = options[m.replace('@', '')];
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
}

/**
 * 循环css values
 * @param {Object} code css对象
 * @param {Function} callback 回调函数
 */
async function eachStyle(code, callback) {
    for (let rule of (code.stylesheet || code).rules) {
        if (/^(rule|font-face)$/.test(rule.type)) {
            for (let declaration of rule.declarations) {
                if (declaration.type !== 'declaration') continue;
                await callback(declaration, rule);
            }
        } else if (rule.type === 'media') {
            await eachStyle(rule, callback);
        } else if (rule.type === 'import') {
            await callback({value: rule.import}, rule);
        }
    }
}

/**
 * 循环html 标签
 * @param {String|jQuery} code 待处理代码
 * @param {String} selector 选择器
 * @param {Function} callback 回调
 * @returns {String|jQuery} 处理完成后的代码
 */
async function eachHtml(code, selector, callback) {
    let $ = typeof(code) === "string" ? cheerio.load(code, {decodeEntities: false}) : code,
        elements = $(selector);

    for (let i = 0; i < elements.length; i++) {
        await callback(elements.eq(i), elements.eq(i)[0].tagName);
    }
    return typeof(code) === "string" ? $.html() : $;
}

/**
 * html嵌入html文件中资源地址定位
 * @param {String} path 主html绝对地址
 * @param {String} inlinePath 嵌入html相对地址
 * @param {String} inlineContent 待处理代码
 * @returns {String} 处理完成后的代码
 */
async function inlineHtmlResLocate(path, inlinePath, inlineContent) {
    return await eachHtml(inlineContent, 'link,script,a,iframe,img,embed,audio,video,object,source', function (el, tag) {
        let attr = /link|a/.test(tag) ? 'href' : 'src';
        for (let name of [attr, 'data-' + attr]) {
            if (utils.isRelativePath(el.attr(name))) {
                el.attr(name, utils.inlinePath(path, inlinePath, el.attr(name)).relative);
            }
        }
    });
}

/**
 * html嵌入样式文件中资源地址重新定位
 * @param {String} path 主html绝对地址
 * @param {String} inlinePath 嵌入css相对地址
 * @param {String} inlineContent 待处理代码
 * @returns {String} 处理完成后的代码
 */
async function inlineStyleResLocate(path, inlinePath, inlineContent) {
    let code = CSS.parse(inlineContent);

    await eachStyle(code, function (declaration) {
        declaration.value = declaration.value.replace(/url\([\s\S]*?\)/g, function (m) {
            let url = utils.stringQuote(m.replace(/^url\(/, '').replace(/\)$/, '')).rest;
            if (utils.isRelativePath(url)) {
                m = m.replace(url, utils.inlinePath(path, inlinePath, url).relative);
            }
            return m;
        });
    });

    return CSS.stringify(code);
}

/**
 * html嵌入脚本文件中资源地址重新定位
 * @param {String} path 主html绝对地址
 * @param {String} inlinePath 嵌入script相对地址
 * @param {String} inlineContent 待处理代码
 * @returns {String} 处理完成后的代码
 */
function inlineScriptResLocate(path, inlinePath, inlineContent) {
    return inlineContent.replace(scriptInlineRegexp, function (m, comment, type, value) {
        if (/^__(inline|uri|hash)$/.test(type)) {
            let url = utils.stringQuote(value).rest;
            m = m.replace(url, utils.inlinePath(path, inlinePath, url).relative);
        }
        return m;
    });
}

/**
 * 获取文件的发布地址
 * @param {String} path 文件路径
 * @param {String} mainPath 主文件路径
 * @param {Boolean} absolute 是否使用绝对地址 js中使用__uri和___uri的都用绝对地址
 * @returns {string} 发布地址
 */
async function uri(path, mainPath, absolute = false) {
    let options = JSON.parse(process.env.COMPILE),
        info = utils.query(path),
        md5 = utils.md5(await utils.read(info.rest));

    if (options.www.trim() === '' && !absolute) {
        path = pth.relative(pth.dirname(mainPath), info.rest);
    } else {
        path = pth.relative(options.cwd, info.rest); //相对地址
        path = pth.join(options.www || '/', path); //绝对地址
    }

    let pathInfo = pth.parse(path);
    if (utils.isResFile(path) && options.hash && path.indexOf('_' + md5 + '.') == -1) {
        path = pth.join(pathInfo.dir, pathInfo.name + '_' + md5 + pathInfo.ext); //md5文件名字
    }
    path += info.query;
    if (utils.isResFile(path) && !options.hash && path.indexOf('_' + md5 + '.') == -1) {
        path += (info.query ? '&' : '?') + 'v=' + md5; //文件版本query
    }
    path += info.hash;

    return path.replace(/\\/g, '/');
}

/**
 * http请求合并
 * @param {String} mainPath html文件绝对地址
 * @param {Array} paths 合并请求的相对地址
 * @returns {string} 合并后的请求地址
 */
function concat(mainPath, paths) {
    let options = JSON.parse(process.env.COMPILE);
    let url, len, dir;
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

    let path = paths[0].slice(0, i).join('/') + '/??';

    paths.forEach(function (arr) {
        path += arr.slice(i).join('/') + ',';
    });

    path = path.substring(0, path.length - 1).replace(/\\/g, '/');

    return options.www ? pth.resolve(options.cwd, path) : pth.relative(pth.dirname(mainPath), path);
}

/**
 * html中嵌入页面文件 (.html|.tpl|.ejs)
 * <link rel="import" href="demo.html?__inline">
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */
async function htmlInlineHtml(path, $) {
    return await eachHtml($, 'link[rel="import"]', async function (el) {
        let href = el.attr('href');

        if (utils.isRelativePath(href) && utils.isHtmlFile(href)) {
            let inlinePath = utils.inlinePath(path, href),
                inlineContent = await utils.read(inlinePath.absolute);

            inlineContent = await inlineHtmlResLocate(path, inlinePath.relative, inlineContent);

            el.before(inlineContent).remove();
        }
    });
}

/**
 * html中嵌入样式文件
 * <link rel="stylesheet" href="demo.css?__inline">
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */
async function htmlInlineStyle(path, $) {
    return await eachHtml($, 'link[rel="stylesheet"]', async function (el) {
        let href = el.attr('href');

        if (utils.isRelativePath(href) && /\.css\?__inline$/.test(href)) {
            let inlinePath = utils.inlinePath(path, href),
                inlineContent = await utils.read(inlinePath.absolute);

            //嵌入css 处理资源定位
            inlineContent = await inlineStyleResLocate(path, inlinePath.relative, inlineContent);
            //嵌入css 处理css中base64嵌入
            inlineContent = await styleProcessor(path, inlineContent);
            //清理开发内容
            inlineContent = dev(inlineContent);

            el.before(util.format('<style>%s</style>', inlineContent)).remove();
        }
    });
}

/**
 * html中嵌入脚本资源
 *  <script src="demo.js?__inline"></script>
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */
async function htmlInlineScript(path, $) {
    return await eachHtml($, 'script[src$=".js?__inline"]', async function (el) {
        let src = el.attr('src');

        if (utils.isRelativePath(src)) {
            let inlinePath = utils.inlinePath(path, src),
                inlineContent = await utils.read(inlinePath.absolute);

            //嵌入js 处理资源定位
            inlineContent = inlineScriptResLocate(path, inlinePath.relative, inlineContent);
            //嵌入js 处理js中资源嵌入
            inlineContent = await scriptProcessor(path, inlineContent);
            //清理开发内容
            inlineContent = dev(inlineContent);

            el.before(util.format('<script>%s</script>', inlineContent)).remove();
        }
    });
}

/**
 * html中嵌入图片base64和svg
 * <img src="images/logo.gif?__inline"/>
 * <img src="images/logo.svg?__inline"/>
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */
async function htmlInlineImage(path, $) {
    return await eachHtml($, 'img[src$="?__inline"]', async function (el) {
        let src = el.attr('src');

        if (utils.isRelativePath(src)) {
            let isSvg = /\.svg\?__inline/.test(src),
                inlinePath = utils.inlinePath(path, src),
                inlineContent = await utils.read(inlinePath.absolute);

            if (isSvg) {
                let svg = $(utils.compressHTML(inlineContent.toString())); //需要压缩svg
                if (el.attr('class') !== undefined) svg.attr('class', el.attr('class'));
                el.before(svg).remove();
            } else if (utils.isImageFile(src)) {
                el.attr('src', utils.base64(inlineContent, inlinePath.absolute));
            }
        }
    });
}

/**
 * html http请求合并
 * //http://tengine.taobao.org/document_cn/http_concat_cn.html
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */
async function htmlHttpConcat(path, $) {
    var map = {'link': {}, 'script': {}};
    await eachHtml($, 'link[concat],script[concat]', async function (el, tag) {
        let key = el.attr('concat') || 'key',
            src = el.attr(tag === 'link' ? 'href' : 'src');

        if (utils.isRelativePath(src)) {
            src = pth.resolve(pth.dirname(path), await uri(utils.inlinePath(path, src).absolute, path));
            map[tag][key] = map[tag][key] || {el: el, paths: []};
            map[tag][key].paths.push(src)
        }
    });
    for (let tag in map) {
        let temp = tag === 'link' ? '<link rel="stylesheet" href="%s" />' : '<script src="%s"></script>';
        for (let key in map[tag]) {
            map[tag][key].el.before(util.format('\n' + temp, concat(path, map[tag][key].paths)));
        }
    }
    $('link[concat],script[concat]').remove(); //移除
    return $;
}

/**
 * 脚本处理 文件嵌入 处理区块裁剪 资源定位
 * @param {String} path 文件地址
 * @param {String} contents 文件内容
 * @returns {string} 处理后的文件内容
 */
async function scriptProcessor(path, contents) {
    let placeholder = {};
    contents.replace(scriptInlineRegexp, function (m, comment, type, value) {
        if (/^__(inline|_?uri|hash)$/.test(type)) {
            placeholder[type + '_' + value] = {
                origin: value,
                real: null
            }
        }
        return m;
    });
    function inlineFile(inlinePath, inlineContent, origin, quote) {
        if (/\.(js|json)$/.test(inlinePath.absolute)) {
            return inlineContent; //在js中嵌入js文件和json文件
        } else if (utils.isImageFile(inlinePath.absolute)) {
            return quote + utils.base64(inlineContent, inlinePath.absolute) + quote
        } else if (utils.isTextFile(inlinePath.absolute)) {
            if (/\.css$/.test(inlinePath.absolute)) {
                inlineContent = new CleanCSS().minify(inlineContent).styles; //压缩css
            } else if (utils.isHtmlFile(inlinePath.absolute)) {
                if (/<\/script>/.test(inlineContent)) {
                    throw utils.error(util.format('%s: 该页面包含script标签, 无法嵌入到 %s 中。', inlinePath.absolute, path));
                }
                inlineContent = utils.compressHTML(inlineContent);
            }
            return JSON.stringify(inlineContent);
        }
        return origin;
    }

    for (let key in placeholder) {
        let info = utils.stringQuote(placeholder[key].origin),
            inlinePath = utils.inlinePath(path, info.rest),
            inlineContent = await utils.read(inlinePath.absolute);

        if (/^___?uri_/.test(key)) {
            //__uri('./test.js') to 'test.js?v=eab0b78' or 'test_eab0b78.js'
            placeholder[key].real = info.quote + await uri(inlinePath.absolute, path, true) + info.quote;
        } else if (/^__hash_/.test(key)) {
            //__hash('./test.js') to 'eab0b78'
            placeholder[key].real = info.quote + utils.md5(inlineContent) + info.quote;
        } else if (/^__inline_/.test(key)) {
            //__inline('file path')
            placeholder[key].real = inlineFile(inlinePath, inlineContent, placeholder[key].origin, info.quote);
        }
    }

    return contents.replace(scriptInlineRegexp, function (m, comment, type, value) {
        if (/^__(inline|_?uri|hash)$/.test(type)) {
            return placeholder[type + '_' + value].real;
        }
        return m;
    });
}

/**
 * css处理 base64图片 资源定位
 * @param {String} path 文件地址
 * @param {String} contents 文件内容
 * @returns {String} 处理后的文件内容
 */
async function styleProcessor(path, contents) {
    let code = CSS.parse(contents);

    //插入base64图片 和 资源定位
    await eachStyle(code, async function (declaration, rule) {
        let match = declaration.value.match(/url\([\s\S]*?\)/g);
        if (match) {
            for (let m of match) {
                let url = utils.stringQuote(m.replace(/^url\(/, '').replace(/\)$/, '')).rest;
                if (utils.isRelativePath(url)) {
                    let info = utils.query(url),
                        inlinePath = utils.inlinePath(path, url);

                    if (/\?__inline$/.test(url) && utils.isImageFile(url)) {
                        let inlineContent = await utils.read(inlinePath.absolute);
                        declaration.value = declaration.value.replace(url, utils.base64(inlineContent, inlinePath.absolute)); //转换为base64
                    } else {
                        declaration.value = declaration.value.replace(url, await uri(inlinePath.absolute + info.query + info.hash, path)); //转换为发布地址
                    }
                }
            }
        } else if (rule.type === 'import') {
            let url = utils.stringQuote(declaration.value).rest,
                inlinePath = utils.inlinePath(path, url);

            rule.import = declaration.value.replace(url, await uri(inlinePath.absolute, path)); //转换为发布地址
        }
    });

    return CSS.stringify(code);
}

/**
 * html处理 压缩内联css和js 资源定位
 * @param {String} path 文件地址
 * @param {String} contents 文件内容
 * @returns {String} 处理后的文件内容
 */
async function htmlProcessor(path, contents) {
    return await eachHtml(contents, 'link,script,a,iframe,img,embed,audio,video,object,source,style', async function (el, tag) {
        if (tag === 'style') {
            el.text(new CleanCSS().minify(el.html()).styles); //压缩style元素
        } else if (tag === 'script' && el.attr('src') === undefined && /^(undefined|text\/javascript)$/.test(el.attr('type'))) {
            el.text(minify(el.html(), {fromString: true}).code); //压缩script元素
        } else {
            //资源定位
            let attr = /link|a/.test(tag) ? 'href' : 'src';
            for (let name of [attr, 'data-' + attr]) {
                if (utils.isRelativePath(el.attr(name))) {
                    el.attr(name, await uri(utils.inlinePath(path, el.attr(name)).absolute, path));
                }
            }
        }
    });
}

export async function html(file) {
    let contents = file.contents.toString(),
        $ = cheerio.load(contents, {decodeEntities: false});

    await htmlInlineHtml(file.path, $);
    await htmlInlineStyle(file.path, $);
    await htmlInlineScript(file.path, $);
    await htmlInlineImage(file.path, $);
    await htmlHttpConcat(file.path, $);
    contents = dev($.html());
    contents = await htmlProcessor(file.path, contents);

    file.contents = new Buffer(contents);
}

export async function css(file) {
    let contents = file.contents.toString();

    contents = await styleProcessor(file.path, contents);
    contents = dev(contents);
    try {
        contents = new CleanCSS().minify(contents).styles;
    } catch (e) {
        //压缩失败就不用理会
    }

    file.contents = new Buffer(contents);
}

export async function js(file) {
    let contents = file.contents.toString();

    contents = await scriptProcessor(file.path, contents);
    contents = dev(contents);
    try {
        contents = minify(contents, {fromString: true}).code;
    } catch (e) {
        //压缩失败就不用理会
    }

    file.contents = new Buffer(contents);
}