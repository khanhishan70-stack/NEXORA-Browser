/* NEXORA — futuristic layer: particles, monitor tilt, headline decode, stat count-up.
 * Visual only. Skips itself under prefers-reduced-motion; tilt needs a fine pointer. */
(function () {
  'use strict';

  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var finePointer = window.matchMedia ? window.matchMedia('(pointer: fine)') : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }
  function canTilt() { return !reducedMotion() && !!finePointer && finePointer.matches; }

  /* ---------- particle atmosphere ---------- */
  var canvas = document.createElement('canvas');
  canvas.id = 'fx-particles';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var particles = [];
  var W = 0, H = 0;
  var COLORS = ['0,255,249', '180,0,255', '255,46,166', '220,245,255'];

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.max(28, Math.min(85, Math.round((W * H) / 22000)));
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.6 + Math.random() * 1.7,
        speed: 0.08 + Math.random() * 0.3,
        sway: 8 + Math.random() * 22,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.4 + Math.random() * 1.2,
        color: COLORS[(Math.random() * COLORS.length) | 0]
      });
    }
  }

  function drawParticles(t) {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.y -= p.speed;
      if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
      var x = p.x + Math.sin(t / 2400 + p.phase) * p.sway * 0.2;
      var alpha = 0.14 + 0.5 * (0.5 + 0.5 * Math.sin(t / 1000 * p.twinkle + p.phase));
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.color + ',' + alpha.toFixed(3) + ')';
      ctx.fill();
    }
  }

  /* ---------- pointer tilt (hero monitor + showcase bezels) ---------- */
  var tilts = [];
  function addTilt(area, target, baseX, baseY, range) {
    if (!area || !target) return;
    var state = { area: area, target: target, baseX: baseX, baseY: baseY, range: range, x: baseX, y: baseY, tx: baseX, ty: baseY, active: false, raf: false };
    tilts.push(state);
    area.addEventListener('pointerenter', function () {
      if (!canTilt()) return;
      state.active = true;
      target.style.willChange = 'transform';
    });
    area.addEventListener('pointermove', function (e) {
      if (!state.active) return;
      var r = area.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5;
      var ny = (e.clientY - r.top) / r.height - 0.5;
      state.tx = baseX - ny * range;
      state.ty = baseY + nx * range;
    });
    area.addEventListener('pointerleave', function () {
      state.active = false;
      state.tx = baseX; state.ty = baseY;
      target.style.willChange = '';
    });
  }

  function stepTilts() {
    for (var i = 0; i < tilts.length; i++) {
      var s = tilts[i];
      var dx = s.tx - s.x, dy = s.ty - s.y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        if (!s.active && s.raf) { s.target.style.removeProperty('transform'); s.raf = false; }
        continue;
      }
      s.x += dx * 0.12; s.y += dy * 0.12;
      s.raf = true;
      s.target.style.setProperty('transform', 'rotateX(' + s.x.toFixed(2) + 'deg) rotateY(' + s.y.toFixed(2) + 'deg)', 'important');
    }
  }

  var heroStage = document.querySelector('.monitor-stage');
  addTilt(heroStage, document.querySelector('.hero-visual .monitor'), 3, -6, 10);
  document.querySelectorAll('.showcase-monitor').forEach(function (m) {
    addTilt(m, m.querySelector('.showcase-bezel'), 0, 0, 12);
  });
  var setup = document.getElementById('setupShowcase');
  if (setup) addTilt(setup, setup.querySelector('.showcase-bezel'), 0, 0, 10);

  /* ---------- one shared loop, paused while the tab is hidden ---------- */
  var running = false;
  function frame(t) {
    if (!running) return;
    if (!reducedMotion()) { drawParticles(t); stepTilts(); }
    window.requestAnimationFrame(frame);
  }
  function syncLoop() {
    var shouldRun = !document.hidden && !reducedMotion();
    if (shouldRun && !running) { running = true; window.requestAnimationFrame(frame); }
    else if (!shouldRun && running) { running = false; }
    if (reducedMotion()) {
      ctx.clearRect(0, 0, W, H);
      tilts.forEach(function (s) { s.target.style.removeProperty('transform'); s.x = s.tx = s.baseX; s.y = s.ty = s.baseY; });
    }
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  document.addEventListener('visibilitychange', syncLoop);
  if (motionQuery) {
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', syncLoop);
    else if (motionQuery.addListener) motionQuery.addListener(syncLoop);
  }
  syncLoop();

  /* ---------- hero headline: decode-in once on load ---------- */
  (function decodeHeadline() {
    var h1 = document.querySelector('.hero-copy h1');
    if (!h1 || reducedMotion()) return;
    var GLYPHS = '!<>-_/[]{}=+*^?#01';
    var nodes = [];
    var walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    var total = 0;
    while (walker.nextNode()) {
      var n = walker.currentNode;
      nodes.push({ node: n, text: n.textContent, start: total });
      total += n.textContent.length;
    }
    if (!total) return;
    var DURATION = 1100, DELAY = 300, t0 = null;
    function tick(t) {
      if (t0 === null) t0 = t;
      var elapsed = t - t0 - DELAY;
      var progress = Math.max(0, Math.min(1, elapsed / DURATION));
      var resolved = Math.floor(progress * total);
      nodes.forEach(function (entry) {
        var local = resolved - entry.start;
        if (local >= entry.text.length) { entry.node.textContent = entry.text; return; }
        var out = entry.text.slice(0, Math.max(0, local));
        for (var i = Math.max(0, local); i < entry.text.length; i++) {
          var ch = entry.text[i];
          out += (ch === ' ' || ch === '\n') ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        entry.node.textContent = out;
      });
      if (progress < 1) window.requestAnimationFrame(tick);
      else nodes.forEach(function (entry) { entry.node.textContent = entry.text; });
    }
    window.requestAnimationFrame(tick);
  }());

  /* ---------- hero stats: count up when visible ---------- */
  (function countUp() {
    var strongs = document.querySelectorAll('.hero-stats strong');
    if (!strongs.length) return;
    if (reducedMotion() || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target;
        var m = el.textContent.match(/^(\d+)(.*)$/);
        if (!m) return;
        var target = parseInt(m[1], 10), suffix = m[2], t0 = null;
        function tick(t) {
          if (t0 === null) t0 = t;
          var p = Math.min(1, (t - t0) / 1200);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) window.requestAnimationFrame(tick);
        }
        window.requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    strongs.forEach(function (el) { io.observe(el); });
  }());
})();