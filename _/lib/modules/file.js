const pth = require('path');
const url = require('url');
const fs = require('fs');
const mime = require('mime');
const utils = require('./utils');

const FILE_CACHE = {};

class File {
    constructor(path, content) {
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
        this.content = content || fs.readFileSync(path, null); //文件内容
    }

    /**
     * 返回文件内容的base64编码
     * @param {Boolean} prefix 是否需要base64格式头, 默认为 true
     * @returns {String}
     */
    getBase64(prefix = true) {
        let key = `_base64_${prefix}`;
        if (!this.extras[key]) {
            prefix = prefix ? `data:${mime.lookup(this.path)};base64,` : '';
            this.extras[key] = prefix + utils.base64(this.content);
        }

        return this.extras[key];
    }

    /**
     * 获取文件内容的md5序列
     * @returns {String}
     */
    getHash() {
        if (!this.extras['_hash']) this.extras['_hash'] = utils.md5(this.content);
        return this.extras['_hash'];
    }
}

module.exports = function (path) {
    let info = url.parse(path);
    path = utils.unifiedPathSep(`${info.protocol || ''}${info.pathname}`);
    if (!FILE_CACHE[path]) {
        if (!fs.existsSync(path)) {
            throw 'unable to find file ' + path;
        }
        FILE_CACHE[path] = new File(path);
    }

    return FILE_CACHE[path];
};