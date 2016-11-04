const pth = require('path');
const fs = require('fs');
const through = require('through2');
const {env, log, colors} = require('gulp-util');
const Promise = require('./modules/promise');
const Client = require('./modules/ftp');
const utils = require('./modules/utils');

const PLUGIN_NAME = 'gulp-project.ftp';

/**
 * 上传文件至单台服务器
 * @param {Array} files 需要上传的文件列表
 * @param {Boolean} clean 上传前是否清理ftp目标目录
 * @param {String} to 发布至FTP的目标路径
 * @param {Object} config ftp配置
 */
function upload(files, clean, to, config) {
    const message = `upload files to ftp ${config.host}:${config.port}${pth.join('/', to)}`;

    return new Promise(function (resolve, reject) {
        log('Starting', `'${colors.cyan(message)}'...`);

        const startTime = Date.now();
        const client = new Client();
        client.on('error', reject);
        client.on('ready', function () {
            let promises = [];
            if (clean) promises.push(this.rmdirSync.bind(this, to, true)); //清理工作目录

            for (let file of files) {
                let path = pth.join(to, file.relative); //输出路径

                promises.push(this.mkdirSync.bind(this, pth.dirname(path), true)); //创建文件目录
                promises.push(this.putSync.bind(this, file.contents, path)); //创建文件
            }

            Promise.series(promises).then(function () {
                log('Finished', `'${colors.cyan(message)}'`, 'after', colors.magenta(utils.formatTimeUnit(Date.now() - startTime)));
                client.end();
                resolve();
            }).catch(reject); //串行执行
        });
        client.connect(config);
    })
}

module.exports = function (options) {
    /**
     * 配置选项
     * gulp task --env * 设置环境变量
     * @type {{
     * clean: boolean 上传前是否清理ftp目标目录,
     * to: string 发布至FTP的路径
     * config: {
     *      host: string, ,分隔多个服务器
     *      port: number,
     *      user: string,
     *      password: string
     * } || [{
     *      env: number, 环境变量用于试用不同环境
     *      content: {
     *          host: string, ,分隔多个服务器
     *          port: number,
     *          user: string,
     *          password: string
     *      }
     * }]
     * }}
     */
    options = Object.assign({
        clean: true,
        to: null,
        config: {}
    }, options);

    if (options.to === null) throw utils.error(PLUGIN_NAME, 'Invalid ftp output path');
    if (options.config === null) throw utils.error(PLUGIN_NAME, 'Invalid ftp config');
    if (options.config instanceof Array && Object.keys(env).length === 0) throw utils.error(PLUGIN_NAME, 'Env is null，gulp task --env *');

    //FTP配置转换 环境选取
    if (options.config instanceof Array) {
        for (let conf of options.config) {
            if (env.env == conf.env) {
                options.config = conf.content;
                break;
            }
        }
    }

    if(options.config instanceof Array) throw utils.error(PLUGIN_NAME, `Fail to find the corresponding environment configuration，env = ${env.env}`);

    //FTP配置转换 多服务器处理
    if (options.config instanceof Object) {
        let hosts, config, conf, key;
        if ((hosts = options.config.host.split(',')).length > 1) {
            config = options.config;
            options.config = [];
            for (let host of hosts) {
                if (host.trim()) {
                    conf = {};
                    for (key in config) {
                        conf[key] = config[key];
                    }
                    conf.host = host.trim();
                    options.config.push(conf);
                }
            }
        } else {
            options.config = [options.config];
        }
    }

    var files = []; //需要上传的文件集合
    return through.obj(function (file, enc, cb) {
        if (file.isBuffer()) {
            files.push(file);
        } else {
            this.push(file);
        }
        cb();
    }, function (cb) {
        var promises = [];
        for (let conf of options.config) {
            promises.push(upload.bind(null, files, options.clean, options.to, conf))
        }

        Promise.series(promises).then(cb).catch((err)=> {
            //忽略一个错误信息
            if(/^Uncaught, unspecified "error" event/.test(err)) log(utils.error(PLUGIN_NAME, err));
            cb();
        });
    });
};