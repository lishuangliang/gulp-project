import through from 'through2';
import rename from './modules/rename';

export default function (obj) {
    return through.obj(function (file, encoding, callback) {
        file.path = rename(file.path, obj);
        callback(null, file);
    });
}