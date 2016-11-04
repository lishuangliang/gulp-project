/**
 * 工具默认配置
 * @type {{
 * TEXT_FILE_EXTS: RegExp 文本文件扩展名,
 * IMAGE_FILE_EXTS: RegExp 图片文件扩展名,
 * HTML_FILE_EXTS: RegExp html文件扩展名,
 * RES_FILE_EXTS: RegExp 资源文件扩展名 [需要进行设置指纹的文件]
 * }}
 */
module.exports = {
    TEXT_FILE_EXTS: /\.(css|tpl|js|php|txt|json|xml|htm|text|xhtml|html|md|conf|po|config|tmpl|coffee|less|sass|jsp|scss|manifest|bak|asp|tmp|haml|jade|aspx|ashx|java|py|c|cpp|h|cshtml|asax|master|ascx|cs|ftl|vm|ejs|styl|jsx|handlebars|shtml|ts|tsx|yml|sh|es|es6|es7|map|vue)$/i,
    IMAGE_FILE_EXTS: /\.(svg|tif?f|wbmp|png|bmp|fax|gif|ico|jfif|jpe|jpeg|jpg|woff|cur|webp|swf|ttf|eot|woff2)$/i,
    HTML_FILE_EXTS: /\.(html|tpl|ejs)$/i,
    RES_FILE_EXTS: /\.(js|json|css|mp3|mp4|ogg|webm|swf|ttf|otf|eot|woff2?|svg|bmp|gif|png|jpe?g|webp|tif?f)$/i,
    SCRIPT_INLINE_REGEXP: /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(__inline|___?uri|__hash)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g
};