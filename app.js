/* NEXORA website interactions — config-driven, no invented URLs. */
(function () {
  'use strict';
  var cfg = window.NEXORA_SITE || {};
  var hasDl = !!(cfg.windowsInstallerUrl || cfg.releasesUrl);
  var hasGh = !!cfg.githubRepoUrl;

  // ---- Optional website analytics (visitor countries + download clicks).
  // OFF by default: nothing loads, nobody is tracked. Activates only when
  // gaMeasurementId is set in config.js. This measures the WEBSITE, never
  // the browser — NEXORA itself still phones home to nobody.
  function trackEvent(name, params) {
    try {
      if (window.gtag) window.gtag('event', name, params || {});
    } catch (e) {}
  }
  if (cfg.gaMeasurementId) {
    try {
      var gid = cfg.gaMeasurementId;
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gid);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', gid, { anonymize_ip: true });
    } catch (e) {}
  }

  // ---- Download / GitHub buttons follow configuration ----
  function wireButtons() {
    document.querySelectorAll('[data-download]').forEach(function (b) {
      if (!hasDl) {
        b.disabled = true;
        b.title = 'Coming Soon — the first official installer is not published yet.';
        b.textContent = /Windows/.test(b.textContent) ? b.textContent : 'Download — Coming Soon';
      } else {
        b.addEventListener('click', function () {
          trackEvent('download_nexora', {
            version: (cfg.releaseInfo && cfg.releaseInfo.version) || 'unknown'
          });
          window.open(cfg.windowsInstallerUrl || cfg.releasesUrl, '_blank', 'noopener');
        });
      }
    });

    document.querySelectorAll('[data-github]').forEach(function (b) {
      if (!hasGh) {
        b.addEventListener('click', function () {
          alert('The public NEXORA repository is not published yet. Check back after the first release.');
        });
      } else {
        b.addEventListener('click', function () {
          window.open(cfg.githubRepoUrl, '_blank', 'noopener');
        });
      }
    });
    // Release info line, only when a real release is configured.
    var note = document.getElementById('heroReleaseNote');
    var dl = document.getElementById('dlInfo');
    if (cfg.releaseInfo && note && dl) {
      var r = cfg.releaseInfo;
      note.textContent = 'Latest: v' + r.version + ' · ' + r.date;
      dl.innerHTML = '<strong>Latest: v' + esc(r.version) + '</strong>'
        + '<span class="dl-meta">' + esc(r.arch || '') + ' · ' + esc(r.size || '') + ' · released ' + esc(r.date || '') + '</span>'
        + '<span>Download NEXORA only from official release sources.</span>';
    }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- Scroll progress ----
  var prog = document.getElementById('progress');
  function onScroll() {
    if (!prog) return;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    prog.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Live download counter (real GitHub totals, public API, no login) ----
  // Shows actual completed downloads across all releases. This is the honest
  // number: anonymous totals, including repeat downloads — not unique humans.
  (function liveDownloads() {
    var el = document.getElementById('dlInfo');
    if (!el || !cfg.githubRepoUrl) return;
    var line = document.createElement('span');
    line.className = 'dl-meta';
    line.id = 'dlLiveCount';
    line.textContent = 'Counting real downloads…';
    el.appendChild(line);
    var repo = cfg.githubRepoUrl.replace(/\/$/, '').split('/').slice(-2).join('/');
    fetch('https://api.github.com/repos/' + repo + '/releases?per_page=20')
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (rels) {
        var total = 0, latest = 0;
        (rels || []).forEach(function (rel, i) {
          var n = 0;
          (rel.assets || []).forEach(function (a) { n += Number(a.download_count || 0); });
          total += n;
          if (i === 0) latest = n;
        });
        line.textContent = 'Downloaded ' + total.toLocaleString('en-US') + ' times in total (' + latest.toLocaleString('en-US') + ' on the latest release) — live from GitHub.';
      })
      .catch(function () {
        line.textContent = '';
      });
  })();

  // ---- Mobile nav ----
  var burger = document.getElementById('navBurger');
  var links = document.getElementById('navLinks');
  if (burger && links) {
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') links.classList.remove('open');
    });
  }

  // ---- Scroll reveal + active nav ----
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  var secs = ['features', 'esta', 'privacy', 'screens', 'whatsnew', 'download', 'faq'];
  var navAs = Array.from(document.querySelectorAll('.nav-links a'));
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        navAs.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  secs.forEach(function (id) {
    var s = document.getElementById(id);
    if (s) spy.observe(s);
  });

  // ---- Screenshot lightbox (enlarges the illustrative mockups) ----
  var lb = document.getElementById('lightbox');
  var lbBody = document.getElementById('lightboxBody');
  var lbCap = document.getElementById('lightboxCap');
  function closeLb() { if (lb) lb.hidden = true; }
  document.querySelectorAll('.shot').forEach(function (fig) {
    fig.addEventListener('click', function () {
      var mini = fig.querySelector('.shot-mini');
      var cap = fig.querySelector('figcaption');
      if (!mini || !lb) return;
      lbBody.innerHTML = '';
      lbBody.appendChild(mini.cloneNode(true));
      lbCap.textContent = cap ? cap.innerText : '';
      lb.hidden = false;
    });
    fig.setAttribute('tabindex', '0');
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fig.click(); }
    });
  });
  var lbClose = document.getElementById('lightboxClose');
  if (lbClose) lbClose.addEventListener('click', closeLb);
  if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLb(); });

  wireButtons();
})();
