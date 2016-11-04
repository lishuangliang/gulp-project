const pth = require('path');
const through = require('through2');
const tinify = require('tinify');
const request = require('request');
const {log, colors} = require('gulp-util');
const utils = require('./modules/utils');

var AUTH_TOKEN = {};

module.exports = function (tokens) {
    //tinify tokens
    tokens = tokens || ['L5Iyfv0_IJkc26IFIxfkUcUBmo9bE-xH', 'o3u-F7z6a0Ik2540_f0nyMgauqWGyIUM', 'kcSI-3W3Ktvkl-m6WoGULcrynTA_X6Ig', 'sM5ymb1YuwI5TkFKQNPyiS6t0kMsRT3p'];
    //需要压缩的图片的集合
    var files = [];
    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer() && /\.(jpe?g|png)/.test(file.path)) {
            files.push(file.path);
        }
        callback(null, file);
    }, function (callback) {
        if (files.length > 0) {

        } else {
            callback();
        }
    });
};