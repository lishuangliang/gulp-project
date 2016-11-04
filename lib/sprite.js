const pth = require('path');
const fs = require('fs');
const Spritesmith = require('spritesmith');
const through = require('through2');
const {File, log} = require('gulp-util');
const utils = require('./modules/utils');
const rename = require('./modules/rename');

const PLUGIN_NAME = 'gulp-project.sprite';

module.exports = function (options) {
    options = Object.assign({
        padding: 20,
        algorithm: 'binary-tree',
        rename: null
    }, options);

    var files = []; //文件列表

    return through.obj(function (file, enc, cb) {
        if (file.isBuffer() && /\.(jpe?g|png)$/.test(file.path)) {
            files.push(file.path);
        } else {
            this.push(file);
        }

        cb();
    }, function (cb) {
        if (files.length === 0) return cb();

        Spritesmith.run({
            src: files,
            padding: options.padding,
            algorithm: options.algorithm
        }, (err, result)=> {
            if (err) {
                log(utils.error(PLUGIN_NAME, err));
            } else {
                //精灵图输出路径
                let spritePath = pth.join(pth.dirname(files[0]), 'sprite_' + utils.md5(result.image) + '.png');

                //rename处理
                if (options.rename) spritePath = rename(spritePath, options.rename);

                //输出文件
                let err = fs.writeFileSync(spritePath, result.image);
                if (err) {
                    log(utils.error(PLUGIN_NAME, err, spritePath));
                } else {
                    this.push(new File({
                        base: pth.dirname(spritePath),
                        path: spritePath,
                        contents: result.image
                    }));
                    log(`精灵图合并成功 --> ${spritePath}\n`, result.coordinates); //打印出合并信息
                }
            }
            cb();
        });
    });
};