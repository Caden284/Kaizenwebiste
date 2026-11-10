/*  ONE SIGNAL — intro film → website hand-off
    Plays the 60 s film full-screen when someone lands on the home page, then glides the film's
    yin-yang onto the real .emblem in your hero (same size, same angle, same spin) and reveals the site.
    Add to index.html, just before </body>:
      <link rel="stylesheet" href="/media/one-signal-intro.css">
      <script src="/media/one-signal-intro.js" defer></script>
*/
(function () {
  'use strict';
  var CFG = {
    webm: '/media/one-signal-1080.webm',
    mp4: '/media/one-signal-1080.mp4',
    handoffAt: 58.5,       // seconds into the film when the glide starts (emblem is at rest by 58.4)
    glide: 1100,           // ms
    frame: { w: 1920, h: 1080 },
    emblem: { x: 960, y: 540, size: 480 },  // where the film's emblem rests, in film pixels
    spin0: 53.6,           // film emblem angle (deg) = 9 * (t - spin0) once settled — same 40 s/rev as the site
    lightFrom: 57.3,       // film turns to the site's daylight background from here
    oncePerSession: true
  };

  var html = document.documentElement;
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
      '<source src="' + CFG.webm + '" type="video/webm">' +
      '<source src="' + CFG.mp4 + '" type="video/mp4">' +
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

  function fit() { // how the 16:9 film sits in the viewport
    var vw = wrap.clientWidth, vh = wrap.clientHeight;
    var cover = vw / vh >= 1;
    var k = cover ? Math.max(vw / CFG.frame.w, vh / CFG.frame.h) : Math.min(vw / CFG.frame.w, vh / CFG.frame.h);
    var ox = (vw - CFG.frame.w * k) / 2, oy = (vh - CFG.frame.h * k) / 2;
    v.style.objectFit = cover ? 'cover' : 'contain';
    return { k: k, cx: ox + CFG.emblem.x * k, cy: oy + CFG.emblem.y * k, size: CFG.emblem.size * k, vw: vw, vh: vh };
  }
  function ease(x) { // cubic-bezier(.2,.9,.3,1) — the site's settle curve
    var lo = 0, hi = 1, t = x;
    for (var i = 0; i < 22; i++) { t = (lo + hi) / 2; var bx = 3 * (1 - t) * (1 - t) * t * .2 + 3 * (1 - t) * t * t * .3 + t * t * t; if (bx < x) lo = t; else hi = t; }
    return 3 * (1 - t) * (1 - t) * t * .9 + 3 * (1 - t) * t * t + t * t * t;
  }
  function syncSpin(filmTime) { // put the site's emblem at the film's angle so the swap is invisible
    var ang = (9 * (filmTime - CFG.spin0)) % 360; if (ang < 0) ang += 360;
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
    var f = fit(), r = emblemEl.getBoundingClientRect();
    // the hero emblem must be on screen to glide onto it (on phones it sits below the fold): otherwise dissolve
    if (r.top < 0 || r.bottom > f.vh || r.left < 0 || r.right > f.vw) { syncSpin(v.currentTime); reveal(); teardown(700); return; }
    var tx = r.left + r.width / 2, ty = r.top + r.height / 2, ts = emblemEl.offsetWidth;
    var s = ts / f.size, dx = tx - f.cx, dy = ty - f.cy;
    var t0 = performance.now(), filmT0 = v.currentTime, diag = Math.hypot(f.vw, f.vh);
    emblemEl.style.visibility = 'hidden';
    wrap.style.background = 'transparent';
    v.style.transformOrigin = f.cx + 'px ' + f.cy + 'px';
    (function step(now) {
      var p = Math.min(1, (now - t0) / CFG.glide), e = ease(p);
      // only the emblem travels: the rest of the film frame dissolves away around it
      var R = diag * (1 - ease(Math.min(1, p / .45))) + (f.size / 2 + 2);
      var m = 'radial-gradient(circle at ' + f.cx + 'px ' + f.cy + 'px, #000 ' + (R - 1) + 'px, transparent ' + (R + 1) + 'px)';
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
  v.addEventListener('timeupdate', function () {
    if (v.currentTime >= CFG.lightFrom) wrap.classList.add('os-light');
    if (v.currentTime >= CFG.handoffAt) handoff();
  });
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
