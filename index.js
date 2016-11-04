module.exports.filter = require('./lib/filter');
module.exports.readFile = require('./lib/readFile');
module.exports.rename = require('./lib/rename');
module.exports.sprite = require('./lib/sprite');
module.exports.tinify = require('./lib/tinify');
module.exports.ftp = require('./lib/ftp');
module.exports.utils = require('./lib/modules/utils');
module.exports.request = require('request');
module.exports.del = require('del');
module.exports.gutil = require('gulp-util');


// module.exports.filter = require('./_/lib/filter');
module.exports.compile = require('./_/lib/compile');
// module.exports.tinify = require('./_/lib/tinify');
// module.exports.sprite = require('./_/lib/sprite');
module.exports.rollup = require('./_/lib/rollup');
// module.exports.rename = require('./_/lib/rename');
// module.exports.ftp = require('./_/lib/ftp');
module.exports.readFiles = require('./_/lib/readFiles');
// module.exports.utils = require('./_/lib/modules/utils');
// module.exports.del = require('del');
// module.exports.gutil = require('gulp-util');
module.exports.noop = require('gulp-util').noop;