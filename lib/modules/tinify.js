const tinify = require('tinify');

/**
 * 修改tinify原生函数fromBuffer 使其通过file获取到文件信息
 * @param string
 * @returns {*}
 */
tinify.Source.fromBuffer = function (string) {
    var response = tinify.client.request("post", "/shrink", string);
    var location = response.get("headers").get("location");
    return {
        obj: new tinify.Source(location),
        file: response.get("body")
    };
};

module.exports = tinify;