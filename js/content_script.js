$(function() {
    console.log('執行VeryBuy批次自動拍Chrome擴充工具...');
    window.isTradeDone = false;

    /* Listen for messages */
    chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
        /* If the received message has the expected format... */

        switch(msg.type) {
            case 'autoTrade':
                var currentSeq = msg.taobaoItem.seq;
                var taobaoItem = msg.taobaoItem.content;
                runAutoTrade(taobaoItem.id, taobaoItem.colorSku, taobaoItem.sizeSku, taobaoItem.colorCartFullName, taobaoItem.sizeCartFullName, taobaoItem.amount);
                // sendResponse 回傳訊息僅在同步內有效
                sendResponse({currentSeq: currentSeq});

                autoTradeEnsureDone(function() {
                    console.log('msg', msg);
                    console.log('#' + msg.taobaoItem.seq + ' done.', '(Received a msg from bp...)');
                    chrome.runtime.sendMessage({type: 'autoTrade', taobaoItemId: taobaoItem.id, additionalInfo: additionalInfo.getComparison()});
                });
                break;
            case 'tradeConfigFromContentScript':
                // 要先 JSON.stringify() 再 encodeURIComponent()
                // 範例儲存方式 <div id="taobaoItemsContentScript" data-items="%5B%7B%22id%22%3A%22527361405258%22%2C%22colorSku%22%3A%2220509%3A28315%22%2C%22sizeSku%22%3A%221627207%3A149938866%22%2C%22amount%22%3A10%7D%2C%7B%22id%22%3A%22545998369080%22%2C%22colorSku%22%3A%2220509%3A1446377418%22%2C%22sizeSku%22%3A%221627207%3A7201401%22%2C%22amount%22%3A8%7D%5D">我是taobaoItems<div>
                var $targetElement = $('#taobaoItemsContentScript');
                if ($targetElement.length > 0 && typeof $targetElement.data('items') != 'undefined') {
                    var taobaoItems = JSON.parse(decodeURIComponent($targetElement.data('items')));
                    sendResponse({succsess: true, taobaoItems: taobaoItems});
                } else {
                    sendResponse({succsess: false});
                }

                break;
            case 'showResult':
                alert('即將產生VeryBuy自動拍 購物訂單對照表...');
                taobaoCartEnsureLoaded(function() {
                    parseTaobaoCartContent.init();
                    var taobaoCartResult = parseTaobaoCartContent.getTaobaoCartResult();
                    console.log(taobaoCartResult, 'taobaoCartResult');
                    chrome.runtime.sendMessage({type: 'showResult', taobaoCartResult: taobaoCartResult});
                }, Date.now());
                location.replace('https://world.taobao.com/cart/cart.htm');
                break;
            default:
                console.log("It doesn't match type:" + msg.type);
        }
    });
});

var runAutoTrade = function(taobaoItemId, colorSku, sizeSku, colorCartFullName, sizeCartFullName, amount) {

    if (!taobaoItemId || !amount) {
        alert('taobaoItemId || amount 項目不得為空值！');
        return;
    }
    function AutoTrade() {
        this.taobaoItemId = taobaoItemId;
        this.colorSku = colorSku;
        this.sizeSku = sizeSku;
        this.colorCartFullName = colorCartFullName;
        this.sizeCartFullName = sizeCartFullName;
        this.amount = amount;
    }
    AutoTrade.prototype.run = function() {
        colorLabel: {
            if (this.colorSku === null) {
                // 表示此商品本來就沒colorSku項目
                alert('colorSku null')
                break colorLabel;
            }
            var colorSkuElement = document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + this.colorSku + '"]');
            if (detection.ifElementNotExisted(colorSkuElement, 'id: ' + this.taobaoItemId + ' - colorSku: ' + this.colorSku + '不存在')) {
                window.isTradeDone = true;
                return;
            }

            colorSkuElement[0].classList.remove('tb-selected');

            colorSkuElement[0].click();

            // 爬網頁得到的資訊，暫時不用來比對了(vb後端會另外給一個購物車sku對應的翻譯名稱)
            additionalInfo.setNameByColorSku(this.colorSku);
        }

        sizeLabel: {
            if (this.sizeSku === null) {
                // 表示此商品本來就沒sizeSku項目
                alert('sizeSku null')
                break sizeLabel;
            }
            var sizeSkuElement = document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + this.sizeSku + '"]');

            if (detection.ifElementNotExisted(sizeSkuElement, 'id: ' + this.taobaoItemId + ' - sizeSku: ' + this.sizeSku + '不存在')) {
                window.isTradeDone = true;
                return;
            }

            sizeSkuElement[0].classList.remove('tb-selected');

            sizeSkuElement[0].click();

            // 爬網頁得到的資訊，暫時不用來比對了(vb後端會另外給一個購物車sku對應的翻譯名稱)
            additionalInfo.setNameBySizeSku(this.sizeSku);
        }

        additionalInfo.setNameByTaobaoItemId(this.taobaoItemId);

        this.setAmountByTriggerIncrease(this.amount);

        additionalInfo.setTaobaoItemId(this.taobaoItemId);
        additionalInfo.setColorCartFullName(this.colorCartFullName);
        additionalInfo.setSizeCartFullName(this.sizeCartFullName);
        additionalInfo.setAmountForKeyValue(this.amount);

        var amount_delay = this.amount * 350;

        setTimeout(function() {
            document.getElementById('J_btn_addToCart').click();

            popupCloseEnsureExisted(function() {
                document.querySelectorAll('.J_popup_close.sea-iconfont')[0].click();
                window.isTradeDone = true;
            }, Date.now());
        }, amount_delay);
    };
    AutoTrade.prototype.setAmountByTriggerIncrease = function(amount) {
        var i = 1;
        interval = setInterval(function() {
            if(i == amount) {
                clearInterval(interval);
                return;
            }
            document.querySelectorAll('.tb-increase.J_Increase.sea-iconfont')[0].click();
            i++
        }, 350);
    };

    var autoTrade = new AutoTrade();
    autoTrade.run();
};

var additionalInfo = (function() {
    var comparison = {};
    var _taobaoItemId = '0';
    var _colorCartFullName = '';
    var _sizeCartFullName = '';
    var _amount = 0;
    var getTaobaoItemName = function() {
        return document.querySelectorAll('#J_Title .tb-main-title .t-title')[0].textContent;
    };
    var getNameByColorSku = function(colorSku) {
        var colorSkuElement = document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + colorSku + '"] > a');
        return colorSkuElement[0].getAttribute('title');
    };
    var getNameBySizeSku = function(sizeSku) {
        var sizeSkuElement = document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + sizeSku + '"] > a');
        return sizeSkuElement[0].getAttribute('title');
    };
    var setKeyValue = function() {
        // 爬網頁得到的資訊sku名稱從cKey中移除，
        // 改用vb後端會另外給一個購物車sku對應的翻譯名稱
        var o = {
            id: _taobaoItemId,
            colorCartFullName: _colorCartFullName,
            sizeCartFullName: _sizeCartFullName,
            amount: parseInt(_amount)
        }
        comparison.cKey = JSON.stringify(o);
    }
    return {
        getComparison: function() {
            setKeyValue();
            return comparison;
        },
        setTaobaoItemId: function(taobaoItemId) {
            _taobaoItemId = taobaoItemId;
        },
        setColorCartFullName: function(colorCartFullName) {
            _colorCartFullName = colorCartFullName;
        },
        setSizeCartFullName: function(sizeCartFullName) {
            _sizeCartFullName = sizeCartFullName;
        },
        setNameByTaobaoItemId: function(taobaoItemId) {
            // 取的名稱暫時不需要 taobaoItemId
            comparison.itemName = getTaobaoItemName();
        },
        setNameByColorSku: function(colorSku) {
            comparison.colorName = getNameByColorSku(colorSku);
        },
        setNameBySizeSku: function(sizeSku) {
            comparison.sizeName = getNameBySizeSku(sizeSku);
        },
        setAmountForKeyValue: function(amount) {
            _amount = amount;
        }
    }
})();

var parseTaobaoCartContent = (function() {
    var taobaoCartResult = [];
    var getParseBasicInfo = function() {
        // 回傳一個 [[name], [id in href]]
        var result = [[], []];
        var basicInfo = document.querySelectorAll('.item-basic-info > a')
        basicInfo.forEach(function(item) {
            // name of item
            result[0].push(item.textContent);
            // href with id
            var href = item.getAttribute('href').split('//world.taobao.com/item/')[1];
            var taobaoItemid = href.split('.')[0];
            result[1].push(taobaoItemid);
        });
        return result;
    };
    var getParseMixedSku = function() {
        // 回傳 [[colorCartFullName], [sizeCartFullName]]
        // 或回傳 [[sizeCartFullName], [colorCartFullName]]
        var result = [];
        var mixedSku = document.querySelectorAll('.td-info .sku-line');
        if (detection.ifElementNotExisted(mixedSku, '$(\'.td-info .sku-line\') not found')) {
            return result;
        }
        var partSkuEven = [];
        var partSkuOdd = [];
        mixedSku.forEach(function(item, index) {
            if (index % 2 == 0) {
                partSkuEven.push(item.textContent);
            } else {
                partSkuOdd.push(item.textContent);
            }
        });
        for (var index in partSkuEven) {
            result.push([]);
            result[index].push(partSkuEven[index]);
        }
        for (var index in partSkuOdd) {
            result[index].push(partSkuOdd[index]);
        }
        return result;
    };
    var getAmountOfItems = function() {
        var result = [];
        var amountofItems = document.querySelectorAll('.item-amount > input');
        if (detection.ifElementNotExisted(amountofItems, '$(\'.item-amount > input\') not found')) {
            return result;
        }
        amountofItems.forEach(function(item) {
            result.push(item.getAttribute('value'));
        });
        return result;
    };
    var assignKeyValues = function() {
        for (var item in taobaoCartResult) {
            var i = Object.keys(taobaoCartResult).indexOf(item);
            item = taobaoCartResult[i];
            var o = {
                id: item.id,
                colorCartFullName: item.mixedCartFullName0,
                sizeCartFullName: item.mixedCartFullName1,
                amount: item.amount
            }
            taobaoCartResult[i].cKey = [];
            taobaoCartResult[i].cKey.push(JSON.stringify(o));

            o.colorCartFullName = item.mixedCartFullName1;
            o.sizeCartFullName = item.mixedCartFullName0;

            taobaoCartResult[i].cKey.push(JSON.stringify(o));
        }
    };
    return {
        init: function() {
            var basicInfo = getParseBasicInfo();

            basicInfo[0].forEach(function(item, i) {
                taobaoCartResult.push({name: item});
            });
            basicInfo[1].forEach(function(item, i) {
                taobaoCartResult[i].id = item;
            });

            var mixedCartFullNames = getParseMixedSku();

            mixedCartFullNames.forEach(function(item, i) {
                taobaoCartResult[i].mixedCartFullName0 = item[0].replace('：', ':');
                taobaoCartResult[i].mixedCartFullName1 = item[1].replace('：', ':');
            });

            getAmountOfItems().forEach(function(amount, i) {
                taobaoCartResult[i].amount = parseInt(amount);
            });

            assignKeyValues();
        },
        getTaobaoCartResult: function() {
            return taobaoCartResult;
        }
    }
})();

var detection = (function() {
    function Detection() {
        console.log('new Detection()...');
    };
    Detection.prototype.timeout = function(endDateTime, startDateTime, timeout, alertMessage, closeAlert) {
        if (endDateTime - startDateTime >= timeout) {
            if (!closeAlert) {
                alert(alertMessage);
            }
            return true;
        }
        return false;
    };
    Detection.prototype.ifElementNotExisted = function(element, alertMessage = '偵測到不存在元素', closeAlert) {
        if (element === null) {
            if (!closeAlert) {
                alert('Error: length of element@elementExistedDetection is null');
            }
            console.error(alertMessage, 'Detection@isElementExisted');
            return true;
        }
        if (element.length == 0) {
            if (!closeAlert) {
                alert('Error: length of element@elementExistedDetection is undefined');
            }
            console.error(alertMessage, 'Detection@isElementExisted');
            return true;
        }
        return false;
    };
    var _detection = new Detection();
    return {
        timeout: function(endDateTime, startDateTime, timeout, alertMessage, closeAlert = false) {
            return _detection.timeout(endDateTime, startDateTime, timeout, alertMessage, closeAlert);
        },
        ifElementNotExisted: function(element, alertMessage, closeAlert = false) {
            return _detection.ifElementNotExisted(element, alertMessage, closeAlert);
        }
    }
})();

var autoTradeEnsureDone = function(callback) {
    if (!window.isTradeDone) {
        setTimeout(function() { autoTradeEnsureDone(callback); }, 50);
    } else {
        if (callback) {
            callback();
        }
    }
};

var popupCloseEnsureExisted = function(callback, startDateTime) {
    if (detection.timeout(Date.now(), startDateTime, 3000, 'Error: 淘寶購物車Alert通知逾時')) {
        window.isTradeDone = true;
        return;
    }

    if (typeof document.querySelectorAll('.J_popup_close.sea-iconfont')[0] == 'undefined') {
        setTimeout(function() { popupCloseEnsureExisted(callback, startDateTime); }, 50);
    } else {
        if (callback) {
            callback();
        }
    }
};

var taobaoCartEnsureLoaded = function(callback, startDateTime) {
    if (detection.timeout(Date.now(), startDateTime, 3000, 'Error: 淘寶購物車頁面逾時')) {
        return;
    }
    if (typeof document.querySelectorAll('.item-basic-info > a')[0] == 'undefined') {
        setTimeout(function() { taobaoCartEnsureLoaded(callback, startDateTime); }, 50);
    } else {
        if (callback) {
            callback();
        }
    }
};
