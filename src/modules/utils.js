import pth from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mime from 'mime';
import {PluginError, log, colors} from 'gulp-util';
import tinify from './tinify';

const TEXT_FILE_EXTS = /^\.(css|tpl|js|php|txt|json|xml|htm|text|xhtml|html|md|conf|po|config|tmpl|coffee|less|sass|jsp|scss|manifest|bak|asp|tmp|haml|jade|aspx|ashx|java|py|c|cpp|h|cshtml|asax|master|ascx|cs|ftl|vm|ejs|styl|jsx|handlebars|shtml|ts|tsx|yml|sh|es|es6|es7|map|vue)$/i;
const IMAGE_FILE_EXTS = /^\.(svg|tif?f|wbmp|png|bmp|fax|gif|ico|jfif|jpe|jpeg|jpg|woff|cur|webp|swf|ttf|eot|woff2)$/i;
const HTML_FILE_EXTS = /^\.(html|tpl|ejs)$/i;
const RES_FILE_EXTS = /^\.(js|json|css|mp3|mp4|ogg|webm|swf|ttf|otf|eot|woff2?|svg|bmp|gif|png|jpe?g|webp|tif?f)$/i;

Buffer.prototype.append = function (data) {
    data.copy(this, this.size, 0, data.length);
    this.size += data.length;
};

const utils = {
    PLUGIN_NAME: 'gulp-project',
    CACHE: {},
    /**
     * 创建错误信息
     * @param {String|Object} err 错误信息
     * @param {String} path 文件路径
     * @returns {PluginError}
     */
    error: function (err, path) {
        let msg = err,
            info = {showStack: false};

        if (typeof err === "object") {
            msg = err.message || err.msg || 'unspecified error';
            info.lineNumber = err.line;
            info.stack = err.stack;
        }
        if (path) {
            msg = path + ': ' + msg;
            info.fileName = pth.parse(path).base;
        }

        return new PluginError(this.PLUGIN_NAME, msg, info);
    },
    /**
     * 格式化文件大小 转换为具体的单位 最大单位g
     * @param {Number} bytes 文件大小 单位byte
     * @param {Number} decimals 保留小时位数 缺省为2
     * @returns {String} 转换后的值
     */
    formatSizeUnits: function (bytes, decimals = 2) {
        if (bytes === 0) return '0 byte';
        let units = ['bytes', 'kb', 'mb', 'g'],
            i = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
        return parseFloat((bytes / Math.pow(1000, i)).toFixed(decimals)) + ' ' + units[i];
    },
    /**
     * 格式化时间 转换为具体的单位 最大单位h
     * @param {Number} times 时间 单位ms
     * @param {Number} decimals 保留小时位数 缺省为2
     * @returns {String} 转换后的值
     */
    formatTimeUnit: function (times, decimals = 2) {
        if (times < 1000) {
            return times + ' ms';
        } else if (times < 60000) {
            return parseFloat(times / 1000).toFixed(decimals) + ' s';
        } else if (times < 3600000) {
            return parseFloat(times / 60000).toFixed(decimals) + ' m';
        } else {
            return parseFloat(times / 3600000).toFixed(decimals) + ' h';
        }
    },
    /**
     * 判断文件是否是资源文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isResFile: function (path) {
        return RES_FILE_EXTS.test(pth.extname(this.query(path).rest));
    },
    /**
     * 判断文件是否是text文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isTextFile: function (path) {
        return TEXT_FILE_EXTS.test(pth.extname(this.query(path).rest));
    },
    /**
     * 判断文件是否是html文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isHtmlFile: function (path) {
        return HTML_FILE_EXTS.test(pth.extname(this.query(path).rest));
    },
    /**
     * 判断文件是否是图片文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isImageFile: function (path) {
        return IMAGE_FILE_EXTS.test(pth.extname(this.query(path).rest));
    },
    /**
     * 按位数生成md5串
     * @param {String|Buffer} data 数据源
     * @param {Number} len 长度, 缺省为7
     * @returns {String} md5串
     */
    md5: function (data, len = 7) {
        let md5sum = crypto.createHash('md5'),
            encoding = typeof data === 'string' ? 'utf8' : 'binary';
        md5sum.update(data, encoding);
        return md5sum.digest('hex').substring(0, len);
    },
    /**
     * 生成base64串
     * @param {String|Buffer|Array} data 数据源
     * @param {String} path 数据源地址 填写添加前缀
     * @returns {String} base64串
     */
    base64: function (data, path) {
        if (data instanceof Array) {
            data = new Buffer(data);
        } else if (!(data instanceof Buffer)) {
            data = new Buffer((data || '').toString());
        }

        let prefix = path ? 'data:' + mime.lookup(path) + ';base64,' : ''; //前缀

        return prefix + data.toString('base64');
    },
    /**
     * 提取字符串中的一对引号包围的内容
     * @param {String} str 待处理的字符串
     * @param {String} quotes 初始引号可选范围, 缺省为[',"]
     * @returns {Object} {
     *  origin: 源字符串,
     *  rest: 引号包围的文字内容,
     *  quote: 引号类型
     *  }
     */
    stringQuote: function (str, quotes = '\'"') {
        let info = {
            origin: str,
            rest: str = str.trim(),
            quote: ''
        };

        if (str) {
            let len = str.length - 1;
            quotes = quotes.split('');
            for (let quote of quotes) {
                if (str[0] === quote && str[len] === quote) {
                    info.quote = quote;
                    info.rest = str.substring(1, len);
                    break;
                }
            }
        }

        return info;
    },
    /**
     * path处理，提取path中rest部分(?之前)、query部分(?#之间)、hash部分(#之后)
     * @param {String} str 待处理的url
     * @returns {Object} {
     *  origin: *,
     *  rest: *,
     *  hash: string,
     *  query: string
     *  }
     */
    query: function (str) {
        let rest = str,
            pos = rest.indexOf('#'),
            hash = '',
            query = '';

        if (~pos) {
            hash = rest.substring(pos);
            rest = rest.substring(0, pos);
        }

        pos = rest.indexOf('?');

        if (~pos) {
            query = rest.substring(pos);
            rest = rest.substring(0, pos);
        }

        rest = rest.replace(/\\/g, '/');

        if (rest !== '/') {
            // 排除由于.造成路径查找时因filename为""而产生bug，以及隐藏文件问题
            rest = rest.replace(/\/\.?$/, '');
        }

        return {
            origin: str,
            rest: rest,
            hash: hash,
            query: query
        }
    },
    /**
     * 判断path是否为本地相对路径
     * @param {String} path 路径
     * @returns {Boolean}
     */
    isRelativePath: function (path) {
        return path != '' && path !== undefined && !/^(http:|https:|ftp:)?\/\/.*/.test(path) && !/\/\?\?/.test(path) && !/^(tel:|mailto:|javascript:|\#|data:image)/.test(path) && !pth.isAbsolute(path);
    },
    /**
     * 解析path 获取文件内联链接地址
     * @param {String} path 主文件绝对地址
     * @param {Array} inlinePaths 内联文件相对地址
     * @returns {Object} {
     *  absolute: 内联文件绝对地址,
     *  relative: 内网文件相对于主文件地址
     *  }
     */
    inlinePath: function (path, ...inlinePaths) {
        let absolutePath = this.query(path).rest;
        for (let inlinePath of inlinePaths) {
            absolutePath = pth.resolve(pth.parse(absolutePath).dir, this.query(inlinePath).rest);
        }
        let info = this.query(inlinePaths[inlinePaths.length - 1]);
        return {
            absolute: absolutePath,
            relative: pth.relative(pth.parse(path).dir, absolutePath) + info.query + info.hash,
            qh: info.query + info.hash
        }
    },
    /**
     * 读取文件 有缓存从缓存中读取 如果是图片 需要经过压缩
     * @param {String} path 文件绝对路径
     * @param {Buffer} contents 文件内容
     * @returns {String|Buffer} 文件内容
     */
    read: async function (path, contents) {
        path = this.query(path).rest;
        if (!this.CACHE[path]) {
            if (!fs.existsSync(path) || !fs.lstatSync(path).isFile()) throw this.error('路径不存在或者不是有效的文件路径', path);
            if (!contents) {
                contents = fs.readFileSync(path, this.isTextFile(path) ? 'utf8' : null); //读取文件
            } else if (contents instanceof Buffer && this.isTextFile(path)) {
                contents = contents.toString('utf8');
            }
            //对png gif jpg 进行压缩
            if (process.env.COMPRESS && /\.(png|jpe?g)$/.test(pth.extname(path))) {
                try {
                    contents = await tinify(path, contents);
                } catch (e) {
                    throw this.error(e, path);
                }
            }
            this.CACHE[path] = contents;
        }
        return this.CACHE[path];
    },
    /**
     * 压缩HTML代码
     * @param {String} contents 待处理的阿迪吗
     * @returns {String} 处理后的代码
     */
    compressHTML: function (contents) {
        [/[\n\r\t]+/g, /\s{2,}/g].forEach(function (regexp) {
            contents = contents.replace(regexp, " ");
        });
        contents = contents.replace(/> </g, '><');
        contents = contents.trim();

        return contents;
    }
};

export default utils;