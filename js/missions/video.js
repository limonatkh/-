/* =====================================================================
 * CHANNEL VIDEOS — the original Limonat animations, shown on screens
 * inside the mission world.
 * ---------------------------------------------------------------------
 * VR.VIDEOS is the only place videos are described. A mission screen
 * just names a key:  { type: 'videoScreen', video: 'thinker', ... }
 * To add a video later, add an entry here; no mission code changes.
 *
 *   youtube   the YouTube video id
 *   start/end the segment to play, in seconds
 *   clueAt    the moment that matters (shown as a time to the player)
 *   clue      what the owner of the channel says is visible there. It is
 *             shown ONLY when the video can't play (offline, blocked
 *             embedding), so nobody gets stuck in a mission.
 *
 * Playback: the YouTube IFrame Player API (a normal YouTube link can't
 * be drawn into WebGL). The player opens as the TV's screen view; the
 * 3D room stays as it is behind it. Nothing is downloaded or copied.
 * ===================================================================== */
(function () {
  VR.VIDEOS = Object.assign(VR.VIDEOS || {}, {
    thinker: {
      youtube: 'vU9OX6f2dpw',
      title: { ar: 'المفكر v.s الفقيه', en: 'المفكر v.s الفقيه' },
      start: 81, end: 118, clueAt: 115,
      clue: { ar: 'عند 01:55 تظهر كرة بداخلها سبع نجوم.', en: 'At 01:55 a ball appears with seven stars inside it.' },
    },
    tasawwur: {
      youtube: 'qkOjFvwUun0',
      title: { ar: 'الحكم على الشيء جزء من تصوره', en: 'الحكم على الشيء جزء من تصوره' },
      start: 8, end: 30, clueAt: 28,
      clue: { ar: 'تعرض شاشة حروف الجر بهذا الترتيب: «في»، ثم «عن»، ثم «على».',
        en: 'A screen shows these Arabic prepositions in this order: «في» (fi), then «عن» (an), then «على» (ala).' },
    },
  });

  Object.assign(VR.I18N.STRINGS.en, {
    'v.watch': 'Watch', 'n.screen': 'Screen',
    'vid.segment': 'Clip {a} – {b}', 'vid.loading': 'Loading the video…', 'vid.replay': 'REPLAY THE CLIP',
    'vid.open': 'Open on YouTube', 'vid.help': 'Video not playing? Show the description of the clue',
    'vid.failTitle': 'The video can\'t play here', 'vid.failText': 'This is the clip as described by the channel:',
    'vid.offline': 'No internet connection.', 'vid.blocked': 'The video can\'t be embedded here.',
    'vid.journal': 'Clip description ({t})', 'vid.watched': 'Watched: {title}',
  });
  Object.assign(VR.I18N.STRINGS.ar, {
    'v.watch': 'شاهد', 'n.screen': 'شاشة',
    'vid.segment': 'المقطع {a} – {b}', 'vid.loading': 'نحمّل الفيديو…', 'vid.replay': 'إعادة المقطع',
    'vid.open': 'افتح في يوتيوب', 'vid.help': 'الفيديو لا يعمل؟ اعرض وصف الدليل',
    'vid.failTitle': 'تعذّر تشغيل الفيديو هنا', 'vid.failText': 'هذا وصف المقطع كما قدّمته القناة:',
    'vid.offline': 'لا يوجد اتصال بالإنترنت.', 'vid.blocked': 'لا يمكن عرض هذا الفيديو داخل اللعبة.',
    'vid.journal': 'وصف المقطع ({t})', 'vid.watched': 'شاهدت: {title}',
  });

  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- YouTube IFrame API, loaded once on first use
  let apiPromise = null;
  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch (e) { /* ignore */ } resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
      s.onerror = () => { apiPromise = null; reject(new Error('load')); };
      document.head.appendChild(s);
      setTimeout(() => { if (!(window.YT && window.YT.Player)) { apiPromise = null; reject(new Error('timeout')); } }, 9000);
    });
    return apiPromise;
  }

  /**
   * Open a video on the mission UI (the TV's screen view).
   * opts: { onFallback(clueText) } called once if the description has to be shown.
   */
  VR.MissionUI.prototype.showVideo = function (vid, opts = {}) {
    const T = (k, v) => VR.t(k, v), L = (v) => VR.L(v);
    const url = `https://www.youtube.com/watch?v=${vid.youtube}&t=${vid.start}s`;
    let player = null, closed = false, fellBack = false, helpTimer = 0;
    VR.Audio.setMusicVolume(0.05);
    this.open('video', `
      <div class="mi-eyebrow">${esc(L(opts.name) || T('n.screen'))}</div>
      <div class="mi-vtitle">${esc(L(vid.title))}</div>
      <div class="mi-vframe"><div id="mi-yt"></div><div class="mi-vmsg" id="mi-vmsg">${T('vid.loading')}</div></div>
      <div class="mi-vrow">
        <span class="mi-vseg num">${esc(T('vid.segment', { a: mmss(vid.start), b: mmss(vid.end) }))}</span>
        <a class="mi-vlink" href="${url}" target="_blank" rel="noopener">${T('vid.open')}</a>
      </div>
      <button class="btn" id="mi-vreplay">${T('vid.replay')}</button>
      <button class="mi-vhelp" id="mi-vhelp" hidden>${T('vid.help')}</button>
      <div class="mi-vfall" id="mi-vfall" hidden></div>
      <button class="btn" id="mi-close" data-focus>${T('mi.close')}</button>`,
    (card) => {
      const msg = card.querySelector('#mi-vmsg');
      const fallback = (why) => {
        if (closed) return;
        msg.hidden = false; msg.textContent = why || T('vid.failTitle');
        card.querySelector('#mi-vhelp').hidden = true;
        const f = card.querySelector('#mi-vfall');
        f.innerHTML = `<b>${T('vid.failTitle')}</b><p>${T('vid.failText')}</p><blockquote>${esc(L(vid.clue))}</blockquote>
          <p class="num">${esc(T('vid.segment', { a: mmss(vid.start), b: mmss(vid.end) }))} · ${mmss(vid.clueAt)}</p>`;
        f.hidden = false;
        if (!fellBack) { fellBack = true; opts.onFallback && opts.onFallback(L(vid.clue), mmss(vid.clueAt)); }
      };
      card.querySelector('#mi-close').addEventListener('click', () => this.close());
      card.querySelector('#mi-vhelp').addEventListener('click', () => fallback(T('vid.failTitle')));
      card.querySelector('#mi-vreplay').addEventListener('click', () => {
        VR.Audio.play('click');
        if (player && player.seekTo) { player.seekTo(vid.start, true); player.playVideo(); }
      });
      // after a while, offer the description in case playback silently failed
      helpTimer = setTimeout(() => { if (!closed && !fellBack) card.querySelector('#mi-vhelp').hidden = false; }, 12000);
      if (navigator.onLine === false) { fallback(T('vid.offline')); return; }
      loadApi().then((YT) => {
        if (closed) return;
        player = new YT.Player('mi-yt', {
          host: 'https://www.youtube-nocookie.com',
          videoId: vid.youtube,
          width: '100%', height: '100%',
          playerVars: { start: vid.start, end: vid.end, autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, controls: 1, origin: location.origin },
          events: {
            onReady: (e) => { msg.hidden = true; try { e.target.playVideo(); } catch (err) { /* autoplay refused: the player shows its own play button */ } },
            onStateChange: (e) => { if (e.data === YT.PlayerState.PLAYING) { msg.hidden = true; opts.onPlaying && opts.onPlaying(); } },
            onError: () => fallback(T('vid.blocked')),
          },
        });
      }).catch(() => fallback(navigator.onLine === false ? T('vid.offline') : T('vid.blocked')));
    });
    // closing the screen stops the video
    const prevClose = this._videoCleanup;
    this._videoCleanup = () => {
      closed = true; clearTimeout(helpTimer);
      try { if (player && player.destroy) player.destroy(); } catch (e) { /* ignore */ }
      player = null;
      VR.Audio.setMusicVolume(0.35);
    };
    if (prevClose) prevClose();
  };
  // run the cleanup whenever the video modal is closed (any route: button, Esc, pause)
  const baseClose = VR.MissionUI.prototype.close;
  VR.MissionUI.prototype.close = function () {
    if (this.modal === 'video' && this._videoCleanup) { const c = this._videoCleanup; this._videoCleanup = null; c(); }
    return baseClose.call(this);
  };
  VR.VideoUtil = { mmss, loadApi };
})();
