import util from 'util';
import pth from 'path';
import tinify from 'tinify';
import request from 'request';
import {log, colors} from 'gulp-util';
import utils from './utils';

/**
 * 修改tinify原生函数fromBuffer 使其通过file获取到文件信息
 * @param string
 * @returns {*}
 */
tinify.Source.fromBuffer = function (string) {
    var response = tinify.client.request("post", "/shrink", string);
    var location = response.get("headers").get("location");
    return {
        obj: new tinify.Source(location),
        file: response.get("body")
    };
};

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
                resolve(res.caseless.dict['compression-count']);
            }
        });
    });
}

/**
 * 获取可用的token
 * @returns {String|Null}
 */
async function token() {
    //第一次使用 去校验token并获取使用次数
    if (AUTH_TOKEN == null) {
        AUTH_TOKEN = {};

        let startTime = Date.now();
        log("Starting", util.format("'%s'...", colors.cyan('check token')));

        for (let token of process.env.AUTH_TOKENS.split(',')) {
            AUTH_TOKEN[token] = await compressionCount(token);
        }

        log("Finished", util.format("'%s'", colors.cyan('check token')), 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime)));
    }

    for (let token in AUTH_TOKEN) {
        if (AUTH_TOKEN[token] < 480) return token;
    }
    return null;
}

export default function (path, contents) {
    return new Promise(async(resolve, reject) => {
        try {
            const name = pth.basename(path),
                startTime = Date.now();

            tinify.key = await token(); //设置token
            if (tinify.key === null) return reject('没有可以使用的token');

            log("Starting", util.format("'%s'...", colors.cyan('compress ' + name)));
            let source = tinify.fromBuffer(contents);
            source.obj.toBuffer(function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    AUTH_TOKEN[tinify.key] = tinify.compressionCount; //更新使用次数
                    source.file.then((res) => { //读取压缩信息
                        let info = JSON.parse(res.toString());
                        log("Finished", util.format("'%s'", colors.cyan('compress ' + name), 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime))), colors.green(util.format('%s -> %s', utils.formatSizeUnits(info.input.size), utils.formatSizeUnits(info.output.size))));
                        resolve(data);
                    });
                }
            });
        } catch (e) {
            reject(e);
        }
    });
};