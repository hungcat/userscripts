// ==UserScript==
// @name         Comfortable YouTube
// @namespace    https://github.com/hungcat/userscripts/
// @version      0.6.0
// @description  Remember playback speed for each channel and make YouTube more comfortable to watch
// @author       hungcat
// @match        *://www.youtube.com/*
// @exclude      *://www.youtube.com/tv*
// @exclude      *://www.youtube.com/embed/*
// @exclude      *://www.youtube.com/live_chat*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @updateURL    https://github.com/hungcat/userscripts/raw/main/youtube.com_comfortable-youtube.user.js
// @downloadURL  https://github.com/hungcat/userscripts/raw/main/youtube.com_comfortable-youtube.user.js
// @supportURL   https://github.com/hungcat/userscripts/
// ==/UserScript==

(function (d, Util, YT) {
    'use strict';

    let lastCompatibilityWarning = '';

    d.addEventListener('yt-navigate-finish', () => {
        scheduleCompatibilityCheck();
        Util.tryTask(playerReady, () => YT.getAPI() && YT.getVideo(), 1000, 30);
    });

    scheduleCompatibilityCheck();
    Util.tryTask(playerReady, () => YT.getAPI() && YT.getVideo(), 1000, 30);
    unsafeWindow.CY = Object.freeze({
        version: '0.6.0',
        inspect: inspectCompatibility,
        runTests: runSelfTests,
    });

    function playerReady() {
        inspectCompatibility();
        const api = YT.getAPI();
        if (!api) return;

        const playbackRateKey = YT.getPlaybackRateKey();
        if (playbackRateKey) {
            const savedRate = Number(GM_getValue(playbackRateKey, 2));
            api.setPlaybackRate(YT.isLive() ? 1 : (Number.isFinite(savedRate) && savedRate > 0 ? savedRate : 2));
        }

        const video = YT.getVideo();
        if (video && !video.dataset.CY_SETRATECHANGE) {
            video.dataset.CY_SETRATECHANGE = true;
            video.addEventListener('ratechange', function () {
                const key = YT.getPlaybackRateKey();
                if (!YT.isLive() && key) GM_setValue(key, this.playbackRate);
            });
        }
    }

    function inspectCompatibility() {
        if (!/\/(watch|live)\b/.test(window.location.pathname)) return null;

        const selectors = {
            player: Boolean(YT.getAPI()),
            video: Boolean(YT.getVideo()),
            channelLink: Boolean(YT.getChannelID()),
        };
        const report = {
            version: '0.6.0',
            url: window.location.href,
            features: {
                playbackRate: selectors.player && selectors.video,
                perChannelSettings: selectors.channelLink,
            },
            selectors,
        };
        const missingCore = ['player', 'video'].filter(name => !selectors[name]);
        if (missingCore.length) {
            const warningKey = window.location.pathname + ':' + missingCore.join(',');
            if (warningKey !== lastCompatibilityWarning) {
                console.warn('[CY] YouTube DOM compatibility check failed. Missing:', missingCore.join(', '), report);
                lastCompatibilityWarning = warningKey;
            }
        } else {
            lastCompatibilityWarning = '';
        }
        if (window.__CY_DEBUG__) console.info('[CY] compatibility report', report);
        return report;
    }

    function scheduleCompatibilityCheck() {
        window.setTimeout(inspectCompatibility, 5000);
    }

    function runSelfTests() {
        const tests = [
            ['channel IDs are read from channel URLs', () => YT.parseChannelID('https://www.youtube.com/channel/UCtest123') === 'UCtest123'],
            ['channel handles are read from channel URLs', () => YT.parseChannelID('https://www.youtube.com/@example') === '@example'],
            ['invalid channel URLs are rejected', () => YT.parseChannelID('not a URL') === null],
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
        console.info(`[CY] self-tests: ${results.length - failed.length}/${results.length} passed`);
        return { passed: failed.length === 0, results };
    }
})(document, (function () {
    const toString = Object.prototype.toString;
    function checkType(obj, type) {
        return toString.call(obj).slice(8, -1).toLowerCase() === type;
    }

    const task_dict = {};
    function tryTask(/* task, condition, interval, retry_limit */) {
        let retry_count = 0;
        const task = checkType(arguments[0], 'function') ? arguments[0] : (() => { }),
            condition = checkType(arguments[1], 'function') ? arguments[1] : (() => true),
            interval = checkType(arguments[2], 'number') ? arguments[2] : 1000,
            retry_limit = checkType(arguments[3], 'number') ? arguments[3] : 100;

        if (task_dict[task] != null) return;
        task_dict[task] = setInterval(() => {
            if (retry_limit >= 0 && ++retry_count > retry_limit) {
                clearInterval(task_dict[task]);
                task_dict[task] = null;
            } else if (condition()) {
                task();
                clearInterval(task_dict[task]);
                task_dict[task] = null;
            }
        }, interval);
    }

    return { checkType, tryTask };
})(), (function (d) {
    function parseChannelID(href) {
        try {
            const pathname = new URL(href, window.location.href).pathname;
            const match = pathname.match(/\/(?:channel|user)\/([^/]+)|\/(@[^/]+)/);
            return match ? (match[1] || match[2]) : null;
        } catch (error) {
            return null;
        }
    }

    function getChannelID() {
        const ownerLink = d.querySelector('ytd-video-owner-renderer > a');
        return ownerLink ? parseChannelID(ownerLink.href) : null;
    }

    return {
        getAPI: function () { return d.getElementById('movie_player'); },
        getVideo: function () { return d.getElementsByTagName('video')[0]; },
        getChannelID,
        parseChannelID,
        getPlaybackRateKey: function () {
            const channelID = getChannelID();
            return channelID ? 'CY_PLAYBACKRATE_' + channelID : null;
        },
        isLive: function () { return d.getElementsByClassName('ytp-live').length > 0; },
    };
})(document));
