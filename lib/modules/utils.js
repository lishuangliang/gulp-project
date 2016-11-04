const pth = require('path');
const url = require('url');
const crypto = require('crypto');
const {PluginError} = require('gulp-util');

const TEXT_FILE_EXTS = /\.(css|tpl|js|php|txt|json|xml|htm|text|xhtml|html|md|conf|po|config|tmpl|coffee|less|sass|jsp|scss|manifest|bak|asp|tmp|haml|jade|aspx|ashx|java|py|c|cpp|h|cshtml|asax|master|ascx|cs|ftl|vm|ejs|styl|jsx|handlebars|shtml|ts|tsx|yml|sh|es|es6|es7|map|vue)$/i,
    IMAGE_FILE_EXTS = /\.(svg|tif?f|wbmp|png|bmp|fax|gif|ico|jfif|jpe|jpeg|jpg|woff|cur|webp|swf|ttf|eot|woff2)$/i,
    HTML_FILE_EXTS = /\.(html|tpl|ejs)$/i,
    RES_FILE_EXTS = /\.(js|json|css|mp3|mp4|ogg|webm|swf|ttf|otf|eot|woff2?|svg|bmp|gif|png|jpe?g|webp|tif?f)$/i;

module.exports = {
    /**
     * 创建错误信息
     * @param {String} path 插件名称
     * @param {String|Object} err 错误信息
     * @param {String} path 文件路径
     * @returns {PluginError}
     */
    error: function (name, err, path) {
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
        return new PluginError(name, msg, info);
    },
    /**
     * 判断文件是否是资源文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isResFile(path) {
        return RES_FILE_EXTS.test(path);
    },
    /**
     * 判断文件是否是text文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isTextFile(path) {
        return TEXT_FILE_EXTS.test(path);
    },
    /**
     * 判断文件是否是html文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isHtmlFile (path) {
        return HTML_FILE_EXTS.test(path);
    },
    /**
     * 判断文件是否是图片文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isImageFile(path) {
        return IMAGE_FILE_EXTS.test(path);
    },
    /**
     * 格式化文件大小 转换为具体的单位 最大单位g
     * @param {Number} bytes 文件大小 单位byte
     * @param {Number} decimals 保留小时位数 缺省为2
     * @returns {String} 转换后的值
     */
    formatSizeUnits(bytes, decimals = 2) {
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
    formatTimeUnit(times, decimals = 2) {
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
     * 按位数生成md5串
     * @param {String|Buffer} data 数据源
     * @param {Number} len 长度, 默认为 7
     * @returns {String} md5串
     */
    md5(data, len = 7) {
        let md5sum = crypto.createHash('md5'),
            encoding = typeof data === 'string' ? 'utf8' : 'binary';
        md5sum.update(data, encoding);
        return md5sum.digest('hex').substring(0, len);
    },
    /**
     * 生成base64串
     * @param {String|Buffer|Array} data 数据源
     * @returns {String} base64串
     */
    base64(data) {
        if (data instanceof Array) {
            data = new Buffer(data);
        } else if (!(data instanceof Buffer)) {
            data = new Buffer((data || '').toString());
        }
        return data.toString('base64');
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
    stringQuote(str, quotes = '\'"') {
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
     * 匹配规则转换为绝对路径匹配
     * @param {String|RegExp} glob 匹配规则
     * @returns {*}
     */
    toAbsolute(glob) {
        if (glob instanceof RegExp) return glob;
        let non = glob[0] === '!';
        return (non ? '!' : '') + pth.resolve(process.cwd(), (non ? glob.slice(1) : glob));
    },
    /**
     * 格式化路径
     * @param {String} path
     * @returns {*}
     */
    parsePath(path) {
        if (!path) {
            return {
                protocol: null,
                slashes: null,
                auth: null,
                host: null,
                port: null,
                hostname: null,
                hash: null,
                search: null,
                query: null,
                pathname: null,
                path: null,
                href: null,
                rest: null,
                isLocalPath: false
            }
        } else {
            let info = url.parse(path);

            info.rest = (info.protocol || '') + info.pathname;
            info.isLocalPath = pth.isAbsolute(info.rest) || info.protocol == null;
            return info;
        }
    },
    /**
     * 解析path 获取文件内联链接地址
     * @param {String} path 主文件绝对地址
     * @param {String} inlinePath 内联文件相对地址或者绝对地址
     * @returns {Object} {
     *  absolute: 内联文件绝对地址,
     *  relative: 内网文件相对于主文件地址
     *  }
     */
    inlinePath(path, inlinePath) {
        let info = this.parsePath(inlinePath),
            result = null;
        if (info.isLocalPath) {
            if (pth.isAbsolute(info.rest)) {
                result = {
                    origin: pth.join(process.cwd(), info.rest),
                    absolute: info.rest
                };
            } else {
                result = {
                    origin: pth.join(pth.dirname(path), info.rest),
                    absolute: `/${pth.relative(process.cwd(), pth.join(pth.dirname(path), info.rest))}`
                };
            }

            if (!fs.existsSync(result.origin)) throw `${result.constructor}: 文件不存在！`;
        }
        return result;
    },
};