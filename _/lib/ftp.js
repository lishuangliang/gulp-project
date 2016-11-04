const through = require('through2');
const upload = require('./modules/upload');

module.exports = function (options) {
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

    if (options.config === null) throw 'Invalid ftp config';
    if (options.to === null) throw 'Invalid ftp output path';

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
    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            files.push(file);
        }
        callback();
    }, function (callback) {
        upload(files, options, callback);
    });
};