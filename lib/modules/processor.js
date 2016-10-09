'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.js = exports.css = exports.html = undefined;

/**
 * 循环css values
 * @param {Object} code css对象
 * @param {Function} callback 回调函数
 */
let eachStyle = (() => {
    var _ref = _asyncToGenerator(function* (code, callback) {
        for (let rule of (code.stylesheet || code).rules) {
            if (/^(rule|font-face)$/.test(rule.type)) {
                for (let declaration of rule.declarations) {
                    if (declaration.type !== 'declaration') continue;
                    yield callback(declaration, rule);
                }
            } else if (rule.type === 'media') {
                yield eachStyle(rule, callback);
            } else if (rule.type === 'import') {
                yield callback({ value: rule.import }, rule);
            }
        }
    });

    return function eachStyle(_x, _x2) {
        return _ref.apply(this, arguments);
    };
})();

/**
 * 循环html 标签
 * @param {String|jQuery} code 待处理代码
 * @param {String} selector 选择器
 * @param {Function} callback 回调
 * @returns {String|jQuery} 处理完成后的代码
 */


let eachHtml = (() => {
    var _ref2 = _asyncToGenerator(function* (code, selector, callback) {
        let $ = typeof code === "string" ? _cheerio2.default.load(code, { decodeEntities: false }) : code,
            elements = $(selector);

        for (let i = 0; i < elements.length; i++) {
            yield callback(elements.eq(i), elements.eq(i)[0].tagName);
        }
        return typeof code === "string" ? $.html() : $;
    });

    return function eachHtml(_x3, _x4, _x5) {
        return _ref2.apply(this, arguments);
    };
})();

/**
 * html嵌入html文件中资源地址定位
 * @param {String} path 主html绝对地址
 * @param {String} inlinePath 嵌入html相对地址
 * @param {String} inlineContent 待处理代码
 * @returns {String} 处理完成后的代码
 */


let inlineHtmlResLocate = (() => {
    var _ref3 = _asyncToGenerator(function* (path, inlinePath, inlineContent) {
        return yield eachHtml(inlineContent, 'link,script,a,iframe,img,embed,audio,video,object,source', function (el, tag) {
            let attr = /link|a/.test(tag) ? 'href' : 'src';
            for (let name of [attr, 'data-' + attr]) {
                if (_utils2.default.isRelativePath(el.attr(name))) {
                    el.attr(name, _utils2.default.inlinePath(path, inlinePath, el.attr(name)).relative);
                }
            }
        });
    });

    return function inlineHtmlResLocate(_x6, _x7, _x8) {
        return _ref3.apply(this, arguments);
    };
})();

/**
 * html嵌入样式文件中资源地址重新定位
 * @param {String} path 主html绝对地址
 * @param {String} inlinePath 嵌入css相对地址
 * @param {String} inlineContent 待处理代码
 * @returns {String} 处理完成后的代码
 */


let inlineStyleResLocate = (() => {
    var _ref4 = _asyncToGenerator(function* (path, inlinePath, inlineContent) {
        let code = _css2.default.parse(inlineContent);

        yield eachStyle(code, function (declaration) {
            declaration.value = declaration.value.replace(/url\([\s\S]*?\)/g, function (m) {
                let url = _utils2.default.stringQuote(m.replace(/^url\(/, '').replace(/\)$/, '')).rest;
                if (_utils2.default.isRelativePath(url)) {
                    m = m.replace(url, _utils2.default.inlinePath(path, inlinePath, url).relative);
                }
                return m;
            });
        });

        return _css2.default.stringify(code);
    });

    return function inlineStyleResLocate(_x9, _x10, _x11) {
        return _ref4.apply(this, arguments);
    };
})();

/**
 * html嵌入脚本文件中资源地址重新定位
 * @param {String} path 主html绝对地址
 * @param {String} inlinePath 嵌入script相对地址
 * @param {String} inlineContent 待处理代码
 * @returns {String} 处理完成后的代码
 */


/**
 * 获取文件的发布地址
 * @param {String} path 文件路径
 * @param {String} mainPath 主文件路径
 * @param {Boolean} absolute 是否使用绝对地址 js中使用__uri和___uri的都用绝对地址
 * @returns {string} 发布地址
 */
let uri = (() => {
    var _ref5 = _asyncToGenerator(function* (path, mainPath, absolute = false) {
        let options = JSON.parse(process.env.COMPILE),
            info = _utils2.default.query(path),
            md5 = _utils2.default.md5((yield _utils2.default.read(info.rest)));

        if (options.www.trim() === '' && !absolute) {
            path = _path2.default.relative(_path2.default.dirname(mainPath), info.rest);
        } else {
            path = _path2.default.relative(options.cwd, info.rest); //相对地址
            path = _path2.default.join(options.www || '/', path); //绝对地址
        }

        let pathInfo = _path2.default.parse(path);
        if (_utils2.default.isResFile(path) && options.hash && path.indexOf('_' + md5 + '.') == -1) {
            path = _path2.default.join(pathInfo.dir, pathInfo.name + '_' + md5 + pathInfo.ext); //md5文件名字
        }
        path += info.query;
        if (_utils2.default.isResFile(path) && !options.hash && path.indexOf('_' + md5 + '.') == -1) {
            path += (info.query ? '&' : '?') + 'v=' + md5; //文件版本query
        }
        path += info.hash;

        return path.replace(/\\/g, '/');
    });

    return function uri(_x12, _x13, _x14) {
        return _ref5.apply(this, arguments);
    };
})();

/**
 * http请求合并
 * @param {String} mainPath html文件绝对地址
 * @param {Array} paths 合并请求的相对地址
 * @returns {string} 合并后的请求地址
 */


/**
 * html中嵌入页面文件 (.html|.tpl|.ejs)
 * <link rel="import" href="demo.html?__inline">
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */
let htmlInlineHtml = (() => {
    var _ref6 = _asyncToGenerator(function* (path, $) {
        return yield eachHtml($, 'link[rel="import"]', (() => {
            var _ref7 = _asyncToGenerator(function* (el) {
                let href = el.attr('href');

                if (_utils2.default.isRelativePath(href) && _utils2.default.isHtmlFile(href)) {
                    let inlinePath = _utils2.default.inlinePath(path, href),
                        inlineContent = yield _utils2.default.read(inlinePath.absolute);

                    inlineContent = yield inlineHtmlResLocate(path, inlinePath.relative, inlineContent);

                    el.before(inlineContent).remove();
                }
            });

            return function (_x17) {
                return _ref7.apply(this, arguments);
            };
        })());
    });

    return function htmlInlineHtml(_x15, _x16) {
        return _ref6.apply(this, arguments);
    };
})();

/**
 * html中嵌入样式文件
 * <link rel="stylesheet" href="demo.css?__inline">
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */


let htmlInlineStyle = (() => {
    var _ref8 = _asyncToGenerator(function* (path, $) {
        return yield eachHtml($, 'link[rel="stylesheet"]', (() => {
            var _ref9 = _asyncToGenerator(function* (el) {
                let href = el.attr('href');

                if (_utils2.default.isRelativePath(href) && /\.css\?__inline$/.test(href)) {
                    let inlinePath = _utils2.default.inlinePath(path, href),
                        inlineContent = yield _utils2.default.read(inlinePath.absolute);

                    //嵌入css 处理资源定位
                    inlineContent = yield inlineStyleResLocate(path, inlinePath.relative, inlineContent);
                    //嵌入css 处理css中base64嵌入
                    inlineContent = yield styleProcessor(path, inlineContent);
                    //清理开发内容
                    inlineContent = dev(inlineContent);

                    el.before(_util2.default.format('<style>%s</style>', inlineContent)).remove();
                }
            });

            return function (_x20) {
                return _ref9.apply(this, arguments);
            };
        })());
    });

    return function htmlInlineStyle(_x18, _x19) {
        return _ref8.apply(this, arguments);
    };
})();

/**
 * html中嵌入脚本资源
 *  <script src="demo.js?__inline"></script>
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */


let htmlInlineScript = (() => {
    var _ref10 = _asyncToGenerator(function* (path, $) {
        return yield eachHtml($, 'script[src$=".js?__inline"]', (() => {
            var _ref11 = _asyncToGenerator(function* (el) {
                let src = el.attr('src');

                if (_utils2.default.isRelativePath(src)) {
                    let inlinePath = _utils2.default.inlinePath(path, src),
                        inlineContent = yield _utils2.default.read(inlinePath.absolute);

                    //嵌入js 处理资源定位
                    inlineContent = inlineScriptResLocate(path, inlinePath.relative, inlineContent);
                    //嵌入js 处理js中资源嵌入
                    inlineContent = yield scriptProcessor(path, inlineContent);
                    //清理开发内容
                    inlineContent = dev(inlineContent);

                    el.before(_util2.default.format('<script>%s</script>', inlineContent)).remove();
                }
            });

            return function (_x23) {
                return _ref11.apply(this, arguments);
            };
        })());
    });

    return function htmlInlineScript(_x21, _x22) {
        return _ref10.apply(this, arguments);
    };
})();

/**
 * html中嵌入图片base64和svg
 * <img src="images/logo.gif?__inline"/>
 * <img src="images/logo.svg?__inline"/>
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */


let htmlInlineImage = (() => {
    var _ref12 = _asyncToGenerator(function* (path, $) {
        return yield eachHtml($, 'img[src$="?__inline"]', (() => {
            var _ref13 = _asyncToGenerator(function* (el) {
                let src = el.attr('src');

                if (_utils2.default.isRelativePath(src)) {
                    let isSvg = /\.svg\?__inline/.test(src),
                        inlinePath = _utils2.default.inlinePath(path, src),
                        inlineContent = yield _utils2.default.read(inlinePath.absolute);

                    if (isSvg) {
                        let svg = $(_utils2.default.compressHTML(inlineContent.toString())); //需要压缩svg
                        if (el.attr('class') !== undefined) svg.attr('class', el.attr('class'));
                        el.before(svg).remove();
                    } else if (_utils2.default.isImageFile(src)) {
                        el.attr('src', _utils2.default.base64(inlineContent, inlinePath.absolute));
                    }
                }
            });

            return function (_x26) {
                return _ref13.apply(this, arguments);
            };
        })());
    });

    return function htmlInlineImage(_x24, _x25) {
        return _ref12.apply(this, arguments);
    };
})();

/**
 * html http请求合并
 * //http://tengine.taobao.org/document_cn/http_concat_cn.html
 * @param {String} path html文件绝对地址
 * @param {jQuery} $
 * @returns {jQuery}
 */


let htmlHttpConcat = (() => {
    var _ref14 = _asyncToGenerator(function* (path, $) {
        var map = { 'link': {}, 'script': {} };
        yield eachHtml($, 'link[concat],script[concat]', (() => {
            var _ref15 = _asyncToGenerator(function* (el, tag) {
                let key = el.attr('concat') || 'key',
                    src = el.attr(tag === 'link' ? 'href' : 'src');

                if (_utils2.default.isRelativePath(src)) {
                    src = _path2.default.resolve(_path2.default.dirname(path), (yield uri(_utils2.default.inlinePath(path, src).absolute, path)));
                    map[tag][key] = map[tag][key] || { el: el, paths: [] };
                    map[tag][key].paths.push(src);
                }
            });

            return function (_x29, _x30) {
                return _ref15.apply(this, arguments);
            };
        })());
        for (let tag in map) {
            let temp = tag === 'link' ? '<link rel="stylesheet" href="%s" />' : '<script src="%s"></script>';
            for (let key in map[tag]) {
                map[tag][key].el.before(_util2.default.format('\n' + temp, concat(path, map[tag][key].paths)));
            }
        }
        $('link[concat],script[concat]').remove(); //移除
        return $;
    });

    return function htmlHttpConcat(_x27, _x28) {
        return _ref14.apply(this, arguments);
    };
})();

/**
 * 脚本处理 文件嵌入 处理区块裁剪 资源定位
 * @param {String} path 文件地址
 * @param {String} contents 文件内容
 * @returns {string} 处理后的文件内容
 */


let scriptProcessor = (() => {
    var _ref16 = _asyncToGenerator(function* (path, contents) {
        let placeholder = {};
        contents.replace(scriptInlineRegexp, function (m, comment, type, value) {
            if (/^__(inline|_?uri|hash)$/.test(type)) {
                placeholder[type + '_' + value] = {
                    origin: value,
                    real: null
                };
            }
            return m;
        });
        function inlineFile(inlinePath, inlineContent, origin, quote) {
            if (/\.(js|json)$/.test(inlinePath.absolute)) {
                return inlineContent; //在js中嵌入js文件和json文件
            } else if (_utils2.default.isImageFile(inlinePath.absolute)) {
                return quote + _utils2.default.base64(inlineContent, inlinePath.absolute) + quote;
            } else if (_utils2.default.isTextFile(inlinePath.absolute)) {
                if (/\.css$/.test(inlinePath.absolute)) {
                    inlineContent = new _cleanCss2.default().minify(inlineContent).styles; //压缩css
                } else if (_utils2.default.isHtmlFile(inlinePath.absolute)) {
                    if (/<\/script>/.test(inlineContent)) {
                        throw _utils2.default.error(_util2.default.format('%s: 该页面包含script标签, 无法嵌入到 %s 中。', inlinePath.absolute, path));
                    }
                    inlineContent = _utils2.default.compressHTML(inlineContent);
                }
                return JSON.stringify(inlineContent);
            }
            return origin;
        }

        for (let key in placeholder) {
            let info = _utils2.default.stringQuote(placeholder[key].origin),
                inlinePath = _utils2.default.inlinePath(path, info.rest),
                inlineContent = yield _utils2.default.read(inlinePath.absolute);

            if (/^___?uri_/.test(key)) {
                //__uri('./test.js') to 'test.js?v=eab0b78' or 'test_eab0b78.js'
                placeholder[key].real = info.quote + (yield uri(inlinePath.absolute, path, true)) + info.quote;
            } else if (/^__hash_/.test(key)) {
                //__hash('./test.js') to 'eab0b78'
                placeholder[key].real = info.quote + _utils2.default.md5(inlineContent) + info.quote;
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
    });

    return function scriptProcessor(_x31, _x32) {
        return _ref16.apply(this, arguments);
    };
})();

/**
 * css处理 base64图片 资源定位
 * @param {String} path 文件地址
 * @param {String} contents 文件内容
 * @returns {String} 处理后的文件内容
 */


let styleProcessor = (() => {
    var _ref17 = _asyncToGenerator(function* (path, contents) {
        let code = _css2.default.parse(contents);

        //插入base64图片 和 资源定位
        yield eachStyle(code, (() => {
            var _ref18 = _asyncToGenerator(function* (declaration, rule) {
                let match = declaration.value.match(/url\([\s\S]*?\)/g);
                if (match) {
                    for (let m of match) {
                        let url = _utils2.default.stringQuote(m.replace(/^url\(/, '').replace(/\)$/, '')).rest;
                        if (_utils2.default.isRelativePath(url)) {
                            let info = _utils2.default.query(url),
                                inlinePath = _utils2.default.inlinePath(path, url);

                            if (/\?__inline$/.test(url) && _utils2.default.isImageFile(url)) {
                                let inlineContent = yield _utils2.default.read(inlinePath.absolute);
                                declaration.value = declaration.value.replace(url, _utils2.default.base64(inlineContent, inlinePath.absolute)); //转换为base64
                            } else {
                                declaration.value = declaration.value.replace(url, (yield uri(inlinePath.absolute + info.query + info.hash, path))); //转换为发布地址
                            }
                        }
                    }
                } else if (rule.type === 'import') {
                    let url = _utils2.default.stringQuote(declaration.value).rest,
                        inlinePath = _utils2.default.inlinePath(path, url);

                    rule.import = declaration.value.replace(url, (yield uri(inlinePath.absolute, path))); //转换为发布地址
                }
            });

            return function (_x35, _x36) {
                return _ref18.apply(this, arguments);
            };
        })());

        return _css2.default.stringify(code);
    });

    return function styleProcessor(_x33, _x34) {
        return _ref17.apply(this, arguments);
    };
})();

/**
 * html处理 压缩内联css和js 资源定位 删除注释和多余的换行符
 * @param {String} path 文件地址
 * @param {String} contents 文件内容
 * @returns {String} 处理后的文件内容
 */


let htmlProcessor = (() => {
    var _ref19 = _asyncToGenerator(function* (path, contents) {
        contents = yield eachHtml(contents, 'link,script,a,iframe,img,embed,audio,video,object,source,style', (() => {
            var _ref20 = _asyncToGenerator(function* (el, tag) {
                if (tag === 'style') {
                    el.text(new _cleanCss2.default().minify(el.html()).styles); //压缩style元素
                } else if (tag === 'script' && el.attr('src') === undefined && /^(undefined|text\/javascript)$/.test(el.attr('type'))) {
                    el.text((0, _uglifyJs.minify)(el.html(), { fromString: true }).code); //压缩script元素
                } else {
                    //资源定位
                    let attr = /link|a/.test(tag) ? 'href' : 'src';
                    for (let name of [attr, 'data-' + attr]) {
                        if (_utils2.default.isRelativePath(el.attr(name))) {
                            el.attr(name, (yield uri(_utils2.default.inlinePath(path, el.attr(name)).absolute, path)));
                        }
                    }
                }
            });

            return function (_x39, _x40) {
                return _ref20.apply(this, arguments);
            };
        })());
        return contents.replace(/<!-[\s\S]*?-->/g, '').replace(/\n\s{1,}\n/g, '\n'); //删除html注释和多余的换行符
    });

    return function htmlProcessor(_x37, _x38) {
        return _ref19.apply(this, arguments);
    };
})();

let html = exports.html = (() => {
    var _ref21 = _asyncToGenerator(function* (file) {
        let contents = file.contents.toString(),
            $ = _cheerio2.default.load(contents, { decodeEntities: false });

        yield htmlInlineHtml(file.path, $);
        yield htmlInlineStyle(file.path, $);
        yield htmlInlineScript(file.path, $);
        yield htmlInlineImage(file.path, $);
        yield htmlHttpConcat(file.path, $);
        contents = dev($.html());
        contents = yield htmlProcessor(file.path, contents);

        file.contents = new Buffer(contents);
    });

    return function html(_x41) {
        return _ref21.apply(this, arguments);
    };
})();

let css = exports.css = (() => {
    var _ref22 = _asyncToGenerator(function* (file) {
        let contents = file.contents.toString();

        contents = yield styleProcessor(file.path, contents);
        contents = dev(contents);
        try {
            contents = new _cleanCss2.default().minify(contents).styles;
        } catch (e) {
            //压缩失败就不用理会
        }

        file.contents = new Buffer(contents);
    });

    return function css(_x42) {
        return _ref22.apply(this, arguments);
    };
})();

let js = exports.js = (() => {
    var _ref23 = _asyncToGenerator(function* (file) {
        let contents = file.contents.toString();

        contents = yield scriptProcessor(file.path, contents);
        contents = dev(contents);
        try {
            contents = (0, _uglifyJs.minify)(contents, { fromString: true }).code;
        } catch (e) {
            //压缩失败就不用理会
        }

        file.contents = new Buffer(contents);
    });

    return function js(_x43) {
        return _ref23.apply(this, arguments);
    };
})();

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _cheerio = require('cheerio');

var _cheerio2 = _interopRequireDefault(_cheerio);

var _css = require('css');

var _css2 = _interopRequireDefault(_css);

var _cleanCss = require('clean-css');

var _cleanCss2 = _interopRequireDefault(_cleanCss);

var _uglifyJs = require('uglify-js');

var _cbml = require('cbml');

var _cbml2 = _interopRequireDefault(_cbml);

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

//脚本嵌入资源方法匹配正则
const scriptInlineRegexp = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(__inline|___?uri|__hash)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g;

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

        obj = typeof obj === "string" ? _cbml2.default.parse(obj) : obj;

        let value = '';

        for (let node of obj.nodes) {
            if (node.type === 'block') {
                //debug env != 0 -> 移除
                //remove env == 0 -> 移除
                //remove trigger -> 移除
                if (node.tag === 'debug' && options.env != 0 || node.tag === 'remove' && !node.attrs.trigger && options.env == 0) {
                    node.value = '';
                } else if (node.tag === 'remove' && node.attrs.trigger) {
                    let trigger = node.attrs.trigger,
                        match = trigger.match(/@([a-z]*?)+(\s*?)/g);
                    if (match) {
                        for (let m of match) {
                            let v = options[m.replace('@', '')];
                            trigger = trigger.replace(m, typeof v === "string" ? `'${ v.replace(/'/g, "\\'") }'` : v);
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
}function inlineScriptResLocate(path, inlinePath, inlineContent) {
    return inlineContent.replace(scriptInlineRegexp, function (m, comment, type, value) {
        if (/^__(inline|uri|hash)$/.test(type)) {
            let url = _utils2.default.stringQuote(value).rest;
            m = m.replace(url, _utils2.default.inlinePath(path, inlinePath, url).relative);
        }
        return m;
    });
}function concat(mainPath, paths) {
    let options = JSON.parse(process.env.COMPILE);
    let url, len, dir;
    paths = paths.map(path => {
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

    return options.www ? _path2.default.resolve(options.cwd, path) : _path2.default.relative(_path2.default.dirname(mainPath), path);
}