const pth = require('path');
const fs = require('fs');
const through = require('through2');
const request = require('request');
const {log, colors} = require('gulp-util');
const Promise = require('./modules/promise');
const tinify = require('./modules/tinify');
const utils = require('./modules/utils');

var AUTH_TOKEN = null;

/**
 * 获取token当月已经使用次数
 * https://tinypng.com/developers/reference#compression-count
 * @param {String} token
 * @returns {Promise}
 */
function compressionCount(token) {
    return new Promise(function (resolve, reject) {
        request({
            url: 'https://api.tinypng.com/shrink',
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + new Buffer('api:' + token).toString('base64')
            }
        }, function (err, res, body) {
            if (err || JSON.parse(body).error === 'Unauthorized') {
                reject(err || 'invalid token: ' + token);
            } else {
                log('Use the Count', colors.cyan(token), colors.green(res.caseless.dict['compression-count']));
                AUTH_TOKEN[token] = res.caseless.dict['compression-count'];
                resolve();
            }
        });
    });
}

/**
 * 压缩图片 只支持png和jpg
 * @param {Object} file
 * @param {String} token
 * @returns {Promise}
 */
function compressionFile(file, token) {
    const startTime = Date.now();
    return new Promise(function (resolve, reject) {
        tinify.key = token;
        let source = tinify.fromBuffer(file.contents);
        source.obj.toBuffer(function (err, data) {
            if (err) {
                reject(err);
            } else {
                AUTH_TOKEN[token] = tinify.compressionCount; //更新使用次数
                source.file.then((res) => { //读取压缩信息
                    let info = JSON.parse(res.toString());
                    log("Compression", colors.cyan(pth.basename(file.path)), 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime)), colors.green(`${utils.formatSizeUnits(info.input.size)} -> ${utils.formatSizeUnits(info.output.size)}`));
                    resolve(data);
                });
            }
        });
    });
}

/**
 * 获取可用的token
 * @param {Array} tokens
 * @returns {Promise}
 */
function getAvailableToken(tokens) {
    return new Promise(function (resolve, reject) {
        function _() {
            for (let token in AUTH_TOKEN) {
                if (AUTH_TOKEN[token] < 480) {
                    return resolve(token)
                }
            }
            reject('There is no available token');
        }

        if (!AUTH_TOKEN) {
            AUTH_TOKEN = {};
            let promises = [],
                startTime = Date.now();
            log("Starting", `'${colors.cyan('check token')}'...`);

            for (let token of tokens) {
                promises.push(compressionCount(token));
            }

            Promise.all(promises).then(function () {
                log("Finished", colors.cyan('check token'), 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime)));
                _();
            }).catch(reject); //并行执行
        } else {
            _();
        }
    });
}

module.exports = function (tokens) {
    tokens = tokens || ['L5Iyfv0_IJkc26IFIxfkUcUBmo9bE-xH', 'o3u-F7z6a0Ik2540_f0nyMgauqWGyIUM', 'kcSI-3W3Ktvkl-m6WoGULcrynTA_X6Ig', 'sM5ymb1YuwI5TkFKQNPyiS6t0kMsRT3p'];
    tokens = tokens instanceof Array ? tokens : [tokens];

    var cache = {},
        cacheFilePath = pth.join(process.cwd(), 'gulp.compression.lock');

    //读取缓存 如果格式错误会重置
    if (fs.existsSync(cacheFilePath)) {
        try {
            cache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        } catch (e) {
            cache = {};
        }
    }

    return through.obj(function (file, enc, cb) {
        if (file.isBuffer() && /\.(jpe?g|png)/.test(file.path)) {
            let relative = pth.relative(process.cwd(), file.path);
            //判断md5戳确定文件是否被压缩过 如果已经被压缩就不在处理
            if (cache[relative] === utils.md5(file.contents, 12)) return cb(null, file);
            //压缩图片
            Promise.series([
                getAvailableToken.bind(null, tokens),
                compressionFile.bind(null, file)
            ], true).then((res)=> {
                cache[relative] = utils.md5(res[1], 12); //存储缓存
                fs.writeFileSync(file.path, res[1]); //替换原文件

                file.contents = res[1];
                this.push(file);
                cb();
            }).catch((err)=> {
                this.emit('error', utils.error(PLUGIN_NAME, err));
                cb();
            });
        } else {
            cb(null, file);
        }
    }, function (cb) {
        fs.writeFileSync(cacheFilePath, JSON.stringify(cache));
        cb();
    });
};

