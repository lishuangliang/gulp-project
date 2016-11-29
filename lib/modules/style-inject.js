/**
 * css注入
 * @param css
 * @returns {*}
 */
module.exports = function styleInject(css) {
    var head = document.head || document.getElementsByTagName('head')[0],
        style = document.createElement('style');

    style.type = 'text/css';
    if (style.styleSheet) {
        style.styleSheet.cssText = css || '';
    } else {
        style.appendChild(document.createTextNode(css) || '');
    }
    head.appendChild(style);
};