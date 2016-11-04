import pth from 'path';

export default function (path, obj) {
    var parsedPath = {
        dirname: pth.dirname(path),
        basename: pth.basename(path, pth.extname(path)),
        extname: pth.extname(path)
    };

    if (typeof obj === "string" && obj !== '') {
        return obj;
    } else if (typeof obj === 'function') {
        obj(parsedPath);
        return pth.join(parsedPath.dirname, parsedPath.basename + parsedPath.extname);
    } else if (typeof obj === 'object' && obj !== undefined && obj !== null) {
        let info = Object.assign({prefix: '', suffix: ''}, parsedPath);
        return pth.join(info.dirname, info.prefix + info.basename + info.suffix + info.extname);
    } else {
        return path;
    }
}