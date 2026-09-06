/* KeeWe — language switching for the website. No dependencies.
   ------------------------------------------------------------------
   The language list, the codes and the device detection deliberately mirror
   the app, so a visitor sees the site in the language the app would pick:
     kwapp/src/json/language_options.json
     kwapp/src/utils/helpers/language.ts
   Keep the two in step when a language is added.

   English is the markup: every translatable node carries data-i18n (its
   innerHTML) or data-i18n-attr="attr:key" (an attribute), and the English
   text stays inline as the fallback. Other languages are dictionaries in
   assets/lang/<code>.js, fetched only when they are actually needed. */
(function () {
  'use strict';

  /* mirrors src/json/language_options.json in the app */
  var OPTIONS = [
    { label: 'English', value: 'en' },
    { label: 'Te Reo Māori', value: 'mi' },
    { label: '中文', value: 'cn' },
    { label: 'Español', value: 'es' },
    { label: '日本語', value: 'ja' }
  ];

  /* what the switcher shows when collapsed */
  var SHORT = { en: 'EN', mi: 'MI', cn: '中文', es: 'ES', ja: '日本語' };

  /* the app stores Chinese as `cn`; HTML (and devices) want the ISO code */
  var HTML_LANG = { en: 'en', mi: 'mi', cn: 'zh', es: 'es', ja: 'ja' };

  var DEFAULT_LANGUAGE = 'en';
  var STORAGE_KEY = 'keewe.language';
  var LOADING_CLASS = 'i18n-loading';
  var LOADING_TIMEOUT = 1600;

  var supported = OPTIONS.map(function (o) { return o.value; });
  var dicts = {};        /* code -> strings, filled in by register() */
  var base = null;       /* the English strings, read back off the page */
  var nodes = null;      /* the translatable nodes, found once */
  var current = DEFAULT_LANGUAGE;

  /* where this script lives, so the dictionaries resolve on any page */
  var here = (function () {
    var s = document.currentScript;
    if (s && s.src) return s.src.replace(/[^/]*$/, '');
    return './assets/';
  })();

  /* ---------- storage, with private-mode browsers in mind ---------- */
  var readStore = function () {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  };
  var writeStore = function (code) {
    try { window.localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }
  };

  /* ---------- which language ---------- */
  /* The app stores Chinese as `cn`; devices report the ISO code `zh`. */
  var toAppCode = function (code) { return code === 'zh' ? 'cn' : code; };

  var normalise = function (tag) {
    var code = toAppCode(String(tag || '').toLowerCase().split(/[-_]/)[0]);
    return supported.indexOf(code) > -1 ? code : null;
  };

  /* First of the browser's preferred locales we actually have strings for.
     navigator.languages is ordered by preference, so someone whose browser
     lists Māori then English gets Māori. */
  var detectBrowserLanguage = function () {
    var prefs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language];
    for (var i = 0; i < prefs.length; i++) {
      var code = normalise(prefs[i]);
      if (code) return code;
    }
    return DEFAULT_LANGUAGE;
  };

  var fromQuery = function () {
    var m = /[?&](?:lang|hl)=([^&#]+)/.exec(window.location.search);
    return m ? normalise(decodeURIComponent(m[1])) : null;
  };

  /* ?lang= wins, then a previous choice, then the browser. */
  var chosen = function () {
    return fromQuery() || normalise(readStore()) || detectBrowserLanguage();
  };

  /* ---------- the translatable nodes ---------- */
  var collect = function () {
    var found = [];
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      found.push({ el: el, key: el.getAttribute('data-i18n'), attr: null });
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length === 2) found.push({ el: el, key: bits[1].trim(), attr: bits[0].trim() });
      });
    });
    return found;
  };

  /* English comes off the page itself, so it is never out of date */
  var snapshot = function () {
    var out = {};
    nodes.forEach(function (n) {
      out[n.key] = n.attr ? n.el.getAttribute(n.attr) : n.el.innerHTML;
    });
    return out;
  };

  /* the strings in force right now, English behind them */
  var t = function (key) {
    var dict = current === DEFAULT_LANGUAGE ? base : (dicts[current] || {});
    return dict[key] != null ? dict[key] : base[key];
  };

  var apply = function (code) {
    var dict = code === DEFAULT_LANGUAGE ? base : (dicts[code] || {});
    nodes.forEach(function (n) {
      var value = dict[n.key];
      if (value == null) value = base[n.key];   /* untranslated -> English */
      if (value == null) return;
      if (n.attr) {
        if (n.el.getAttribute(n.attr) !== value) n.el.setAttribute(n.attr, value);
      } else if (n.el.innerHTML !== value) {
        n.el.innerHTML = value;
      }
    });
    current = code;
    document.documentElement.setAttribute('lang', HTML_LANG[code] || code);
    document.documentElement.setAttribute('data-language', code);
    document.documentElement.classList.remove(LOADING_CLASS);
    syncSwitcher();
  };

  /* ---------- loading a dictionary ---------- */
  var pending = {};
  var load = function (code, done) {
    if (code === DEFAULT_LANGUAGE || dicts[code]) return done();
    if (pending[code]) { pending[code].push(done); return; }
    pending[code] = [done];
    var s = document.createElement('script');
    s.src = here + 'lang/' + code + '.js';
    s.async = true;
    var finish = function () {
      var waiting = pending[code] || [];
      pending[code] = null;
      waiting.forEach(function (fn) { fn(); });
    };
    s.onload = finish;
    s.onerror = finish;          /* fall back to English rather than hang */
    document.head.appendChild(s);
  };

  var set = function (code, opts) {
    code = normalise(code) || DEFAULT_LANGUAGE;
    if (!(opts && opts.silent)) writeStore(code);
    load(code, function () {
      if (nodes) apply(code);
      else current = code;
    });
    if (!(opts && opts.silent) && window.dataLayer) {
      window.dataLayer.push({ event: 'language_change', language: code });
    }
  };

  /* ---------- the switcher ---------- */
  var switcher = null;

  var syncSwitcher = function () {
    if (!switcher) return;
    switcher.code.textContent = SHORT[current] || current.toUpperCase();
    switcher.btn.setAttribute('aria-label', t('lang.label'));
    switcher.items.forEach(function (btn) {
      var on = btn.getAttribute('data-language') === current;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
    });
  };

  var buildSwitcher = function () {
    var nav = document.querySelector('.site-header .nav');
    if (!nav || document.querySelector('.lang-switch')) return;

    var wrap = document.createElement('div');
    wrap.className = 'lang-switch';

    var btn = document.createElement('button');
    btn.className = 'lang-btn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', t('lang.label'));
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>' +
      '<span class="lang-code"></span>' +
      '<svg class="lang-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m6 9 6 6 6-6"/></svg>';

    var menu = document.createElement('div');
    menu.className = 'lang-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    var items = OPTIONS.map(function (o) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'lang-item';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('data-language', o.value);
      /* each language is named in itself, so it is readable whatever is on */
      item.setAttribute('lang', HTML_LANG[o.value] || o.value);
      item.textContent = o.label;
      menu.appendChild(item);
      return item;
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    var cta = nav.querySelector('.nav-cta');
    if (cta) nav.insertBefore(wrap, cta);
    else nav.appendChild(wrap);

    switcher = { wrap: wrap, btn: btn, menu: menu, items: items, code: btn.querySelector('.lang-code') };

    var open = function (focusFirst) {
      menu.hidden = false;
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      if (focusFirst) (items.filter(function (i) { return i.classList.contains('is-on'); })[0] || items[0]).focus();
    };
    var close = function (refocus) {
      menu.hidden = true;
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    };

    btn.addEventListener('click', function () {
      if (menu.hidden) open(false); else close(false);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(true);
      }
    });

    items.forEach(function (item, i) {
      item.addEventListener('click', function () {
        set(item.getAttribute('data-language'));
        close(true);
      });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
        } else if (e.key === 'Escape') {
          close(true);
        } else if (e.key === 'Tab') {
          close(false);
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!menu.hidden && !wrap.contains(e.target)) close(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) close(true);
    });

    syncSwitcher();
  };

  /* ---------- start ---------- */
  var initial = chosen();

  /* Non-English visitors would otherwise see English for as long as the
     dictionary takes to arrive, so hide the page briefly — with a timeout,
     so a missing or blocked dictionary can never leave it hidden. */
  if (initial !== DEFAULT_LANGUAGE) {
    document.documentElement.classList.add(LOADING_CLASS);
    window.setTimeout(function () {
      document.documentElement.classList.remove(LOADING_CLASS);
    }, LOADING_TIMEOUT);
    load(initial, function () { if (nodes) apply(initial); });
  }

  var start = function () {
    nodes = collect();
    base = snapshot();
    /* not on the page anywhere, but the switcher needs it */
    base['lang.label'] = 'Language';
    buildSwitcher();
    apply(initial);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  /* dictionaries call this as they load */
  window.KeeWe = window.KeeWe || {};
  window.KeeWe.i18n = {
    options: OPTIONS,
    defaultLanguage: DEFAULT_LANGUAGE,
    register: function (code, strings) {
      dicts[code] = strings;
      if (nodes && code === current) apply(code);
    },
    set: set,
    get: function () { return current; },
    detect: detectBrowserLanguage
  };
})();
