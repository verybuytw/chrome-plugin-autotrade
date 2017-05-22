function renderBySelectorName(selectorName, text) {
    document.querySelectorAll(selectorName)[0].textContent = text;
}

function checkAutoTrade() {
    var port = chrome.runtime.connect({
        name: "checkAutoTradeState"
    });
    port.postMessage({});
    port.onMessage.addListener(function(msg) {
        if (msg.isAutoTradeStarted) {
            document.getElementById('auto-trade').setAttribute('disabled', 1);
        }
    });
}

// bp 可以單向使用background.js的函數
var bp = chrome.extension.getBackgroundPage();
// port.name = tradeConfigFromPopup 才會用到以下測試用的 data
// 淘寶商品測試資料
// var myTaobaoItems = [
//     {id: '527361405258', colorSku: '1627207:149938866', sizeSku: '20509:28315', amount: 3},
//     {id: '545998369080', colorSku: '1627207:7201401', sizeSku: '20509:1446377418', amount: 5}
// ];
// 天貓商品測試資料
var myTaobaoItems = [
    {id: '545634494258', colorSku: '1627207:1680461697', sizeSku: '20509:387654415', amount: 3, skuId: '3457276779999'},
    {id: '545923811219', colorSku: '1627207:30155', sizeSku: '20509:28314', amount: 5, skuId: '3460491719440'}
];

document.addEventListener('DOMContentLoaded', function() {
    console.log(bp.currentURL, 'currentURL');
    if (bp.currentURL.match(/\/product\/batch_auto_trade_chrome\/taobao/)) {
        document.querySelectorAll('.group-trade-taobao')[0].classList.remove('hide');
    }
    if (bp.currentURL.match(/\/product\/batch_auto_trade_chrome\/tmall/)) {
        document.querySelectorAll('.group-trade-tmall')[0].classList.remove('hide');
    }
    if (bp.currentURL.match(/\/trade\/itemlist\/list_bought_items.htm/)) {
        document.querySelectorAll('.group-keyGen')[0].classList.remove('hide');
    }
    // 確認是否正在執行自動拍, 正在執行的話就disabled按鈕
    checkAutoTrade();
});

document.getElementById('autoTrade-taobao').addEventListener('click', function(e) {
    var port = chrome.runtime.connect({
        // name: "tradeConfigFromPopup"
        name: "tradeConfigFromContentScript"
    });
    port.postMessage({
        taobaoItems: myTaobaoItems,
        taobaoType: 'taobao'
    });

    port.onMessage.addListener(function(msg) {
        if (!msg.success) {
            renderBySelectorName('.debugger', msg.message);
        }
    });
});

document.getElementById('autoTrade-tmall').addEventListener('click', function(e) {
    var port = chrome.runtime.connect({
        name: "tradeConfigFromPopup"
        // name: "tradeConfigFromContentScript"
    });
    port.postMessage({
        taobaoItems: myTaobaoItems,
        taobaoType: 'tmall'
    });

    port.onMessage.addListener(function(msg) {
        if (!msg.success) {
            renderBySelectorName('.debugger', msg.message);
        }
    });
});

document.getElementById('key-gen').addEventListener('click', function(e) {
    var port = chrome.runtime.connect({
        name: "keyGenerator"
    });
    port.postMessage({});
    port.onMessage.addListener(function(msg) {
        if (!msg.success) {
            renderBySelectorName('.debugger', msg.message);
        }
    });
});

document.getElementById('key-reset').addEventListener('click', function(e) {
    var port = chrome.runtime.connect({
        name: "resetBackfilledKey"
    });
});

