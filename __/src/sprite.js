import pth from 'path';
import Spritesmith from 'spritesmith';
import through from 'through2';
import {File} from 'gulp-util';
import utils from './modules/utils';
import rename from './modules/rename';

export default function (options) {
    /**
     * 配置选项
     * @type {*}
     */
    options = Object.assign({
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

        if (file.isBuffer() && utils.isImageFile(file.path)) {
            files.push(file.path);
        }

        callback(null, file);
    }, function (callback) {
        if (files.length > 1) {
            Spritesmith.run(Object.assign({
                src: files,
            }, options), (err, result) => {
                if (err) {
                    this.emit('error', err);
                } else {
                    console.log(result.coordinates);

                    let spritePath = pth.join(pth.dirname(files[0]), 'sprite_' + utils.md5(result.image) + '.png');

                    //rename处理
                    if (options.rename) spritePath = rename(spritePath, options.rename);

                    this.push(new File({
                        base: pth.dirname(spritePath),
                        path: spritePath,
                        contents: result.image
                    }));
                }
                callback();
            });
        } else {
            callback();
        }
    });
}