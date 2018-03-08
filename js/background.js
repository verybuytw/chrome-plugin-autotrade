window.currentURL = '';
window.isAutoTradeStarted = false;
window.cartUrl = 'https://world.taobao.com/cart/cart.htm?showResult=1';
window.backfilledInfo = '';
// 存放從淘寶購物車爬到的資訊
window.taobaoCartResult = [];

// https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function sleepRandomBetween(min, max) {
    var interval = max - min;
    var s = Math.floor((Math.random() * interval) + min);
    var ms = Math.floor((Math.random() * 1000));
    var wait = s * 1000 + ms;
    console.log("sleep " + wait + " ms.");
    return new Promise(resolve => setTimeout(resolve, wait));
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
        // console.log(tab, 'tabsOnActivated');
        window.currentURL = tab.url;
    })
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    window.currentURL = tab.url;
    var tabStatus = changeInfo.status;

    if (tab.url.match(/\/product\/batch_auto_trade_chrome/)) {
        chrome.pageAction.show(tabId);
    }
    if (tab.url.match(/\/trade\/itemlist\/list_bought_items.htm/)) {
        chrome.pageAction.show(tabId);
    }
    if (tab.url == window.cartUrl) {
        chrome.tabs.sendMessage(tabId, {
            type: 'showResult',
            taobaoType: autoTrade.getRunType()
        });
        return;
    }
    if (window.isAutoTradeStarted && tabStatus == 'complete') {
        // console.log('tabId: #' + tabId + ' onUpdated...');
        // 預設跑 taobao 的建構式
        var taobaoType = 'taobao';
        if (tab.url.match(/tmall/)) {
            taobaoType = 'tmall';
        }
        function returnMsgCallback(res) {
            // console.log(res, 'Got a callback msg from cs...');
        }
        chrome.tabs.sendMessage(tabId, {
            type: 'addItemToCart',
            taobaoType: taobaoType,
            taobaoItem: autoTrade.getTaobaoItem()
        }, returnMsgCallback);
    }
});

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    // console.log(tabId, removeInfo);
});

chrome.runtime.onMessage.addListener(async function(msg, sender, sendResponse) {

    switch(msg.type) {
        case 'addItemToCart':
            var seq = autoTrade.getCurrentSeq();

            autoTrade.setAdditionalInfoBySeq(seq, msg.additionalInfo);

            autoTrade.setTradeDoneBySeq(seq++);

            if (seq == autoTrade.getTaobaoItemListSize()) {
                await sleepRandomBetween(1, 2);
                autoTrade.chromeTabsCreate(window.cartUrl);
                chrome.tabs.remove([sender.tab.id]);
                window.isAutoTradeStarted = false;
                return;
            }

            autoTrade.setTaobaoItem(seq, autoTrade.getTaobaoListContentBySeq(seq));

            var taobaoType = 'taobao';
            if (sender.tab.url.match(/tmall/)) {
                taobaoType = 'tmall';
            }
            triggerAutoTrade(taobaoType);

            chrome.tabs.remove([sender.tab.id]);
            break;
        case 'showResult':
            autoTrade.chromeTabsCreate('result.html');
            // 存取從淘寶購物車爬到的資訊
            window.taobaoCartResult = msg.taobaoCartResult;
        break;
        default:
            console.log("It doesn't match type:" + msg.type);
    }
});

// 儲存自動執行點選 taobao item 內容的所有狀態
var autoTrade = (function() {
    var taobaoType = null;
    var totalItem = 0;
    var taobaoItem = {
        seq: 0,
        content: {
            id: '0',
            colorSku: '',
            sizeSku: '',
            amount: 0,
            skuId: ''
        }
    };
    // var taobaoItemList = [];
    var taobaoItemList = [
        {
            content: {id: '', colorSku: '', sizeSku: '', amount: 0, skuId: ''},
            done: 0
        }
    ];
    return {
        chromeTabsCreate: function(url) {
            chrome.tabs.create({url: url});
            // console.log('#' + taobaoItem.seq + ' tabs created...');
        },
        keyGenerator: function(port) {
            port.onMessage.addListener(function(msg) {
                chrome.tabs.query({
                    currentWindow: true,
                    active: true
                }, function(currentTabs) {
                    var currentTabId = currentTabs[0].id
                    function returnMsgCallback(res) {
                        autoTrade.sendFillTidsMessage(res);
                    }
                    chrome.tabs.sendMessage(currentTabId, {
                        type: 'keyGenerator'
                    }, returnMsgCallback);
                });
            });
        },
        sendFillTidsMessage: function(data) {
            chrome.tabs.query({
                url: '*://*.verybuy.tw/product/batch_auto_trade_chrome/*'
            }, function(currentTabs) {
                if (0 === currentTabs.length) {
                    alert('找不到回填目標後台頁面');
                    return;
                }
                for (let i in currentTabs) {
                    let targetTabId = currentTabs[i].id;
                    function returnMsgCallback(res) {
                        alert('回填結束，成功回填 ' + res.success_count + ' 筆');
                    }
                    chrome.tabs.sendMessage(targetTabId, {
                        type: 'fillTidsIntoTable',
                        data: data
                    }, returnMsgCallback);
                }
            });
        },
        prepareItemsFromContentScript: function(port) {
            port.onMessage.addListener(function(msg) {
                chrome.tabs.query({
                    currentWindow: true,
                    active: true
                }, function(currentTabs) {
                    var currentTabId = currentTabs[0].id
                    function returnMsgCallback(res) {
                        if (typeof res == 'undefined') {
                            window.isAutoTradeStarted = false;
                            port.postMessage({success: false, message: 'Error: content script 不可在chrome extensions 網域執行！'});
                            return;
                        }
                        if (res.succsess && 'taobaoItems' in res && res.taobaoItems.length > 0) {
                            autoTrade.initTaobaoItemList(res.taobaoItems);
                            if ('taobaoType' in msg == false) {
                                window.isAutoTradeStarted = false;
                                port.postMessage({success: false, message: 'Error: taobaoType not in prepareItemsFromContentScript！'});
                                return;
                            }
                            autoTrade.setRunType(msg.taobaoType);
                            triggerAutoTrade(msg.taobaoType);
                        } else {
                            window.isAutoTradeStarted = false;
                            port.postMessage({success: false, message: 'Error: content script 找不到 定義的 taobaoItems javascript 物件結構 (Hint: document.getElementById("taobaoItemsContentScript"))！'});
                        }
                    }
                    chrome.tabs.sendMessage(currentTabId, {
                        type: 'prepareItemsFromContentScript'
                    }, returnMsgCallback);
                });
            });
        },
        initTaobaoItemList: function(list) {
            taobaoItemList = [];
            for (var x in list) {
                taobaoItemList.push({content: list[x], done: 0});
            }
            taobaoItem.seq = 0;
            taobaoItem.content = taobaoItemList[0].content;
            totalItem = taobaoItemList.length;
        },
        setRunType: function(type) {
            taobaoType = type;
        },
        getRunType: function() {
            return taobaoType;
        },
        getTaobaoItemList: function() {
            return taobaoItemList;
        },
        getTaobaoItemListSize: function() {
            return totalItem;
        },
        getTaobaoListContentBySeq: function(seq) {
            return taobaoItemList[seq].content;
        },
        getTaobaoItem: function() {
            return taobaoItem;
        },
        setTaobaoItem: function(seq, itemContent) {
            taobaoItem.seq = seq;
            taobaoItem.content = itemContent;
        },
        getCurrentSeq: function() {
            return taobaoItem.seq;
        },
        setTradeDoneBySeq: function(seq) {
            taobaoItemList[seq].done = 1;
        },
        setAdditionalInfoBySeq: function(seq, additionalInfo) {
            taobaoItemList[seq].content.name = additionalInfo.itemName;
            taobaoItemList[seq].content.colorName = additionalInfo.colorName;
            taobaoItemList[seq].content.sizeName = additionalInfo.sizeName;
            taobaoItemList[seq].content.cKey = additionalInfo.cKey;
        },
        getTaobaoCartResult: function() {
            // 從淘寶購物車爬到的資訊
            return window.taobaoCartResult
        }
    };
})();

chrome.runtime.onConnect.addListener(function(port) {
    switch(port.name) {
        case 'tradeConfigFromPopup':
            window.isAutoTradeStarted = true;
            setTradeConfigFromPopup(port);
            break;
        case 'prepareItemsFromContentScript':
            window.isAutoTradeStarted = true;
            autoTrade.prepareItemsFromContentScript(port);
            break;
        case 'checkAutoTradeState':
            checkAutoTradeState(port);
            break;
        case 'keyGenerator':
            autoTrade.keyGenerator(port);
            break;
        default:
            console.log("It doesn't match port name:" + port.name);
    }
});

var checkAutoTradeState = function(port) {
    port.onMessage.addListener(function(msg) {
        port.postMessage({isAutoTradeStarted: window.isAutoTradeStarted});
    });
}

var setTradeConfigFromPopup = function(port) {
    port.onMessage.addListener(function(msg) {
        if (msg.taobaoItems.length == 0) {
            port.postMessage({success: false, message: 'Error: taobaoItems 不得為空值！'});
            return;
        }
        autoTrade.initTaobaoItemList(msg.taobaoItems);
        if ('taobaoType' in msg == false) {
            msg.taobaoType = 'taobao'
        }
        triggerAutoTrade(msg.taobaoType);
    });
}

var triggerAutoTrade = function(taobaoType = 'taobao') {
    var taobaoItemId = autoTrade.getTaobaoItem().content.id;
    var skuId = null;
    if ('skuId' in autoTrade.getTaobaoItem().content) {
        skuId = autoTrade.getTaobaoItem().content.skuId;
    }
    if ('taobao' === taobaoType) {
        var url = 'https://item.taobao.com/item.htm?id=' + taobaoItemId;
    } else {
        var url = 'https://item.taobao.com/item.htm?id=' + taobaoItemId + '&skuId=' + skuId;
    }
    autoTrade.chromeTabsCreate(url);
}
