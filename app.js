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
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
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

  // Play only while the page is visible and no one is interacting with a monitor.
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }
  function watchAutoplay(root, advance, delay, canPlay, liveRegion, pauseOnHover) {
    var timer = null;
    var hovering = !!(root.matches && root.matches(':hover'));
    var focused = root.contains(document.activeElement);
    function stop() { if (timer !== null) { window.clearInterval(timer); timer = null; } }
    function sync() {
      stop();
      var play = canPlay() && !document.hidden && !reducedMotion() && (pauseOnHover === false || !hovering) && !focused;
      if (liveRegion) liveRegion.setAttribute('aria-live', play ? 'off' : 'polite');
      if (play) timer = window.setInterval(advance, delay);
    }
    root.addEventListener('mouseenter', function () { hovering = true; sync(); });
    root.addEventListener('mouseleave', function () { hovering = false; sync(); });
    root.addEventListener('focusin', function () { focused = true; sync(); });
    root.addEventListener('focusout', function (event) {
      if (!root.contains(event.relatedTarget)) { focused = false; sync(); }
    });
    document.addEventListener('visibilitychange', sync);
    if (motionQuery) {
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', sync);
      else if (motionQuery.addListener) motionQuery.addListener(sync);
    }
    return { stop: stop, sync: sync };
  }

  // ---- Feature and setup monitor showcases: content comes from the cards below. ----
  (function showcaseSlides() {
    function cardData(card) {
      var icon = card.querySelector('.card-ico');
      var title = card.querySelector('h3');
      var text = card.querySelector('p');
      return {
        icon: icon ? icon.textContent.trim() : '✦',
        title: title ? title.textContent : '',
        text: text ? text.textContent : ''
      };
    }
    function twoDigits(number) { return String(number).padStart(2, '0'); }
    function screenMarker(text) {
      var marker = document.createElement('span');
      marker.className = 'screen-index';
      marker.textContent = text;
      return marker;
    }

    var featureSection = document.getElementById('features');
    var features = featureSection ? Array.from(featureSection.querySelectorAll('.cards .card')).map(cardData) : [];
    document.querySelectorAll('.showcase-monitor[data-monitor-kind="feature"]').forEach(function (root, monitorNumber) {
      if (!features.length) return;
      var content = root.querySelector('.showcase-screen-content');
      var title = root.querySelector('.showcase-title');
      var summary = root.querySelector('.showcase-summary');
      var count = root.querySelector('.showcase-count');
      var prev = root.querySelector('.showcase-prev');
      var next = root.querySelector('.showcase-next');
      if (!content || !title || !summary || !count || !prev || !next) return;
      var index = monitorNumber % features.length;
      function render() {
        var item = features[index];
        var stack = document.createElement('div'); stack.className = 'feature-popup-stack';
        var popup = document.createElement('article'); popup.className = 'feature-popup';
        var icon = document.createElement('span'); icon.className = 'feature-popup-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = item.icon;
        var copy = document.createElement('div'); copy.className = 'feature-popup-copy';
        var popupTitle = document.createElement('strong'); popupTitle.textContent = item.title;
        var popupText = document.createElement('p'); popupText.textContent = item.text;
        copy.appendChild(popupTitle); copy.appendChild(popupText);
        popup.appendChild(icon); popup.appendChild(copy); stack.appendChild(popup);
        content.replaceChildren(screenMarker('FEATURE ' + twoDigits(index + 1)), stack);
        title.textContent = item.title;
        summary.textContent = item.text;
        count.textContent = twoDigits(index + 1) + ' / ' + twoDigits(features.length);
        root.setAttribute('aria-label', 'Feature monitor ' + (monitorNumber + 1) + ', ' + (index + 1) + ' of ' + features.length + ': ' + item.title);
      }
      function move(amount) { index = (index + amount + features.length) % features.length; render(); autoplay.sync(); }
      var autoplay = watchAutoplay(root, function () { index = (index + 3) % features.length; render(); }, 5200, function () { return features.length > 1; }, content);
      prev.addEventListener('click', function () { move(-1); });
      next.addEventListener('click', function () { move(1); });
      render(); autoplay.sync();
    });

    var setupSection = document.getElementById('setup');
    var steps = setupSection ? Array.from(setupSection.querySelectorAll('.cards .card')).slice(0, 5).map(cardData) : [];
    var root = document.getElementById('setupShowcase');
    if (!root || !steps.length) return;
    var content = root.querySelector('.setup-screen-content');
    var title = root.querySelector('.setup-title');
    var summary = root.querySelector('.setup-summary');
    var dots = document.getElementById('setupDots');
    var count = document.getElementById('setupIndicator');
    var prev = document.getElementById('setupPrev');
    var next = document.getElementById('setupNext');
    if (!content || !title || !summary || !dots || !count || !prev || !next) return;
    var index = 0;
    function renderStep() {
      var step = steps[index];
      var card = document.createElement('article'); card.className = 'setup-step-card';
      card.id = 'setupStepPanel'; card.setAttribute('role', 'tabpanel'); card.setAttribute('aria-labelledby', 'setupDot' + index); card.tabIndex = 0;
      var icon = document.createElement('span'); icon.className = 'setup-step-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = step.icon;
      var copy = document.createElement('div'); copy.className = 'setup-step-copy';
      var heading = document.createElement('h3'); heading.textContent = step.title;
      var instructions = document.createElement('p'); instructions.textContent = step.text;
      copy.appendChild(heading); copy.appendChild(instructions);
      card.appendChild(icon); card.appendChild(copy);
      content.replaceChildren(screenMarker('STEP ' + (index + 1) + ' / ' + steps.length), card);
      title.textContent = step.title;
      summary.textContent = step.text;
      count.textContent = (index + 1) + ' / ' + steps.length;
      root.setAttribute('aria-label', 'Setup guide, step ' + (index + 1) + ' of ' + steps.length + ': ' + step.title);
      Array.from(dots.children).forEach(function (dot, i) {
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
        dot.tabIndex = i === index ? 0 : -1;
      });
    }
    function choose(i) { index = (i + steps.length) % steps.length; renderStep(); autoplay.sync(); }
    var autoplay = watchAutoplay(root, function () { index = (index + 1) % steps.length; renderStep(); }, 6200, function () { return steps.length > 1; }, content);
    steps.forEach(function (step, i) {
      var dot = document.createElement('button');
      dot.type = 'button'; dot.id = 'setupDot' + i;
      dot.setAttribute('role', 'tab'); dot.setAttribute('aria-controls', 'setupStepPanel');
      dot.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + step.title);
      dot.addEventListener('click', function () { choose(i); });
      dot.addEventListener('keydown', function (event) {
        var target = event.key === 'ArrowRight' ? i + 1 : event.key === 'ArrowLeft' ? i - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : null;
        if (target === null) return;
        event.preventDefault(); choose(target); dots.children[index].focus();
      });
      dots.appendChild(dot);
    });
    prev.addEventListener('click', function () { choose(index - 1); });
    next.addEventListener('click', function () { choose(index + 1); });
    renderStep(); autoplay.sync();
  }());

  // ---- Interactive monitor: Power -> desktop -> user-launched browser. ----
  (function monitorDemo() {
    var screen = document.getElementById('monitorScreen');
    var power = document.getElementById('monitorPower');
    var boot = document.getElementById('monitorBoot');
    var desktop = document.getElementById('monitorDesktop');
    var browser = document.getElementById('monitorBrowser');
    var off = document.getElementById('monitorOff');
    var launch = document.getElementById('launchBrowser');
    var controls = document.getElementById('slideControls');
    var status = document.getElementById('monitorStatus');
    var tag = document.getElementById('monitorTag');
    var image = document.getElementById('monitorShot');
    var caption = document.getElementById('monitorCaption');
    var indicator = document.getElementById('slideIndicator');
    var prev = document.getElementById('slidePrev');
    var next = document.getElementById('slideNext');
    if (!screen || !power || !boot || !desktop || !browser || !off || !launch || !controls || !image || !caption || !indicator || !prev || !next) return;

    var slides = [
      ['assets/screenshots/nexora-home.png', 'NEXORA home · Clock, search, shortcuts, rails.'],
      ['assets/screenshots/nexora-esta.png', 'ESTA assistant · Summarise, explain, translate, notes.'],
      ['assets/screenshots/nexora-history-lock.png', 'History, locked · Password prompt guards everything.'],
      ['assets/screenshots/nexora-tools.png', 'Toolbox rail · Hover any tool for a preview card.'],
      ['assets/screenshots/nexora-yt.png', 'YouTube saver · 360p to 4K plus MP3, one click.'],
      ['assets/screenshots/nexora-offline-ai.png', 'Offline AI · On-device chat, no internet needed.']
    ];
    var index = 0, bootTimer = null, keyboardLaunch = false;
    function updateSlide() {
      image.src = slides[index][0];
      image.alt = slides[index][1];
      caption.textContent = slides[index][1];
      indicator.textContent = (index + 1) + ' / ' + slides.length;
    }
    var autoplay = watchAutoplay(screen.closest('.hero-visual') || screen, function () {
      index = (index + 1) % slides.length; updateSlide();
    }, 5000, function () { return screen.dataset.state === 'browser'; }, null, false);
    function setPhase(name, message) {
      off.hidden = name !== 'off';
      boot.hidden = name !== 'boot';
      desktop.hidden = name !== 'desktop';
      browser.hidden = name !== 'browser';
      controls.hidden = name !== 'browser';
      screen.dataset.state = name;
      power.setAttribute('aria-pressed', name === 'off' ? 'false' : 'true');
      if (tag) tag.textContent = {
        off: 'INTERACTIVE DEMO · DISPLAY OFF',
        boot: 'INTERACTIVE DEMO · STARTING',
        desktop: 'INTERACTIVE DEMO · DESKTOP',
        browser: 'NEXORA · SCREENSHOT PREVIEW'
      }[name];
      if (status) status.textContent = message;
      autoplay.sync();
    }
    function turnOff() {
      if (bootTimer !== null) window.clearTimeout(bootTimer);
      bootTimer = null;
      autoplay.stop();
      index = 0; updateSlide();
      setPhase('off', 'Monitor is off · Press Power to show the desktop');
    }
    function turnOn() {
      if (screen.dataset.state !== 'off') { turnOff(); return; }
      index = 0; updateSlide();
      if (reducedMotion()) {
        setPhase('desktop', 'Desktop ready · Select the NEXORA Browser icon to open the demo');
      } else {
        setPhase('boot', 'Starting the desktop preview…');
        bootTimer = window.setTimeout(function () {
          bootTimer = null;
          if (screen.dataset.state === 'boot') setPhase('desktop', 'Desktop ready · Select the NEXORA Browser icon to open the demo');
        }, 900);
      }
    }
    power.addEventListener('click', turnOn);
    launch.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') keyboardLaunch = true;
    });
    launch.addEventListener('click', function () {
      if (screen.dataset.state !== 'desktop') return;
      setPhase('browser', 'NEXORA Browser open · Browse all six screenshots with Previous and Next');
      // The icon is now hidden: send keyboard focus to the slideshow controls.
      if (keyboardLaunch) next.focus();
      else if (document.activeElement === launch) launch.blur();
      keyboardLaunch = false;
      autoplay.sync();
    });
    function move(amount) {
      if (screen.dataset.state !== 'browser') return;
      index = (index + amount + slides.length) % slides.length;
      updateSlide(); autoplay.sync();
    }
    prev.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    updateSlide();
    setPhase('off', 'Monitor is off · Press Power to show the desktop');
  }());

  wireButtons();
})();
