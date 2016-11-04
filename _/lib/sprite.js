const pth = require('path');
const fs = require('fs');
const Spritesmith = require('spritesmith');
const through = require('through2');
const File = require('gulp-util').File;
const utils = require('./modules/utils');
const rename = require('./modules/rename');


module.exports = function (options) {
    /**
     * 配置项
     * @type {{
     * padding: number 填充图像之间的间距,
     * algorithm: string 填充图像的摆放位置,
     * rename: null || function 雪碧图重命名 默认sprite_md5.png
     * }}
     */
    const config = Object.assign({
        padding: 20,
        algorithm: 'binary-tree',
        rename: null
    }, options);

    //需要合并的文件
    var files = [];
    return through.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isBuffer() && /\.(jpe?g|png)$/.test(file.path)) {
            files.push(file.path);
        }

        callback(null, file);
    }, function (callback) {
        if (files.length > 1) {
            Spritesmith.run(Object.assign({
                src: files,
            }, config), (err, result) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log(result.coordinates); //打印出映射文件的{x, y, width, height}

                    let spritePath = pth.join(pth.dirname(files[0]), 'sprite_' + utils.md5(result.image) + '.png');

                    //rename处理
                    if (options.rename) spritePath = rename(spritePath, options.rename);

                    //写入文件
                    fs.writeFile(spritePath, result.image, (err)=> {
                        if (err) return console.error(err);

                        this.push(new File({
                            base: pth.dirname(spritePath),
                            path: spritePath,
                            contents: result.image
                        }));
                        callback();
                    });
                }
            });
        } else {
            callback();
        }
    });
};