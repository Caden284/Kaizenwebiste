/*  ONE SIGNAL — intro film → website hand-off
    Plays the 60 s film full-screen when someone lands on the home page, then glides the film's
    yin-yang onto the real .emblem in your hero (same size, same angle, same spin) and reveals the site.
    Portrait screens get the 9:16 phone cut; everything else gets the 16:9 cut.
    Add to index.html, just before </body>:
      <link rel="stylesheet" href="/media/one-signal-intro.css">
      <script src="/media/one-signal-intro.js" defer></script>
*/
(function () {
  'use strict';
  var CFG = {
    glide: 1100,           // ms
    oncePerSession: true,
    laptop: {              // 16:9 cut
      webm: '/media/one-signal-1080.webm',
      mp4: '/media/one-signal-1080.mp4',
      frame: { w: 1920, h: 1080 },
      handoffAt: 58.5,     // seconds into the film when the glide starts (emblem is at rest by 58.4)
      emblem: { x: 960, y: 540, size: 480 },  // where the film's emblem rests, in film pixels
      spin0: 53.6,         // film emblem angle (deg) = 9 * (t - spin0) once settled — same 40 s/rev as the site
      lightFrom: 57.3,     // film turns to the site's daylight background from here
      // Dark mode: hand off before the film's light wipe (it starts at 57.43 s), while the film's
      // background still matches the dark site. The emblem holds still at this spot and size from
      // 55.2 s to 57.2 s, so a glide starting at 56.0 s lands by 57.1 s.
      dark: { handoffAt: 56.0, emblem: { x: 960, y: 540, size: 378 } }
    },
    phone: {               // 9:16 cut, for portrait screens
      webm: '/media/one-signal-phone.webm',
      mp4: '/media/one-signal-phone.mp4',
      frame: { w: 1080, h: 1920 },
      sideCrop: 20,        // film px that may be cropped from each side (text sits 68 px in, so it keeps a margin)
      handoffAt: 58.6,     // the daylight wipe (57.4–58.25 s) has finished
      emblem: { x: 540, y: 520, size: 360 },
      spin0: 55.3,
      lightFrom: 57.8,
      // Dark mode: hand off before the daylight wipe starts at 57.4 s
      dark: { handoffAt: 56.8, emblem: { x: 540, y: 520, size: 360 } }
    }
  };

  var html = document.documentElement;
  var dark = html.getAttribute('data-theme') === 'dark';
  var portrait = window.matchMedia && matchMedia('(max-aspect-ratio: 1/1)').matches;
  var film = portrait ? CFG.phone : CFG.laptop;
  var handoffAt = dark ? film.dark.handoffAt : film.handoffAt;
  var filmEmblem = dark ? film.dark.emblem : film.emblem;
  var emblemEl = document.querySelector('.hero .emblem');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var force = params.has('intro');
  var seen = false;
  try { seen = sessionStorage.getItem('os-intro-seen') === '1'; } catch (e) {}
  if (!emblemEl || (!force && (reduce || location.hash || (CFG.oncePerSession && seen)))) return;

  html.classList.add('os-intro');
  window.scrollTo(0, 0);

  var wrap = document.createElement('div');
  wrap.id = 'os-intro';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'Intro film');
  wrap.innerHTML =
    '<video playsinline muted autoplay preload="auto" aria-label="One Signal — 60 second intro film">' +
      '<source src="' + film.webm + '" type="video/webm">' +
      '<source src="' + film.mp4 + '" type="video/mp4">' +
    '</video>' +
    '<div class="os-controls">' +
      '<button type="button" class="os-sound" aria-pressed="false">Sound on</button>' +
      '<button type="button" class="os-skip">Skip intro →</button>' +
    '</div>';
  document.body.appendChild(wrap);
  var v = wrap.querySelector('video');
  var btnSound = wrap.querySelector('.os-sound');
  var btnSkip = wrap.querySelector('.os-skip');
  var started = false, done = false;

  function fit() { // size and place the film in the viewport; returns where its emblem sits on screen
    var vw = wrap.clientWidth, vh = wrap.clientHeight, F = film.frame, k;
    if (film.sideCrop) k = Math.max(vw / F.w, Math.min(vh / F.h, vw / (F.w - 2 * film.sideCrop))); // fill, cropping at most the margins
    else k = vw / vh >= 1 ? Math.max(vw / F.w, vh / F.h) : Math.min(vw / F.w, vh / F.h);           // cover, or letterbox when tall
    var w = F.w * k, h = F.h * k, ox = (vw - w) / 2, oy = (vh - h) / 2;
    v.style.left = ox + 'px'; v.style.top = oy + 'px'; v.style.width = w + 'px'; v.style.height = h + 'px';
    return { k: k, ox: ox, oy: oy, cx: ox + filmEmblem.x * k, cy: oy + filmEmblem.y * k, size: filmEmblem.size * k, vw: vw, vh: vh };
  }
  function ease(x) { // cubic-bezier(.2,.9,.3,1) — the site's settle curve
    var lo = 0, hi = 1, t = x;
    for (var i = 0; i < 22; i++) { t = (lo + hi) / 2; var bx = 3 * (1 - t) * (1 - t) * t * .2 + 3 * (1 - t) * t * t * .3 + t * t * t; if (bx < x) lo = t; else hi = t; }
    return 3 * (1 - t) * (1 - t) * t * .9 + 3 * (1 - t) * t * t + t * t * t;
  }
  function syncSpin(filmTime) { // put the site's emblem at the film's angle so the swap is invisible
    var ang = (9 * (filmTime - film.spin0)) % 360; if (ang < 0) ang += 360;
    emblemEl.style.animation = 'none'; void emblemEl.offsetWidth; emblemEl.style.animation = '';
    emblemEl.style.animationDelay = (-(ang / 9)) + 's';
  }
  function reveal() {
    html.classList.add('os-reveal');
    html.classList.remove('os-intro');
    try { sessionStorage.setItem('os-intro-seen', '1'); } catch (e) {}
    setTimeout(function () { html.classList.remove('os-reveal'); }, 2200);
  }
  function teardown(ms) {
    done = true;
    wrap.style.transition = 'opacity ' + ms + 'ms ease'; wrap.style.opacity = '0';
    setTimeout(function () { wrap.remove(); }, ms + 50);
  }
  function handoff() {
    if (started) return; started = true;
    wrap.classList.add('os-handoff');
    var f = fit(), r = emblemEl.getBoundingClientRect();
    // the hero emblem must be on screen to glide onto it (on phones it sits below the fold): otherwise dissolve
    if (r.top < 0 || r.bottom > f.vh || r.left < 0 || r.right > f.vw) { syncSpin(v.currentTime); reveal(); teardown(700); return; }
    var tx = r.left + r.width / 2, ty = r.top + r.height / 2, ts = emblemEl.offsetWidth;
    var s = ts / f.size, dx = tx - f.cx, dy = ty - f.cy;
    var t0 = performance.now(), filmT0 = v.currentTime, diag = Math.hypot(f.vw, f.vh);
    emblemEl.style.visibility = 'hidden';
    wrap.style.background = 'transparent';
    var ex = f.cx - f.ox, ey = f.cy - f.oy;  // the emblem centre, in the video element's own box
    v.style.transformOrigin = ex + 'px ' + ey + 'px';
    (function step(now) {
      var p = Math.min(1, (now - t0) / CFG.glide), e = ease(p);
      // only the emblem travels: the rest of the film frame dissolves away around it
      var R = diag * (1 - ease(Math.min(1, p / .45))) + (f.size / 2 + 2);
      var m = 'radial-gradient(circle at ' + ex + 'px ' + ey + 'px, #000 ' + (R - 1) + 'px, transparent ' + (R + 1) + 'px)';
      v.style.webkitMaskImage = m; v.style.maskImage = m;
      v.style.transform = 'translate(' + dx * e + 'px,' + dy * e + 'px) scale(' + (1 + (s - 1) * e) + ')';
      if (p < 1) return requestAnimationFrame(step);
      syncSpin(filmT0 + CFG.glide / 1000);
      emblemEl.style.visibility = '';
      reveal(); teardown(250);
    })(t0);
  }
  function skip() {
    if (done) return; started = true;
    syncSpin(v.currentTime || 0); reveal(); teardown(450); v.pause();
  }
  function tick() {
    if (!dark && v.currentTime >= film.lightFrom) wrap.classList.add('os-light');
    if (v.currentTime >= handoffAt) handoff();
  }
  v.addEventListener('timeupdate', tick);
  // timeupdate fires only about 4 times a second; also check every frame so the glide starts on time
  (function poll() { if (started || done) return; tick(); requestAnimationFrame(poll); })();
  v.addEventListener('ended', handoff);
  v.addEventListener('loadedmetadata', fit);
  window.addEventListener('resize', function () { if (!started) fit(); });
  v.addEventListener('error', skip, true);
  btnSkip.addEventListener('click', skip);
  btnSound.addEventListener('click', function () {
    v.muted = !v.muted; btnSound.setAttribute('aria-pressed', String(!v.muted));
    btnSound.textContent = v.muted ? 'Sound on' : 'Sound off';
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') skip(); });
  var dbg = parseFloat(params.get('intro'));
  var go = function () { if (dbg > 0) v.currentTime = dbg; var pr = v.play(); if (pr && pr.catch) pr.catch(skip); };
  if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
})();
