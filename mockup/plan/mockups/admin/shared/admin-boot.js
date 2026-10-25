/* Admin boot: runs in <head>, sets data-theme before first paint from localStorage 'shop.theme' (light|dark|system). */
(function () {
  'use strict';
  var root = document.documentElement, t = null;
  try { var m = /[?&]theme=(light|dark)(?:&|$|#)/.exec(location.search); if (m) { t = m[1]; localStorage.setItem('shop.theme', t); } else t = localStorage.getItem('shop.theme'); } catch (e) {}
  var dark = t === 'dark' || ((t === 'system' || !t) && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-brand', 'd');
  root.style.colorScheme = dark ? 'dark' : 'light';
  window.AdminBoot = { theme: t || 'system' };
})();
