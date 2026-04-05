/* ═══════════════════════════════════════════════════════════════
   ROCKET ASSEMBLY — Scroll-driven visual storytelling
   ─────────────────────────────────────────────────────────────
   Top of page: scattered blueprint parts (requirements)
   Scroll down: parts progressively assemble into a rocket
   Bottom:      "Launch" ignites the rocket → returns to top
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var container  = document.getElementById('rocket-assembly');
  if (!container) return;

  var parts       = Array.prototype.slice.call(container.querySelectorAll('.rocket-part'));
  var labels      = Array.prototype.slice.call(container.querySelectorAll('.rocket-label'));
  var decorations = Array.prototype.slice.call(container.querySelectorAll('.rocket-decoration'));
  var flame       = container.querySelector('.rocket-flame');
  var launchBtn   = document.getElementById('rocket-launch-btn');
  var rocketInner = container.querySelector('.rocket-inner');

  /* ── Scattered state: [translateX, translateY, rotate°, scale] ── */
  var SCATTER = {
    'nose':       [-30, -50, -32, 0.82],
    'body-upper': [ 42, -22,  24, 0.88],
    'window':     [ 50,   6,  14, 0.78],
    'body-lower': [-40,  22, -18, 0.84],
    'fin-left':   [-52,  48, -48, 0.78],
    'fin-right':  [ 52,  42,  42, 0.78],
    'engine':     [  0,  68, 175, 0.72]
  };

  /* ── Assembly ranges: [startScroll%, endScroll%] per part ────── */
  var RANGES = {
    'nose':       [0.05, 0.18],
    'body-upper': [0.15, 0.30],
    'window':     [0.28, 0.42],
    'body-lower': [0.40, 0.55],
    'fin-left':   [0.52, 0.65],
    'fin-right':  [0.52, 0.65],
    'engine':     [0.62, 0.78]
  };

  var ticking    = false;
  var isLaunching = false;

  /* ── Math helpers ──────────────────────────────────────────── */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function getScrollProgress() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    return h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
  }

  /* ── Core update (called via rAF) ─────────────────────────── */
  function update() {
    if (isLaunching) { ticking = false; return; }

    var p = getScrollProgress();

    /* Show after a small scroll */
    container.classList.toggle('rocket-visible', p > 0.015);

    /* Animate each part */
    parts.forEach(function (el) {
      var name = el.getAttribute('data-part');
      var s = SCATTER[name];
      var r = RANGES[name];
      if (!s || !r) return;

      /* Local progress 0→1 for this part */
      var t;
      if (p <= r[0])      t = 0;
      else if (p >= r[1]) t = 1;
      else                t = (p - r[0]) / (r[1] - r[0]);
      t = easeOutCubic(t);

      var tx  = lerp(s[0], 0, t);
      var ty  = lerp(s[1], 0, t);
      var rot = lerp(s[2], 0, t);
      var sc  = lerp(s[3], 1, t);

      el.style.transform =
        'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) ' +
        'rotate(' + rot.toFixed(1) + 'deg) ' +
        'scale(' + sc.toFixed(3) + ')';

      el.style.opacity = lerp(0.4, 1, t).toFixed(2);
    });

    /* Fade labels and decorations as assembly progresses */
    var fade = Math.min(1, p * 2.8);
    labels.forEach(function (el) {
      el.style.opacity = Math.max(0, 1 - fade).toFixed(2);
    });
    decorations.forEach(function (el) {
      el.style.opacity = Math.max(0, 1 - fade * 0.65).toFixed(2);
    });

    /* Assembled state — dashes → solid, show launch button */
    container.classList.toggle('rocket-assembled', p > 0.80);

    ticking = false;
  }

  /* ── Scroll listener (passive, rAF-throttled) ─────────────── */
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  /* ── Launch sequence ──────────────────────────────────────── */
  function launch() {
    if (isLaunching) return;
    isLaunching = true;

    /* Phase 1: ignition — flame + shake */
    flame.classList.add('rocket-flame--active');
    container.classList.add('rocket-launching');
    rocketInner.classList.add('rocket-shake');

    setTimeout(function () {
      /* Phase 2: liftoff */
      rocketInner.classList.remove('rocket-shake');
      rocketInner.classList.add('rocket-liftoff');

      /* Scroll to top */
      window.scrollTo({ top: 0, behavior: 'smooth' });

      /* Phase 3: reset after animation ends */
      setTimeout(function () {
        rocketInner.classList.remove('rocket-liftoff');
        flame.classList.remove('rocket-flame--active');
        container.classList.remove('rocket-launching', 'rocket-assembled', 'rocket-visible');
        isLaunching = false;
        update();
      }, 1400);
    }, 850);
  }

  /* ── Bind ──────────────────────────────────────────────────── */
  window.addEventListener('scroll', onScroll, { passive: true });
  if (launchBtn) {
    launchBtn.addEventListener('click', function (e) {
      e.preventDefault();
      launch();
    });
  }

  /* Initial render */
  update();

  /* Resize guard */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(update, 150);
  });
})();
