let adVideoPlayNow = true;
let mainVideoPlayNow = false;
let preroll = true;
let pauseroll = false;
let sbPressed = false;
let adFirstStart = true;
let pauseNow = false;
let progressEventsSeconds = [];
let videoMainVod = false;
let videoMainLive = false;
let videoCurrentTime = 0;
let isFullscreen = false;
let videoAd;
let player;
let skipDelay;
let vastTracker;
let clickLink;
let myFirstPlay = true;

const loadVAST = (url) => {
    return new Promise(function (resolve, reject) {
            if (myFirstPlay && pauseroll) {
                myFirstPlay = false;
                resolve();
            } else {
                DMVAST.client.get(url, function (r, e) {

                    if (!r) {
                        adVideoPlayNow ? adVideoPlayNow = false : '';
                        reject('Error loading VAST - r is null');
                    }
                    console.log(r);

                    if (r.ads[0].creatives[0].mediaFiles[0].apiFramework == 'VPAID') {
                        adVideoPlayNow ? adVideoPlayNow = false : '';
                        reject('Error loading VAST - VPAID not supported');
                    }

                    vastTracker = new DMVAST.tracker(r.ads[0], r.ads[0].creatives[0]);
                    vastTracker.on('start', () => console.log(getCurrentDate() + " Ad event: start"));
                    vastTracker.on('pause', () => console.log(getCurrentDate() + " Ad event: pause"));
                    vastTracker.on('resume', () => console.log(getCurrentDate() + " Ad event: resume"));
                    vastTracker.on('mute', () => console.log(getCurrentDate() + " Ad event: mute"));
                    vastTracker.on('unmute', () => console.log(getCurrentDate() + " Ad event: unmute"));
                    vastTracker.on('skip', () => console.log(getCurrentDate() + " Ad event: skip"));
                    vastTracker.on('clickthrough', url => console.log(getCurrentDate() + " Ad event: click"));
                    vastTracker.on('complete', () => console.log(getCurrentDate() + " Ad event: complete"));
                    vastTracker.on('firstQuartile', () => console.log(getCurrentDate() + " Ad event: firstQuartile"));
                    vastTracker.on('midpoint', () => console.log(getCurrentDate() + " Ad event: midpoint"));
                    vastTracker.on('thirdQuartile', () => console.log(getCurrentDate() + " Ad event: thirdQuartile"));
                    vastTracker.on('fullscreen', () => console.log(getCurrentDate() + " Ad event: fullscreen"));
                    vastTracker.on('exitFullscreen', () => console.log(getCurrentDate() + " Ad event: exitFullscreen"));
                    vastTracker.on('creativeView', () => {
                        console.log(getCurrentDate() + " Ad event: impression");
                        console.log(getCurrentDate() + " Ad event: creativeView");
                    });

                    for (let k in vastTracker.trackingEvents) {
                        let re = /progress-\d*/;
                        if (!k.search(re)) {
                            progressEventsSeconds.push(parseInt(k.split('-')[1]));
                        }
                    }
                    progressEventsSeconds.sort((a, b) => a - b);

                    videoAd = r.ads[0].creatives[0].mediaFiles[0].fileURL;
                    skipDelay = r.ads[0].creatives[0].skipDelay;
                    clickLink = r.ads[0].creatives[0].videoClickThroughURLTemplate;

                    console.log('loadvast');
                    resolve();
                });
            }
        }
    );
};

const fsEventOn = () => {
    player.on(Clappr.Events.PLAYER_FULLSCREEN, function () {
        isFullscreen = !isFullscreen;
        if (adVideoPlayNow) {
            vastTracker.setFullscreen(isFullscreen);
            // vastTracker.setExpand(isFullscreen);
        }
    })
};

const getCurrentDate = () => {
    let d = new Date();
    return "(" + d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds() + ") ";
};

const setTypeVideo = (type) => {
    if (type == 'vod') {
        videoMainVod = true;
    } else if (type == 'live') {
        videoMainLive = true;
    }
};

const getVideoSource = () => {
    if (preroll) {
        return videoAd;
    } else if (pauseroll) {
        return videoMain;
    }
};

const setTypeAd = (type) => {
    adVideoPlayNow = false;
    preroll = false;
    pauseroll = false;

    if (type == 'preroll') {
        adVideoPlayNow = true;
        preroll = true;
    } else if (type == 'pauseroll') {
        pauseroll = true;
    }
};

const _visibilityAPI = (function () {
    var stateKey,
        eventKey,
        keys = {
            hidden: "visibilitychange",
            webkitHidden: "webkitvisibilitychange",
            mozHidden: "mozvisibilitychange",
            msHidden: "msvisibilitychange"
        };
    for (stateKey in keys) {
        if (stateKey in document) {
            eventKey = keys[stateKey];
            break;
        }
    }
    return {
        'setHandler': function (c) {
            if (c) document.addEventListener(eventKey, c);
        },
        'tabVisible': function () {
            return !document[stateKey];
        }
    }
})();

_visibilityAPI.setHandler(function () {
    if (adVideoPlayNow) {
        if (_visibilityAPI.tabVisible()) {
            setTimeout(function () {
                player.play();
            }, 300);
        } else {
            player.pause();
        }
    }
});

let clapprAdVastPlugin = Clappr.UIContainerPlugin.extend({
    name: 'clappr-vast-ad-plugin',
    version: '2.0',
    adMuted: false,
    videoWasComplited: false,

    initialize: function initialize() {
        this.render();
        // this.checkAdTime();
    },

    render: function render() {
        this.$el.css('font-size', '20px');
        this.$el.css('position', 'absolute');
        this.$el.css('color', 'white');
        this.$el.css('top', '70%');
        this.$el.css('right', '0%');
        this.$el.css('background-color', 'black');
        this.$el.css('z-index', '100500');
        this.$el.css('border', 'solid 3px #333333');
        this.$el.css('padding', '5px');
        this.container.$el.append(this.$el);
        this.$el[0].id = 'adButton';

        if (preroll) {
            this.show();
        } else if (pauseroll) {
            if (adVideoPlayNow) {
                this.show();
            } else {
                this.hide();
            }
        }
        return this;
    },

    bindEvents: function bindEvents() {
        this.listenTo(this.container, Clappr.Events.CONTAINER_ENDED, this.containerEnded);
        this.listenTo(this.container, Clappr.Events.CONTAINER_PLAY, this.containerPlay);
        this.listenTo(this.container, Clappr.Events.CONTAINER_VOLUME, this.containerVolume);
        this.listenTo(this.container, Clappr.Events.CONTAINER_PAUSE, this.containerPause);
        this.listenTo(this.container, Clappr.Events.CONTAINER_CLICK, this.containerClick);
    },

    containerClick: function () {
        if (adVideoPlayNow) {
            window.open(clickLink).focus();
            vastTracker.click();
        } else {
            player.pause();
        }
    },

    containerPause: function () {
        if (adVideoPlayNow && !player.ended) {
            vastTracker.setPaused(true);
        }
        // not activate 'play' event when pause
        else {
            player.pause();
            pauseNow = true;
        }
    },

    containerVolume: function () {
        if (adVideoPlayNow && player) {
            if (player.getVolume() == 0 && !this.AdMuted || player.getVolume() != 0 && this.AdMuted) {
                this.AdMuted = !this.AdMuted;
                vastTracker.setMuted(this.AdMuted);
            }
        }
    },

    containerPlay: function () {
        mainVideoPlayNow ? this.hide() : null;
        player.core.mediaControl.container.settings.seekEnabled = !adVideoPlayNow;

        if (adVideoPlayNow) {
            this.checkAdTime();
            this.show();
            if (adFirstStart) {
                vastTracker.setProgress(0.1);
                vastTracker.load();
                adFirstStart = false;
            } else {
                vastTracker.setPaused(false);
            }
        } else {
            this.hide();
        }
        if (preroll) {
            if (this.videoWasComplited) {
                this.videoWasComplited = false;
                loadVAST(vastUrl).then(() => this.switchSource('va'));
                adVideoPlayNow = true;
                adFirstStart = true;
                // player.pause();
            }

        } else if (pauseroll) {
            if (!adVideoPlayNow && pauseNow && player.isPlaying()) {
                pauseNow = false;
                if (videoMainVod) {
                    videoCurrentTime = player.getCurrentTime();
                }

                adFirstStart = true;
                loadVAST(vastUrl).then(() => this.switchSource('va'));
                this.show();
            }
        }
    },

    containerEnded: function () {
        pauseNow = false;

        if (adVideoPlayNow) {
            vastTracker.complete();
            this.switchSource('av');
        } else if (preroll) {
            this.videoWasComplited = true;
        }
    },

    switchSource: function (type) {
        if (player != null) {
            let f, s;
            if (type == 'av') {
                adVideoPlayNow = false;
                f = videoAd;
                s = videoMain;
            } else if (type == 'va') {
                adVideoPlayNow = true;
                f = videoMain;
                s = videoAd;
            }
            let el = player.core.getCurrentPlayback().el;

            // let endListener = () => {
            //     el.removeEventListener('ended', endListener);
            //     el.src = f;
            //     // el.load();
            //     el.play();
            // };

            el.src = s;
            // el.load();

            // if (!pauseroll) {
            //     el.addEventListener('ended', endListener);
            // }
            !sbPressed ? el.play() : null;

            if (type == 'av' && videoMainVod) {
                player.seek(videoCurrentTime);
            }
        }
    },

    show: function () {
        const showAdButton = () => {
            this.$el.show();
            let timerId = setInterval(() => {
                let ab = document.getElementById('adButton');
                ab.textContent = 'You can skip this ad in ' + parseInt(skipDelay - player.getCurrentTime());
                if (player.getCurrentTime() > skipDelay) {
                    clearInterval(timerId);
                    ab.onclick = () => {
                        vastTracker.skip();
                        sbPressed = true;
                        this.switchSource('av');
                        sbPressed = false;
                    };
                    ab.textContent = 'Skip Ad';
                }
            }, 300);
        };
        if (preroll) {
            if (adVideoPlayNow) {
                showAdButton();
            } else {
                this.hide();
            }
        } else if (pauseroll) {
            showAdButton();
        }
    },

    hide: function () {
        this.$el.hide();
    },

    checkAdTime: function () {
        if (adVideoPlayNow) {
            let fq = false, mp = false, tq = false;
            let timerId = setInterval(function () {
                if (sbPressed) {
                    clearInterval(timerId);
                } else {
                    if (progressEventsSeconds.length && player.getCurrentTime() >= progressEventsSeconds[0]) {
                        vastTracker.setProgress(progressEventsSeconds.shift());
                        console.log(getCurrentDate() + " Ad event: progress")
                    }
                    if (player.getCurrentTime() >= player.getDuration() * 0.25 && !fq) {
                        vastTracker.setProgress(player.getCurrentTime());
                        fq = true;
                    } else if (player.getCurrentTime() >= player.getDuration() * 0.5 && !mp) {
                        vastTracker.setProgress(player.getCurrentTime());
                        mp = true;
                    } else if (player.getCurrentTime() >= player.getDuration() * 0.75 && !tq) {
                        vastTracker.setProgress(player.getCurrentTime());
                        tq = true;
                        clearInterval(timerId);
                    }
                }
            }, 300);
        }
    },
});
