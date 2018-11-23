const pth = require('path');

/**
 * 重命名文件
 * @param {String} path 文件路径
 * @param {String|Function|Object} obj 重命名规则
 * @returns {String} 重置后的文件路径
 */
module.exports = function (path, obj) {
    let info = pth.parse(path),
        parsedPath = {
            dirname: info.dir,
            basename: info.name,
            extname: info.ext
        },
        type = typeof obj;

    if (type === "string" && obj) {
        return obj;
    } else if (type === "function") {
        obj(parsedPath);
        return pth.join(parsedPath.dirname, parsedPath.basename + parsedPath.extname);
    } else if (obj instanceof Object) {
        parsedPath = Object.assign({prefix: '', suffix: ''}, parsedPath, obj);
        return pth.join(parsedPath.dirname, parsedPath.prefix + parsedPath.basename + parsedPath.suffix + parsedPath.extname);
    } else {
        return path;
    }
};