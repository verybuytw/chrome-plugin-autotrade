// bp 可以單向使用background.js的函數
var bp = chrome.extension.getBackgroundPage();

document.addEventListener('DOMContentLoaded', function() {

	$('#backfilledKey').text(bp.backfilledKey);
});