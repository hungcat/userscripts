// ==UserScript==
// @name         Youtube Side Chat
// @namespace    https://github.com/hungcat/userscripts/
// @version      0.4.3
// @description  my livechat window
// @author       hungcat
// @connect-src  youtube.com
// @match        *://www.youtube.com/*
// @exclude      *://www.youtube.com/tv*
// @exclude      *://www.youtube.com/embed/*
// @exclude      *://www.youtube.com/live_chat*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://github.com/hungcat/userscripts/raw/main/youtube.com_youtube-side-chat.user.js
// @downloadURL  https://github.com/hungcat/userscripts/raw/main/youtube.com_youtube-side-chat.user.js
// @supportURL   https://github.com/hungcat/userscripts/
// ==/UserScript==

(function(d, Util, YT, cssText) {
    'use strict';

    // css
    GM_addStyle(cssText);

    d.addEventListener('yt-navigate-finish', e => {
        //console.log('youtube navigation finished');
        Util.tryTask(playerReady, YT.getAPI, 1000, 30);
    });

    Util.tryTask(playerReady, YT.getAPI, 1000, 30);
    //playerReady();

    // do at the end of function
    function playerReady() {
        const api = YT.getAPI();
        //console.log('api:', api);
        if (api) {
            api.setPlaybackRate(YT.isLive() ? 1 : GM_getValue(YT.getPlaybackRateKey(), 2));
            //console.log('set playback rate to ' + api.getPlaybackRate());
            if (!YT.isLive()) {
                const video = YT.getVideo();
                const channelID = YT.getChannelID();
                //console.log('YSC_PLAYBACKRATE: ' + video.dataset.YSC_SETRATECHANGE)
                if (video && !video.dataset.YSC_SETRATECHANGE) {
                    video.dataset.YSC_SETRATECHANGE = true;
                    video.addEventListener('ratechange', function(e) {
                        //console.log('ratechanged', YT.getPlaybackRateKey(), this.playbackRate);
                        GM_setValue(YT.getPlaybackRateKey(), this.playbackRate);
                    });
                }
            }
        }
        Util.tryTask(initChatWindow, YT.getChat, 1000, 30);
    }

    function initChatWindow() {
        const chat = YT.getChat();

        if (!chat || chat.getElementsByClassName('ysc-controller').length > 0 || chat.getElementsByTagName('ytd-message-renderer').length > 0) return;
        console.log('YSC: initChatWindow');

        const initial_opacity = GM_getValue('YSC_OPACITY', 0.8);
        chat.style.setProperty('--ysc-chat-opacity', initial_opacity);

        const opacity_slider = Util.createElement('input', {
            'type': 'range',
            'class': 'ysc-slider ysc-controll ysc-controll-flex1',
            'min': 0.1,
            'max': 1.0,
            'step': 0.01,
            'oninput': function() { setOpacity(this.value); },
            'value': initial_opacity,
        });

        const initial_label = window.innerHeight < window.innerWidth && (YT.isTheater() || YT.isFullscreen()) ? 'Left' : 'Default';
        const side_menu = createSelectBox([
            { 'label': 'Default', 'onclick': e => { toggleYSCStyle(false); } },
            { 'label': 'Left', 'onclick': e => { toggleYSCStyle(true); changeSide(false); } },
            { 'label': 'Right', 'onclick': e => { toggleYSCStyle(true); changeSide(true); } },
        ], { initial_label });

        chat.insertBefore(Util.createElement('div', {
            'class': 'ysc-controller',
            'children': [ opacity_slider, side_menu ],
        }), d.getElementById('show-hide-button'));

        addResizeHandle(chat);
        updateChatWindow();
    }

    function toggleYSCStyle(enable) {
        const chat = YT.getChat();
        if (chat) {
            const cc = chat.classList;
            if (enable == null ? cc.contains('ysc-chat-style') : !enable) {
                cc.remove('ysc-chat-style');
            } else {
                cc.add('ysc-chat-style');
            }
        }
    }

    function updateChatSize() {
        const api = YT.getAPI(), chat = YT.getChat(), bottom = d.getElementsByClassName('ytp-chrome-bottom')[0];
        if (chat && chat.classList.contains('ysc-chat-style') && api && bottom) {
            const player_rect = api.getBoundingClientRect(),
                  bottom_rect = bottom.getBoundingClientRect(),
                  cs = chat.style;
            cs.setProperty('--ysc-chat-top', (player_rect.top + Util.getScrollTop()) + 'px');
            cs.setProperty('--ysc-chat-height', (player_rect.height - bottom_rect.height) + 'px');
            cs.setProperty('--ysc-chat-width', GM_getValue('YSC_CHAT_WINDOW_WIDTH', 264) + 'px');
        }
    }
    window.addEventListener('resize', updateChatSize, { passive: true });

    const last_selected = d.getElementsByClassName('same-as-selected');
    function updateChatWindow() {
        updateChatSize();
        if (last_selected[0] && Util.checkType(last_selected[0].click, 'function')) last_selected[0].click();
    }
    d.addEventListener('fullscreenchange', updateChatWindow);

    function changeSide(side) {
        const chat = YT.getChat();
        if (chat) {
            const c = chat.classList;
            if (side) {
                c.remove('ysc-left-chat');
                c.add('ysc-right-chat');
            } else {
                c.remove('ysc-right-chat');
                c.add('ysc-left-chat');
            }
            updateChatSize();
        }
    }
    function setOpacity(opacity) {
        const chat = YT.getChat();
        if (chat) {
            chat.style.setProperty('--ysc-chat-opacity', opacity);
            GM_setValue('YSC_OPACITY', opacity);
        }
    }


    // menu_list: []{ label: string, onclick: function }
    function createSelectBox(menu_list, options) {
        if (!options) options = {};
        if (!menu_list || !Array.isArray(menu_list)) menu_list = [];

        const initial_label = options.initial_label || menu_list[0] && menu_list[0].label || '',
              front = Util.createElement('div', {
                  'class': 'select-selected',
                  'innerHTML': initial_label,
                  'onclick': function() {
                      this.nextSibling.classList.toggle('select-hide');
                      this.classList.toggle('select-arrow-active');
                  }
              }),
              closeFront = () => {
                  front.nextSibling.classList.add('select-hide');
                  front.classList.remove('select-arrow-active');
              },
              back = Util.createElement('div', {
                  'class': 'select-items select-hide',
                  'children': menu_list.map(menu => Util.createElement('div', {
                      'innerHTML': menu.label || '',
                      'class': menu.label === initial_label ? 'same-as-selected' : '',
                      'onclick': !Util.checkType(menu.onclick, 'function') ? null : (onclick => {
                          return function() {
                              closeFront();
                              if (YT.isTheater() || YT.isFullscreen() || this.innerHTML === initial_label) {
                                  front.innerHTML = this.innerHTML;
                                  onclick();
                                  Array.from(this.parentNode.getElementsByClassName('same-as-selected')).forEach(node => {
                                      node.classList.remove('same-as-selected');
                                  });
                                  this.classList.add('same-as-selected');
                              }
                          };
                      })(menu.onclick),
                  }))
              }),
              box = Util.createElement('div', {
                  'class': 'custom-select ysc-controll',
                  'children': [ front, back ],
              });

        (options.box_keeping_area && options.box_keeping_area.addEventListener ? options.box_keeping_area : box).addEventListener('mouseleave', () => {
            if (!back.classList.contains('select-hide')) closeFront();
        }, { passive: true });

        return box;
    }



    function addResizeHandle(target) {
        if (target && target.getElementsByClassName('resize-handle').length === 0) {
            target.appendChild(Util.createElement('div', {
                'class': 'resize-handle',
                'onmousedown': e => {
                    e.stopPropagation();

                    let is_ticking = false;
                    const is_left = target.classList.contains('ysc-left-chat'),
                          width_base = parseInt(getComputedStyle(target).width) + (is_left ? -e.x : e.x),
                          resize_handler = e => {
                              if (!is_ticking) {
                                  requestAnimationFrame(() => {
                                      //target.style.width = (width_base + (is_left ? e.x : -e.x)) + 'px';
                                      target.style.setProperty('--ysc-chat-width', (width_base + (is_left ? e.x : -e.x)) + 'px');
                                      is_ticking = false;
                                  });
                                  is_ticking = true;
                              }
                          };

                    window.addEventListener('mousemove', resize_handler, { passive: true });
                    window.addEventListener('mouseup', e => {
                        e.stopPropagation();
                        window.removeEventListener('mousemove', resize_handler);
                        target.classList.remove('is-resizing');
                        GM_setValue('YSC_CHAT_WINDOW_WIDTH', getComputedStyle(target).width)
                    }, { once: true, passive: true });

                    target.classList.add('is-resizing');
                },
            }));
            // target.style.setProperty('--ysc-chat-width', GM_setValue('YSC_CHAT_WINDOW_WIDTH', getComputedStyle(target).width) + 'px');

            // 内部iframe内chatウィンドウの幅の最小を0に
            // d.querySelector('#chatframe') === target.children[0]
            target.children[0].contentWindow.document.head.insertAdjacentHTML('beforeend','<style>yt-live-chat-app{min-width:0}</style>')
        }
    }
})(document, (function(d) {
    const toString = Object.prototype.toString;
    function checkType(obj, type) {
        return toString.call(obj).slice(8, -1).toLowerCase() === type;
    }
    function createElement(tag, options) {
        if (!options) options = {};

        const elm = d.createElement(tag);
        Object.keys(options).forEach(key => {
            const o = options[key];
            if (key === 'children' && Array.isArray(o)) {
                o.forEach(e => { elm.appendChild(e); });
            } else if (/^(innerHTML|value)$/.test(key)) {
                elm[key] = o;
            } else if (/^on/.test(key)) {
                if (checkType(o, 'function')) {
                    elm.addEventListener(key.slice(2), o);
                    //elm[key] = options[key];
                }
            } else {
                elm.setAttribute(key, o);
            }
        });

        return elm;
    }
    function getScrollTop() { return d.body.scrollTop || d.documentElement.scrollTop; }

    const task_dict = {};
    function tryTask(/* task, condition, interval, retry_limit */) {
        let retry_count = 0;
        const task = checkType(arguments[0], 'function') ? arguments[0] : (() => {}),
              condition = checkType(arguments[1], 'function') ? arguments[1] : (() => true),
              interval = checkType(arguments[2], 'number') ? arguments[2] : 1000,
              retry_limit = checkType(arguments[3], 'number') ? arguments[3] : 100;

        //console.log('task state:', task.name, task_dict[task]);
        if (task_dict[task] != null) return;
        //console.log('try!');

        task_dict[task] = setInterval(() => {
            if (retry_limit >= 0 && ++retry_count > retry_limit) {
                //console.log('failed to do task');
                clearInterval(task_dict[task]);
                task_dict[task] = null;//false;
            } else if (condition()) {
                task();
                console.log('task finished:', task.name);
                clearInterval(task_dict[task]);
                task_dict[task] = null;
            } else {
                //console.log('retry ' + retry_count);
            }
        }, interval);
    }

    return { checkType, createElement, getScrollTop, tryTask };
})(document), (function(d) {
    const _getChannelID = function(t) { return (t = d.querySelector('ytd-video-owner-renderer > a')) && (t = t.href.match(/[^/]+$/)) && t[0] };
    return {
        getAPI: function() { return d.getElementById('movie_player'); },
        getVideo: function() { return d.getElementsByTagName('video')[0]; },
        getChat: function() { return d.getElementById('chat'); },
        getChatlist: function(t) {
            return (t = d.getElementById('chatframe')) && t.contentDocument.getElementsByClassName('yt-live-chat-item-list-renderer')[5];
        },
        getPageManager: function() { return d.getElementsByClassName('ytd-page-manager')[0]; },
        getChannelID: _getChannelID,
        getPlaybackRateKey: function(t) { return (t = _getChannelID()) && ('YSC_PLAYBACKRATE_' + t) },

        isTheater: function(t) { return (t = d.getElementsByTagName('ytd-watch-flexy')[0]) && t.theater; },
        isMiniPlayer: function(t) { return (t = d.getElementsByTagName('ytd-miniplayer')[0]) && t.active; },
        isLive: function() { return d.getElementsByClassName('ytp-live').length > 0; },
        isFullscreen: function() { return d.fullscreen; },
    }
})(document),
    // css

    ':root { --ysc-chat-top: 0; --ysc-chat-height: auto; --ysc-chat-width: auto; --ysc-chat-opacity: 1; }' +

    'ytd-watch-flexy[theater] .ysc-chat-style { position: absolute; padding: 0; margin: 0 !important; border: 0 !important; opacity: var(--ysc-chat-opacity);' +
    ' top: var(--ysc-chat-top) !important; height: var(--ysc-chat-height) !important; width: var(--ysc-chat-width) !important; min-height: 100px !important; }' +

    'ytd-watch-flexy[theater] .ysc-left-chat { left: 0 } .ysc-left-chat > .resize-handle { left: 100%; }' +
    'ytd-watch-flexy[theater] .ysc-right-chat { right: 0 } .ysc-right-chat > .resize-handle { right: 100%; }' +
    '.ysc-controller { display: none; }' +
    'ytd-watch-flexy[theater] .ysc-controller { display: flex; background: white; }' +
    '.ysc-controll { margin: 2px; }' +
    '.ysc-controll-flex1 { flex: 1; }' +

    'ytd-watch-flexy[theater] .ysc-chat-style > .resize-handle { cursor: w-resize; position: absolute; top: 0; height: 100%; width: 5px; background: grey; }' +
    '.is-resizing { pointer-events: none; }' +

    //'.side-box { height: 100%; backgrond: green; width: 100px; }' +

    // slider style from: https://www.w3schools.com/howto/howto_js_rangeslider.asp
    '.ysc-slider{-webkit-appearance:none;appearance:none;width:70%;height:34px;background:#d3d3d3;outline:0;opacity:.7;-webkit-transition:.2s;transition:opacity .2s}' +
    '.ysc-slider:hover{opacity:1}.ysc-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:24px;height:34px;background:#4caf50;cursor:pointer}' +
    '.ysc-slider::-moz-range-thumb{width:24px;height:34px;background:#4caf50;cursor:pointer}' +

    // switch style from: https://www.w3schools.com/howto/howto_css_switch.asp
    '.ysc-switch{position:relative;display:inline-block;width:60px;height:34px}.ysc-switch input{display:none;margin:0}' +
    '.ysc-switch-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#ccc;-webkit-transition:.4s;transition:.4s}' +
    '.ysc-switch-slider:before{position:absolute;content:"";height:26px;width:26px;left:4px;bottom:4px;background-color:#fff;-webkit-transition:.4s;transition:.4s}' +
    'input:checked+.ysc-switch-slider{background-color:#2196f3}input:focus+.ysc-switch-slider{box-shadow:0 0 1px #2196f3}' +
    'input:checked+.ysc-switch-slider:before{-webkit-transform:translateX(26px);-ms-transform:translateX(26px);transform:translateX(26px)}' +
    '.ysc-switch-slider.round{border-radius:34px}.ysc-switch-slider.round:before{border-radius:50%}' +

    // select box style from: https://www.w3schools.com/howto/howto_custom_select.asp
    '.custom-select{display:inline-block;width:95px;height:34px;position:relative;font-family:Arial;font-size:medium;}' +
    '.select-selected{position:absolute;background-color:#1e90ff;top:0;left:0;right:0;bottom:0;}' +
    '.select-selected:after{position:absolute;content:"";top:7px;right:10px;width:0;height:0;border:6px solid transparent;border-color:transparent transparent #fff transparent}' +
    '.select-selected.select-arrow-active:after{border-color:#fff transparent transparent transparent;top:14px}' +
    '.select-items div,.select-selected{color:#fff;padding: 8px 16px;border:1px solid transparent;border-color:transparent transparent rgba(0,0,0,.1) transparent;cursor:pointer}' +
    '.select-items{position:absolute;background-color:#1e90ff;bottom:100%;left:0;right:0;}.select-hide{display:none}.same-as-selected,.select-items div:hover{background-color:rgba(0,0,0,.1)}'
);


//     window.addEventListener('pushstate', e => { console.log('pushstate event fired'); });
//     window.addEventListener('popstate', e => { console.log('popstate event fired'); });
//     window.addEventListener('beforeunload', e => { console.log('beforeunload event fired'); });
//     window.addEventListener('unload', e => { console.log('unload event fired'); });
//     document.addEventListener('unload', e => { console.log('document unload event fired'); });
//     document.addEventListener('transitionend', e => {
//         if (e.target.id === 'progress') {
//             console.log('progress bar has transmitted');
//         }
//     });
//document.addEventListener('yt-navigate-start', e => { console.log('yt-navigate-start fired'); });
//document.addEventListener('yt-navigate-finish', e => { console.log('yt-navigate-finish fired'); });
