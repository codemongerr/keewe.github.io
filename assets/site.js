/* KeeWe — site behaviour. No dependencies. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sticky header shadow ---------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- mobile nav ---------- */
  var burger = document.querySelector('.burger');
  if (burger && header) {
    burger.addEventListener('click', function () {
      var open = header.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    header.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () {
        header.classList.remove('nav-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- reveal on scroll ---------- */
  var revealables = document.querySelectorAll('.reveal');
  if (revealables.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      revealables.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
          setTimeout(function () { el.classList.add('in'); }, delay);
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
      revealables.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- swipe deck in the phone mockup ---------- */
  var deck = document.querySelector('.deck');
  if (deck) {
    var cards = Array.prototype.slice.call(deck.querySelectorAll('.swipe-card'));
    var top = 0;
    var timer;

    var layout = function () {
      cards.forEach(function (card, i) {
        var pos = (i - top + cards.length) % cards.length;
        card.classList.toggle('is-front', pos === 0);
        card.style.zIndex = String(cards.length - pos);
        if (pos === 0) {
          card.style.transform = 'translateY(0) scale(1)';
          card.style.opacity = '1';
        } else if (pos === 1) {
          card.style.transform = 'translateY(-10px) scale(.955)';
          card.style.opacity = '1';
        } else if (pos === 2) {
          card.style.transform = 'translateY(-19px) scale(.912)';
          card.style.opacity = '1';
        } else {
          card.style.transform = 'translateY(-19px) scale(.912)';
          card.style.opacity = '0';
        }
        card.querySelectorAll('.overlay').forEach(function (o) { o.classList.remove('show'); });
      });
    };

    var fling = function (like) {
      var card = cards[top];
      if (!card) return;
      var overlay = card.querySelector(like ? '.overlay-yes' : '.overlay-no');
      if (overlay) overlay.classList.add('show');
      setTimeout(function () {
        card.style.transform =
          'translate(' + (like ? '135%' : '-135%') + ', -6%) rotate(' + (like ? 20 : -20) + 'deg)';
        card.style.opacity = '0';
        setTimeout(function () {
          top = (top + 1) % cards.length;
          card.style.transition = 'none';
          layout();
          /* force reflow, then restore the transition */
          void card.offsetWidth;
          card.style.transition = '';
        }, 620);
      }, 340);
    };

    var loop = function () {
      timer = setInterval(function () {
        if (document.hidden) return;
        fling(Math.random() > 0.32);
      }, 3600);
    };

    layout();
    /* only cycle once the mockup is on screen, and never under reduced motion */
    if (reduced) {
      /* stacked, but static */
    } else if ('IntersectionObserver' in window) {
      var deckIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !timer) { loop(); }
          else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
        });
      }, { threshold: 0.25 });
      deckIo.observe(deck);
    } else {
      loop();
    }
  }

  /* ---------- back to top ---------- */
  var toTop = document.querySelector('.to-top');
  if (toTop) {
    var toggleTop = function () { toTop.classList.toggle('show', window.scrollY > 700); };
    toggleTop();
    window.addEventListener('scroll', toggleTop, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ---------- footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
