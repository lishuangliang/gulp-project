const Client = require('ftp');
const Promise = require('./promise');

var FTP_DIR_CACHE = {};

/**
 * ftp删除目录 忽略删除目录的错误
 * @param {String} path 路径
 * @param {Boolean} recursive 递归
 * @returns {Promise}
 */
Client.prototype.rmdirSync = function (path, recursive) {
    return new Promise((resolve)=> {
        let reg = new RegExp(`^${this.options.host}:${this.options.port}${path}`);
        this.rmdir(path, recursive, ()=> {
            for (let key in FTP_DIR_CACHE) {
                if (reg.test(key)) {
                    delete FTP_DIR_CACHE[key]; //移除目录缓存
                }
            }
            resolve();
        });
    });
};

/**
 * ftp创建目录 如果已经目录已经存在不会重复操作
 * @param {String} path 路径
 * @param {Boolean} recursive 递归
 * @returns {Promise}
 */
Client.prototype.mkdirSync = function (path, recursive) {
    return new Promise((resolve, reject)=> {
        let key = `${this.options.host}:${this.options.port}${path}`;
        if (FTP_DIR_CACHE[key]) {
            resolve(); //如果目录已经存在就直接返回
        } else {
            //创建目录
            this.mkdir(path, recursive, (err)=> {
                if (err) {
                    reject(err);
                } else {
                    FTP_DIR_CACHE[key] = true;
                    resolve();
                }
            });
        }
    });
};

/**
 * 提交文件至ftp
 * @param args
 * @returns {Promise}
 */
Client.prototype.putSync = function (...args) {
    return new Promise((resolve, reject)=> {
        args.push((err)=> err ? reject(err) : resolve());
        this.put.apply(this, args);
    });
};

module.exports = Client;