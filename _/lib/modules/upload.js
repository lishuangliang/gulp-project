const pth = require('path');
const Client = require('ftp');
const {log, colors} = require('gulp-util');
const utils = require('./utils');

function sync(keys) {
    for (let key of keys) {
        Client.prototype[key + 'Sync'] = function (...args) {
            return new Promise((resolve, reject) => {
                args.push((err)=> key !== 'rmdir' && err ? reject(err) : resolve()); //忽略删除目录的错误
                this[key].apply(this, args);
            });
        }
    }
}

sync(['mkdir', 'rmdir', 'put']);

var cache = {};

function upload(files, to, config, clean) {
    return new Promise(function (resolve, reject) {
        log('Starting', `'${colors.cyan('upload files to ftp ' + config.host)}'...`);

        const startTime = Date.now();
        const client = new Client();
        client.on('error', reject);
        client.on('ready', function () {
            let promises = [];
            if (clean) promises.push(client.rmdirSync(to, true)); //清理工作目录

            for (let file of files) {
                let destPath = pth.join(to, file.relative), //输出路径
                    destDir = pth.dirname(destPath);

                if (!cache[`${config.host}_${destDir}`]) {
                    promises.push(client.mkdirSync(destDir, true)); //创建文件目录
                    cache[`${config.host}_${destDir}`] = true;
                }
                promises.push(client.putSync(file.contents, destPath)); //创建文件
            }

            Promise.all(promises).then(function () {
                log('Finished', `'${colors.cyan('upload files to ftp ' + config.host)}'`, 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime)));
                client.end();
                resolve(); //上传全部文件成功
            }).catch(reject);
        });
        client.connect(config);
    });
}

function each(files, options, callback, index = 0) {
    let config = options.config[index];
    upload(files, options.to, config, options.clean).then(function () {
        if (!options.config[index + 1]) {
            callback();
        } else {
            each(files, options, callback, index + 1);
        }
    }).catch((err)=> {
        console.log(err);
        callback();
    });
}


module.exports = function (files, options, callback) {
    each(files, options, callback);
};