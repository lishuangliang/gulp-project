const pth = require('path');
const fs = require('fs');
const mime = require('mime');
const utils = require('./utils');

var FILE_CACHE = {}; //文件缓存

class File {
    constructor(path) {
        let info = pth.parse(path);

        this.path = path; //文件物理地址
        this.dir = info.dir; //文件物理目录地址
        this.base = info.base; //文件名
        this.name = info.name; //文件名不包含后缀
        this.ext = info.ext; //文件名后缀
        this.subpath = pth.resolve('/', pth.relative(process.cwd(), path)); //文件基于项目 root 的绝对路径
        this.release = this.subpath; //发布的路径 基于项目 root 的绝对路径
        this.uri = this.subpath; //访问的路径 可使用http,https,ws等路径
        this.isImage = utils.isImageFile(this.ext); //是否是图片文件
        this.isText = utils.isTextFile(this.ext); //是否是文本文件
        this.isHtml = utils.isHtmlFile(this.ext); //是否是html文件
        this.isRes = utils.isResFile(this.ext); //是否是资源文件
        this.extras = {}; //文件附属属性
        this.compile = false; //文件是否被编译过
        this.content = fs.readFileSync(path, null); //文件内容
    }

    /**
     * 返回文件内容的base64编码
     * @param {Boolean} prefix 是否需要base64格式头, 默认为 true
     * @returns {String}
     */
    getBase64(prefix = true) {
        let key = `base64_${prefix}`;
        if (!this.extras[key]) {
            this.extras[key] = (prefix ? `data:${mime.lookup(this.path)};base64,` : '') + utils.base64(this.content);
        }

        return this.extras[key];
    }

    /**
     * 获取文件内容的md5序列，多次调用，尽管文件内容有变化，也只会返回第一次调用时根据当时文件内容计算出来的结果。
     * @param {Number} len 长度, 默认为 7
     * @returns {String}
     */
    getHash(len = 7) {
        let key = `hash_${len}`;
        if (!this.extras[key]) {
            this.extras[key] = utils.md5(this.content, len);
        }
        return this.extras[key];
    }
}

module.exports = function (path) {
    path = utils.parsePath(path).rest;
    if (!FILE_CACHE[path]) {
        if (!fs.existsSync(path)) {
            throw 'unable to find file ' + path;
        }
        FILE_CACHE[path] = new File(path);
    }

    return FILE_CACHE[path];
};