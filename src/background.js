function getType(url) {
    var regex = /(https?:\/\/.*.+?\..+?)\//;
    var matches = url.match(regex);
    var heading = matches[1];
    if ( "https://github.com".indexOf(heading) === 0 ) {
        return 'github';
    } else if ( localStorage.getItem('ghe-api_prefix').indexOf(heading) === 0) {
        return 'ghe';
    }
}

function getApiPrefix(type) {
    return localStorage.getItem(type + '-api_prefix');
}

function getHostFromApiPrefix(type) {
    var regex = /https?:\/\/.*(.+?\..+?)\//;
    var match = getApiPrefix(type).match(regex);
    return match ? match[1] : '';
}

/*
 * URLからAPIを叩くのに使いそうなパラメーターを抽出する
 */
function getParamsFromUrl(url) {
    // 期待しないURLでアイコン出さないように、それっぽいホストか一応チェックする
    var host = getHostFromApiPrefix(getType(url));
    if (url.indexOf(host) == -1) {
        return null;
    }

    var regex = /.+\/(.+?)\/(.+?)\/pull\/(\d+)/;
    var match = url.match(regex);
    return match ? {"user": match[1], "repo": match[2], "issue": match[3]} : null;
}

/*
 * 状態に応じたアイコンを表示する
 */
function updateIcon(tabId, currentState) {
    switch (currentState) {
        case 'レビュー依頼':
            chrome.pageAction.setIcon({tabId: tabId, path: 'icon-19-requested.png'});
        break;
        case 'レビュー中':
            chrome.pageAction.setIcon({tabId: tabId, path: 'icon-19-inreview.png'});
        break;
        case 'レビュー完了':
            chrome.pageAction.setIcon({tabId: tabId, path: 'icon-19-ok.png'});
        break;
        default:
            chrome.pageAction.setIcon({tabId: tabId, path: 'icon-19-normal.png'});
        break;
    }
    // ついでにツールチップも更新する
    chrome.pageAction.setTitle({tabId: tabId, title: currentState ? currentState : 'クリックでレビュー依頼'});
}

/*
 * function, [args] を (function)(args) というstringに変換する
 *
 */

function serializeFunction(f, args) {
    return '(' + f.toString() + ')' + '(' + args.map(function(v) { return JSON.stringify(v) }).join(', ') + ')';
}

/*
 * ページの背景に指定された状態を表示
 *
 */

function setBackground(tabId, state) {
    var set_background = localStorage.getItem('global-set_background');
    if (! set_background || typeof set_background == 'string' && ! JSON.parse(set_background)) { return }

    chrome.tabs.executeScript(tabId, {
        code: serializeFunction(function() {
            var state = arguments[0];
            var canvas = document.createElement('canvas');
            canvas.width = 150;
            canvas.height = 120;
            var context = canvas.getContext('2d');
            var rad = 30 * Math.PI / 180
            context.setTransform(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0 );
            context.font = "bold 20px sans-serif";
            context.fillStyle = '#ddd';
            context.textAlign = 'left'
            context.textBaseline = 'top'
            if (state) {
                context.fillText(state, 20, 20);
            }
            document.body.style.background = "url('" + canvas.toDataURL() + "')";
        }, [state])
    });
}

/*
 * 認証キーをlocalStorageから取得する
 * 見つからなかったらpromptで入力させる(一発勝負)
 */
function getAuthorization(type) {
    var username = localStorage.getItem(type + '-username');
    var password = localStorage.getItem(type + '-password');
    if (!username || !password) {
        chrome.tabs.create({
            url: chrome.extension.getURL('options.html')
        });
        return '';
    }

    var raw = username + ':' + password;
    var authorization = $.base64.encode(raw);
    return 'Basic ' + authorization;
}

/*
 * タブのURLの変化を監視する
 * pull-reqっぽい雰囲気だったらアイコン変える
 */
function checkForGithubUrl(tabId, changeInfo, tab) {
    var params = getParamsFromUrl(tab.url);
    if (params) {
        chrome.pageAction.show(tabId); // これ呼ばないとアイコン表示されない
        var authorization = getAuthorization(getType(tab.url));
        $.ajax({
            url: getApiPrefix(getType(tab.url)) + 'repos/' + params.user + '/' + params.repo + '/issues/' + params.issue + '/labels',
            cache: false,
            type: 'GET',
            headers: {'Authorization': authorization},
        }).done(function(labels) {
            var state = null;
            labels.forEach(function(label) {
                switch (label.name) {
                    case 'レビュー依頼':
                    case 'レビュー中':
                    case 'レビュー完了':
                        state = label.name;
                    break;
                }
            });
            setBackground(tabId, state);
            updateIcon(tabId, state);
        });
    }
}
chrome.tabs.onUpdated.addListener(checkForGithubUrl); // コールバック登録

/*
 * アイコンのクリックを監視する
 * クリックされたら状態を遷移して、ラベルを変えたりアイコンを変えたりする
 */
chrome.pageAction.onClicked.addListener(function(tab) {
    var params = getParamsFromUrl(tab.url);
    var authorization = getAuthorization(getType(tab.url));
    // 現在の状態を取得して、次の状態を決定する
    var currentState = null;
    var nextState = 'レビュー依頼';
    $.ajax({
        url: getApiPrefix(getType(tab.url)) + 'repos/' + params.user + '/' + params.repo + '/issues/' + params.issue + '/labels',
        cache: false,
        type: 'GET',
        headers: {'Authorization': authorization},
    }).done(function(labels) {
        console.log(labels);
        labels.forEach(function(label) {
            switch (label.name) {
                case 'レビュー依頼':
                    currentState = label.name;
                    nextState = 'レビュー中';
                    break;
                case 'レビュー中':
                    currentState = label.name;
                    nextState = 'レビュー完了';
                    break;
                case 'レビュー完了':
                    currentState = label.name;
                    nextState = null;
                    break;
                default:
                    break;
            }
        });
        setBackground(tab.id, nextState);
        updateIcon(tab.id, nextState);

        // レビュー状態のラベルを削除する
        if (currentState) {
            $.ajax({
                url: getApiPrefix(getType(tab.url)) + 'repos/' + params.user + '/' + params.repo + '/issues/' + params.issue + '/labels/' + currentState,
                cache: false,
                type: 'DELETE',
                headers: {'Authorization': authorization},
            });
        }
        // 次の状態へラベルを遷移させる
        if (nextState) {
            $.ajax({
                url: getApiPrefix(getType(tab.url)) + 'repos/' + params.user + '/' + params.repo + '/issues/' + params.issue + '/labels',
                cache: false,
                type: 'POST',
                headers: {'Authorization': authorization},
                data: JSON.stringify([nextState]),
            });
        }
    });
});
