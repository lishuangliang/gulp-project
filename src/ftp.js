import util from 'util';
import pth from 'path';
import Client from 'ftp';
import through from 'through2';
import {log, colors} from 'gulp-util';
import utils from './modules/utils';

function sync(keys) {
    for (let key of keys) {
        Client.prototype[key + 'Sync'] = function (...args) {
            return new Promise((resolve) => {
                args.push(function (err) {
                    resolve(err);
                });
                this[key].apply(this, args);
            });
        }
    }
}

sync(['mkdir', 'rmdir', 'put']);

/**
 * 上传文件至FTP
 * @param {Array} files 需要上传的文件列表
 * @param {String} to 上传至FTP的工作目录
 * @param {Object} config ftp配置
 * @param {Boolean} clean 是否清理工作目录
 * @returns {Promise}
 */
function upload(files, to, config, clean) {
    return new Promise(function (resolve, reject) {
        const client = new Client();
        client.on('error', reject);
        client.on('ready', async() => {
            let err, file, destPath;
            if (clean) await client.rmdirSync(to, true); //清理工作目录
            if (err = await client.mkdirSync(to, true)) return reject(err); //创建项目目录

            for (file of files) {
                destPath = pth.join(to, pth.dirname(file.relative), pth.basename(file.relative)); //输出路径

                if (err = await client.mkdirSync(pth.dirname(destPath), true)) {
                    return reject(err);  //创建文件目录失败
                } else if (err = await client.putSync(file.contents, destPath)) {
                    return reject(err);  //上传文件失败
                }
            }
            client.end();
            resolve(); //上传全部文件成功
        });
        client.connect(config);
    });
}

/**
 * 上传操作开始
 * @param {Array} files 需要上传的文件列表
 * @param {Object} options ftp选项配置
 * @returns {Promise}
 */
function to(files, options) {
    return new Promise(async function (resolve, reject) {
        let config, startTime;
        for (config of options.config) {
            startTime = Date.now();
            log("Starting", util.format("'%s'...", colors.cyan('upload files to ftp ' + config.host)));
            try {
                await upload(files, options.to, config, options.clean);
            } catch (e) {
                reject(e);
            }
            log("Finished", util.format("'%s'", colors.cyan('upload files to ftp ' + config.host), 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime))));
        }
        resolve();
    });
}

export default function (options) {
    /**
     * 配置选项
     * @type {{
     * clean: boolean 是否清理FTP目录,
     * config: {
     *      host: string,
     *      port: number,
     *      user: string,
     *      password: string
     * } || [object],
     * to: string 发布至FTP的路径
     * }}
     */
    options = Object.assign({
        clean: true,
        to: null,
        config: null
    }, options);

    if (options.config === null) {
        throw utils.error('Invalid ftp config');
    }

    if (options.to === null) {
        throw utils.error('Invalid ftp output path');
    }

    //FTP配置转换
    if (!Array.isArray(options.config)) {
        let hosts, config, key;
        if ((hosts = options.config.host.split(',')).length > 1) {
            options.config = hosts.map(function (host) {
                config = {};
                for (key in options.config) {
                    config[key] = options.config[key];
                }
                config.host = host.trim();
                return config;
            });
        } else {
            options.config = [options.config];
        }
    }

    //需要上传的文件集合
    var files = [];
    var stream = through.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        files.push(file);
        callback(null, file);
    }, function (callback) {
        to(files, options).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
    });
    stream.resume();
    return stream;
}