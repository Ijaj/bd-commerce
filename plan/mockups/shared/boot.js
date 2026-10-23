/* ShopName mockups - boot (runs synchronously in <head>, before first paint).
   Decides brand + theme + language BEFORE rendering so there is no flash:
     brand : ?brand=a|b|c|d  >  <html data-brand="b"> preset (brand-b.html)  >  localStorage shop.brand  >  d (final)
     theme : ?theme=light|dark  >  localStorage shop.theme  >  system preference
     phase : ?phase=launch|full  >  localStorage shop.phase  >  launch  (demo switch: launch = COD only, full = online pay + advance + pre-order)
     lang  : ?lang=en|bn  >  localStorage shop.lang  >  en
   Exposes window.ShopBoot = { brands, brand } for core.js. Every page must contain:
     <link id="brand-fonts" rel="stylesheet" href="...fonts of brand a...">
     <link rel="stylesheet" href="shared/base.css"> <link rel="stylesheet" href="shared/pages.css">
     <link id="brand-css" rel="stylesheet" href="shared/brand-a.css">      (brand css LAST so it overrides)
     <script src="shared/boot.js"></script>
*/
(function () {
  'use strict';
  var root = document.documentElement;
  var GF = 'https://fonts.googleapis.com/css2?family=';
  var brands = {
    a: { name: 'Trust', css: 'shared/brand-a.css', fonts: GF + 'Hind+Siliguri:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700;800&display=swap' },
    b: { name: 'Deal marketplace', css: 'shared/brand-b.css', fonts: GF + 'Hind+Siliguri:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap' },
    c: { name: 'Modern calm', css: 'shared/brand-c.css', fonts: GF + 'DM+Sans:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap' },
    d: { name: 'D \u2014 Final (B style + C colours)', css: 'shared/brand-d.css', fonts: GF + 'Hind+Siliguri:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap' }
  };
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function param(n, re) { var m = new RegExp('[?&]' + n + '=(' + re + ')(?:&|$|#)').exec(location.search); return m ? m[1] : null; }

  var b = param('brand', '[abcd]') || root.getAttribute('data-brand');
  if (b && brands[b]) set('shop.brand', b); else b = get('shop.brand');
  if (!brands[b]) b = 'd';
  root.setAttribute('data-brand', b);
  var css = document.getElementById('brand-css'), fonts = document.getElementById('brand-fonts');
  if (css && css.getAttribute('href') !== brands[b].css) css.setAttribute('href', brands[b].css);
  if (fonts && fonts.getAttribute('href') !== brands[b].fonts) fonts.setAttribute('href', brands[b].fonts);

  var th = param('theme', 'light|dark');
  if (th) set('shop.theme', th); else th = get('shop.theme');
  if (th !== 'dark' && th !== 'light') th = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  root.setAttribute('data-theme', th);

  var lg = param('lang', 'en|bn');
  if (lg) set('shop.lang', lg); else lg = get('shop.lang');
  root.setAttribute('lang', lg === 'bn' ? 'bn' : 'en');

  var ph = param('phase', 'launch|full');
  if (ph) set('shop.phase', ph); else ph = get('shop.phase');
  if (ph !== 'full') ph = 'launch';   // default: launch (COD only)
  root.setAttribute('data-phase', ph);

  window.ShopBoot = { brands: brands, brand: b, phase: ph };
})();
