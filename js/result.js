var renderTable = function(tableId, tableContent) {

    var tbody = '';

    $.each(tableContent, function(i, itemContent) {
        tbody += '<tr>';
        tbody += '<td>' + (i + 1) + '</td>';
        tbody += '<td>' + ((typeof itemContent.id !== 'undefined') ? itemContent.id : '-') + '</td>';
        tbody += '<td>' + ((typeof itemContent.name !== 'undefined') ? itemContent.name : '-') + '</td>';

        // 比較結果不顯示
        if (typeof itemContent.match == 'undefined') {
            tbody += '<td>' + ((typeof itemContent.colorSku !== 'undefined') ? itemContent.colorSku : '-') + '</td>';
        }

        tbody += '<td>' + ((typeof itemContent.colorCartFullName !== 'undefined') ? itemContent.colorCartFullName : '-') + '</td>';

        // 比較結果不顯示
        if (typeof itemContent.match == 'undefined') {
            tbody += '<td>' + ((typeof itemContent.sizeSku !== 'undefined') ? itemContent.sizeSku : '-') + '</td>';
        }

        tbody += '<td>' + ((typeof itemContent.sizeCartFullName !== 'undefined') ? itemContent.sizeCartFullName : '-') + '</td>';
        tbody += '<td>' + ((typeof itemContent.amount !== 'undefined') ? itemContent.amount : '-') + '</td>';

        if (typeof itemContent.match !== 'undefined') {
            switch(itemContent.match) {
                case 1:
                    tbody += '<td style="color: blue;">'
                    break;
                case -1:
                    tbody += '<td style="color: red;">'
                    break;
                default:
                    tbody += '<td>';
            }
            tbody += ((typeof itemContent.cKey !== 'undefined') ? itemContent.cKey : '-') + '</td>';
        } else {
            tbody += '<td>' + ((typeof itemContent.cKey !== 'undefined') ? itemContent.cKey : '-') + '</td>';
        }

        if (typeof itemContent.match !== 'undefined') {
            tbody += '<td>' + itemContent.match + '</td>';
        }
        if (typeof itemContent.extraInfo !== 'undefined') {
            switch(itemContent.match) {
                case 1:
                    tbody += '<td style="color: blue;">'
                    break;
                case -1:
                    tbody += '<td style="color: red;">'
                    break;
                default:
                    tbody += '<td>';
            }
            tbody += itemContent.extraInfo + '</td>';
        }

        tbody += '</tr>';
    });

    $('#' + tableId + ' > tbody').append(tbody);
}

var sortById = function(items) {
    items.sort(function (a, b) {
        // 物件可以利用其中一個屬性的值來排序
        if (parseInt(a.id) > parseInt(b.id)) {
            return 1;
        }
        if (parseInt(a.id) < parseInt(b.id)) {
            return -1;
        }
        // a must be equal to b
        return 0;
    });
    return items;
}

var getComparisonResult = function(vbTaobaoItems, taobaoCartItems) {
    // 要先確保兩者資料結構一致
    // initialization
    taobaoCartItems.forEach(function(item, i) {
        taobaoCartItems[i].match = 0;
        taobaoCartItems[i].extraInfo = '購物車';
    });

    var attentionItems = [];

    vbTaobaoItems.forEach(function(vbTaobaoItem, i) {
        var isMatched = false;
        taobaoCartItems.forEach(function(taobaoCartItem, j) {
            if (vbTaobaoItem.cKey == taobaoCartItem.cKey[0] || vbTaobaoItem.cKey == taobaoCartItem.cKey[1]) {
                taobaoCartItem.match = 1;
                taobaoCartItem.extraInfo = 'V';
                isMatched = true;
            }
            taobaoCartItem.colorCartFullName = vbTaobaoItem.colorCartFullName;
            taobaoCartItem.sizeCartFullName = vbTaobaoItem.sizeCartFullName;
        });
        if (!isMatched) {
            vbTaobaoItem.match = -1;
            vbTaobaoItem.extraInfo = 'X';
            attentionItems.push(vbTaobaoItem);
        }
    });

    attentionItems.forEach(function(attentionItem, i) {
        taobaoCartItems.push(attentionItem);
    });

    return taobaoCartItems;
}

// bp 可以單向使用background.js的函數
var bp = chrome.extension.getBackgroundPage();

document.addEventListener('DOMContentLoaded', function() {
    var taobaoItemList = bp.autoTrade.getTaobaoItemList();
    var cloneTaobaoItemList = [];
    taobaoItemList.forEach(function(taobaoItem, i) {
        cloneTaobaoItemList[i] = Object.assign({}, taobaoItem.content);
    });

    $('#app > .ori-result').text(JSON.stringify(cloneTaobaoItemList));

    renderTable('trade-table', cloneTaobaoItemList);

    var taobaoCartResult = bp.autoTrade.getTaobaoCartResult();
    var cloneTaobaoCartResult = [];
    taobaoCartResult.forEach(function(taobaoCart, i) {
        cloneTaobaoCartResult[i] = Object.assign({}, taobaoCart);
    });

    if (cloneTaobaoCartResult.length == 0) {
        alert('尚未存取從淘寶購物車爬到的資訊！');
    } else {
        cloneTaobaoCartResult = sortById(cloneTaobaoCartResult);
        $('#app > .parse-result').text(JSON.stringify(cloneTaobaoCartResult));
    }

    renderTable('taobao-cart-table', cloneTaobaoCartResult);

    var comparisonResult = getComparisonResult(cloneTaobaoItemList, cloneTaobaoCartResult);

    $('#app > .compare-result').text(JSON.stringify(sortById(comparisonResult)));

    renderTable('compare-table', comparisonResult);
});

document.getElementById('trigger-detail').addEventListener('change', function() {
    if (this.querySelectorAll('input')[0].checked) {
        document.getElementById('trade-table').classList.remove("hide");
        document.getElementById('taobao-cart-table').classList.remove("hide");
    } else {
        document.getElementById('trade-table').classList.add("hide");
        document.getElementById('taobao-cart-table').classList.add("hide");
    }
}, false);
