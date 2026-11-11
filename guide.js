/* ============================================================
 * NEXORA — AI Guide engine
 * A voice-narrated tour of the site + browser. Plays pre-rendered
 * natural-voice clips (guide-voice.js) when present, otherwise the
 * Web Speech API, otherwise a timed text tour.
 * ============================================================ */
(function () {
  'use strict';
  if (document.getElementById('nexGuide')) return;

  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }
  var synth = window.speechSynthesis || null;
  var supported = !!(synth && typeof window.SpeechSynthesisUtterance === 'function');
  var VOICE_PACK = (window.NEXORA_GUIDE_VOICE && window.NEXORA_GUIDE_VOICE.lines && typeof window.Audio === 'function') ? window.NEXORA_GUIDE_VOICE : null;
  var NATURAL = '__nexora_natural__';

  /* ---------- tour content (accurate to this site) ---------- */
  var CHAPTERS = [
    { id: 'welcome', title: 'What is NEXORA', ico: '✦', anchor: 'top', lines: [
      'Welcome to NEXORA — a free, open-source AI browser for Windows, built by the NEXORA team.',
      'Tap any topic below and I will explain it, or press Next to go step by step. Stop me anytime.'
    ]},
    { id: 'features', title: 'Features', ico: '🧰', anchor: 'features', lines: [
      'Let us start with what makes NEXORA different.',
      'A slim vertical tab rail keeps every site one click away, and hovering a tab fans out live previews so you can recognise any page at a glance.',
      'Your history is grouped by day and protected by your own password.',
      'Calls just work — one button handles camera, microphone and screen sharing for Meet, Discord and WhatsApp.',
      'Built-in shields block ads and trackers and warn you about phishing.',
      'And the toolbox rail docks a translator, volume boost, hands-free voice, a Pomodoro timer, a video editor and more on the right.'
    ]},
    { id: 'esta', title: 'ESTA AI', ico: '✨', anchor: 'esta', lines: [
      'Meet ESTA, your AI browsing companion.',
      'ESTA lives in a side panel, so you can chat, summarize the page you are reading, get coding help, or study without leaving your tab.',
      'It runs through the NEXORA backend on your own PC, and it even keeps working offline with an on-device model.',
      'Cloud AI is optional, never required.'
    ]},
    { id: 'install', title: 'How to install', ico: '⬇️', anchor: 'setup', lines: [
      'Getting started takes five easy steps.',
      'First, download the ZIP — it is about 246 megabytes for Windows 64-bit.',
      'Next, right-click and Extract All, then open the NEXORA Browser folder.',
      'Double-click launch dot bat; the first run sets up Python and the AI backend for you automatically.',
      'The browser then opens by itself.',
      'Offline AI is optional — NEXORA asks before downloading anything large, so you stay in control of your disk space.'
    ]},
    { id: 'usage', title: 'How to use it', ico: '🖱️', anchor: 'features', lines: [
      'Here is how to use NEXORA day to day.',
      'Click the vertical rail on the left to switch sites, and hover any tab to preview it.',
      'Open ESTA from the side panel to ask questions about whatever you are reading.',
      'On any YouTube watch page, one button saves the video from 360p up to 4K, or just the MP3 audio.',
      'Set a history password in Settings to keep your browsing private, and make it yours with custom wallpapers and themes.',
      'Every rerun of launch dot bat is safe — it skips whatever is already installed.'
    ]},
    { id: 'privacy', title: 'Privacy & safety', ico: '🛡️', anchor: 'privacy', lines: [
      'Your privacy comes first.',
      'History, downloads, permissions and settings live in your own profile folder on your PC, not on our servers.',
      'Sync only happens if you create a NEXORA account and turn it on.',
      'You hold the keys — your history is password-guarded, and per-site permissions are yours to allow or block.',
      'And we are honest: NEXORA is pre-release software, so we make no unhackable claims.'
    ]},
    { id: 'faq', title: 'Good to know', ico: '💡', anchor: 'faq', lines: [
      'A few quick answers before you go.',
      'NEXORA is free and open source, with the first official build for Windows 64-bit.',
      'Always download from the official release page linked on this site — never trust third-party installers.',
      'NEXORA updates itself like Chrome: one click downloads, another restarts, and your tabs stay safe.',
      'No API keys or accounts are required for the AI.',
      'Ready to explore? Hit the Download button and enjoy the web, reimagined.'
    ]}
  ];
  var INTRO = 'Hi! I am your NEXORA AI guide. Press “Explain Guide” for a quick intro, then tap any topic to hear the details. Stop me anytime.';
  var OUTRO = 'That is the full tour! NEXORA is free, open source, and ready when you are. Hit Download to get started — enjoy the web, reimagined.';

  var offsets = [], total = 0;
  CHAPTERS.forEach(function (c) { offsets.push(total); total += c.lines.length; });

  /* ---------- state ---------- */
  var mode = 'idle';            // idle | speaking | paused
  var ci = 0, si = 0;           // chapter / sentence index
  var gen = 0;                  // generation guard for async speech callbacks
  var finished = false;
  var muted = false, vol = 1, rate = 1, follow = true, autoPlay = false;
  var voices = [], voice = null, fbTimer = null;
  var visited = {};
  var useNatural = !!VOICE_PACK, clipActive = false, resumeAt = 0;
  var audioEl = VOICE_PACK ? new window.Audio() : null;
  if (audioEl) audioEl.preload = 'auto';
  var actx = null, analyser = null, gainNode = null, freq = null;

  /* ---------- build UI ---------- */
  var root = document.createElement('div');
  root.id = 'nexGuide';
  root.className = 'ng-root';
  root.setAttribute('data-open', 'false');
  root.setAttribute('data-state', 'idle');
  root.innerHTML =
    '<button class="ng-fab" id="ngFab" aria-label="Open NEXORA AI Guide" aria-expanded="false" aria-controls="ngPanel">' +
      '<span class="ng-fab-orb" aria-hidden="true"></span><span class="ng-fab-label">AI Guide</span>' +
    '</button>' +
    '<section class="ng-panel" id="ngPanel" role="dialog" aria-label="NEXORA AI Guide" aria-modal="false" hidden>' +
      '<header class="ng-head">' +
        '<div class="ng-avatar" aria-hidden="true"><span class="ng-avatar-orb"></span><span class="ng-avatar-ring"></span></div>' +
        '<div class="ng-head-txt"><strong>NEXORA AI Guide</strong><span class="ng-status" id="ngStatus" role="status" aria-live="polite">Ready to guide you</span></div>' +
        '<button class="ng-icon-btn" id="ngMute" aria-pressed="false" aria-label="Mute voice" title="Mute / unmute voice">🔊</button>' +
        '<button class="ng-icon-btn" id="ngClose" aria-label="Close guide" title="Close">×</button>' +
      '</header>' +
      '<div class="ng-scroll">' +
        '<div class="ng-viz"><canvas id="ngViz" aria-hidden="true"></canvas><span class="ng-viz-tag">voice</span></div>' +
        '<div class="ng-now">' +
          '<div class="ng-now-top"><span class="ng-chap-num" id="ngChapNum">00 / 0' + CHAPTERS.length + '</span><strong class="ng-chap-title" id="ngChapTitle">Welcome</strong></div>' +
          '<p class="ng-caption" id="ngCaption" aria-live="polite"></p>' +
        '</div>' +
        '<div class="ng-progress"><div class="ng-progress-bar" id="ngBar"></div></div>' +
        '<div class="ng-chapters" id="ngChapters" role="tablist" aria-label="Guide topics"></div>' +
        '<div class="ng-controls">' +
          '<label class="ng-field ng-field-voice"><span>Voice</span><select id="ngVoice" aria-label="Narration voice"></select></label>' +
          '<label class="ng-field"><span>Speed <b id="ngRateVal">1.0×</b></span><input id="ngRate" type="range" min="0.6" max="1.6" step="0.1" value="1" aria-label="Speech speed"></label>' +
          '<label class="ng-field"><span>Volume <b id="ngVolVal">100%</b></span><input id="ngVol" type="range" min="0" max="1" step="0.05" value="1" aria-label="Speech volume"></label>' +
          '<label class="ng-toggle"><input type="checkbox" id="ngFollow" checked><span class="ng-switch" aria-hidden="true"></span><span>Follow along on the page</span></label>' +
          '<label class="ng-toggle"><input type="checkbox" id="ngAuto"><span class="ng-switch" aria-hidden="true"></span><span>Auto-play all topics</span></label>' +
        '</div>' +
        '<p class="ng-foot" id="ngFoot"></p>' +
      '</div>' +
      '<div class="ng-transport">' +
        '<button class="ng-icon-btn" id="ngPrev" aria-label="Previous topic" title="Previous topic">⏮</button>' +
        '<button class="ng-play" id="ngPlay" aria-label="Explain guide"><span id="ngPlayIco" aria-hidden="true">▶</span><span id="ngPlayTxt">Explain Guide</span></button>' +
        '<button class="ng-stop" id="ngStop" aria-label="Stop guide" title="Stop" disabled><span aria-hidden="true">⏹</span><span>Stop</span></button>' +
        '<button class="ng-icon-btn" id="ngNext" aria-label="Next topic" title="Next topic">⏭</button>' +
        '<button class="ng-icon-btn" id="ngReplay" aria-label="Replay from start" title="Replay from start">↻</button>' +
      '</div>' +
    '</section>';
  document.body.appendChild(root);

  var $ = function (id) { return document.getElementById(id); };
  var fab = $('ngFab'), panel = $('ngPanel'), statusEl = $('ngStatus'), muteBtn = $('ngMute'),
      closeBtn = $('ngClose'), chapNum = $('ngChapNum'), chapTitle = $('ngChapTitle'),
      caption = $('ngCaption'), bar = $('ngBar'), chaptersEl = $('ngChapters'),
      prevBtn = $('ngPrev'), playBtn = $('ngPlay'), playIco = $('ngPlayIco'), playTxt = $('ngPlayTxt'),
      stopBtn = $('ngStop'), nextBtn = $('ngNext'), replayBtn = $('ngReplay'),
      voiceSel = $('ngVoice'), rateIn = $('ngRate'), rateVal = $('ngRateVal'),
      volIn = $('ngVol'), volVal = $('ngVolVal'), followIn = $('ngFollow'), autoIn = $('ngAuto'), foot = $('ngFoot');

  foot.textContent = VOICE_PACK
    ? 'The guide’s voice is AI-generated (open-source Kokoro TTS) and plays from this site. Nothing you say or do is recorded.'
    : supported
      ? 'Voice uses your browser’s built-in speech. Nothing is recorded or sent anywhere.'
      : 'Voice isn’t supported in this browser — the guide will read as text instead.';
  if (!supported && !VOICE_PACK) foot.classList.add('ng-warn');

  /* chapter chips */
  CHAPTERS.forEach(function (c, i) {
    var b = document.createElement('button');
    b.className = 'ng-chap'; b.type = 'button'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', 'false'); b.dataset.i = i;
    b.innerHTML = '<span class="ng-chap-ico" aria-hidden="true">' + c.ico + '</span><span>' + c.title + '</span>';
    b.addEventListener('click', function () { jumpTo(i); });
    chaptersEl.appendChild(b);
  });
  var chapBtns = Array.prototype.slice.call(chaptersEl.children);

  /* ---------- voices ---------- */
  function scoreVoice(v) {
    var n = (v.name || '').toLowerCase(), s = 0;
    if (/natural|online|neural/.test(n)) s += 4;
    if (/google/.test(n)) s += 3;
    if (/aria|zira|samantha|female|jenny|libby|sonia/.test(n)) s += 2;
    if (/uk|en-gb/.test(n + ' ' + (v.lang || '').toLowerCase())) s += 1;
    if (/microsoft/.test(n)) s += 1;
    return s;
  }
  function loadVoices() {
    if (!supported && !VOICE_PACK) { voiceSel.disabled = true; voiceSel.innerHTML = '<option>Text-only mode</option>'; return; }
    var all = supported ? (synth.getVoices() || []) : [];
    voices = all.filter(function (v) { return /^en/i.test(v.lang || ''); });
    if (!voices.length) voices = all.slice();
    voices.sort(function (a, b) { return scoreVoice(b) - scoreVoice(a); });
    var keep = voiceSel.value;
    voiceSel.innerHTML = '';
    if (VOICE_PACK) {
      var n = document.createElement('option');
      n.value = NATURAL; n.textContent = '✦ ' + (VOICE_PACK.label || 'Natural voice');
      voiceSel.appendChild(n);
    }
    voices.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.voiceURI; o.textContent = v.name.replace(/\s*\(.*?\)\s*/g, ' ').trim() + ' · ' + v.lang;
      voiceSel.appendChild(o);
    });
    if (!voiceSel.options.length) { var d = document.createElement('option'); d.textContent = 'Default voice'; voiceSel.appendChild(d); }
    var keepVoice = voices.filter(function (v) { return v.voiceURI === keep; })[0];
    voice = keepVoice || voices[0] || null;
    if (VOICE_PACK && (!keepVoice || keep === NATURAL)) voiceSel.value = NATURAL;
    else if (voice) voiceSel.value = voice.voiceURI;
    applyVoiceChoice();
  }
  function applyVoiceChoice() {
    useNatural = !!VOICE_PACK && voiceSel.value === NATURAL;
    if (!useNatural) {
      var pick = voices.filter(function (v) { return v.voiceURI === voiceSel.value; })[0];
      if (pick) voice = pick;
    }
  }
  if (supported) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  } else loadVoices();

  /* ---------- caption rendering ---------- */
  function renderChapter(i) {
    var c = CHAPTERS[i];
    chapNum.textContent = ('0' + (i + 1)).slice(-2) + ' / ' + ('0' + CHAPTERS.length).slice(-2);
    chapTitle.textContent = c.ico + ' ' + c.title;
    caption.innerHTML = '';
    c.lines.forEach(function (line, k) {
      var s = document.createElement('span');
      s.className = 'ng-sent'; s.dataset.k = k; s.textContent = line + ' ';
      caption.appendChild(s);
    });
    chapBtns.forEach(function (b, k) {
      b.classList.toggle('ng-active', k === i);
      b.setAttribute('aria-selected', k === i ? 'true' : 'false');
    });
  }
  function setActiveSentence(i, k) {
    var spans = caption.querySelectorAll('.ng-sent');
    for (var j = 0; j < spans.length; j++) {
      spans[j].classList.toggle('ng-active', j === k);
      spans[j].classList.toggle('ng-done', j < k);
    }
    var active = spans[k];
    if (active && active.scrollIntoView) {
      var sc = caption.closest('.ng-scroll');
      if (sc) { var ar = active.getBoundingClientRect(), sr = sc.getBoundingClientRect();
        if (ar.bottom > sr.bottom - 8 || ar.top < sr.top + 8) active.scrollIntoView({ block: 'nearest' }); }
    }
    bar.style.width = (((offsets[i] + k) / total) * 100).toFixed(1) + '%';
  }
  function showIntro() {
    chapNum.textContent = '00 / ' + ('0' + CHAPTERS.length).slice(-2);
    chapTitle.textContent = '✦ Welcome';
    caption.textContent = INTRO;
    bar.style.width = '0%';
    chapBtns.forEach(function (b) { b.classList.remove('ng-active'); b.setAttribute('aria-selected', 'false'); });
  }

  /* ---------- follow-along ---------- */
  var glowTimer = null;
  function followTo(anchor) {
    if (!follow) return;
    var el = anchor === 'top' ? document.getElementById('top') : document.getElementById(anchor);
    if (!el) return;
    var nav = document.getElementById('nav');
    var navH = nav ? nav.offsetHeight : 0;
    var y = el.getBoundingClientRect().top + window.pageYOffset - navH - 14;
    window.scrollTo({ top: Math.max(0, y), behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (anchor !== 'top') {
      el.classList.add('ng-section-glow');
      clearTimeout(glowTimer);
      glowTimer = setTimeout(function () { el.classList.remove('ng-section-glow'); }, 2700);
    }
  }

  /* ---------- speech core ---------- */
  function setStatus(t) { statusEl.textContent = t; }
  function setMode(m) {
    mode = m; root.setAttribute('data-state', m);
    var playing = (m === 'speaking');
    playIco.textContent = playing ? '⏸' : '▶';
    playTxt.textContent = playing ? 'Pause' : (m === 'paused' ? 'Resume' : (finished ? 'Replay Guide' : 'Explain Guide'));
    playBtn.setAttribute('aria-label', playing ? 'Pause guide' : (m === 'paused' ? 'Resume guide' : 'Explain guide'));
    stopBtn.disabled = (m === 'idle');
    syncViz();
  }

  function haltAll() {
    gen++; clipActive = false;
    if (supported) synth.cancel();
    if (audioEl) audioEl.pause();
    clearTimeout(fbTimer);
  }

  /* Route the clip through WebAudio so the visualizer can read real levels. Must run in a user gesture. */
  function ensureAudioGraph() {
    if (!audioEl) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!actx && AC) {
      try {
        actx = new AC();
        var src = actx.createMediaElementSource(audioEl);
        analyser = actx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.6;
        gainNode = actx.createGain();
        src.connect(analyser); analyser.connect(gainNode); gainNode.connect(actx.destination);
        freq = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) { actx = null; analyser = null; gainNode = null; }
    }
    if (actx && actx.state === 'suspended' && actx.resume) actx.resume();
    applyVolume();
  }
  function applyVolume() {
    if (!audioEl) return;
    var v = muted ? 0 : vol;
    if (gainNode) { gainNode.gain.value = v; audioEl.volume = 1; }
    else audioEl.volume = v;
  }

  function speakCurrent(startAt) {
    var c = CHAPTERS[ci];
    renderChapter(ci);
    setActiveSentence(ci, si);
    setStatus('Speaking · ' + c.title);
    visited[ci] = true; chapBtns[ci].classList.add('ng-visited');
    if (si === 0 && !startAt) followTo(c.anchor);
    var text = c.lines[si];
    var myGen = gen;
    var entry = useNatural ? VOICE_PACK.lines[c.id + '-' + si] : null;
    if (entry && entry.t === text) playClip(VOICE_PACK.base + entry.f, text, myGen, startAt || 0);
    else speakSynth(text, myGen);
  }

  var curClip = '', prefetchEl = null;
  function playClip(url, text, myGen, startAt) {
    clipActive = true;
    var failed = false;
    function fail() {
      if (failed || myGen !== gen) return;
      failed = true; clipActive = false; curClip = '';
      speakSynth(text, myGen);
    }
    audioEl.onended = function () { if (myGen !== gen || mode !== 'speaking') return; clipActive = false; advance(); };
    audioEl.onerror = fail;
    if (curClip !== url) { curClip = url; audioEl.src = url; }
    audioEl.defaultPlaybackRate = rate; audioEl.playbackRate = rate;
    try { audioEl.currentTime = startAt; } catch (e) { /* not seekable yet; starts at 0 */ }
    applyVolume();
    var p = audioEl.play();
    if (p && p.catch) p.catch(function (err) {
      if (myGen !== gen || failed) return;
      var n = err && err.name;
      if (n === 'AbortError') return;
      if (n === 'NotAllowedError') { clipActive = false; stop(); setStatus('Voice blocked — press Explain again'); return; }
      fail();
    });
    prefetchNext();
  }
  function prefetchNext() {
    var c = CHAPTERS[ci], k = si + 1, j = ci;
    if (k >= c.lines.length) { j++; k = 0; }
    if (j >= CHAPTERS.length) return;
    var e = VOICE_PACK.lines[CHAPTERS[j].id + '-' + k];
    if (!e) return;
    if (!prefetchEl) { prefetchEl = new window.Audio(); prefetchEl.preload = 'auto'; prefetchEl.muted = true; }
    var u = VOICE_PACK.base + e.f;
    if (prefetchEl.getAttribute('src') !== u) prefetchEl.src = u;
  }

  function speakSynth(text, myGen) {
    clipActive = false;
    if (supported) {
      var u = new window.SpeechSynthesisUtterance(text);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
      u.rate = rate; u.pitch = 1.02; u.volume = muted ? 0 : vol;
      u.onend = function () { if (myGen !== gen || mode !== 'speaking') return; advance(); };
      u.onerror = function (e) {
        if (myGen !== gen) return;
        var er = e && e.error;
        if (er === 'interrupted' || er === 'canceled') return;
        if (er === 'not-allowed' || er === 'synthesis-failed') {
          stop(); setStatus('Voice blocked — press Explain again'); return;
        }
        if (mode === 'speaking') advance();
      };
      try { synth.speak(u); } catch (err) { fallbackSchedule(text, myGen); }
    } else {
      fallbackSchedule(text, myGen);
    }
  }
  function fallbackSchedule(text, myGen) {
    var words = text.split(/\s+/).length;
    var ms = Math.max(1500, Math.min(9000, words * 360)) / rate;
    clearTimeout(fbTimer);
    fbTimer = setTimeout(function () { if (myGen === gen && mode === 'speaking') advance(); }, ms);
  }

  function advance() {
    si++;
    if (si >= CHAPTERS[ci].lines.length) {
      if (autoPlay) {
        ci++; si = 0;
        if (ci >= CHAPTERS.length) { finish(); return; }
        speakCurrent();
      } else {
        endTopic();
      }
      return;
    }
    speakCurrent();
  }

  /* On-demand: a topic finished — stop and wait for the user to pick the next. */
  function endTopic() {
    haltAll();
    var done = ci;
    chapBtns[done].classList.add('ng-visited');
    si = 0;
    if (done >= CHAPTERS.length - 1) {
      finished = true;
      setMode('idle');
      chapNum.textContent = ('0' + CHAPTERS.length).slice(-2) + ' / ' + ('0' + CHAPTERS.length).slice(-2);
      chapTitle.textContent = '🎉 All topics covered';
      caption.textContent = 'That is everything! Tap any topic to hear it again, or press ↻ to start over.';
      bar.style.width = '100%';
      chapBtns.forEach(function (b) { b.classList.remove('ng-active'); b.setAttribute('aria-selected', 'false'); });
      setStatus('All topics covered — pick one to replay');
      return;
    }
    ci = done + 1;
    setMode('idle');
    chapNum.textContent = ('0' + (ci + 1)).slice(-2) + ' / ' + ('0' + CHAPTERS.length).slice(-2);
    chapTitle.textContent = CHAPTERS[ci].ico + ' ' + CHAPTERS[ci].title;
    caption.textContent = done === 0
      ? 'That is NEXORA in brief! Tap any topic below for the details, or press Explain Guide to continue step by step.'
      : 'Ready for “' + CHAPTERS[ci].title + '”. Press Explain Guide, or tap any topic below.';
    bar.style.width = ((offsets[ci] / total) * 100).toFixed(1) + '%';
    chapBtns.forEach(function (b, k) { b.classList.toggle('ng-active', k === ci); b.setAttribute('aria-selected', k === ci ? 'true' : 'false'); });
    setStatus(done === 0 ? 'Pick a topic — I will explain it' : 'Up next · ' + CHAPTERS[ci].title);
  }

  function startFrom(i, k) {
    haltAll();
    ci = i; si = k; finished = false;
    setMode('speaking'); setStatus('Speaking · ' + CHAPTERS[ci].title);
    speakCurrent();
  }
  function play() {
    ensureAudioGraph();
    if (mode === 'speaking') { pause(); return; }
    if (mode === 'paused') { resume(); return; }
    if (finished) { ci = 0; si = 0; finished = false; }
    startFrom(ci, si);
  }
  function pause() {
    if (mode !== 'speaking') return;
    resumeAt = (clipActive && audioEl) ? audioEl.currentTime : 0;
    haltAll();
    setMode('paused'); setStatus('Paused');
  }
  function resume() {
    if (mode !== 'paused') return;
    setMode('speaking'); setStatus('Speaking · ' + CHAPTERS[ci].title);
    var at = resumeAt; resumeAt = 0;
    speakCurrent(at);
  }
  function stop() {
    haltAll();
    finished = false; ci = 0; si = 0;
    setMode('idle'); setStatus('Stopped — press Explain to restart');
    showIntro();
  }
  function finish() {
    haltAll();
    finished = true; mode = 'idle'; root.setAttribute('data-state', 'idle');
    bar.style.width = '100%';
    chapTitle.textContent = '🎉 Tour complete';
    chapNum.textContent = ('0' + CHAPTERS.length).slice(-2) + ' / ' + ('0' + CHAPTERS.length).slice(-2);
    caption.textContent = OUTRO;
    chapBtns.forEach(function (b) { b.classList.add('ng-visited'); b.classList.remove('ng-active'); });
    setMode('idle'); setStatus('Tour complete — replay anytime');
    if (follow) followTo('download');
  }
  function jumpTo(i) {
    ensureAudioGraph();
    i = Math.max(0, Math.min(CHAPTERS.length - 1, i));
    startFrom(i, 0);
  }
  function respeakCurrent() {
    if (mode !== 'speaking') return;
    haltAll();
    speakCurrent();
  }

  /* ---------- visualizer ---------- */
  var viz = $('ngViz'), vctx = viz.getContext('2d'), vW = 0, vH = 0, vRaf = 0, vOn = false;
  var BARS = 34, vals = [], targets = [];
  for (var b = 0; b < BARS; b++) { vals.push(0.08); targets.push(0.08); }
  function sizeViz() {
    var r = viz.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    vW = Math.max(1, r.width); vH = Math.max(1, r.height);
    viz.width = Math.round(vW * dpr); viz.height = Math.round(vH * dpr);
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawViz(t) {
    vctx.clearRect(0, 0, vW, vH);
    var speaking = (mode === 'speaking');
    var live = speaking && clipActive && analyser && freq && !reducedMotion();
    if (live) analyser.getByteFrequencyData(freq);
    var gap = 3, bw = (vW - gap * (BARS - 1)) / BARS, mid = vH / 2;
    var grad = vctx.createLinearGradient(0, 0, vW, 0);
    grad.addColorStop(0, '#00fff9'); grad.addColorStop(0.5, '#b400ff'); grad.addColorStop(1, '#ff2ea6');
    vctx.fillStyle = grad;
    for (var i = 0; i < BARS; i++) {
      if (live) {
        var d = Math.abs(i - (BARS - 1) / 2) / (BARS / 2);
        targets[i] = 0.06 + (freq[1 + Math.floor(d * 22)] / 255) * 0.94;
      } else if (speaking && !reducedMotion()) {
        if (Math.random() < 0.28) targets[i] = 0.2 + Math.random() * 0.8;
      } else {
        targets[i] = 0.06 + 0.05 * (0.5 + 0.5 * Math.sin(t / 700 + i * 0.5));
      }
      vals[i] += (targets[i] - vals[i]) * (speaking ? 0.35 : 0.08);
      var h = Math.max(2, vals[i] * (vH - 10));
      var x = i * (bw + gap), y = mid - h / 2;
      vctx.globalAlpha = speaking ? 0.95 : 0.5;
      if (vctx.roundRect) { vctx.beginPath(); vctx.roundRect(x, y, bw, h, bw / 2); vctx.fill(); }
      else vctx.fillRect(x, y, bw, h);
    }
    vctx.globalAlpha = 1;
  }
  function vizFrame(t) { if (!vOn) return; drawViz(t); vRaf = window.requestAnimationFrame(vizFrame); }
  function syncViz() {
    var should = !panel.hidden && !document.hidden && !reducedMotion();
    if (should && !vOn) { vOn = true; sizeViz(); vRaf = window.requestAnimationFrame(vizFrame); }
    else if (!should && vOn) { vOn = false; window.cancelAnimationFrame(vRaf); }
    if (reducedMotion() && !panel.hidden) { sizeViz(); drawViz(0); }
  }
  window.addEventListener('resize', function () { if (!panel.hidden) sizeViz(); });
  document.addEventListener('visibilitychange', syncViz);

  /* ---------- open / close ---------- */
  function open() {
    panel.hidden = false; root.setAttribute('data-open', 'true'); fab.setAttribute('aria-expanded', 'true');
    panel.classList.remove('ng-opening'); void panel.offsetWidth; panel.classList.add('ng-opening');
    if (supported && !voices.length) loadVoices();
    syncViz();
    setTimeout(function () { playBtn.focus(); }, 60);
  }
  function close() {
    if (mode !== 'idle') stop();
    panel.hidden = true; root.setAttribute('data-open', 'false'); fab.setAttribute('aria-expanded', 'false');
    syncViz(); fab.focus();
  }
  fab.addEventListener('click', function () { panel.hidden ? open() : close(); });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });

  /* ---------- controls ---------- */
  playBtn.addEventListener('click', play);
  stopBtn.addEventListener('click', stop);
  prevBtn.addEventListener('click', function () { jumpTo(ci - 1); });
  nextBtn.addEventListener('click', function () { jumpTo(ci + 1); });
  replayBtn.addEventListener('click', function () { jumpTo(0); });
  muteBtn.addEventListener('click', function () {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', muted ? 'Unmute voice' : 'Mute voice');
    if (muted) { volIn.value = 0; volVal.textContent = '0%'; }
    else { volIn.value = vol || 1; volVal.textContent = Math.round((vol || 1) * 100) + '%'; }
    if (!muted && !vol) vol = 1;
    if (clipActive) applyVolume(); else respeakCurrent();
  });
  voiceSel.addEventListener('change', function () {
    ensureAudioGraph();
    applyVoiceChoice();
    respeakCurrent();
  });
  rateIn.addEventListener('input', function () {
    rate = parseFloat(rateIn.value); rateVal.textContent = rate.toFixed(1) + '×';
    if (audioEl) { audioEl.defaultPlaybackRate = rate; audioEl.playbackRate = rate; }
  });
  volIn.addEventListener('input', function () {
    vol = parseFloat(volIn.value); volVal.textContent = Math.round(vol * 100) + '%';
    if (vol > 0 && muted) { muted = false; muteBtn.textContent = '🔊'; muteBtn.setAttribute('aria-pressed', 'false'); }
    if (vol === 0 && !muted) { muted = true; muteBtn.textContent = '🔇'; muteBtn.setAttribute('aria-pressed', 'true'); }
    applyVolume();
  });
  followIn.addEventListener('change', function () { follow = followIn.checked; });
  autoIn.addEventListener('change', function () { autoPlay = autoIn.checked; });

  /* ---------- init ---------- */
  showIntro();
  setMode('idle');
})();