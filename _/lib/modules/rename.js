const pth = require('path');

module.exports = function (path, setting) {
    let info = pth.parse(path),
        parsedPath = {
            dirname: info.dir,
            basename: info.name,
            extname: info.ext
        };

    if (typeof setting === "string" && setting) {
        return setting;
    } else if (typeof setting === "function") {
        parsedPath = setting(parsedPath);
        return pth.join(parsedPath.dirname, parsedPath.basename + parsedPath.extname);
    } else if (setting instanceof Object) {
        parsedPath = Object.assign({prefix: '', suffix: ''}, parsedPath, setting);
        return pth.join(parsedPath.dirname, parsedPath.prefix + parsedPath.basename + parsedPath.suffix + parsedPath.extname);
    } else {
        return path;
    }
};