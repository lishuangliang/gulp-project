const pth = require('path');
const {spawnSync} = require('child_process');
const consistentPath = require('consistent-path');

let cmd = 'npm',
    npmPrefix,
    partialPath = ['node_modules', 'node-sass'],
    envObj = {};

//克隆当前环境
Object.keys(process.env).forEach(function (k) {
    envObj[k] = process.env[k];
});

//确保在OS X路径是有效的
envObj.PATH = consistentPath();

if (process.platform == 'win32') {
    cmd = 'npm.cmd';
} else {
    partialPath.unshift('lib');
}

//获得npm全局安装的目录路径
try {
    npmPrefix = spawnSync(cmd, ['get', 'prefix'], {
        env: envObj
    }).output[1].toString().trim()
} catch (e) {
    throw 'Node-SASS is not installed globally! Please make sure to install node-sass before using the global option.';
}

// 添加前缀
partialPath.unshift(npmPrefix);

module.exports = {
    path: pth.join.apply(null, partialPath),
    env: envObj
};