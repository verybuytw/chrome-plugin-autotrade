$(function() {
    console.log('執行VeryBuy批次自動拍Chrome擴充工具...');
    window.isTradeDone = false;

    /* Listen for messages */
    chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
        /* If the received message has the expected format... */
        window.detection = detectionHelper();

        switch(msg.type) {
            case 'addItemToCart':
                var currentSeq = msg.taobaoItem.seq;
                var taobaoItem = msg.taobaoItem.content;
                window.additionalInfo = additionalInfoBytaobaoType(msg.taobaoType);

                addItemToCart(msg.taobaoType, taobaoItem.id, taobaoItem.colorSku, taobaoItem.sizeSku, taobaoItem.colorCartFullName, taobaoItem.sizeCartFullName, taobaoItem.amount);
                // sendResponse 回傳訊息僅在同步內有效
                sendResponse({currentSeq: currentSeq});

                ensureAddItemToCartDone(function() {
                    console.log('msg', msg);
                    console.log('#' + msg.taobaoItem.seq + ' done.', '(Received a msg from bp...)');
                    chrome.runtime.sendMessage({type: 'addItemToCart', taobaoItemId: taobaoItem.id, additionalInfo: additionalInfo.getComparison()});
                });
                break;
            case 'prepareItemsFromContentScript':
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
                    var parseTaobaoCartContent = parseTaobaoCartContentByTaobaoType(msg.taobaoType);
                    parseTaobaoCartContent.init();
                    var taobaoCartResult = parseTaobaoCartContent.getTaobaoCartResult();
                    console.log(taobaoCartResult, 'taobaoCartResult');
                    chrome.runtime.sendMessage({type: 'showResult', taobaoCartResult: taobaoCartResult});
                }, Date.now());
                location.replace('https://world.taobao.com/cart/cart.htm');
                break;
            case 'keyGenerator':
                ;
                // sendResponse 回傳訊息僅在同步內有效
                sendResponse({backfilledInfo: runKeyGenerator()});
                break;
            case 'fillTidsIntoTable':
                var bill_items = msg.data.backfilledInfo;
                var filled_result = fillTidsIntoTable(bill_items);
                sendResponse(filled_result);
                break;
            default:
                console.log("It doesn't match type:" + msg.type);
        }
    });
});

var runKeyGenerator = function() {
    var backfilledInfo = [];
    var boughtWrappers = document.querySelectorAll('[class^=bought-wrapper-mod__trade-order___]');

    for (let i = 0; i < boughtWrappers.length; i++) {
        // 訂單號
        var taobaoOrderId = boughtWrappers[i].getAttribute('data-id');

        if (document.querySelectorAll('[class^=bought-wrapper-mod__trade-order___][data-id="' + taobaoOrderId + '"] [class^=bought-wrapper-mod__checkbox___] > input')[0].disabled == true) {
            // 不是能勾選的狀態不用理
            //continue;
        }
        var tbody = document.querySelectorAll('[class^=bought-wrapper-mod__trade-order___][data-id="' + taobaoOrderId + '"] tbody')

        // tbody 1~n , 0 不含 taobaoitemId 資訊
        for (let n = 1; n < tbody.length; n++) {
            var wrapperDiv = document.querySelectorAll('[class^=bought-wrapper-mod__trade-order___][data-id="' + taobaoOrderId + '"]')[0];

            // a tag 藏有 taobaoitemId
            var atag = wrapperDiv.querySelectorAll('tbody')[n].querySelectorAll('tr td')[0].querySelectorAll('a')[0];

            var taobaoItemId = null;
            var itemLink = atag.getAttribute('href');

            itemLink = typeof itemLink.split('id=')[1] != 'undefined' ? itemLink.split('id=')[1] : null;
            if (itemLink === null) {
                alert('解析商品ID發生錯誤\nError: itemLink === null');
            } else {
                taobaoItemId = typeof itemLink.split('&')[0] != 'undefined' ? itemLink.split('&')[0] : null;
            }
            if (taobaoItemId === null) {
                alert('解析商品ID發生錯誤\nError: taobaoItemId === null');
            }

            // 顏色尺寸
            var skuStrings = [];
            var skuSpans = wrapperDiv.querySelectorAll('[class^=production-mod__sku-item___]');
            for (let i = 0; i < skuSpans.length; i++) {
                skuStrings.push(skuSpans[i].textContent);
            }

            backfilledInfo.push({
                'taobaoItemId': taobaoItemId,
                'skuStrings': skuStrings,
                'taobaoOrderId': taobaoOrderId
            });
        }
    }
    return backfilledInfo;
};

var addItemToCart = function(type = 'taobao', taobaoItemId, colorSku, sizeSku, colorCartFullName, sizeCartFullName, amount) {

    // https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
    function sleepRandomBetween(min, max) {
        var interval = max - min;
        var s = Math.floor((Math.random() * interval) + min);
        var ms = Math.floor((Math.random() * 1000));
        var wait = s * 1000 + ms;
        console.log("sleep " + wait + " ms.");
        return new Promise(resolve => setTimeout(resolve, wait));
    }

    async function sleepByColorSizeButton(elementLi) {
        var buttonIsText = (null === elementLi.querySelector('a').getAttribute('style'));
        var optionsCount = elementLi.parentElement.querySelectorAll('li').length;
        if (1 === optionsCount) {
            return;
        }
        var min = 0;
        var max = 1;
        if (buttonIsText) {
            min = Math.floor(optionsCount / 10);
            max = Math.floor(optionsCount / 5) + 1;
        } else {
            min = Math.floor(optionsCount / 4);
            max = Math.floor(optionsCount / 2) + 1;
        }
        await sleepRandomBetween(min, max);
    }

    if (!taobaoItemId || !amount) {
        alert('taobaoItemId || amount 項目不得為空值！');
        return;
    }
    switch(type) {
        case 'taobao':
            // 執行淘寶自動拍
            function TaobaoAutoTrade() {
                this.taobaoItemId = taobaoItemId;
                this.colorSku = (typeof colorSku == 'undefined') ? null : colorSku;
                this.sizeSku = (typeof sizeSku == 'undefined') ? null : sizeSku;
                this.colorCartFullName = colorCartFullName;
                this.sizeCartFullName = sizeCartFullName;
                this.amount = amount;
            }
            TaobaoAutoTrade.prototype.run = async function() {
                await sleepRandomBetween(0, 1);
                window.scrollTo(0, Math.floor((Math.random() * 50) + 300));
                colorLabel: {
                    if (this.colorSku === null) {
                        // 表示此商品本來就沒colorSku項目
                        // alert('colorSku null');
                        break colorLabel;
                    }
                    var colorSkuElement = document.querySelectorAll('.tb-clearfix > li[data-value="' + this.colorSku + '"]');
                    if (detection.ifElementNotExisted(colorSkuElement, 'id: ' + this.taobaoItemId + ' - colorSku: ' + this.colorSku + '不存在', true)) {
                        window.isTradeDone = true;
                        return;
                    }

                    var elementLi = colorSkuElement[0];
                    await sleepByColorSizeButton(elementLi);
                    if (!elementLi.classList.contains('tb-selected')) {
                        elementLi.click();
                    }

                    // 爬網頁得到的資訊，暫時不用來比對了(vb後端會另外給一個購物車sku對應的翻譯名稱)
                    additionalInfo.setNameByColorSku(this.colorSku);
                }

                sizeLabel: {
                    if (this.sizeSku === null) {
                        // 表示此商品本來就沒sizeSku項目
                        // alert('sizeSku null');
                        break sizeLabel;
                    }
                    var sizeSkuElement = document.querySelectorAll('.tb-clearfix > li[data-value="' + this.sizeSku + '"]');

                    if (detection.ifElementNotExisted(sizeSkuElement, 'id: ' + this.taobaoItemId + ' - sizeSku: ' + this.sizeSku + '不存在', true)) {
                        window.isTradeDone = true;
                        return;
                    }

                    var elementLi = sizeSkuElement[0];
                    await sleepByColorSizeButton(elementLi);
                    if (!elementLi.classList.contains('tb-selected')) {
                        elementLi.click();
                    }

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

                await sleepRandomBetween(0, 1);

                setTimeout(function() {
                    document.querySelectorAll('#J_juValid .tb-btn-add .J_LinkAdd')[0].click();

                    ensureAddItemToCartRedirected(function() {
                        window.isTradeDone = true;
                    }, Date.now());
                }, amount_delay);
            };
            TaobaoAutoTrade.prototype.setAmountByTriggerIncrease = function(amount) {
                var i = 1;
                interval = setInterval(function() {
                    if(i == amount) {
                        clearInterval(interval);
                        return;
                    }
                    document.querySelectorAll('.tb-increase.J_Increase')[0].click();
                    i++
                }, 350);
            };

            var autoTrade = new TaobaoAutoTrade();
            autoTrade.run();
            break;
        case 'tmall':
            // 執行天貓自動拍
            function TmallAutoTrade() {
                this.taobaoItemId = taobaoItemId;
                this.colorSku = (typeof colorSku == 'undefined') ? null : colorSku;
                this.sizeSku = (typeof sizeSku == 'undefined') ? null : sizeSku;
                this.colorCartFullName = colorCartFullName;
                this.sizeCartFullName = sizeCartFullName;
                this.amount = amount;
            }
            TmallAutoTrade.prototype.run = async function() {
                // 必須要用skuid來選顏色尺寸...
                colorLabel: {
                    // 用來檢測商品顏色項目是否存在
                    // 雖然選擇 顏色&尺寸是靠網址query string: skuid來決定
                    if (this.colorSku === null) {
                        // 表示此商品本來就沒colorSku項目
                        break colorLabel;
                    }
                    var colorSkuElement = document.querySelectorAll('.J_TSaleProp li[data-value="' + this.colorSku + '"]');

                    if (colorSkuElement[0].style.display == 'none') {
                        alert('id: ' + this.taobaoItemId + ' - colorSku: ' + this.colorSku + '不存在');
                        window.isTradeDone = true;
                        return;
                    }
                }
                sizeLabel: {

                    // 用來檢測商品尺寸項目是否存在
                    if (this.sizeSku === null) {
                        // 表示此商品本來就沒sizeSku項目
                        break sizeLabel;
                    }
                    var sizeSkuElement = document.querySelectorAll('.J_TSaleProp li[data-value="' + this.sizeSku + '"]');

                    if (sizeSkuElement[0].style.display == 'none') {
                        alert('id: ' + this.taobaoItemId + ' - sizeSku: ' + this.sizeSku + '不存在');
                        window.isTradeDone = true;
                        return;
                    }
                }

                additionalInfo.setNameByTaobaoItemId(this.taobaoItemId);

                this.setAmountByTriggerIncrease(this.amount);

                additionalInfo.setTaobaoItemId(this.taobaoItemId);
                additionalInfo.setColorCartFullName(this.colorCartFullName);
                additionalInfo.setSizeCartFullName(this.sizeCartFullName);
                additionalInfo.setAmountForKeyValue(this.amount);

                var amount_delay = this.amount * 350;

                setTimeout(function() {

                    document.querySelectorAll('.tb-btn-basket')[0].querySelectorAll('a')[0].click();

                    setTimeout(function() {
                        window.isTradeDone = true;
                    }, 3000);
                }, amount_delay);
            };
            TmallAutoTrade.prototype.setAmountByTriggerIncrease = function(amount) {
                var i = 1;
                interval = setInterval(function() {
                    if(i == amount) {
                        clearInterval(interval);
                        return;
                    }
                    document.querySelectorAll('#J_Amount .mui-amount-increase')[0].click();
                    i++
                }, 350);
            };

            var autoTrade = new TmallAutoTrade();
            autoTrade.run();
            break;
        default:
            alert('執行自動拍對應不到相關型態！');
    }
};

var additionalInfoBytaobaoType = function(taobaoType) {
    var comparison = {};
    var _taobaoItemId = '0';
    var _colorCartFullName = '';
    var _sizeCartFullName = '';
    var _amount = 0;
    var getTaobaoItemName = function() {
        var taobaoItemName = null;

        if (taobaoType == 'taobao') {
            taobaoItemName = document.querySelectorAll('#J_Title .tb-main-title')[0].textContent;
        }
        if (taobaoType == 'tmall') {
            taobaoItemName = document.querySelectorAll('.tb-detail-hd h1')[0].textContent;
        }
        return taobaoItemName;
    };
    var getNameByColorSku = function(colorSku) {
        var nameByColorSku = null;
        var colorSkuElement = null;

        if (taobaoType == 'taobao') {
            colorSkuElement = document.querySelectorAll('.tb-clearfix > li[data-value="' + colorSku + '"] > a');
            nameByColorSku = colorSkuElement[0].getAttribute('title');
        }
        if (taobaoType == 'tmall') {
            colorSkuElement = document.querySelectorAll('.J_TSaleProp li[data-value="' + colorSku + '"] a span');
            nameByColorSku = colorSkuElement[0].textContent;
        }
        return nameByColorSku;
    };
    var getNameBySizeSku = function(sizeSku) {
        var nameBySizeSku = null;
        var sizeSkuElement = null;

        if (taobaoType == 'taobao') {
            sizeSkuElement = document.querySelectorAll('.tb-clearfix > li[data-value="' + sizeSku + '"] > a');
            nameBySizeSku = sizeSkuElement[0].getAttribute('title');
        }
        if (taobaoType == 'tmall') {
            sizeSkuElement = document.querySelectorAll('.J_TSaleProp li[data-value="' + sizeSku + '"] a span');
            nameBySizeSku = sizeSkuElement[0].textContent;
        }
        return nameBySizeSku;
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
};

var parseTaobaoCartContentByTaobaoType = function(taobaoType) {
    var taobaoCartResult = [];
    var getParseBasicInfo = function() {
        // 回傳一個 [[name], [id in href]]
        var result = [[], []];
        var basicInfo = document.querySelectorAll('.item-basic-info > a')
        basicInfo.forEach(function(item) {
            // name of item
            result[0].push(item.textContent);
            // get id
            var url = new URL(item.getAttribute('href'));
            var taobaoItemid = url.searchParams.get('id');
            result[1].push(taobaoItemid);
        });
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

            var mixedSkuNames = document.querySelectorAll('.find-similar.close[data-itemid="' + item.id + '"]')[0].parentElement.parentElement.parentElement.querySelectorAll('.td-info .sku-line');

            if (typeof mixedSkuNames[1] == 'undefined') {
                var o = {
                    id: item.id,
                    colorCartFullName: mixedSkuNames[0].textContent.replace('：', ':'),
                    sizeCartFullName: '单一',
                    amount: item.amount
                }
                taobaoCartResult[i].cKey = [];
                taobaoCartResult[i].cKey.push(JSON.stringify(o));

                o = {
                    id: item.id,
                    colorCartFullName: '单一',
                    sizeCartFullName: mixedSkuNames[0].textContent.replace('：', ':'),
                    amount: item.amount
                }
                taobaoCartResult[i].cKey.push(JSON.stringify(o));
            } else {
                var o = {
                    id: item.id,
                    colorCartFullName: mixedSkuNames[0].textContent.replace('：', ':'),
                    sizeCartFullName: mixedSkuNames[1].textContent.replace('：', ':'),
                    amount: item.amount
                }
                taobaoCartResult[i].cKey = [];
                taobaoCartResult[i].cKey.push(JSON.stringify(o));

                o.colorCartFullName = mixedSkuNames[1].textContent.replace('：', ':');
                o.sizeCartFullName = mixedSkuNames[0].textContent.replace('：', ':');

                taobaoCartResult[i].cKey.push(JSON.stringify(o));
            }
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

            getAmountOfItems().forEach(function(amount, i) {
                taobaoCartResult[i].amount = parseInt(amount);
            });

            assignKeyValues();
        },
        getTaobaoCartResult: function() {
            return taobaoCartResult;
        }
    }
};

var detectionHelper = function() {
    function Detection() {
        // console.log('new Detection()...');
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
                alert('Error: length of element@elementExistedDetection is null\n' + alertMessage);
            }
            console.error(alertMessage, 'Detection@isElementExisted');
            return true;
        }
        if (element.length == 0) {
            if (!closeAlert) {
                alert('Error: length of element@elementExistedDetection is undefined\n' + alertMessage);
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
};

var ensureAddItemToCartDone = function(callback) {
    if (!window.isTradeDone) {
        setTimeout(function() { ensureAddItemToCartDone(callback); }, 500);
    } else {
        if (callback) {
            callback();
        }
    }
};

var ensureAddItemToCartRedirected = function(callback, startDateTime) {
    if (detection.timeout(Date.now(), startDateTime, 60000, 'Error: 淘寶購物車Alert通知逾時')) {
        window.isTradeDone = true;
        return;
    }
    if (typeof document.querySelectorAll('#J_ResultSummary .result-hint .icon-success')[0] == 'undefined') {
        setTimeout(function() { ensureAddItemToCartRedirected(callback, startDateTime); }, 500);
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

var fillTidsIntoTable = function(bill_items) {
    let success_count = 0;
    for (let i in bill_items) {
        // NOTE: 資料格式為 {taobaoItemId:"556786590860", skuStrings:["尺码：S", "颜色分类：墨绿色"], taobaoOrderId: "123"}
        let bill_item = bill_items[i];
        let taobaoItemId = bill_item.taobaoItemId;
        let table = document.getElementById('taobaoItemsContentScript');
        // 找出在所有在 table 中，該 taobaoItemId 對應的資料列
        let selector = '[data-item-id="' + taobaoItemId + '"]';
        let rows = table.querySelectorAll(selector);
        rows.forEach(function(row) {
            // 比對該列內是否含有每組 sku 的字串
            for (let j in bill_item.skuStrings) {
                let matchString = bill_item.skuStrings[j].replace('：', ':');
                if (!row.textContent.match(matchString)) {
                    return;
                }
            }
            // 填入訂單號
            let input_tid = row.querySelectorAll('.taobaoOrderId')[0];
            input_tid.value = bill_item.taobaoOrderId;
            success_count += 1;
        });
    }
    return {success_count: success_count};
};
