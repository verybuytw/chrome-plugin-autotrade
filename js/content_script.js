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
		    	runAutoTrade(taobaoItem.id, taobaoItem.colorSku, taobaoItem.sizeSku, taobaoItem.amount);
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
		    	});
		    	break;
		    default:
		    	console.log("It doesn't match type:" + msg.type);
		}
	});
});

var runAutoTrade = function(taobaoItemId, colorSku, sizeSku, amount) {

	if (!taobaoItemId || !colorSku || !sizeSku || !amount) {
		alert('taobao項目任一參數不得為空值！');
		return;
	}
	setTimeout(function() {

	    document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + colorSku + '"]')[0].classList.remove('tb-selected');
		document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + sizeSku + '"]')[0].classList.remove('tb-selected');

		document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + colorSku + '"] > a')[0].click();

		additionalInfo.setNameByColorSku(colorSku);

		document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + sizeSku + '"] > a')[0].click();

		additionalInfo.setNameBySizeSku(sizeSku);

		additionalInfo.setNameByTaobaoItemId(taobaoItemId);

		setAmountByTriggerIncrease(amount);

		additionalInfo.setAmountForKeyValue(amount);

		var amount_delay = amount * 350;

		setTimeout(function() {
		    document.getElementById('J_btn_addToCart').click();

			popupCloseEnsureExisted(function() {
				document.querySelectorAll('.J_popup_close.sea-iconfont')[0].click();
				window.isTradeDone = true;
			});
		}, amount_delay);
	}, 2000);
};

var additionalInfo = (function() {
	var comparison = {};
	var _taobaoItemId = '0';
	var _amount = 0;
	var getTaobaoItemName = function() {
		// taobaoItemId 暫時不需要用
		return document.querySelectorAll('#J_Title .tb-main-title .t-title')[0].textContent;
	};
	var getNameByColorSku = function(colorSku) {
		return document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + colorSku + '"] > a')[0].getAttribute('title');
	};
	var getNameBySizeSku = function(sizeSku) {
		return document.querySelectorAll('.tb-cleafix > .J_SKU[data-pv="' + sizeSku + '"] > a')[0].getAttribute('title');
	};
	var setKeyValue = function() {
		var o = {
			id: _taobaoItemId,
			colorName: comparison.colorName,
			sizeName: comparison.sizeName,
			amount: _amount
		}
		comparison.cKey = JSON.stringify(o);
	}
	return {
		getComparison: function() {
			setKeyValue();
			return comparison;
		},
		setNameByTaobaoItemId: function(taobaoItemId) {
			_taobaoItemId = taobaoItemId;
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

var autoTradeEnsureDone = function(callback) {
    if (!window.isTradeDone) {
        setTimeout(function() { autoTradeEnsureDone(callback); }, 50);
    } else {
        if (callback) {
            callback();
        }
    }
};

var popupCloseEnsureExisted = function(callback) {
    if (typeof document.querySelectorAll('.J_popup_close.sea-iconfont')[0] == 'undefined') {
        setTimeout(function() { popupCloseEnsureExisted(callback); }, 50);
    } else {
        if (callback) {
            callback();
        }
    }
};

var taobaoCartEnsureLoaded = function(callback) {
    if (typeof document.querySelectorAll('.item-basic-info > a')[0] == 'undefined') {
        setTimeout(function() { taobaoCartEnsureLoaded(callback); }, 50);
    } else {
        if (callback) {
            callback();
        }
    }
};

var setAmountByTriggerIncrease = function(amount) {
	var i = 1;
	interval = setInterval(function(){
		if(i == amount) {
			clearInterval(interval);
			return;
		}
		document.querySelectorAll('.tb-increase.J_Increase.sea-iconfont')[0].click();
		i++
	}, 350);
}

var setAmountByAutoKeydown = function(amount) {
	// 暫時不使用
	var e = $.Event('keydown');
    e.which = parseInt(amount) + 48; // keycode of zero is 48
    $('#J_IptAmount').focus();
    $('#J_IptAmount').trigger(e);
}

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
		// 回傳一個 [[colorName], [sizeName]]
		var result = [[], []];
		var mixedSku = document.querySelectorAll('.td-info .sku-line');
		mixedSku.forEach(function(item, i) {
		    result[i & 1].push(item.textContent);
		});
		return result;
	};
	var getAmountOfItems = function() {
		var result = [];
		var amountofItems = document.querySelectorAll('.item-amount > input');
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
				colorName: item.colorName,
				sizeName: item.sizeName,
				amount: item.amount
			}
			taobaoCartResult[i].cKey = JSON.stringify(o);
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

			var mixedSku = getParseMixedSku();

			mixedSku[0].forEach(function(item, i) {
		    	taobaoCartResult[i].colorName = item.split('颜色分类：')[1];
		    });
		    mixedSku[1].forEach(function(item, i) {
		    	taobaoCartResult[i].sizeName = item.split('尺码：')[1];
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
