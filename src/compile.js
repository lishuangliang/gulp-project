import pth from 'path';
import through from 'through2';
import utils from './modules/utils';
import {log, colors} from 'gulp-util';
import {html, css, js} from './modules/processor';

function compile(file) {
    return new Promise(async function (resolve, reject) {
        try {
            let info = pth.parse(file.path),
                contents = await utils.read(file.path, file.contents);

            file.dir = info.dir;
            file.ext = info.ext;
            file.contents = contents instanceof Buffer ? contents : new Buffer(contents); //初始化

            //html 内容嵌入 http请求合并 处理区块裁剪 资源定位
            if (utils.isHtmlFile(file.path)) {
                await html(file);
            }

            //css base64嵌入 资源定位
            if (/^\.css$/.test(file.ext)) {
                await css(file);
            }

            //js 内容嵌入 处理区块裁剪 资源定位
            if (/^\.js$/.test(file.ext)) {
                await js(file);
            }

            //对资源文件添加md5戳
            if (JSON.parse(process.env.COMPILE).hash && utils.isResFile(file.path)) {
                file.path = pth.join(file.dir, info.name + '_' + utils.md5(contents) + file.ext);
            }
        } catch (e) {
            return reject(e);
        }

        resolve(file);
    });
}

export default function (options, tokens, compress = false) {
    //tinify 图片压缩tokens
    process.env.AUTH_TOKENS = tokens || ['L5Iyfv0_IJkc26IFIxfkUcUBmo9bE-xH', 'o3u-F7z6a0Ik2540_f0nyMgauqWGyIUM', 'kcSI-3W3Ktvkl-m6WoGULcrynTA_X6Ig', 'sM5ymb1YuwI5TkFKQNPyiS6t0kMsRT3p'];
    //是否使用tinify压缩
    process.env.COMPRESS = compress ? '1' : '';


    //编译选项
    process.env.COMPILE = JSON.stringify(Object.assign({
        cwd: process.cwd(),
        www: '',
        hash: true,
        env: 0
    }, options));

    return through.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(utils.error('Cannot use streamed file', file.path));
        }

        if (file.isBuffer()) {
            let startTime = Date.now();
            file.files = []; //用来存储副文件
            compile(file).then((file)=> {
                log('Compile', colors.blue(file.path), 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime))); //打印编译信息

                for (let f of file.files) {
                    this.push(f); //添加副文件
                }
                delete file.files; //移除
                this.push(file); //添加主文件
                callback();
            }).catch((err) => {
                callback(err, null);
            });
        } else {
            callback(null, file);
        }
    }, function (callback) {
        log('Compile', colors.green('done'));
        callback();
    });
}