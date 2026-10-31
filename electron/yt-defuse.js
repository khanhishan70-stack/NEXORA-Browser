/* NEXORA SHIELDS - YouTube anti-enforcement defuser (main-world payload)
 * ---------------------------------------------------------------------------
 * Problem: blocking YouTube ads at the network layer is detectable. Two
 * detection layers exist:
 *   (1) ad metadata (adPlacements / adSlots / playerAds) in the player JSON -
 *       when the ads it schedules never load, YouTube concludes "ad blocker".
 *   (2) a CLIENT-SIDE FLIP: even when the server serves a perfectly fine
 *       playabilityStatus:"OK" response (verified by direct fetch on repeat
 *       visits with cookies), YouTube's own scripts replace
 *       ytInitialPlayerResponse.playabilityStatus with an ERROR object whose
 *       reason is "Ad blockers violate YouTube's Terms of Service", and the
 *       watch page swaps the player for the enforcement screen. Observed live:
 *       status OK -> ERROR happens in-page AFTER load, via in-place property
 *       replacement on the response object (not via the window setter).
 *
 * Fix (the uBlock Origin / Brave technique):
 *   1. strip the ad metadata before the player reads it (nothing scheduled,
 *      no failed ad request to observe);
 *   2. GUARD playabilityStatus: assignments that flip it to ERROR with an
 *      ad-block reason are dropped, so the enforcement screen never appears
 *      and playback continues on the server's real OK response. Legitimate
 *      errors (private, region-blocked, age-restricted...) carry non-adblock
 *      reasons and pass through untouched.
 * Network blocking stays on in the main process.
 *
 * DELIVERY (see main.js): this file is read as source text and registered on
 * every persist:webview guest via the DevTools protocol command
 * Page.addScriptToEvaluateOnNewDocument, so it executes in the PAGE'S OWN JS
 * WORLD before any page script of every document. That channel bypasses
 * CSP/Trusted Types - YouTube serves "require-trusted-types-for 'script'",
 * which silently blocks the classic <script>/textContent preload injection.
 * injectShieldsDomCleaner() additionally re-arms it at load time through the
 * proven executeJavaScript channel (idempotent via the __nxD guard).
 *
 * STEALTH: the fetch/XHR wrappers masquerade as native code (name, length, and
 * a Function.prototype.toString reporting "[native code]" for tagged
 * functions), the same concealment uBO's scriptlets use.
 */
(function () {
  try {
    if (window.__nxD) return;
    // Host gate: never touch any other site.
    var _h = '';
    try { _h = String(location.hostname || '').toLowerCase(); } catch (e) {}
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(_h)) return;
    window.__nxD = true;

    var KEYS = ['"adPlacements"', '"adSlots"', '"playerAds"'];
    var PROP_KEYS = ['adPlacements', 'adSlots', 'playerAds'];

    // Rename ad keys to a harmless no_ads key so the JSON stays valid for
    // everything that reads it (uBO's replace=/"adPlacements"/"no_ads"/).
    function patchText(text) {
      if (typeof text !== 'string' || !text) return null;
      var hit = false, out = text;
      for (var i = 0; i < KEYS.length; i++) {
        if (out.indexOf(KEYS[i]) === -1) continue;
        hit = true;
        out = out.split(KEYS[i]).join('"no_ads"');
      }
      return hit ? out : null;
    }
    // Delete ad properties from an already-parsed player response object.
    function pruneObj(o) {
      if (!o || typeof o !== 'object') return o;
      try {
        for (var i = 0; i < PROP_KEYS.length; i++) {
          if (PROP_KEYS[i] in o) {
            try { delete o[PROP_KEYS[i]]; } catch (e) { try { o[PROP_KEYS[i]] = undefined; } catch (e2) {} }
          }
        }
        if (o.playerResponse && typeof o.playerResponse === 'object') pruneObj(o.playerResponse);
      } catch (e) {}
      return o;
    }

    // ---- playability guard: does this object represent the adblock flip? ----
    function textOf(x) {
      if (x == null) return '';
      if (typeof x === 'string') return x;
      try { return String(x.simpleText || x.runs && x.runs.map(function (r) { return r.text; }).join('') || ''); } catch (e) { return ''; }
    }
    function isAdblockReason(x) {
      var t = textOf(x);
      return /ad[\s_\-]*block/i.test(t) || /violate.{0,40}terms/i.test(t) || /allowlist/i.test(t);
    }
    function isAdblockBlock(v) {
      try {
        if (!v || typeof v !== 'object') return false;
        if (String(v.status) !== 'ERROR') return false;
        if (isAdblockReason(v.reason)) return true;
        var s = JSON.stringify(v.errorScreen || {});
        return /ad[\s_\-]*block/i.test(s) || /violate.{0,40}terms/i.test(s) || /allowlist/i.test(s);
      } catch (e) { return false; }
    }

    // Guard a playabilityStatus-like object: dropping status/reason writes that
    // would (re)introduce the adblock verdict.
    var _guarded = typeof WeakSet === 'function' ? new WeakSet() : null;
    function _has(o) { try { return _guarded ? _guarded.has(o) : !!o.__nxg; } catch (e) { return false; } }
    function _mark(o) { try { if (_guarded) _guarded.add(o); else o.__nxg = true; } catch (e) {} }
    function guardStatus(ps) {
      if (!ps || typeof ps !== 'object' || _has(ps)) return;
      _mark(ps);
      var ds, s, r, ok;
      try {
        ds = Object.getOwnPropertyDescriptor(ps, 'status');
        s = ds && 'value' in ds ? ds.value : ps.status;
        ds = Object.getOwnPropertyDescriptor(ps, 'reason');
        r = ds && 'value' in ds ? ds.value : ps.reason;
        // last known healthy status: a dropped flip reverts to it, covering
        // the write order where status lands BEFORE the adblock reason.
        ok = (s == null || String(s) === 'ERROR') ? 'OK' : String(s);
        Object.defineProperty(ps, 'status', {
          configurable: true, enumerable: true,
          get: function () { return s; },
          set: function (v) {
            if (String(v) === 'ERROR' && (isAdblockReason(r) || isAdblockReason(v))) return;
            s = v;
            if (v != null && String(v) !== 'ERROR') ok = String(v);
          }
        });
        Object.defineProperty(ps, 'reason', {
          configurable: true, enumerable: true,
          get: function () { return r; },
          set: function (v) {
            if (String(s) === 'ERROR' && (isAdblockReason(v) || isAdblockReason(r))) {
              s = ok; // undo the flip that got us into ERROR
              return;
            }
            r = v;
          }
        });
      } catch (e) {}
    }
    // Guard a scalar-ish field (videoDetails / streamingData): the adblock
    // flip routine also NULLS these to shut the player down. Blocking writes
    // of null/undefined while a real object is in place stops that; object ->
    // object writes (legit content swaps) still pass.
    function guardKeep(y, key) {
      try {
        var d = Object.getOwnPropertyDescriptor(y, key);
        var cur = d && 'value' in d ? d.value : y[key];
        if (!cur || typeof cur !== 'object') return;
        Object.defineProperty(y, key, {
          configurable: true, enumerable: true,
          get: function () { return cur; },
          set: function (v) { if (v === null || v === undefined) return; cur = v; }
        });
      } catch (e) {}
    }
    // Guard a player response object: assignments of a new playabilityStatus
    // (the observed flip vector: ytInitialPlayerResponse.playabilityStatus =
    // {status:"ERROR", reason:"Ad blockers violate..."}) are filtered here.
    function guardResponse(y) {
      if (!y || typeof y !== 'object' || _has(y)) return;
      _mark(y);
      try {
        var d = Object.getOwnPropertyDescriptor(y, 'playabilityStatus');
        var cur = d && 'value' in d ? d.value : y.playabilityStatus;
        Object.defineProperty(y, 'playabilityStatus', {
          configurable: true, enumerable: true,
          get: function () { return cur; },
          set: function (v) { if (isAdblockBlock(v)) return; cur = v; guardStatus(v); }
        });
        guardStatus(cur);
      } catch (e) {}
      guardKeep(y, 'videoDetails');
      guardKeep(y, 'streamingData');
    }
    // Re-apply on any later replacement of the global (SPA navigations).
    function armGlobal(y) {
      try { pruneObj(y); guardResponse(y); } catch (e) {}
      return y;
    }

    function isTarget(url) {
      var u = String(url || '').toLowerCase();
      return /\/youtubei\/v1\/(player|playlist|get_watch)(\?|$)/.test(u);
    }

    // ---- 1) the inline player response, pruned + guarded at assignment.
    // This script runs BEFORE YouTube's inline <script>, so every assignment
    // passes through here before the player ever reads it.
    try {
      var cur = window.ytInitialPlayerResponse;
      if (cur) armGlobal(cur);
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        configurable: true,
        enumerable: true,
        get: function () { return cur; },
        set: function (v) {
          // Reject a whole-object swap that carries the adblock verdict;
          // legit SPA replacements (new video) pass and get re-armed.
          if (isAdblockBlock(v && v.playabilityStatus)) return;
          cur = armGlobal(v);
        }
      });
    } catch (e) {}

    // ---- 2) fetch: only the three player endpoints are rewritten; every other
    // request goes through the untouched native fetch, by reference.
    try {
      var nativeFetch = window.fetch;
      if (typeof nativeFetch === 'function') {
        var nxFetch = function (input, init) {
          var url = '';
          try { url = (input && input.url) || String(input || ''); } catch (e) {}
          var p = nativeFetch.apply(this, arguments);
          if (!isTarget(url)) return p;
          return p.then(function (res) {
            if (!res || !res.ok) return res;
            return res.text().then(function (t) {
              var n = patchText(t);
              if (n === null) return res;
              var h = new Headers(res.headers);
              try { h.delete('content-length'); } catch (e) {}
              return new Response(n, { status: res.status, statusText: res.statusText, headers: h });
            });
          });
        };
        Object.defineProperty(nxFetch, 'name', { value: 'fetch' });
        Object.defineProperty(nxFetch, 'length', { value: 1 });
        nxFetch.__nxtag = 'fetch';
        window.fetch = nxFetch;
      }
    } catch (e) {}

    // ---- 3) XHR: the player uses this for /player on SPA navigations.
    try {
      var oOpen = XMLHttpRequest.prototype.open;
      var oSend = XMLHttpRequest.prototype.send;
      var nxOpen = function (m, u) { this.__nxu = String(u || ''); return oOpen.apply(this, arguments); };
      nxOpen.__nxtag = 'open';
      var nxSend = function () {
        var self = this;
        if (isTarget(self.__nxu)) {
          try {
            self.addEventListener('readystatechange', function () {
              if (self.readyState !== 4) return;
              try {
                if (self.responseType === '' || self.responseType === 'text') {
                  var t = self.responseText, n = patchText(t);
                  if (n !== null) {
                    Object.defineProperty(self, 'responseText', { configurable: true, value: n });
                    Object.defineProperty(self, 'response', { configurable: true, value: n });
                  }
                } else if (self.responseType === 'json' && self.response && typeof self.response === 'object') {
                  pruneObj(self.response);
                }
              } catch (e) {}
            });
          } catch (e) {}
        }
        return oSend.apply(this, arguments);
      };
      nxSend.__nxtag = 'send';
      XMLHttpRequest.prototype.open = nxOpen;
      XMLHttpRequest.prototype.send = nxSend;
    } catch (e) {}

    // ---- 4) conceal the wrappers from Function.prototype.toString checks.
    try {
      var ots = Function.prototype.toString;
      Function.prototype.toString = function () {
        if (this && this.__nxtag) return 'function ' + this.__nxtag + '() { [native code] }';
        return ots.call(this);
      };
      Object.defineProperty(Function.prototype.toString, 'toString', {
        value: function () { return 'function toString() { [native code] }'; }
      });
    } catch (e) {}
  } catch (e) {}
})();
