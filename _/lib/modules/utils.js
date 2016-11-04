const pth = require('path');
const url = require('url');
const crypto = require('crypto');
const config = require('../config');

const utils = {
    config: config,
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
     * 判断文件是否是资源文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isResFile(path) {
        return config.RES_FILE_EXTS.test(path);
    },
    /**
     * 判断文件是否是text文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isTextFile(path) {
        return config.TEXT_FILE_EXTS.test(path);
    },
    /**
     * 判断文件是否是html文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isHtmlFile(path) {
        return config.HTML_FILE_EXTS.test(path);
    },
    /**
     * 判断文件是否是图片文件
     * @param {String} path 文件路径
     * @returns {Boolean}
     */
    isImageFile(path) {
        return config.IMAGE_FILE_EXTS.test(path);
    },
    /**
     * 统一路径格式
     * @param path {string} 原路径
     * @returns {string}
     */
    unifiedPathSep(path) {
        return path.split(pth.sep).join('/');
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
     * 判断当前路径是否是本地路径
     * @param {String} path 路径
     * @returns {Boolean}
     */
    isLocalPath(path) {
        return path && !/^(http:|https:|ftp:)?\/\/.*/.test(path) && !/\/\?\?/.test(path) && !/^(tel:|mailto:|javascript:|\#|data:image)/.test(path);
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
    },
    /**
     * 转换为绝对路径
     * @param {String|RegExp} glob 匹配规则
     * @returns {*}
     */
    unrelative(glob) {
        if (glob instanceof RegExp) return glob;
        let non = glob[0] === '!';
        return (non ? '!' : '') + pth.resolve(process.cwd(), (non ? glob.slice(1) : glob));
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
    }
};

module.exports = utils;