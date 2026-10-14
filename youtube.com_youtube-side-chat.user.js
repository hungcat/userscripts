// ==UserScript==
// @name         Youtube Side Chat
// @namespace    https://github.com/hungcat/userscripts/
// @version      0.5.0
// @description  Per-channel playback speed and adjustable side chat for YouTube
// @author       hungcat
// @match        *://www.youtube.com/*
// @match        *://www.google.com/search*
// @exclude      *://www.youtube.com/tv*
// @exclude      *://www.youtube.com/embed/*
// @exclude      *://www.youtube.com/live_chat*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @updateURL    https://github.com/hungcat/userscripts/raw/main/youtube.com_youtube-side-chat.user.js
// @downloadURL  https://github.com/hungcat/userscripts/raw/main/youtube.com_youtube-side-chat.user.js
// @supportURL   https://github.com/hungcat/userscripts/
// ==/UserScript==

(function (d, Util, YT, cssText) {
    'use strict';

    GM_addStyle(cssText);
    let lastCompatibilityWarning = '';

    d.addEventListener('yt-navigate-finish', () => {
        scheduleCompatibilityCheck();
        Util.tryTask(playerReady, () => YT.getAPI() && YT.getVideo(), 1000, 30);
    });

    scheduleCompatibilityCheck();
    Util.tryTask(playerReady, () => YT.getAPI() && YT.getVideo(), 1000, 30);
    unsafeWindow.YSC = Object.freeze({
        version: '0.5.0',
        inspect: inspectCompatibility,
        runTests: runSelfTests,
    });

    function playerReady() {
        inspectCompatibility();
        const api = YT.getAPI();
        if (api) {
            const playbackRateKey = YT.getPlaybackRateKey();
            if (playbackRateKey) {
                const savedRate = Number(GM_getValue(playbackRateKey, 2));
                api.setPlaybackRate(YT.isLive() ? 1 : (Number.isFinite(savedRate) && savedRate > 0 ? savedRate : 2));
            }
            const video = YT.getVideo();
            if (video && !video.dataset.YSC_SETRATECHANGE) {
                video.dataset.YSC_SETRATECHANGE = true;
                video.addEventListener('ratechange', function () {
                    const key = YT.getPlaybackRateKey();
                    if (!YT.isLive() && key) GM_setValue(key, this.playbackRate);
                });
            }
            Util.tryTask(initChatWindow, () => YT.getChat() && d.getElementById('show-hide-button'), 500, 30);
        }
    }

    function initChatWindow() {
        const chat = YT.getChat();

        if (!chat || chat.getElementsByClassName('ysc-controller').length > 0) return;

        const initialOpacity = clamp(Number(GM_getValue('YSC_OPACITY', 0.8)), 0.1, 1);
        chat.style.setProperty('--ysc-chat-opacity', initialOpacity);

        const opacitySlider = Util.createElement('input', {
            'type': 'range',
            'class': 'ysc-slider ysc-control ysc-control-flex1',
            'min': 0.1,
            'max': 1.0,
            'step': 0.01,
            'oninput': function () { setOpacity(this.value); },
            'value': initialOpacity,
        });

        const initialLabel = 'Default';
        const sideMenu = createSelectBox([
            { 'label': 'Default', 'onclick': e => { toggleYSCStyle(false); } },
            { 'label': 'Left', 'onclick': e => { toggleYSCStyle(true); changeSide(false); } },
            { 'label': 'Right', 'onclick': e => { toggleYSCStyle(true); changeSide(true); } },
        ], { initial_label: initialLabel });

        chat.insertBefore(Util.createElement('div', {
            'class': 'ysc-controller',
            'children': [opacitySlider, sideMenu],
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
            const playerRect = api.getBoundingClientRect(),
                bottomRect = bottom.getBoundingClientRect(),
                chatWidth = Number(GM_getValue('YSC_CHAT_WINDOW_WIDTH', 264));
            chat.style.setProperty('--ysc-chat-top', (playerRect.top + Util.getScrollTop()) + 'px');
            chat.style.setProperty('--ysc-chat-height', Math.max(100, playerRect.height - bottomRect.height) + 'px');
            chat.style.setProperty('--ysc-chat-width', clamp(chatWidth, 180, Math.max(180, window.innerWidth * 0.8)) + 'px');
        }
    }
    window.addEventListener('resize', updateChatSize, { passive: true });

    function updateChatWindow() {
        updateChatSize();
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
            const value = clamp(Number(opacity), 0.1, 1);
            chat.style.setProperty('--ysc-chat-opacity', value);
            GM_setValue('YSC_OPACITY', value);
        }
    }

    function clamp(value, min, max) {
        if (!Number.isFinite(value)) return min;
        return Math.min(max, Math.max(min, value));
    }

    function inspectCompatibility() {
        if (!/\/(watch|live)\b/.test(window.location.pathname)) return null;

        const checks = {
            player: Boolean(YT.getAPI()),
            video: Boolean(YT.getVideo()),
            watchPage: Boolean(d.querySelector('ytd-watch-flexy')),
            chatContainer: Boolean(YT.getChat()),
            chatControls: Boolean(d.getElementById('show-hide-button')),
        };
        const report = {
            version: '0.5.0',
            url: window.location.href,
            features: {
                playbackRate: checks.player && checks.video,
                sideChat: checks.watchPage && checks.chatContainer && checks.chatControls,
            },
            selectors: checks,
        };
        const missingCore = ['player', 'video'].filter(name => !checks[name]);
        if (missingCore.length) {
            const warningKey = window.location.pathname + ':' + missingCore.join(',');
            if (warningKey !== lastCompatibilityWarning) {
                console.warn('[YSC] YouTube DOM compatibility check failed. Missing:', missingCore.join(', '), report);
                lastCompatibilityWarning = warningKey;
            }
        } else {
            lastCompatibilityWarning = '';
        }
        if (window.__YSC_DEBUG__) console.info('[YSC] compatibility report', report);
        return report;
    }

    function scheduleCompatibilityCheck() {
        window.setTimeout(inspectCompatibility, 5000);
    }

    function runSelfTests() {
        const tests = [
            ['clamp keeps in-range values', () => clamp(0.5, 0.1, 1) === 0.5],
            ['clamp enforces lower bound', () => clamp(-1, 0.1, 1) === 0.1],
            ['clamp enforces upper bound', () => clamp(2, 0.1, 1) === 1],
            ['clamp handles invalid values', () => clamp(NaN, 0.1, 1) === 0.1],
            ['channel IDs are read from channel URLs', () => YT.parseChannelID('https://www.youtube.com/channel/UCtest123') === 'UCtest123'],
            ['channel handles are read from channel URLs', () => YT.parseChannelID('https://www.youtube.com/@example') === '@example'],
        ];
        const results = tests.map(([name, test]) => {
            try {
                const passed = test();
                return { name, passed, error: passed ? '' : 'Assertion failed' };
            } catch (error) {
                return { name, passed: false, error: error.message };
            }


        });
        const failed = results.filter(result => !result.passed);
        console.table(results);
        console.info(`[YSC] self-tests: ${results.length - failed.length}/${results.length} passed`);
        return { passed: failed.length === 0, results };
    }

    // menu_list: []{ label: string, onclick: function }
    function createSelectBox(menu_list, options) {
        if (!options) options = {};
        if (!menu_list || !Array.isArray(menu_list)) menu_list = [];

        const initial_label = options.initial_label || menu_list[0] && menu_list[0].label || '',
            front = Util.createElement('div', {
                'class': 'select-selected',
                'innerHTML': initial_label,
                'onclick': function () {
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
                        return function () {
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
                'class': 'custom-select ysc-control',
                'children': [front, back],
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
                'onpointerdown': e => {
                    e.stopPropagation();

                    let is_ticking = false;
                    const isLeft = target.classList.contains('ysc-left-chat'),
                        startX = e.clientX,
                        startWidth = target.getBoundingClientRect().width,
                        resizeHandler = moveEvent => {
                            if (!is_ticking) {
                                requestAnimationFrame(() => {
                                    const direction = isLeft ? 1 : -1;
                                    const width = clamp(startWidth + (moveEvent.clientX - startX) * direction, 180, window.innerWidth * 0.8);
                                    target.style.setProperty('--ysc-chat-width', width + 'px');
                                    is_ticking = false;
                                });
                                is_ticking = true;
                            }
                        };

                    const stopResize = () => {
                        window.removeEventListener('pointermove', resizeHandler);
                        window.removeEventListener('pointerup', onPointerUp);
                        window.removeEventListener('pointercancel', stopResize);
                        target.classList.remove('is-resizing');
                        GM_setValue('YSC_CHAT_WINDOW_WIDTH', target.getBoundingClientRect().width);
                    };
                    const onPointerUp = event => {
                        event.stopPropagation();
                        stopResize();
                    };
                    window.addEventListener('pointermove', resizeHandler, { passive: true });
                    window.addEventListener('pointerup', onPointerUp, { once: true, passive: true });
                    window.addEventListener('pointercancel', stopResize, { once: true, passive: true });

                    target.classList.add('is-resizing');
                },
            }));
        }
    }
})(document, (function (d) {
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
            } else if (/^(value|innerHTML|innerText|textContent)$/.test(key)) {
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
        const task = checkType(arguments[0], 'function') ? arguments[0] : (() => { }),
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
})(document), (function (d) {
    function parseChannelID(href) {
        try {
            const pathname = new URL(href, window.location.href).pathname;
            const match = pathname.match(/\/(?:channel|user)\/([^/]+)|\/(@[^/]+)/);
            return match ? (match[1] || match[2]) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {string} channel ID
     */
    function _getChannelID() {
        const ownerLink = d.querySelector('ytd-video-owner-renderer > a');
        return ownerLink ? parseChannelID(ownerLink.href) : null;
    }
    return {
        getAPI: function () { return d.getElementById('movie_player'); },
        getVideo: function () { return d.getElementsByTagName('video')[0]; },
        getChat: function () { return d.getElementById('chat'); },
        getChannelID: _getChannelID,
        parseChannelID,
        getPlaybackRateKey: function (t) { return (t = _getChannelID()) && ('YSC_PLAYBACKRATE_' + t) },

        isTheater: function (t) { return (t = d.getElementsByTagName('ytd-watch-flexy')[0]) && t.theater; },
        isLive: function () { return d.getElementsByClassName('ytp-live').length > 0; },
        isFullscreen: function () { return d.fullscreen; },
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
    '.ysc-control { margin: 2px; }' +
    '.ysc-control-flex1 { flex: 1; }' +

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
