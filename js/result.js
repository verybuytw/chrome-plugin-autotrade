var renderTable = function(tableId, tableContent) {
    var tbody = '';
    $.each(tableContent, function(i, item) {
        // 因為資料結構上目前把 bp.autoTrade.getTaobaoItemList() 多了一層 {content : itemObject}
        var itemContent = item.content ? item.content : item;

        tbody += '<tr>';
        tbody += '<td>' + (i + 1) + '</td>';
        tbody += '<td>' + ((typeof itemContent.id !== 'undefined') ? itemContent.id : '-') + '</td>';
        tbody += '<td>' + ((typeof itemContent.name !== 'undefined') ? itemContent.name : '-') + '</td>';

        // 比較結果不顯示
        if (typeof itemContent.match == 'undefined') {
            tbody += '<td>' + ((typeof itemContent.colorSku !== 'undefined') ? itemContent.colorSku : '-') + '</td>';
        }

        tbody += '<td>' + ((typeof itemContent.colorName !== 'undefined') ? itemContent.colorName : '-') + '</td>';

        // 比較結果不顯示
        if (typeof itemContent.match == 'undefined') {
            tbody += '<td>' + ((typeof itemContent.sizeSku !== 'undefined') ? itemContent.sizeSku : '-') + '</td>';
        }

        tbody += '<td>' + ((typeof itemContent.sizeName !== 'undefined') ? itemContent.sizeName : '-') + '</td>';
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
        if (a.id > b.id) {
            return 1;
        }
        if (a.id < b.id) {
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
        taobaoCartItems[i].extraInfo = '額外的';
    });

    var attentionItems = [];

    vbTaobaoItems.forEach(function(vbTaobaoItem, i) {
        var isMatched = false;
        var vbTaobaoItemContent = vbTaobaoItem.content;
        taobaoCartItems.forEach(function(taobaoCartItem, j) {
            if (vbTaobaoItemContent.cKey == taobaoCartItem.cKey) {
                taobaoCartItems[j].match = 1;
                taobaoCartItems[j].extraInfo = 'V';
                isMatched = true;
            }
        });
        if (!isMatched) {
            var item = vbTaobaoItemContent;
            item.match = -1;
            item.extraInfo = 'X';
            attentionItems.push(item);
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
    var taobaoItemList = sortById(bp.autoTrade.getTaobaoItemList().slice());

    $('#app > .ori-result').text(JSON.stringify(taobaoItemList));

    renderTable('trade-table', taobaoItemList);

    taobaoCartResult = bp.autoTrade.getTaobaoCartResult().slice();
    if (taobaoCartResult.length == 0) {
        alert('尚未存取從淘寶購物車爬到的資訊！');
    } else {
        taobaoCartResult = sortById(taobaoCartResult);
        $('#app > .parse-result').text(JSON.stringify(taobaoCartResult));
    }

    renderTable('taobao-cart-table', taobaoCartResult);

    var cloneTaobaoItemList = taobaoItemList.slice();
    var cloneTaobaoCartResult = taobaoCartResult.slice();

    // var comparisonResult = getComparisonResult(cloneTaobaoItemList, cloneTaobaoCartResult);
    var comparisonResult = [];

    $('#app > .compare-result').text(JSON.stringify(comparisonResult));

    renderTable('compare-table', comparisonResult);
});

document.getElementById('trigger-detail').addEventListener('change', function() {
    // console.log(this.querySelectorAll('input')[0].checked, 'trigger-detail');
    if (this.querySelectorAll('input')[0].checked) {
        document.getElementById('trade-table').classList.remove("hide");
        document.getElementById('taobao-cart-table').classList.remove("hide");
    } else {
        document.getElementById('trade-table').classList.add("hide");
        document.getElementById('taobao-cart-table').classList.add("hide");
    }
}, false);
