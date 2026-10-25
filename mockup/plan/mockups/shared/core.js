/* ==========================================================================
   ShopName mockups - core.js   (vanilla JS, no deps, works from file://)
   Loaded at the END of <body> of every page, after boot.js (in <head>) and before the page script.

   HOW TO ADD A PAGE (batch 2b recipe)
   1. Copy category.html. Keep the <head> as is (fonts link, base.css, pages.css, brand css, boot.js).
      Body = <div id="frame"></div> + <script src="shared/core.js"></script> + <script src="shared/page-xxx.js"></script>
   2. In shared/page-xxx.js:
        Shop.i18n({ en: { my_key: 'Hello' }, bn: { my_key: 'হ্যালো' } });   // page-specific strings
        Shop.renderPage('<section class="wrap">... <h1 ' + Shop.X('my_key') + '</h1></section>', {
          active: 'cart',            // bottom-nav highlight: home | cats | offers | cart | account | '' (none)
          q: '',                     // pre-fill header search box
          sbar: '',                  // optional HTML of a sticky mobile bar that REPLACES the bottom nav (product page)
          onReady: function (frame) { ... bind events ... }
        });
      Static text:   '<span ' + Shop.X('key') + '</span>'      (data-i18n; re-applied on language switch)
      Attributes:    '<input ' + Shop.XA('placeholder', 'key') + '>'
      Bilingual data: '<span ' + Shop.LX('English', 'বাংলা') + '</span>'   (data-en / data-bn)
      Templated text ('Showing {n}'): Shop.t('key', {n: 5}) and re-render inside Shop.on('lang', fn).
      After inserting HTML later, call Shop.applyI18n(container).
   3. Add CSS for the page in shared/pages.css (sections, tokens only: var(--primary) etc., never hex).
   4. Link to it from index.html (page list). Header/footer/bottom nav are shared; never copy them.

   CART STORAGE (localStorage 'shop.cart')  -> JSON array of line items, newest last:
        [ { "id": 10, "variant": "black/256", "qty": 2 }, ... ]
      id      = product id (number). Resolve with Shop.data.getProduct(id) / Shop.data.detail(id).
      variant = '' (no options) | '<option2 id>' (one option) | '<option1 id>/<option2 id>' e.g. 'black/256'.
      qty     = integer >= 1.   Lines with the same id+variant are merged.
      Use the API, not raw storage:  Shop.cart.get() / lines() / add(id, variant, qty) / setQty(id, variant, qty)
      / remove(id, variant) / clear() / count().   Shop.cart.lines() returns the resolved lines:
        { id, variant, qty, p (product), d (detail), c (combo: price, regular, old, stock, label{en,bn}, h, emoji),
          price (unit, event/flash price already applied), total (price*qty) }
      Shop.on('cart', fn) fires on every change (also from other tabs).
   OTHER STORAGE KEYS
      shop.brand a|b|c|d   shop.phase launch|full   shop.theme light|dark   shop.lang en|bn   shop.cookie '1'
      shop.wish    [productId,...]   (Shop.wish.has/toggle/count)
      shop.coupons [ 'CODE', ... ]   collected coupons = coupon wallet (Shop.data.coupons has the definitions)
      shop.recent  [productId,...]   recently viewed (newest first, max 12)
      shop.notify  [productId,...]   "notify me when back in stock"
   URL helpers: Shop.url.product(id) category(slug) search(q)
   Fake data: Shop.data = { tree, catBySlug, mains, product(i), getProduct(id), all(), detail(id), zones, districts,
                            coupons, config, freeRule(zoneKey), defaultZone(), reviewsFor(id), ... }
                            (zones[k].freeAbove: BDT subtotal for free delivery, null = never, 0 = always)
   PHASE: Shop.phase() 'launch'|'full', Shop.isFull(); localStorage shop.phase / ?phase=. Digits: Shop.num / Shop.digits (see DIGITS FOLLOW LANGUAGE)
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var BOOT = window.ShopBoot || { brands: {}, brand: 'd', phase: 'launch' };
  var Shop = window.Shop = {};
  /* LAUNCH / FULL phase switch (demo): launch = COD only (no online pay, no advance, no pre-order, no bKash/Nagad offers); full = everything. */
  var PHASE = BOOT.phase === 'full' ? 'full' : 'launch';
  Shop.phase = function () { return PHASE; };
  Shop.isFull = function () { return PHASE === 'full'; };
  var store = Shop.store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
    getJSON: function (k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } },
    setJSON: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  Shop.reduceMotion = reduceMotion;

  /* ------------------------------------------------------------------ tiny utils + events */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(html) { var tpl = document.createElement('template'); tpl.innerHTML = html.trim(); return tpl.content.firstChild; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  // k-style counts: en "2.1k", bn "2.1 হাজার" (digits are converted by Shop.digits / the DOM sweep). l = 'en'|'bn' (default: current language)
  function fmtK(n, l) {
    if (n < 1000) return String(n);
    var v = (Math.round(n / 100) / 10).toString().replace(/\.0$/, '');
    return (l || lang) === 'bn' ? digits(v, 'bn') + ' \u09B9\u09BE\u099C\u09BE\u09B0' : v + 'k';
  }
  /* DIGITS FOLLOW LANGUAGE (Q104). BN -> Bangla digits for every displayed number; EN -> English digits.
     Shop.digits(str [, l])  converts the digits of a string; these tokens ALWAYS keep English digits:
       order IDs / ticket IDs / tracking IDs (BD-100219, PTH-7712004, T-2041), phone numbers (01711000000, +880 1700-000000),
       coupon codes and any word mixing letters and digits (PUJA15, 5G, 128GB), the demo OTP 123456, and English-only phrases such as product titles.
     Shop.num(n [, l])       = digits(String(n));  formatBDT / fmtK are language-aware.
     Markup opt-out: put data-nd on an element (its whole subtree keeps English digits); <input>/<textarea> values are never touched.
     A MutationObserver + a full sweep on every language switch convert/restore all text nodes under <body>, so dynamic text
     (countdowns, toasts, re-rendered lists) needs no extra code. */
  var BN_D = '\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF';
  var KEEP_RE = /(BD-\d+)|(\b[A-Z]{1,4}-\d[\w-]*)|(\+?880[\d\s-]{6,}\d)|(\b01\d{9}\b)|(\b123456\b)|([A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*)|(\d)/g;
  function digits(str, l) {
    str = String(str);
    // English-only phrases (product titles, brand names: Latin words, no Bangla text) keep ALL their digits so "RTX 4060 16GB" is never half-converted
    if ((l || lang) === 'bn') return (/[A-Za-z]{2,}/.test(str) && !/[\u0980-\u09FF]/.test(str)) ? str : str.replace(KEEP_RE, function (m, a, b, c, d, e, f, g) { return g ? BN_D.charAt(+g) : m; });
    return str.replace(/[\u09E6-\u09EF]/g, function (ch) { return String(BN_D.indexOf(ch)); });
  }
  function num(n, l) { return digits(String(n), l); }
  // Bangladeshi lakh grouping: 125000 -> ৳1,25,000 (BN: ৳১,২৫,০০০)
  function formatBDT(n, l) {
    var s = String(Math.round(Math.abs(n))), last3 = s.slice(-3), rest = s.slice(0, -3);
    if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',';
    return digits((n < 0 ? '-' : '') + '৳' + rest + last3, l);
  }
  Shop.$ = $; Shop.$$ = $$; Shop.el = el; Shop.esc = esc; Shop.pad = pad; Shop.fmtK = fmtK; Shop.digits = digits; Shop.num = num; Shop.formatBDT = window.formatBDT = formatBDT;
  var handlers = {};
  Shop.on = function (n, fn) { (handlers[n] = handlers[n] || []).push(fn); };
  Shop.emit = function (n, d) { (handlers[n] || []).forEach(function (f) { try { f(d); } catch (e) { console.error(e); } }); };
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var x = Math.imul(a ^ a >>> 15, 1 | a);
      x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x;
      return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
  }
  Shop.rng = rng;
  function slugify(s) { return s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  Shop.slugify = slugify;
  function qparam(n) { var m = new RegExp('[?&]' + n + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null; }
  Shop.qparam = qparam;

  /* ------------------------------------------------------------------ theme + language state */
  var lang = root.getAttribute('lang') === 'bn' ? 'bn' : 'en';
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function setTheme(t, noSave) {
    root.setAttribute('data-theme', t);
    if (!noSave) store.set('shop.theme', t);
    Shop.emit('theme', t);
  }
  Shop.setTheme = setTheme;
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (!store.get('shop.theme')) setTheme(mq.matches ? 'dark' : 'light', true); });

  /* ------------------------------------------------------------------ digits sweep (Q104) */
  var SKIP_SEL = '[data-nd],script,style,textarea,input';
  function sweepText(n) {
    var v = n.nodeValue;
    if (!v || (lang === 'bn' ? !/\d/.test(v) : !/[\u09E6-\u09EF]/.test(v))) return;
    var p = n.parentNode;
    if (p && p.closest && p.closest(SKIP_SEL)) return;
    var w = digits(v);
    if (w !== v) n.nodeValue = w;
  }
  function sweep(node) {
    if (!node) return;
    if (node.nodeType === 3) { sweepText(node); return; }
    if (node.nodeType !== 1) return;
    var tw = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = tw.nextNode())) list.push(n);
    list.forEach(sweepText);
  }
  Shop.sweepDigits = sweep;
  var digitObs = null;
  function watchDigits() {
    if (digitObs || !window.MutationObserver) return;
    digitObs = new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        if (r.type === 'characterData') sweepText(r.target);
        else for (var i = 0; i < r.addedNodes.length; i++) sweep(r.addedNodes[i]);
      });
    });
    digitObs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ------------------------------------------------------------------ i18n */
  var D = { en: {}, bn: {} };
  Shop.i18n = function (dict) { ['en', 'bn'].forEach(function (l) { if (dict[l]) for (var k in dict[l]) D[l][k] = dict[l][k]; }); };
  function fmt(s, vars) { return digits(String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; })); }
  function t(k, vars) { var v = D[lang][k] != null ? D[lang][k] : (D.en[k] != null ? D.en[k] : k); return fmt(v, vars); }
  Shop.t = t;
  Shop.lang = function () { return lang; };
  Shop.X = function (k) { return 'data-i18n="' + k + '">' + esc(t(k)); };
  Shop.XA = function (attr, k) { return 'data-i18n-attr="' + attr + '=' + k + '" ' + attr + '="' + esc(t(k)) + '"'; };
  Shop.LX = function (en, bn) { return 'data-en="' + esc(en) + '" data-bn="' + esc(bn) + '">' + esc(lang === 'bn' ? bn : en); };
  Shop.L = function (en, bn) { return lang === 'bn' ? bn : en; };
  Shop.applyI18n = function (scope) {
    var n, i, nodes = $$('[data-i18n]', scope);
    for (i = 0; i < nodes.length; i++) { n = nodes[i]; var v = D[lang][n.getAttribute('data-i18n')]; if (v != null) n.textContent = fmt(v, n.dataset); }
    nodes = $$('[data-i18n-attr]', scope);
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.getAttribute('data-i18n-attr').split(',').forEach(function (pair) { var a = pair.split('='); var v2 = D[lang][a[1]]; if (v2 != null) n.setAttribute(a[0], fmt(v2, n.dataset)); });
    }
    nodes = $$('[data-en][data-bn]', scope);
    for (i = 0; i < nodes.length; i++) { n = nodes[i]; n.textContent = n.getAttribute('data-' + lang); }
  };

  Shop.i18n({
    en: {
      skip: 'Skip to content', hotline: 'Hotline', track: 'Track order', sell: 'Sell with us', help: 'Help', utility: 'Utility',
      search_ph: 'Search for products, brands and more', search_ph_m: 'Search products', all_cats: 'All categories', search: 'Search',
      wishlist: 'Wishlist', cart: 'Cart', login: 'Login', account: 'Account', theme: 'Toggle dark mode', lang_lbl: 'Language', brand_lbl: 'Brand style', phase_lbl: 'Demo phase: Launch (COD only) or Full',
      cats_menu: 'Categories', shop_by: 'Shop by category', view_all: 'View all', promo_lbl: 'Promotions',
      just_for_you: 'Just for you', load_more: 'Load more', showing: 'Showing {n} products',
      flash: 'Flash Sale', ends_in: 'Ends in', cd_h: 'h', cd_m: 'm', cd_s: 's', sold: 'sold', almost: 'Almost gone',
      recent: 'Recently viewed', featured: 'Featured',
      'new': 'New', hot: 'Hot', free_del: 'Free delivery', preorder: 'Pre-order', upcoming: 'Up-coming', oos: 'Out of stock', add_wish: 'Add to wishlist', rm_wish: 'Remove from wishlist',
      cta_shop: 'Shop now', prev: 'Previous slide', next: 'Next slide', goto: 'Go to slide {n}', slide_of: 'Slide {n} of {m}',
      pause: 'Pause slideshow', play: 'Play slideshow',
      h1_home: 'ShopName - online shopping in Bangladesh',
      s1_k: 'New arrivals', s1_t: 'Smart tech, smarter prices', s1_s: 'Phones, laptops and gadgets with official warranty',
      s2_k: 'Groceries', s2_t: 'Fresh to your door in 24 hours', s2_s: 'Cash on delivery across Bangladesh',
      s3_k: 'Fashion week', s3_t: "Up to 50% off the season's best", s3_s: 'Panjabi, saree, shoes and more',
      event_tag: 'Limited time', event_cta: 'Shop the sale',
      event0_t: 'Puja Mega Sale', event0_s: 'Up to 60% off on fashion, home and more',
      event1_t: 'Eid Festival', event1_s: 'Gifts, fashion and feast essentials, delivered fast',
      c0: 'Fashion', c1: 'Electronics', c2: 'Mobile & Gadgets', c3: 'Home & Kitchen', c4: 'Beauty', c5: 'Baby & Kids',
      c6: 'Groceries', c7: 'Sports', c8: 'Books', c9: 'Health', c10: 'Automotive', c11: 'Toys',
      about_blurb: "ShopName is Bangladesh's everyday online shop: genuine products, honest prices, cash on delivery.",
      f_company: 'Company', f_care: 'Customer care', about_us: 'About us', careers: 'Careers', blog: 'Blog', contact: 'Contact us',
      how_order: 'How to order', delivery: 'Delivery info', returns: 'Returns and refunds', faq: 'FAQ',
      f_pay: 'We accept', f_courier: 'Delivery to all 64 districts through trusted courier partners. Inside Dhaka in 1-2 days.',
      f_app: 'Get the app', get_on: 'Get it on', f_social: 'Follow us', f_news: 'Newsletter', f_news_s: 'Deals and offers in your inbox. No spam.',
      news_ph: 'Your email address', subscribe: 'Subscribe', thanks: 'Thanks for subscribing!',
      copyright: '© 2026 ShopName. All rights reserved.',
      cookie_lbl: 'Cookies', cookie_t: 'We use cookies to improve your experience.', cookie_ok: 'Accept', cookie_x: 'Dismiss',
      nav_home: 'Home', nav_cats: 'Categories', nav_offers: 'Offers', nav_cart: 'Cart', nav_account: 'Account', nav_lbl: 'Main navigation',
      preview: 'Mobile preview', desktop_view: 'Desktop view', bc_home: 'Home', bc_lbl: 'Breadcrumb', all_products: 'All products',
      added: 'Added to cart', view_cart: 'View cart', checkout: 'Checkout', continue_shop: 'Continue shopping', close: 'Close',
      cart_items: 'Cart ({n} items)', subtotal: 'Subtotal', qty: 'Qty', free_del_more: 'Add {amt} more for free delivery', free_del_got: 'You get free delivery!',
      wish_added: 'Added to wishlist', wish_removed: 'Removed from wishlist'
    },
    bn: {
      skip: 'মূল কন্টেন্টে যান', hotline: 'হটলাইন', track: 'অর্ডার ট্র্যাক', sell: 'আমাদের সাথে বিক্রি করুন', help: 'সহায়তা', utility: 'ইউটিলিটি',
      search_ph: 'পণ্য, ব্র্যান্ড ও আরও অনেক কিছু খুঁজুন', search_ph_m: 'পণ্য খুঁজুন', all_cats: 'সব ক্যাটাগরি', search: 'খুঁজুন',
      wishlist: 'উইশলিস্ট', cart: 'কার্ট', login: 'লগইন', account: 'অ্যাকাউন্ট', theme: 'ডার্ক মোড পরিবর্তন করুন', lang_lbl: 'ভাষা', brand_lbl: 'ব্র্যান্ড স্টাইল', phase_lbl: 'ডেমো ধাপ: লঞ্চ (শুধু COD) বা ফুল',
      cats_menu: 'ক্যাটাগরি', shop_by: 'ক্যাটাগরি অনুযায়ী কিনুন', view_all: 'সব দেখুন', promo_lbl: 'প্রমোশন',
      just_for_you: 'আপনার জন্য', load_more: 'আরও দেখুন', showing: '{n}টি পণ্য দেখানো হচ্ছে',
      flash: 'ফ্ল্যাশ সেল', ends_in: 'শেষ হতে বাকি', cd_h: 'ঘ', cd_m: 'মি', cd_s: 'সে', sold: 'বিক্রি', almost: 'প্রায় শেষ',
      recent: 'সম্প্রতি দেখেছেন', featured: 'ফিচার্ড',
      'new': 'নতুন', hot: 'হট', free_del: 'ফ্রি ডেলিভারি', preorder: 'প্রি-অর্ডার', upcoming: 'আসছে শীঘ্রই', oos: 'স্টক নেই', add_wish: 'উইশলিস্টে যোগ করুন', rm_wish: 'উইশলিস্ট থেকে সরান',
      cta_shop: 'এখনই কিনুন', prev: 'আগের স্লাইড', next: 'পরের স্লাইড', goto: 'স্লাইড {n}-এ যান', slide_of: 'স্লাইড {n} / {m}',
      pause: 'স্লাইডশো থামান', play: 'স্লাইডশো চালান',
      h1_home: 'ShopName - বাংলাদেশে অনলাইন শপিং',
      s1_k: 'নতুন পণ্য', s1_t: 'স্মার্ট টেক, সাশ্রয়ী দাম', s1_s: 'অফিসিয়াল ওয়ারেন্টিসহ ফোন, ল্যাপটপ ও গ্যাজেট',
      s2_k: 'মুদি', s2_t: '24 ঘণ্টায় দোরগোড়ায় তাজা পণ্য', s2_s: 'সারা বাংলাদেশে ক্যাশ অন ডেলিভারি',
      s3_k: 'ফ্যাশন উইক', s3_t: 'সেরা কালেকশনে 50% পর্যন্ত ছাড়', s3_s: 'পাঞ্জাবি, শাড়ি, জুতা ও আরও অনেক কিছু',
      event_tag: 'সীমিত সময়', event_cta: 'সেলে কিনুন',
      event0_t: 'পূজা মেগা সেল', event0_s: 'ফ্যাশন, হোম ও আরও অনেক কিছুতে 60% পর্যন্ত ছাড়',
      event1_t: 'ঈদ ফেস্টিভ্যাল', event1_s: 'উপহার, ফ্যাশন ও ঈদের কেনাকাটা, দ্রুত ডেলিভারি',
      c0: 'ফ্যাশন', c1: 'ইলেকট্রনিক্স', c2: 'মোবাইল ও গ্যাজেট', c3: 'বাসা ও রান্নাঘর', c4: 'সৌন্দর্য', c5: 'শিশু ও বেবি',
      c6: 'মুদি', c7: 'খেলাধুলা', c8: 'বই', c9: 'স্বাস্থ্য', c10: 'অটোমোটিভ', c11: 'খেলনা',
      about_blurb: 'ShopName বাংলাদেশের প্রতিদিনের অনলাইন শপ: আসল পণ্য, সঠিক দাম, ক্যাশ অন ডেলিভারি।',
      f_company: 'কোম্পানি', f_care: 'গ্রাহক সেবা', about_us: 'আমাদের সম্পর্কে', careers: 'ক্যারিয়ার', blog: 'ব্লগ', contact: 'যোগাযোগ করুন',
      how_order: 'কীভাবে অর্ডার করবেন', delivery: 'ডেলিভারি তথ্য', returns: 'রিটার্ন ও রিফান্ড', faq: 'সচরাচর জিজ্ঞাসা',
      f_pay: 'পেমেন্ট মাধ্যম', f_courier: 'বিশ্বস্ত কুরিয়ার পার্টনারের মাধ্যমে 64 জেলায় ডেলিভারি। ঢাকার ভেতরে 1-2 দিন।',
      f_app: 'অ্যাপ ডাউনলোড করুন', get_on: 'পাওয়া যাচ্ছে', f_social: 'আমাদের অনুসরণ করুন', f_news: 'নিউজলেটার',
      f_news_s: 'ডিল ও অফার সরাসরি আপনার ইনবক্সে।', news_ph: 'আপনার ইমেইল', subscribe: 'সাবস্ক্রাইব', thanks: 'ধন্যবাদ!',
      copyright: '© 2026 ShopName। সর্বস্বত্ব সংরক্ষিত।',
      cookie_lbl: 'কুকি', cookie_t: 'আপনার অভিজ্ঞতা উন্নত করতে আমরা কুকি ব্যবহার করি।', cookie_ok: 'গ্রহণ করুন', cookie_x: 'বন্ধ করুন',
      nav_home: 'হোম', nav_cats: 'ক্যাটাগরি', nav_offers: 'অফার', nav_cart: 'কার্ট', nav_account: 'অ্যাকাউন্ট', nav_lbl: 'প্রধান নেভিগেশন',
      preview: 'মোবাইল প্রিভিউ', desktop_view: 'ডেস্কটপ ভিউ', bc_home: 'হোম', bc_lbl: 'ব্রেডক্রাম্ব', all_products: 'সব পণ্য',
      added: 'কার্টে যোগ হয়েছে', view_cart: 'কার্ট দেখুন', checkout: 'চেকআউট', continue_shop: 'কেনাকাটা চালিয়ে যান', close: 'বন্ধ করুন',
      cart_items: 'কার্ট ({n}টি আইটেম)', subtotal: 'সাবটোটাল', qty: 'পরিমাণ', free_del_more: 'ফ্রি ডেলিভারির জন্য আরও {amt} যোগ করুন', free_del_got: 'আপনি ফ্রি ডেলিভারি পাচ্ছেন!',
      wish_added: 'উইশলিস্টে যোগ হয়েছে', wish_removed: 'উইশলিস্ট থেকে সরানো হয়েছে'
    }
  });

  /* ------------------------------------------------------------------ icons */
  var P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    heart: '<path d="M12 21s-8-4.9-9.5-10a5.2 5.2 0 0 1 9.5-4.2 5.2 5.2 0 0 1 9.5 4.2C20 16.1 12 21 12 21z"/>',
    cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2.5 3.5h3l2.2 11h10.6l2-8H6.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    chevR: '<path d="m9 5 7 7-7 7"/>', chevL: '<path d="m15 5-7 7 7 7"/>', chevD: '<path d="m5 9 7 7 7-7"/>', chevU: '<path d="m5 15 7-7 7 7"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    pkg: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    filter: '<path d="M3 5h18l-7 8.500V20l-4-2v-4.500z"/>',
    sort: '<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    truck: '<path d="M2 6h11v10H2zM13 10h4.500l3.500 3.500V16H13z"/><circle cx="6.500" cy="17.500" r="1.800"/><circle cx="17" cy="17.500" r="1.800"/>',
    shield: '<path d="M12 3 4 6v6c0 4.500 3.200 7.800 8 9 4.800-1.200 8-4.500 8-9V6z"/><path d="m8.500 12 2.500 2.500 4.500-5"/>',
    undo: '<path d="M4 9h11a5 5 0 0 1 0 10H8"/><path d="m8 5-4 4 4 4"/>',
    play: '<path d="M7 4.500v15l12-7.500z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    share: '<circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="m8.200 10.800 7.600-3.600M8.200 13.200l7.600 3.600"/>',
    store: '<path d="M4 9.500 5.500 4h13L20 9.500M4 9.500a2.700 2.700 0 0 0 5.300 0 2.700 2.700 0 0 0 5.400 0 2.700 2.700 0 0 0 5.300 0M5 12.500V20h14v-7.500"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.1"/>',
    camera: '<path d="M4 8h3l1.500-2.500h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
    msg: '<path d="M4 5h16v11H9l-5 4z"/>',
    ticket: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.500"/>',
    thumb: '<path d="M7 11v9H4v-9zM7 11l4-7c2 0 3 1.500 2.500 3.500L13 10h6a2 2 0 0 1 2 2.300l-1.200 6A2 2 0 0 1 17.800 20H7"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500M8 11h6M11 8v6"/>'
  };
  Shop.addIcons = function (o) { for (var k in o) P[k] = o[k]; };
  function icon(n, s, cls) {
    s = s || 20;
    return '<svg class="ic ' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + P[n] + '</svg>';
  }
  Shop.icon = icon;
  var LOGOS = {
    a: '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect class="lm-bg" width="32" height="32" rx="8"/><path class="lm-fg" d="M9 12h14l-1 11a2 2 0 0 1-2 1.8h-8a2 2 0 0 1-2-1.8z"/><path class="lm-st" d="M12.5 12v-1.5a3.5 3.5 0 0 1 7 0V12" fill="none" stroke-width="2" stroke-linecap="round"/><path d="m13 18.5 2.4 2.4 4.1-4.6" fill="none" stroke="var(--lm-bg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    b: '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect class="lm-bg" width="32" height="32" rx="5" transform="skewX(-8) translate(3 0)"/><path class="lm-fg" d="M18.5 4 8 18h6.5l-1.5 10L24 13h-6.5z"/></svg>',
    c: '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle class="lm-bg" cx="16" cy="16" r="16"/><path class="lm-st" d="M9 14.5c0 4.700 3 7.500 7 7.500s7-2.800 7-7.500" fill="none" stroke-width="2.2" stroke-linecap="round"/><circle class="lm-fg" cx="16" cy="9.800" r="2.200"/></svg>',
    d: null
  };

  LOGOS.d = LOGOS.b;

  /* ------------------------------------------------------------------ DATA: category tree (4 levels: main + 3 sub) */
  // node = [English, Bengali, children?]; levels: main(1) > group(2) > item(3) > leaf(4)
  var RAW = [
    { e: '👗', h: 330, kids: [
      ['Men', 'পুরুষ', [['Panjabi', 'পাঞ্জাবি', [['Eid Panjabi', 'ঈদ পাঞ্জাবি'], ['Casual Panjabi', 'ক্যাজুয়াল পাঞ্জাবি']]], ['T-Shirts', 'টি-শার্ট'], ['Jeans', 'জিন্স'], ['Shoes', 'জুতা']]],
      ['Women', 'নারী', [['Saree', 'শাড়ি', [['Jamdani', 'জামদানি'], ['Silk Saree', 'সিল্ক শাড়ি'], ['Cotton Saree', 'সুতি শাড়ি']]], ['Salwar Kameez', 'সালোয়ার কামিজ'], ['Handbags', 'হ্যান্ডব্যাগ'], ['Jewellery', 'গহনা']]],
      ['Accessories', 'এক্সেসরিজ', [['Watches', 'ঘড়ি'], ['Sunglasses', 'সানগ্লাস'], ['Belts', 'বেল্ট'], ['Wallets', 'ওয়ালেট']]]] },
    { e: '📺', h: 210, kids: [
      ['TV & Audio', 'টিভি ও অডিও', [['Smart TV', 'স্মার্ট টিভি', [['4K TVs', '4K টিভি'], ['Android TVs', 'অ্যান্ড্রয়েড টিভি']]], ['Soundbar', 'সাউন্ডবার'], ['Speakers', 'স্পিকার'], ['Headphones', 'হেডফোন']]],
      ['Computing & Cameras', 'কম্পিউটার ও ক্যামেরা', [['Laptops', 'ল্যাপটপ', [['Gaming Laptops', 'গেমিং ল্যাপটপ'], ['Ultrabooks', 'আল্ট্রাবুক'], ['Student Laptops', 'স্টুডেন্ট ল্যাপটপ']]], ['Monitors', 'মনিটর'], ['Cameras', 'ক্যামেরা'], ['Networking', 'নেটওয়ার্কিং']]],
      ['Appliances', 'হোম অ্যাপ্লায়েন্স', [['Air Conditioner', 'এয়ার কন্ডিশনার'], ['Refrigerator', 'ফ্রিজ'], ['Washing Machine', 'ওয়াশিং মেশিন'], ['Fan', 'ফ্যান']]]] },
    { e: '📱', h: 260, kids: [
      ['Phones', 'ফোন', [['Smartphones', 'স্মার্টফোন', [['Android Phones', 'অ্যান্ড্রয়েড ফোন'], ['5G Phones', '5G ফোন']]], ['Feature Phones', 'ফিচার ফোন'], ['Tablets', 'ট্যাবলেট'], ['Refurbished', 'রিফার্বিশড']]],
      ['Wearables', 'ওয়্যারেবল', [['Smart Watch', 'স্মার্ট ওয়াচ'], ['Fitness Band', 'ফিটনেস ব্যান্ড'], ['Earbuds', 'ইয়ারবাড'], ['Neckband', 'নেকব্যান্ড']]],
      ['Mobile Accessories', 'মোবাইল এক্সেসরিজ', [['Power Bank', 'পাওয়ার ব্যাংক'], ['Chargers', 'চার্জার'], ['Cases', 'কভার'], ['Cables', 'ক্যাবল']]]] },
    { e: '🍳', h: 30, kids: [
      ['Kitchen', 'রান্নাঘর', [['Cookware', 'রান্নার সরঞ্জাম'], ['Rice Cooker', 'রাইস কুকার'], ['Blender', 'ব্লেন্ডার'], ['Kettle', 'কেটলি']]],
      ['Furniture', 'ফার্নিচার', [['Beds', 'খাট'], ['Sofas', 'সোফা'], ['Wardrobes', 'আলমারি'], ['Tables', 'টেবিল']]],
      ['Decor', 'সাজসজ্জা', [['Wall Art', 'ওয়াল আর্ট'], ['Lighting', 'লাইটিং'], ['Curtains', 'পর্দা'], ['Bedding', 'বিছানাপত্র']]]] },
    { e: '💄', h: 290, kids: [
      ['Makeup', 'মেকআপ', [['Lipstick', 'লিপস্টিক'], ['Foundation', 'ফাউন্ডেশন'], ['Eye Makeup', 'আই মেকআপ'], ['Nails', 'নখ']]],
      ['Skin Care', 'ত্বকের যত্ন', [['Serums', 'সিরাম'], ['Moisturizer', 'ময়েশ্চারাইজার'], ['Sunscreen', 'সানস্ক্রিন'], ['Face Wash', 'ফেস ওয়াশ']]],
      ['Hair & Fragrance', 'চুল ও সুগন্ধি', [['Shampoo', 'শ্যাম্পু'], ['Hair Dryer', 'হেয়ার ড্রায়ার'], ['Perfume', 'পারফিউম'], ['Body Spray', 'বডি স্প্রে']]]] },
    { e: '🍼', h: 180, kids: [
      ['Baby Care', 'শিশুর যত্ন', [['Diapers', 'ডায়াপার'], ['Feeding', 'ফিডিং'], ['Bath', 'গোসল'], ['Baby Skin Care', 'শিশুর ত্বকের যত্ন']]],
      ['Gear', 'বেবি গিয়ার', [['Strollers', 'স্ট্রলার'], ['Car Seats', 'কার সিট'], ['Cribs', 'দোলনা'], ['Carriers', 'ক্যারিয়ার']]],
      ['Kids Fashion', 'বাচ্চাদের ফ্যাশন', [['Boys', 'ছেলে'], ['Girls', 'মেয়ে'], ['School Bags', 'স্কুল ব্যাগ'], ['Kids Shoes', 'বাচ্চাদের জুতা']]]] },
    { e: '🛒', h: 120, kids: [
      ['Staples', 'মুদি পণ্য', [['Rice', 'চাল'], ['Atta & Flour', 'আটা ও ময়দা'], ['Oil', 'তেল'], ['Pulses', 'ডাল']]],
      ['Fresh', 'তাজা পণ্য', [['Fruits', 'ফল'], ['Vegetables', 'সবজি'], ['Fish', 'মাছ'], ['Meat', 'মাংস']]],
      ['Snacks & Drinks', 'স্ন্যাকস ও পানীয়', [['Tea & Coffee', 'চা ও কফি'], ['Biscuits', 'বিস্কুট'], ['Juice', 'জুস'], ['Honey', 'মধু']]]] },
    { e: '⚽', h: 0, kids: [
      ['Team Sports', 'দলগত খেলা', [['Cricket', 'ক্রিকেট'], ['Football', 'ফুটবল'], ['Badminton', 'ব্যাডমিন্টন'], ['Basketball', 'বাস্কেটবল']]],
      ['Fitness', 'ফিটনেস', [['Dumbbells', 'ডাম্বেল'], ['Yoga Mats', 'যোগা ম্যাট'], ['Treadmills', 'ট্রেডমিল'], ['Cycles', 'সাইকেল']]],
      ['Outdoor Sports', 'আউটডোর স্পোর্টস', [['Camping', 'ক্যাম্পিং'], ['Swimming', 'সাঁতার'], ['Fishing', 'মাছ ধরা'], ['Sportswear', 'স্পোর্টসওয়্যার']]]] },
    { e: '📚', h: 50, kids: [
      ['Fiction', 'উপন্যাস', [['Bangla Novels', 'বাংলা উপন্যাস'], ['Thriller', 'থ্রিলার'], ['Poetry', 'কবিতা'], ['Translated', 'অনুবাদ']]],
      ['Education', 'শিক্ষা', [['SSC & HSC', 'এসএসসি ও এইচএসসি'], ['Admission', 'ভর্তি'], ['Language', 'ভাষা'], ['University', 'বিশ্ববিদ্যালয়']]],
      ['Kids & Others', 'শিশু ও অন্যান্য', [['Story Books', 'গল্পের বই'], ['Self Help', 'আত্মউন্নয়ন'], ['Religion', 'ধর্ম'], ['Comics', 'কমিক্স']]]] },
    { e: '💊', h: 155, kids: [
      ['Devices', 'ডিভাইস', [['BP Monitor', 'বিপি মনিটর'], ['Glucometer', 'গ্লুকোমিটার'], ['Thermometer', 'থার্মোমিটার'], ['Oximeter', 'অক্সিমিটার']]],
      ['Supplements', 'সাপ্লিমেন্ট', [['Vitamins', 'ভিটামিন'], ['Protein', 'প্রোটিন'], ['Herbal', 'হারবাল'], ['Omega', 'ওমেগা']]],
      ['Personal Care', 'ব্যক্তিগত যত্ন', [['Sanitizer', 'স্যানিটাইজার'], ['Masks', 'মাস্ক'], ['Supports', 'সাপোর্ট'], ['Adult Care', 'অ্যাডাল্ট কেয়ার']]]] },
    { e: '🚗', h: 230, kids: [
      ['Bike', 'বাইক', [['Helmets', 'হেলমেট'], ['Gloves', 'গ্লাভস'], ['Phone Holders', 'ফোন হোল্ডার'], ['Covers', 'কভার']]],
      ['Car', 'গাড়ি', [['Dash Cams', 'ড্যাশ ক্যাম'], ['Vacuum', 'ভ্যাকুয়াম'], ['Seat Covers', 'সিট কভার'], ['Air Fresheners', 'এয়ার ফ্রেশনার']]],
      ['Care', 'যত্ন', [['Engine Oil', 'ইঞ্জিন অয়েল'], ['Polish', 'পলিশ'], ['Tyres', 'টায়ার'], ['Batteries', 'ব্যাটারি']]]] },
    { e: '🧩', h: 80, kids: [
      ['Play', 'খেলা', [['RC Cars', 'আরসি কার'], ['Building Blocks', 'বিল্ডিং ব্লক'], ['Dolls', 'পুতুল'], ['Plush', 'প্লাশ']]],
      ['Learning', 'শেখা', [['Puzzles', 'পাজল'], ['STEM Kits', 'STEM কিট'], ['Board Games', 'বোর্ড গেম'], ['Drawing', 'ড্রয়িং']]],
      ['Outdoor Toys', 'আউটডোর খেলনা', [['Bikes', 'বাইক'], ['Scooters', 'স্কুটার'], ['Water Toys', 'পানির খেলনা'], ['Sports Toys', 'স্পোর্টস টয়']]]] }
  ];
  var MAIN_SLUGS = ['fashion', 'electronics', 'mobile-gadgets', 'home-kitchen', 'beauty', 'baby-kids', 'groceries', 'sports', 'books', 'health', 'automotive', 'toys'];
  var catBySlug = {}, mains = [];
  function addNode(raw, parent, mainIdx, level) {
    var slug = level === 1 ? MAIN_SLUGS[mainIdx] : slugify(raw[0]);
    if (catBySlug[slug]) slug = parent.slug + '-' + slug;
    var n = { slug: slug, en: level === 1 ? Shop.t('c' + mainIdx) : raw[0], bn: raw[1], level: level, parent: parent, kids: [], main: mainIdx };
    catBySlug[slug] = n;
    if (parent) parent.kids.push(n);
    return n;
  }
  var ROOT = { slug: '', en: 'All products', bn: 'সব পণ্য', level: 0, parent: null, kids: [], main: -1 };
  RAW.forEach(function (m, i) {
    var mn = addNode([null, D.bn['c' + i]], ROOT, i, 1);
    mn.en = D.en['c' + i]; mn.e = m.e; mn.h = m.h; mn.k = 'c' + i;
    m.kids.forEach(function (g) {
      var gn = addNode(g, mn, i, 2);
      g[2].forEach(function (it) {
        var inode = addNode(it, gn, i, 3);
        (it[2] || []).forEach(function (lf) { addNode(lf, inode, i, 4); });
      });
    });
    mains.push(mn);
  });
  function path(n) { var a = []; while (n && n.level > 0) { a.unshift(n); n = n.parent; } return a; }
  function inCat(leafSlug, slug) { var n = catBySlug[leafSlug]; while (n) { if (n.slug === slug) return true; n = n.parent; } return false; }
  function findInMain(mainIdx, enName) {
    var res = null;
    (function walk(n) { if (res) return; if (n.en === enName) { res = n; return; } n.kids.forEach(walk); })(mains[mainIdx]);
    return res;
  }

  /* attribute registry: key -> {en,bn,type,opts:[[en,bn,hex?]]}; inherited down the tree via MAIN_ATTRS / GROUP_ATTRS */
  var COLORS = [['Black', 'কালো', '#1f1f23', 255], ['White', 'সাদা', '#f4f4f4', 45], ['Red', 'লাল', '#d62d2d', 5], ['Blue', 'নীল', '#2a5bd7', 215], ['Green', 'সবুজ', '#1f8a4c', 140], ['Grey', 'ধূসর', '#8b8f97', 200], ['Gold', 'সোনালি', '#d4a63a', 42]];
  var ATTRS = {
    color: { en: 'Color', bn: 'রং', type: 'color', opts: COLORS },
    size: { en: 'Size', bn: 'সাইজ', opts: [['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL'], ['XXL', 'XXL']] },
    material: { en: 'Material', bn: 'উপাদান', opts: [['Cotton', 'সুতি'], ['Silk', 'সিল্ক'], ['Leather', 'চামড়া'], ['Denim', 'ডেনিম'], ['Steel', 'স্টিল'], ['Wood', 'কাঠ'], ['Plastic', 'প্লাস্টিক'], ['Glass', 'কাঁচ']] },
    warranty: { en: 'Warranty', bn: 'ওয়ারেন্টি', opts: [['1 year', '1 বছর'], ['2 years', '2 বছর'], ['3 years', '3 বছর']] },
    ram: { en: 'RAM', bn: 'র‍্যাম', opts: [['4GB', '4GB'], ['8GB', '8GB'], ['16GB', '16GB'], ['32GB', '32GB']] },
    storage: { en: 'Storage', bn: 'স্টোরেজ', opts: [['64GB', '64GB'], ['128GB', '128GB'], ['256GB', '256GB'], ['512GB', '512GB']] },
    skin: { en: 'Skin type', bn: 'ত্বকের ধরন', opts: [['All skin', 'সব ত্বক'], ['Oily', 'তৈলাক্ত'], ['Dry', 'শুষ্ক'], ['Sensitive', 'সংবেদনশীল']] },
    age: { en: 'Age group', bn: 'বয়স', opts: [['0-12 months', '0-12 মাস'], ['1-3 years', '1-3 বছর'], ['3-6 years', '3-6 বছর'], ['6+ years', '6+ বছর']] },
    pack: { en: 'Pack size', bn: 'প্যাক সাইজ', opts: [['500g', '500g'], ['1kg', '1kg'], ['5kg', '5kg'], ['25kg', '25kg']] },
    origin: { en: 'Origin', bn: 'উৎস', opts: [['Local', 'দেশি'], ['Imported', 'আমদানিকৃত']] },
    level: { en: 'Level', bn: 'লেভেল', opts: [['Beginner', 'নতুনদের জন্য'], ['Intermediate', 'মাঝারি'], ['Pro', 'প্রো']] },
    lang: { en: 'Language', bn: 'ভাষা', opts: [['Bangla', 'বাংলা'], ['English', 'ইংরেজি']] },
    format: { en: 'Format', bn: 'ফরম্যাট', opts: [['Paperback', 'পেপারব্যাক'], ['Hardcover', 'হার্ডকভার']] },
    mtype: { en: 'Type', bn: 'ধরন', opts: [['Digital', 'ডিজিটাল'], ['Manual', 'ম্যানুয়াল']] },
    agegrp: { en: 'Suitable for', bn: 'যাদের জন্য', opts: [['Adults', 'প্রাপ্তবয়স্ক'], ['Kids', 'শিশু'], ['Everyone', 'সবার']] },
    fitment: { en: 'Fits', bn: 'উপযোগী', opts: [['Bike', 'বাইক'], ['Car', 'গাড়ি'], ['Universal', 'সব']] }
  };
  var MAIN_ATTRS = [['color', 'size', 'material'], ['color', 'warranty'], ['color', 'storage', 'warranty'], ['color', 'material'], ['skin'], ['age', 'color'], ['pack', 'origin'], ['color', 'level'], ['lang', 'format'], ['mtype', 'agegrp'], ['color', 'fitment'], ['age', 'material']];
  var GROUP_ATTRS = { 'computing-cameras': ['ram'], 'phones': ['ram'] };
  // attribute keys valid for a category node (inherited from every ancestor)
  function attrKeysFor(node) {
    var keys = [];
    path(node).forEach(function (n) {
      var add = n.level === 1 ? MAIN_ATTRS[n.main] : (GROUP_ATTRS[n.slug] || []);
      add.forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    });
    return keys;
  }
  var BRANDS_BY_MAIN = [
    ['Kumo', 'Ananta', 'Rangon', 'Nodi', 'Tarun'], ['Voltix', 'Nexora', 'Sonic', 'Arcline', 'Zenith'], ['Voltix', 'Pixelo', 'Aeon', 'Xenon', 'Zorin'],
    ['Hearth', 'Chulha', 'Brava', 'Zenith', 'Nodi'], ['Sundari', 'Bonoful', 'Glowa', 'Kumo', 'Aeon'], ['Tuli', 'Shishu', 'Nodi', 'Ananta', 'Kumo'],
    ['Meghna', 'Shuvo', 'Sundarban', 'Chhaya', 'Ananta'], ['Arena', 'Kumo', 'Zenith', 'Brava', 'Tarun'], ['Kothamala', 'Pathak', 'Boimela', 'Shabdo', 'Granthi'],
    ['Sehat', 'Brava', 'Glowa', 'Nexora', 'Kumo'], ['Rider', 'Zenith', 'Arcline', 'Brava', 'Voltix'], ['Tuli', 'Khelna', 'Brava', 'Ananta', 'Kumo']
  ];

  /* products: [emoji, title, base price, leaf category (English name, searched inside the main category), extra category] - 5 per main, in order */
  var BASE = [
    ['👘', 'Men Cotton Panjabi - Embroidered Eid Collection', 1850, 'Eid Panjabi'], ['🥻', 'Women Jamdani Saree - Handloom Pure Cotton', 4200, 'Jamdani'],
    ['👞', 'Classic Leather Loafers for Men', 2450, 'Shoes'], ['👖', 'Slim Fit Denim Jeans - Stretch', 1650, 'Jeans'], ['👜', 'Ladies Hand Bag - Premium PU Leather', 1990, 'Handbags'],
    ['📺', '55" 4K Smart LED Television - Android', 62500, '4K TVs'], ['❄️', 'Inverter Air Conditioner 1.5 Ton', 58900, 'Air Conditioner'],
    ['💻', 'Gaming Laptop 15.6" RTX 4060 16GB/1TB', 125000, 'Gaming Laptops'], ['🔊', 'Bluetooth Soundbar 2.1 Channel', 7450, 'Soundbar'], ['📷', 'Mirrorless Digital Camera Kit', 89500, 'Cameras'],
    ['📱', 'Smartphone 8/256GB - AMOLED 120Hz', 32990, '5G Phones'], ['🎧', 'Wireless Earbuds ANC - 30h Battery', 2890, 'Earbuds', 'headphones'],
    ['⌚', 'Smart Watch Series 7 - AMOLED', 4590, 'Smart Watch', 'watches'], ['🔋', '20000mAh Power Bank Fast Charge', 2150, 'Power Bank'], ['🔌', '65W GaN Fast Charger Type-C', 1450, 'Chargers'],
    ['🍳', 'Non-stick Cookware Set 7 Pieces', 3250, 'Cookware'], ['🍚', 'Rice Cooker 1.8L Automatic', 3890, 'Rice Cooker'], ['🛏️', 'Memory Foam Pillow - Orthopedic', 1250, 'Bedding', 'beds'],
    ['☕', 'Electric Kettle Stainless 1.7L', 1450, 'Kettle'], ['🥤', 'Blender 3-in-1 600W with Grinder', 4290, 'Blender'],
    ['💄', 'Matte Liquid Lipstick Set of 6', 990, 'Lipstick'], ['🧴', 'Vitamin C Face Serum 30ml', 1150, 'Serums'], ['💇', 'Hair Dryer 2000W Ionic', 1990, 'Hair Dryer'],
    ['☀️', 'Sunscreen SPF 50 PA++++ 60g', 720, 'Sunscreen'], ['🌸', 'Perfume Eau de Parfum 100ml', 3450, 'Perfume'],
    ['🍼', 'Baby Diaper Pants Large 64pcs', 1590, 'Diapers'], ['👶', 'Baby Stroller Foldable Lightweight', 8900, 'Strollers'], ['🎒', 'Kids School Bag Waterproof', 1150, 'School Bags'],
    ['🍼', 'Baby Feeding Bottle Anti-Colic 240ml', 650, 'Feeding'], ['🧸', 'Kids Cotton Pajama Set', 790, 'Boys'],
    ['🌾', 'Miniket Rice Premium 25kg Bag', 1850, 'Rice'], ['🛢️', 'Mustard Oil Pure 5 Litre', 1190, 'Oil'], ['🍯', 'Sundarban Honey 500g Raw', 690, 'Honey'],
    ['🍵', 'Premium Tea Leaf 500g', 380, 'Tea & Coffee'], ['🌴', 'Fresh Dates Ajwa 1kg', 1990, 'Fruits'],
    ['🏏', 'Cricket Bat English Willow', 5450, 'Cricket'], ['⚽', 'Football Size 5 Match Ball', 1250, 'Football'], ['🧘', 'Yoga Mat Anti-Slip 6mm', 890, 'Yoga Mats'],
    ['🏋️', 'Adjustable Dumbbell Set 20kg', 3650, 'Dumbbells'], ['🏸', 'Badminton Racket Pair with Shuttles', 1450, 'Badminton'],
    ['📚', 'Bestselling Bangla Novel Collection - 5 Books', 1450, 'Bangla Novels'], ['📖', 'English Grammar and Composition', 450, 'Language'], ['📓', 'Class 10 Guide Book Combo', 680, 'SSC & HSC'],
    ['📕', 'Self Improvement Hardcover Edition', 520, 'Self Help'], ['📗', 'Children Story Book Illustrated', 350, 'Story Books'],
    ['🩺', 'Digital Blood Pressure Monitor', 2450, 'BP Monitor'], ['💊', 'Multivitamin Tablets 60 Count', 890, 'Vitamins'], ['🌡️', 'Infrared Thermometer Non-contact', 1250, 'Thermometer'],
    ['🩸', 'Glucometer with 50 Test Strips', 1850, 'Glucometer'], ['🧼', 'Herbal Hand Sanitizer 500ml', 220, 'Sanitizer'],
    ['⛑️', 'Full Face Helmet ISI Certified', 3250, 'Helmets'], ['📹', 'Car Dash Camera 1080p', 4290, 'Dash Cams'], ['⛽', 'Engine Oil 10W-40 4 Litre', 2450, 'Engine Oil'],
    ['🏍️', 'Motorcycle Phone Holder Waterproof', 650, 'Phone Holders'], ['🚗', 'Car Vacuum Cleaner Portable', 1850, 'Vacuum'],
    ['🚙', 'Remote Control Car 4WD Off-road', 2450, 'RC Cars'], ['🧱', 'Building Blocks 500 Pieces Set', 1650, 'Building Blocks'], ['🧸', 'Plush Teddy Bear 60cm', 1150, 'Plush'],
    ['🧩', 'Educational Puzzle Wooden', 590, 'Puzzles'], ['🎲', 'Board Game Family Edition', 990, 'Board Games']
  ];
  var VARIANT_SUFFIX = ['', ' - Black', ' - Premium Edition', ' (Combo Pack)'];
  var WEIGHT_OVERRIDE = { 5: 14, 6: 38, 26: 7, 30: 25, 31: 4.6, 37: 1.6, 38: 20, 7: 2.4 };
  var MAIN_WEIGHT = [0.4, 6, 0.3, 1.2, 0.2, 1.5, 2, 1, 0.5, 0.4, 1, 0.6];
  BASE.forEach(function (b, i) {
    var m = Math.floor(i / 5), n = findInMain(m, b[3]);
    b.leaf = n ? n.slug : mains[m].slug;
    b.cats = [b.leaf];
    if (b[4] && catBySlug[b[4]]) b.cats.push(b[4]);
  });

  var N_PRODUCTS = 1200, pcache = {};
  function build(baseIdx, seed, id) {
    var r = rng(seed * 7919 + 13), b = BASE[baseIdx], cat = Math.floor(baseIdx / 5);
    var price = Math.round(b[2] * (0.85 + r() * 0.35) / 10) * 10;
    var hasDeal = r() < 0.72;
    var pct = [10, 15, 20, 25, 30, 35, 40, 50][Math.floor(r() * 8)];
    var old = hasDeal ? Math.round(price / (1 - pct / 100) / 10) * 10 : 0;
    var badges = [];
    if (r() < 0.2) badges.push('new');
    if (r() < 0.2) badges.push('hot');
    if (r() < 0.35) badges.push('free_del');
    if (r() < 0.06) badges.push('preorder');
    var oos = (seed >= 30 && r() < 0.14) || seed === 37;
    var rating = 3.6 + r() * 1.35, sold = Math.floor(Math.pow(r(), 3) * 12000) + 8;
    var p = {
      id: id, base: baseIdx, cat: cat, h: mains[cat].h, emoji: b[0],
      title: b[1] + VARIANT_SUFFIX[Math.floor(seed / 60) % VARIANT_SUFFIX.length],
      price: price, old: old, off: old ? Math.round((old - price) / old * 100) : 0,
      rating: Math.round(rating * 10) / 10, sold: sold, reviews: Math.max(2, Math.floor(sold * (0.04 + r() * 0.08))), qa: Math.floor(r() * 36),
      badges: badges.slice(0, 2), oos: oos, brand: BRANDS_BY_MAIN[cat][Math.floor(r() * 5)], cats: b.cats.slice(),
      age: Math.floor(r() * 400), weight: Math.round((WEIGHT_OVERRIDE[baseIdx] || MAIN_WEIGHT[cat] * (0.6 + r() * 0.9)) * 10) / 10,
      returnDays: cat === 6 ? 2 : cat === 4 ? 3 : (seed % 13 === 0 ? 14 : 7), attrs: {}
    };
    p.preorder = badges.indexOf('preorder') >= 0;
    // advance payment (Q106): dropship items 20% (id % 3 === 0, same rule as Shop.isDrop), a few others 30%; applied only in the Full phase
    p.advancePercent = id % 3 === 0 ? 20 : (id % 8 === 5 ? 30 : 0);
    if (!Shop.isFull()) { p.preorder = false; p.badges = p.badges.filter(function (x) { return x !== 'preorder'; }); }   // pre-order is hidden at launch
    p.flash = seed % 7 === 3;
    // attributes for every key valid at the product's leaf category (so filters match inherited category attributes)
    attrKeysFor(catBySlug[b.leaf]).forEach(function (k) { var o = ATTRS[k].opts; p.attrs[k] = o[Math.floor(r() * o.length)][0]; });
    return p;
  }
  // Q114: up-coming products are visible but cannot be ordered (wishlist only); picked so some land on the default category page and one matches "phone"
  var UPCOMING = { 538: 1, 316: 1, 53: 1, 20: 1, 296: 1 };
  function product(i) {
    if (pcache[i]) return pcache[i];
    var p;
    if (i === 9001) { p = build(7, 9001, 9001); p.title = 'Gaming Laptop 15.6" RTX 5060 32GB/1TB - Next Gen'; p.old = 0; p.off = 0; p.price = 149000; p.preorder = Shop.isFull(); p.oos = !Shop.isFull(); p.soon = !Shop.isFull(); p.badges = Shop.isFull() ? ['preorder', 'new'] : ['new']; p.flash = false; p.age = 1; }
    else if (i === 9002) { p = build(8, 9002, 9002); p.title = 'Bluetooth Soundbar 2.1 Channel - Limited Edition'; p.oos = true; p.preorder = false; p.badges = []; p.flash = false; }
    else {
      var idx = (i * 7 + Math.floor(i / 60) * 3) % 60;
      p = build(idx, i, i);
      if (i === 10) { p.oos = false; p.preorder = false; p.flash = true; p.old = 38990; p.off = Math.round((p.old - p.price) / p.old * 100); p.reviews = 148; p.sold = 2310; p.rating = 4.6; p.qa = 3; }
    }
    if (UPCOMING[i]) { p.upcoming = true; p.preorder = false; p.oos = false; p.flash = false; p.old = 0; p.off = 0; p.advancePercent = 0; p.badges = ['upcoming']; }
    return (pcache[i] = p);
  }
  function getProduct(id) { id = +id; return (id >= 0 && id < N_PRODUCTS) || id === 9001 || id === 9002 ? product(id) : null; }
  var allCache = null;
  function all() { if (!allCache) { allCache = []; for (var i = 0; i < N_PRODUCTS; i++) allCache.push(product(i)); } return allCache; }
  function deal(p) { // copy of p guaranteed to have an old price + in stock (used for flash bands)
    var c = Object.assign({}, p);
    if (!c.old) { c.old = Math.round(c.price / 0.7 / 10) * 10; c.off = Math.round((c.old - c.price) / c.old * 100); }
    c.oos = false;
    return c;
  }

  /* delivery: zone base charge + weight extra (per kg above the first). Q105: FREE DELIVERY = the customer pays NO delivery fee.
     Threshold is PER ZONE: zone.freeAbove = BDT subtotal at/above which delivery is free; null = never free; 0 = always free. */
  var config = { codFee: 0 };
  var zones = {
    dhaka: { en: 'Inside Dhaka', bn: 'ঢাকা সিটির ভেতরে', base: 60, perKg: 15, days: [1, 2], freeAbove: 1499 },
    dhakaOut: { en: 'Dhaka suburbs', bn: 'ঢাকার আশপাশ', base: 80, perKg: 20, days: [2, 3], freeAbove: 2999 },
    major: { en: 'Major cities', bn: 'বড় শহর', base: 110, perKg: 25, days: [2, 4], freeAbove: null },
    rest: { en: 'Other districts', bn: 'অন্যান্য জেলা', base: 130, perKg: 30, days: [3, 5], freeAbove: null },
    remote: { en: 'Remote areas', bn: 'দুর্গম এলাকা', base: 160, perKg: 40, days: [5, 7], freeAbove: null }
  };
  // bilingual one-liner for a zone's free-delivery rule, e.g. "Free delivery in Inside Dhaka above ৳1,499" (span with data-en/data-bn)
  function freeRule(zoneKey) {
    var z = zones[zoneKey];
    if (z.freeAbove == null) return '<span ' + Shop.LX('Free delivery is not available in ' + z.en, z.bn + '-এ ফ্রি ডেলিভারি নেই') + '</span>';
    if (z.freeAbove === 0) return '<span ' + Shop.LX('Free delivery in ' + z.en, z.bn + '-এ ফ্রি ডেলিভারি') + '</span>';
    return '<span ' + Shop.LX('Free delivery in ' + z.en + ' above ' + formatBDT(z.freeAbove, 'en'), z.bn + '-এ ' + formatBDT(z.freeAbove, 'bn') + '-এর বেশি অর্ডারে ফ্রি ডেলিভারি') + '</span>';
  }
  var districts = [
    ['Dhaka (city)', 'ঢাকা (সিটি)', 'dhaka'], ['Gazipur', 'গাজীপুর', 'dhakaOut'], ['Narayanganj', 'নারায়ণগঞ্জ', 'dhakaOut'], ['Savar', 'সাভার', 'dhakaOut'],
    ['Chattogram', 'চট্টগ্রাম', 'major'], ['Sylhet', 'সিলেট', 'major'], ['Rajshahi', 'রাজশাহী', 'major'], ['Khulna', 'খুলনা', 'major'],
    ['Barishal', 'বরিশাল', 'rest'], ['Rangpur', 'রংপুর', 'rest'], ['Mymensingh', 'ময়মনসিংহ', 'rest'], ['Cumilla', 'কুমিল্লা', 'rest'],
    ["Cox's Bazar", 'কক্সবাজার', 'rest'], ['Bandarban', 'বান্দরবান', 'remote'], ['Khagrachhari', 'খাগড়াছড়ি', 'remote']
  ];
  var coupons = [
    { code: 'WELCOME100', en: '৳100 off', bn: '৳100 ছাড়', ten: 'On orders above ৳1,000', tbn: '৳1,000-এর বেশি অর্ডারে', exp: 'Expires in 6 days', ebn: '6 দিনে শেষ' },
    { code: 'EID10', en: '10% off', bn: '10% ছাড়', ten: 'Max discount ৳500', tbn: 'সর্বোচ্চ ছাড় ৳500', exp: 'Expires in 12 days', ebn: '12 দিনে শেষ' },
    { code: 'FREEDEL', en: 'Free delivery', bn: 'ফ্রি ডেলিভারি', ten: 'On orders above ৳2,000', tbn: '৳2,000-এর বেশি অর্ডারে', exp: 'Expires in 3 days', ebn: '3 দিনে শেষ' }
  ];

  /* ------------------------------------------------------------------ DATA: product detail (variants up to 2 option types), reviews, Q&A */
  var VOPTS = [
    { c: 1, name: { en: 'Size', bn: 'সাইজ' }, vals: [['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL']] },
    { c: 1, name: { en: 'Model', bn: 'মডেল' }, vals: [['Standard', 'স্ট্যান্ডার্ড'], ['Plus', 'প্লাস'], ['Max', 'ম্যাক্স']] },
    { c: 1, name: { en: 'Storage', bn: 'স্টোরেজ' }, vals: [['128GB', '128GB'], ['256GB', '256GB'], ['512GB', '512GB']] },
    { c: 1, name: { en: 'Size', bn: 'সাইজ' }, vals: [['Small', 'ছোট'], ['Medium', 'মাঝারি'], ['Large', 'বড়']] },
    { c: 0, name: { en: 'Volume', bn: 'পরিমাণ' }, vals: [['30ml', '30ml'], ['50ml', '50ml'], ['100ml', '100ml']] },
    { c: 1, name: { en: 'Size', bn: 'সাইজ' }, vals: [['S', 'S'], ['M', 'M'], ['L', 'L']] },
    { c: 0, name: { en: 'Pack', bn: 'প্যাক' }, vals: [['500g', '500g'], ['1kg', '1kg'], ['5kg', '5kg']], f: [0.4, 0.75, 1] },
    { c: 1, name: { en: 'Size', bn: 'সাইজ' }, vals: [['S', 'S'], ['M', 'M'], ['L', 'L']] },
    { c: 0, name: { en: 'Edition', bn: 'সংস্করণ' }, vals: [['Paperback', 'পেপারব্যাক'], ['Hardcover', 'হার্ডকভার']], f: [1, 1.35] },
    { c: 0, name: { en: 'Pack', bn: 'প্যাক' }, vals: [['1 pc', '1 পিস'], ['2 pcs', '2 পিস'], ['3 pcs', '3 পিস']], f: [1, 1.9, 2.7] },
    { c: 1, name: { en: 'Size', bn: 'সাইজ' }, vals: [['S', 'S'], ['M', 'M'], ['L', 'L']] },
    { c: 1, name: { en: 'Pack', bn: 'প্যাক' }, vals: [['Standard', 'স্ট্যান্ডার্ড'], ['Deluxe', 'ডিলাক্স']], f: [1, 1.3] }
  ];
  function detail(id) {
    var p = getProduct(id);
    if (!p) return null;
    if (p._d) return p._d;
    var r = rng(p.id * 977 + 5), VO = VOPTS[p.cat], o1 = null, i, j;
    if (VO.c) {
      var vals = [];
      for (i = 0; i < 4; i++) { var c = COLORS[(p.id + i * 2) % COLORS.length]; vals.push({ id: slugify(c[0]), en: c[0], bn: c[1], hex: c[2], h: c[3] }); }
      o1 = { key: 'o1', name: { en: 'Color', bn: 'রং' }, swatch: true, vals: vals };
    }
    var o2 = { key: 'o2', name: VO.name, vals: VO.vals.map(function (v) { return { id: slugify(v[0]), en: v[0], bn: v[1] }; }) };
    var f = VO.f || [1, 1.12, 1.25];
    var combos = {}, order = [];
    var list1 = o1 ? o1.vals : [null];
    list1.forEach(function (a, ai) {
      o2.vals.forEach(function (b, bi) {
        var key = (a ? a.id + '/' : '') + b.id, rr = r(), stock;
        stock = p.oos ? 0 : rr < 0.2 ? 0 : rr < 0.32 ? 3 : 5 + Math.floor(rr * 40);
        var regular = Math.round(p.price * f[bi] * (a && a.id === 'gold' ? 1.05 : 1) / 10) * 10;
        var old = p.old ? Math.round(p.old * f[bi] * (a && a.id === 'gold' ? 1.05 : 1) / 10) * 10 : 0;
        var price = regular;
        if (p.flash) { price = Math.round(regular * 0.9 / 10) * 10; if (!old) old = regular; }
        combos[key] = { key: key, o1: a, o2: b, regular: regular, price: price, old: old, off: old ? Math.round((old - price) / old * 100) : 0, stock: stock, h: a ? a.h : p.h, emoji: p.emoji,
          label: { en: (a ? a.en + ' / ' : '') + b.en, bn: (a ? a.bn + ' / ' : '') + b.bn } };
        order.push(key);
      });
    });
    if (!p.oos) {
      if (p.id === 10 || p.id === 9001) { // demo: one low-stock, one sold-out, rest fine
        order.forEach(function (k, n) { combos[k].stock = n % 5 === 1 ? 0 : n % 5 === 3 ? 3 : 14 + n; });
      }
      if (!order.some(function (k) { return combos[k].stock > 0; })) combos[order[0]].stock = 20;
    }
    var d = {
      id: p.id, p: p, options: o1 ? [o1, o2] : [o2], combos: combos, order: order,
      combo: function (key) { return combos[key] || combos[d.defaultKey()]; },
      defaultKey: function () { for (var n = 0; n < order.length; n++) if (combos[order[n]].stock > 0) return order[n]; return order[0]; },
      keyOf: function (a, b) { return (o1 ? a + '/' : '') + b; },
      video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // placeholder link (YouTube only, per product rules)
      preorderInfo: p.preorder ? { date: Date.now() + (p.id === 9001 ? 27 : 14) * 86400000, pct: 20 } : null,
      returnDays: p.returnDays, warranty: p.cat <= 2 ? { en: '1 year brand warranty', bn: '1 বছরের ব্র্যান্ড ওয়ারেন্টি' } : null,
      gallery: function (colorVal) {
        var h = colorVal ? colorVal.h : p.h;
        return [{ h: h, rot: 0, tag: 'Front' }, { h: h, rot: -14, tag: 'Angle' }, { h: h, rot: 0, tag: 'Box', extra: '📦' }, { h: h, rot: 10, tag: 'Detail', small: true }];
      }
    };
    return (p._d = d);
  }
  // price/stock line for the cart: Shop.data.detail(id).combo(variant)

  var NAMES = ['Rahim Uddin', 'Nusrat Jahan', 'Tanvir Ahmed', 'Sadia Islam', 'Mehedi Hasan', 'Farhana Akter', 'Imran Hossain', 'Sumaiya Rahman', 'Arif Chowdhury', 'Mitu Das', 'Shakib Khan', 'Rubina Yasmin', 'Kamrul Hasan', 'Lamia Tasnim'];
  var RTEXT = {
    5: ['Exactly as described and delivery was quick. Packaging was very good.', 'Excellent quality for this price. Will order again.', 'Genuine product with warranty card. Very happy with it.', 'Better than I expected. Highly recommended.'],
    4: ['Good product, delivery took one extra day.', 'Nice quality, the color is slightly different from the photo.', 'Works well. Box was a little dented but the item is fine.'],
    3: ['Average. Works fine but the build feels a bit cheap.', 'Okay for the price, nothing special.'],
    2: ['Not as expected, but support was quick to help.'],
    1: ['Received a defective piece. Waiting for the refund.']
  };
  function ratingDist(rating) {
    var t = rating - 4.2, w = [Math.max(0.04, 0.2 - 0.12 * t), Math.max(0.03, 0.04 - 0.02 * t), Math.max(0.03, 0.07 - 0.05 * t), Math.max(0.05, 0.2 - 0.06 * t), 0], s = 0, i;
    w[4] = Math.max(0.2, 1 - w[0] - w[1] - w[2] - w[3]);
    w.forEach(function (x) { s += x; });
    return w.map(function (x) { return x / s; }); // index 0 = 1 star ... 4 = 5 stars
  }
  function reviewsFor(id) {
    var p = getProduct(id), d = detail(id), r = rng(p.id * 31 + 7), dist = ratingDist(p.rating), out = [], i;
    for (i = 0; i < 14; i++) {
      var x = r(), acc = 0, stars = 5;
      for (var s = 0; s < 5; s++) { acc += dist[s]; if (x <= acc) { stars = s + 1; break; } }
      var list = RTEXT[stars], photos = r() < 0.35 ? 1 + Math.floor(r() * 3) : 0;
      var k = d.order[Math.floor(r() * d.order.length)];
      out.push({ id: i, name: NAMES[(p.id + i * 5) % NAMES.length], stars: stars, text: list[Math.floor(r() * list.length)], days: 2 + Math.floor(r() * 80) + i * 3,
        photos: photos, variant: d.combos[k].label, helpful: Math.floor(r() * 30), verified: true,
        reply: (stars <= 3 || r() < 0.25) ? { en: 'Thank you for your feedback. Please contact our support if you need any help with your order.', bn: 'আপনার মতামতের জন্য ধন্যবাদ। অর্ডার নিয়ে সাহায্য লাগলে আমাদের সাপোর্টে যোগাযোগ করুন।' } : null });
    }
    return out;
  }
  function qaFor(id) {
    var p = getProduct(id);
    return [
      { q: 'Is this product original with warranty?', a: 'Yes, it is 100% genuine and comes with a valid brand warranty card. - ShopName Support', days: 6 },
      { q: 'Do you offer cash on delivery outside Dhaka?', a: 'Cash on delivery is available in all 64 districts. A small COD handling charge may apply for remote areas.', days: 11 },
      { q: 'Can I return it if I do not like the color?', a: 'Yes, within ' + p.returnDays + ' days of delivery if the item is unused and in the original packaging.', days: 15 },
      { q: 'How long does delivery take to Chattogram?', a: 'Usually 2-4 working days after dispatch.', days: 21 }
    ];
  }

  Shop.data = {
    tree: ROOT, catBySlug: catBySlug, mains: mains, path: path, inCat: inCat, attrs: ATTRS, attrKeysFor: attrKeysFor, colors: COLORS,
    product: product, getProduct: getProduct, all: all, deal: deal, detail: detail, count: N_PRODUCTS, reviewsFor: reviewsFor, qaFor: qaFor, ratingDist: ratingDist,
    freeRule: freeRule, zones: zones, districts: districts, coupons: coupons, config: config, base: BASE,
    // zone key used before an address is chosen: default saved address, else Inside Dhaka
    defaultZone: function () { var a = store.getJSON('shop.addr', []), d = Array.isArray(a) ? (a.filter(function (x) { return x.def; })[0] || a[0]) : null; return d && districts[d.di] ? districts[d.di][2] : 'dhaka'; },
    // delivery estimate for a zone and total weight (kg) / subtotal (BDT): {charge, free, days:[min,max]}
    delivery: function (zoneKey, weight, subtotal) {
      var z = zones[zoneKey], extra = Math.max(0, Math.ceil(weight - 1)) * z.perKg, free = z.freeAbove != null && subtotal >= z.freeAbove;
      return { zone: z, base: z.base, extra: extra, charge: free ? 0 : z.base + extra, free: free, freeAbove: z.freeAbove, days: z.days };
    }
  };
  Shop.url = {
    product: function (id) { return 'product.html?p=' + id; },
    category: function (slug) { return 'category.html' + (slug ? '?c=' + slug : ''); },
    search: function (q) { return 'search.html?q=' + encodeURIComponent(q); }
  };

  /* ------------------------------------------------------------------ cart / wishlist / coupons / recent (localStorage) */
  var cart = Shop.cart = {
    get: function () { var c = store.getJSON('shop.cart', []); return Array.isArray(c) ? c : []; },
    save: function (c) { store.setJSON('shop.cart', c); Shop.emit('cart', c); },
    add: function (id, variant, qty) {
      var pr = getProduct(id);
      if (pr && pr.upcoming) return false;   // Q114: up-coming products cannot be ordered
      var c = cart.get(), v = variant || '', q = Math.max(1, qty | 0), hit = null;
      c.forEach(function (l) { if (l.id === +id && l.variant === v) hit = l; });
      if (hit) hit.qty += q; else c.push({ id: +id, variant: v, qty: q });
      cart.save(c);
      return true;
    },
    setQty: function (id, variant, qty) {
      var c = cart.get();
      c.forEach(function (l) { if (l.id === +id && l.variant === (variant || '')) l.qty = Math.max(1, qty | 0); });
      cart.save(c);
    },
    remove: function (id, variant) { cart.save(cart.get().filter(function (l) { return !(l.id === +id && l.variant === (variant || '')); })); },
    clear: function () { cart.save([]); },
    count: function () { return cart.get().reduce(function (n, l) { return n + l.qty; }, 0); },
    lines: function () {
      return cart.get().map(function (l) {
        var p = getProduct(l.id); if (!p) return null;
        var d = detail(l.id), c = d.combo(l.variant);
        return { id: l.id, variant: c.key, qty: l.qty, p: p, d: d, c: c, price: c.price, total: c.price * l.qty };
      }).filter(Boolean);
    },
    subtotal: function () { return cart.lines().reduce(function (s, l) { return s + l.total; }, 0); }
  };
  var wish = Shop.wish = {
    get: function () { return store.getJSON('shop.wish', []); },
    has: function (id) { return wish.get().indexOf(+id) >= 0; },
    toggle: function (id) {
      var w = wish.get(), i = w.indexOf(+id);
      if (i >= 0) w.splice(i, 1); else w.push(+id);
      store.setJSON('shop.wish', w); Shop.emit('wish', w);
      return i < 0;
    },
    count: function () { return wish.get().length; }
  };
  Shop.recent = {
    get: function () { return store.getJSON('shop.recent', []); },
    add: function (id) { var a = Shop.recent.get().filter(function (x) { return x !== +id; }); a.unshift(+id); store.setJSON('shop.recent', a.slice(0, 12)); }
  };
  Shop.collected = {
    get: function () { return store.getJSON('shop.coupons', []); },
    has: function (code) { return Shop.collected.get().indexOf(code) >= 0; },
    add: function (code) { var a = Shop.collected.get(); if (a.indexOf(code) < 0) a.push(code); store.setJSON('shop.coupons', a); }
  };
  function refreshCounts() {
    var cc = cart.count(), wc = wish.count();
    $$('.js-ccount').forEach(function (n) { n.textContent = cc; n.hidden = cc === 0; });
    $$('.js-wcount').forEach(function (n) { n.textContent = wc; n.hidden = wc === 0; });
    $$('.heart[data-id]').forEach(function (b) { var on = wish.has(b.getAttribute('data-id')); b.setAttribute('aria-pressed', String(on)); });
  }
  Shop.refreshCounts = refreshCounts;
  Shop.on('cart', refreshCounts); Shop.on('wish', refreshCounts);
  window.addEventListener('storage', function (e) { if (e.key === 'shop.cart') Shop.emit('cart'); if (e.key === 'shop.wish') Shop.emit('wish'); });

  /* ------------------------------------------------------------------ shared HTML builders */
  // Product card (decided rules: image, ONE-line title, price, old price + discount %, rating + sold, badges, NO add-to-cart).
  // o.size 'xs' = compact (recently viewed: price + old + discount only), o.progress = flash-sale sold bar %
  Shop.card = function (p, o) {
    o = o || {};
    var cls = 'card' + (p.oos ? ' is-oos' : '') + (o.size ? ' ' + o.size : ''), href = Shop.url.product(p.id);
    var bd = p.badges.map(function (b) { return '<span class="bdg bdg-' + b + '" ' + Shop.X(b) + '</span>'; }).join('');
    var on = wish.has(p.id);
    var h = '<article class="' + cls + '">' +
      '<a class="card-media" href="' + href + '" tabindex="-1" aria-hidden="true"><div class="ph" style="--h:' + p.h + '"><span aria-hidden="true">' + p.emoji + '</span></div>' +
      (bd && !p.oos ? '<div class="bdgs">' + bd + '</div>' : '') +
      (p.oos ? '<div class="oos"><span ' + Shop.X('oos') + '</span></div>' : '') + '</a>' +
      '<button class="heart" type="button" data-id="' + p.id + '" aria-pressed="' + on + '" ' + Shop.XA('aria-label', 'add_wish') + '>' + icon('heart', 18) + '</button>' +
      '<div class="card-body"><a class="card-title" href="' + href + '" title="' + esc(p.title) + '">' + esc(p.title) + '</a>' +
      (p.oos ? '<span class="sr-only" ' + Shop.X('oos') + '</span>' : '') +
      '<div class="price-row"><span class="price">' + formatBDT(p.price) + '</span>' +
      (p.old ? '<s class="old">' + formatBDT(p.old) + '</s><span class="off">-' + p.off + '%</span>' : '') + '</div>' +
      (p.upcoming ? '' : '<div class="meta"><span class="rate"><span class="star" aria-hidden="true">★</span> ' + p.rating.toFixed(1) + '</span><span aria-hidden="true">·</span><span>' + '<span ' + Shop.LX(fmtK(p.sold, 'en'), fmtK(p.sold, 'bn')) + '</span> <span ' + Shop.X('sold') + '</span></span></div>');
    if (o.progress) {
      h += '<div class="prog" aria-hidden="true"><i style="width:' + o.progress + '%"></i></div>' +
        '<div class="prog-l"><span>' + o.progress + '% <span ' + Shop.X('sold') + '</span></span>' + (o.progress >= 85 ? '<b ' + Shop.X('almost') + '</b>' : '') + '</div>';
    }
    return h + '</div></article>';
  };
  // stable sort: out-of-stock products go to the end of the batch
  Shop.oosLast = function (list) {
    return list.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return (a[0].oos ? 1 : 0) - (b[0].oos ? 1 : 0) || a[1] - b[1]; }).map(function (x) { return x[0]; });
  };
  Shop.cdHTML = function () {
    return '<div class="cd" role="timer"><span class="cd-l" ' + Shop.X('ends_in') + '</span>' +
      '<span class="cd-b"><b data-cd="h">05</b><i ' + Shop.X('cd_h') + '</i></span><span class="cd-s" aria-hidden="true">:</span>' +
      '<span class="cd-b"><b data-cd="m">23</b><i ' + Shop.X('cd_m') + '</i></span><span class="cd-s" aria-hidden="true">:</span>' +
      '<span class="cd-b"><b data-cd="s">09</b><i ' + Shop.X('cd_s') + '</i></span></div>';
  };
  var ends = Date.now() + (5 * 3600 + 23 * 60 + 9) * 1000;
  function tick() {
    var ms = ends - Date.now();
    if (ms <= 0) { ends = Date.now() + 6 * 3600 * 1000; ms = ends - Date.now(); }
    var s = Math.floor(ms / 1000), v = { h: pad(Math.floor(s / 3600)), m: pad(Math.floor(s % 3600 / 60)), s: pad(s % 60) };
    $$('[data-cd]').forEach(function (n) { n.textContent = v[n.getAttribute('data-cd')]; });
  }
  Shop.tick = tick;
  setInterval(tick, 1000);

  function seg() {
    return '<div class="seg" role="group" ' + Shop.XA('aria-label', 'lang_lbl') + '>' +
      '<button type="button" data-lang="en" aria-pressed="false">EN</button>' +
      '<button type="button" data-lang="bn" aria-pressed="false" lang="bn">বাং</button></div>';
  }
  function themeBtn() {
    return '<button class="icon-btn js-theme" type="button" ' + Shop.XA('aria-label', 'theme') + '>' + '<span class="ic-sun">' + icon('sun', 18) + '</span><span class="ic-moon">' + icon('moon', 18) + '</span></button>';
  }
  function logo() { return '<a class="logo" href="home.html" aria-label="ShopName"><span class="logo-mk">' + LOGOS[root.getAttribute('data-brand') || 'd'] + '</span><span class="wm"><b>Shop</b>Name</span></a>'; }
  function lnk(href, cls, inner) { return '<a ' + (cls ? 'class="' + cls + '" ' : '') + 'href="' + href + '">' + inner + '</a>'; }

  function headerHTML(o) {
    var q = esc(o.q || ''), sel = o.c || '';
    var catOpts = mains.map(function (c) { return '<option value="' + c.slug + '"' + (sel === c.slug ? ' selected' : '') + ' ' + Shop.X(c.k) + '</option>'; }).join('');
    var h = '<div class="topbar on-dark"><div class="wrap bar"><div class="tb-l">' + icon('phone', 14) + ' <span ' + Shop.X('hotline') + '</span>: <a href="tel:+8801700000000">+880 1700-000000</a></div>' +
      '<nav class="tb-r" ' + Shop.XA('aria-label', 'utility') + '><a href="account.html#orders" ' + Shop.X('track') + '</a><a href="#" ' + Shop.X('sell') + '</a><a href="#" ' + Shop.X('help') + '</a>' + seg() + themeBtn() + '</nav></div></div>';
    h += '<header class="hdr on-dark"><div class="wrap hd-d">' + logo() +
      '<form class="search" role="search" action="search.html" method="get"><select name="c" ' + Shop.XA('aria-label', 'all_cats') + '><option value="" ' + Shop.X('all_cats') + '</option>' + catOpts + '</select>' +
      '<input type="search" name="q" value="' + q + '" ' + Shop.XA('placeholder', 'search_ph') + ' ' + Shop.XA('aria-label', 'search') + '>' +
      '<button type="submit">' + icon('search', 18) + '<span ' + Shop.X('search') + '</span></button></form>' +
      '<div class="act"><a href="account.html#wishlist">' + icon('heart', 24) + '<span class="lbl" ' + Shop.X('wishlist') + '</span><span class="cnt js-wcount" hidden>0</span></a>' +
      '<a href="cart.html">' + icon('cart', 24) + '<span class="lbl" ' + Shop.X('cart') + '</span><span class="cnt js-ccount" hidden>0</span></a>' +
      '<a href="account.html">' + icon('user', 24) + '<span class="lbl" ' + Shop.X('login') + '</span></a></div></div>' +
      '<div class="hd-m"><div class="wrap hm-r1">' + logo() + '<span class="grow"></span>' + seg() + themeBtn() +
      '<a class="icon-btn cart-m" href="cart.html" ' + Shop.XA('aria-label', 'cart') + '>' + icon('cart', 22) + '<span class="cnt js-ccount" hidden>0</span></a></div>' +
      '<div class="wrap hm-r2"><form class="search search-m" role="search" action="search.html" method="get">' + icon('search', 18, 'si') + '<input type="search" name="q" value="' + q + '" ' + Shop.XA('placeholder', 'search_ph_m') + ' ' + Shop.XA('aria-label', 'search') + '></form></div></div></header>';
    return h;
  }

  // mega menu used on the home hero (desktop) - 4-level tree: main > group > item
  Shop.catMenuHTML = function () {
    return '<nav class="catmenu" ' + Shop.XA('aria-label', 'cats_menu') + '><ul>' + mains.map(function (c) {
      var groups = c.kids.map(function (g) {
        return '<div><h3><a href="' + Shop.url.category(g.slug) + '" ' + Shop.LX(g.en, g.bn) + '</a></h3><ul>' +
          g.kids.map(function (s) { return '<li><a href="' + Shop.url.category(s.slug) + '" ' + Shop.LX(s.en, s.bn) + '</a></li>'; }).join('') + '</ul></div>';
      }).join('');
      return '<li><a href="' + Shop.url.category(c.slug) + '"><span class="cm-e" aria-hidden="true">' + c.e + '</span><span class="cm-n" ' + Shop.X(c.k) + '</span>' + icon('chevR', 14, 'cm-c') + '</a>' +
        '<div class="fly"><div class="fly-h"><b ' + Shop.X(c.k) + '</b><a class="link" href="' + Shop.url.category(c.slug) + '"><span ' + Shop.X('view_all') + '</span>' + icon('chevR', 14) + '</a></div>' + groups + '</div></li>';
    }).join('') + '</ul></nav>';
  };

  function footerHTML() {
    var social = ['f', 'in', 'yt', 'x'].map(function (s, n) { return '<a class="soc" href="#" aria-label="' + ['Facebook', 'Instagram', 'YouTube', 'X'][n] + '">' + s + '</a>'; }).join('');
    return '<footer class="foot on-dark"><div class="wrap">' +
      '<div class="foot-news"><div><h3 ' + Shop.X('f_news') + '</h3><p ' + Shop.X('f_news_s') + '</p></div>' +
      '<form class="news-f"><label class="sr-only" for="nl-email" ' + Shop.X('news_ph') + '</label><input id="nl-email" name="email" type="email" required ' + Shop.XA('placeholder', 'news_ph') + '><button class="btn btn-accent" type="submit" ' + Shop.X('subscribe') + '</button></form></div>' +
      '<div class="foot-grid"><div class="fg-about">' + logo() + '<p ' + Shop.X('about_blurb') + '</p><h3 ' + Shop.X('f_social') + '</h3><div class="socs">' + social + '</div></div>' +
      '<div><h3 ' + Shop.X('f_company') + '</h3><ul><li><a href="#" ' + Shop.X('about_us') + '</a></li><li><a href="#" ' + Shop.X('careers') + '</a></li><li><a href="#" ' + Shop.X('blog') + '</a></li><li><a href="#" ' + Shop.X('sell') + '</a></li><li><a href="#" ' + Shop.X('contact') + '</a></li></ul></div>' +
      '<div><h3 ' + Shop.X('f_care') + '</h3><ul><li><a href="#" ' + Shop.X('how_order') + '</a></li><li><a href="#" ' + Shop.X('delivery') + '</a></li><li><a href="#" ' + Shop.X('returns') + '</a></li><li><a href="account.html#orders" ' + Shop.X('track') + '</a></li><li><a href="#" ' + Shop.X('faq') + '</a></li></ul></div>' +
      '<div class="fg-pay"><h3 ' + Shop.X('f_pay') + '</h3><div class="pays"><span class="pay">COD</span><span class="pay">bKash</span><span class="pay">Nagad</span><span class="pay">Card</span></div>' +
      '<p class="courier">' + icon('pkg', 16) + ' <span ' + Shop.X('f_courier') + '</span></p>' +
      '<h3 ' + Shop.X('f_app') + '</h3><div class="apps"><a class="app" href="#"><small ' + Shop.X('get_on') + '</small><b>Google Play</b></a><a class="app" href="#"><small ' + Shop.X('get_on') + '</small><b>App Store</b></a></div></div></div>' +
      '<p class="copy" ' + Shop.X('copyright') + '</p></div></footer>';
  }

  function dockHTML(o, showCookie) {
    var nav = [['home', 'home.html', 'home', 'nav_home'], ['cats', 'category.html', 'grid', 'nav_cats'], ['offers', 'event.html', 'tag', 'nav_offers'], ['cart', 'cart.html', 'cart', 'nav_cart'], ['account', 'account.html', 'user', 'nav_account']];
    var bnav = '<nav class="bnav" ' + Shop.XA('aria-label', 'nav_lbl') + '>' + nav.map(function (n) {
      return '<a href="' + n[1] + '"' + (o.active === n[0] ? ' aria-current="page"' : '') + '>' + icon(n[2], 22) + '<span ' + Shop.X(n[3]) + '</span>' + (n[0] === 'cart' ? '<span class="cnt js-ccount" hidden>0</span>' : '') + '</a>';
    }).join('') + '</nav>';
    return '<div class="dock">' +
      (showCookie ? '<div class="cookie" role="region" ' + Shop.XA('aria-label', 'cookie_lbl') + '><p ' + Shop.X('cookie_t') + '</p><button class="btn btn-primary btn-sm cookie-ok" type="button" ' + Shop.X('cookie_ok') + '</button><button class="icon-btn cookie-x" type="button" ' + Shop.XA('aria-label', 'cookie_x') + '>' + icon('close', 18) + '</button></div>' : '') +
      (o.sbar ? '<div class="sbar">' + o.sbar + '</div>' : '') + bnav + '</div>';
  }

  /* ------------------------------------------------------------------ overlays, toast, mini-cart */
  var ovStack = [];
  var ovl = Shop.ovl = {
    place: function (node) {
      var fr = $('#frame');
      if (root.classList.contains('preview')) { node.style.setProperty('--ov-y', fr.scrollTop + 'px'); node.style.setProperty('--ov-h', fr.clientHeight + 'px'); }
    },
    open: function (node, focusSel) {
      ovl.place(node);
      node._prevFocus = document.activeElement;
      node.classList.add('open'); root.classList.add('ov-open');
      if (ovStack.indexOf(node) < 0) ovStack.push(node);
      var f = (focusSel && $(focusSel, node)) || $('[data-autofocus]', node) || $('button, a[href], input, select', node);
      if (f) setTimeout(function () { f.focus(); }, 30);
    },
    close: function (node) {
      node.classList.remove('open');
      ovStack = ovStack.filter(function (n) { return n !== node; });
      if (!ovStack.length) root.classList.remove('ov-open');
      if (node._prevFocus && node._prevFocus.focus) { try { node._prevFocus.focus(); } catch (e) { /* ignore */ } }
      Shop.emit('ovl-close', node);
    },
    top: function () { return ovStack[ovStack.length - 1]; }
  };
  document.addEventListener('keydown', function (e) {
    var top = ovl.top();
    if (!top) return;
    if (e.key === 'Escape') { e.preventDefault(); ovl.close(top); }
    else if (e.key === 'Tab') {
      var f = $$('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]', top).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  var toastTimer = null;
  Shop.toast = function (msg, action) {
    var layer = $('#toast-layer'); if (!layer) return;
    ovl.place(layer);
    var tt = $('.toast', layer);
    tt.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<a href="' + action.href + '">' + esc(action.label) + '</a>' : '');
    tt.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { tt.classList.remove('show'); }, 3200);
  };

  // mini-cart drawer shown after "Add to cart": Shop.miniCart.show(addedLine?)
  Shop.miniCart = {
    show: function (added) {
      var host = $('#minicart'); if (!host) return;
      var lines = cart.lines(), sub = cart.subtotal(), count = cart.count(), fd = zones[Shop.data.defaultZone()].freeAbove;
      var addedHTML = '';
      if (added) {
        var c = added.c;
        addedHTML = '<div class="mc-item"><div class="mc-img"><div class="ph" style="--h:' + c.h + '"><span aria-hidden="true">' + added.p.emoji + '</span></div></div><div class="mc-t"><b>' + esc(added.p.title) + '</b>' +
          (c.o2 ? '<span class="muted" ' + Shop.LX(c.label.en, c.label.bn) + '</span>' : '') + '<span>' + added.qty + ' × ' + formatBDT(added.price) + '</span></div></div>';
      }
      var left = fd == null ? 0 : fd - sub, pct = fd ? Math.min(100, Math.round(sub / fd * 100)) : 100;
      host.innerHTML = '<div class="sheet-back" data-close></div><div class="drawer sheet" role="dialog" aria-modal="true" aria-labelledby="mc-h">' +
        '<div class="sheet-h"><h2 id="mc-h">' + icon('check', 20, 'ok') + ' <span ' + Shop.X('added') + '</span></h2><button class="icon-btn" type="button" data-close ' + Shop.XA('aria-label', 'close') + '>' + icon('close', 20) + '</button></div>' +
        '<div class="sheet-b">' + addedHTML +
        '<div class="mc-sum"><span>' + t('cart_items', { n: count }) + '</span><b>' + formatBDT(sub) + '</b></div>' +
        (fd == null ? '' : '<div class="mc-free"><div class="prog" aria-hidden="true"><i style="width:' + pct + '%"></i></div><p>' + (left > 0 ? t('free_del_more', { amt: formatBDT(left) }) : t('free_del_got')) + '</p></div>') + '</div>' +
        '<div class="sheet-f mc-act"><a class="btn btn-ghost" href="cart.html" ' + Shop.X('view_cart') + '</a><a class="btn btn-primary" href="checkout.html" ' + Shop.X('checkout') + '</a>' +
        '<button class="btn-link" type="button" data-close ' + Shop.X('continue_shop') + '</button></div></div>';
      ovl.open(host, '.mc-act .btn-primary');
    }
  };

  /* ------------------------------------------------------------------ brand switcher, language, preview */
  function swapLink(id, href) {
    var old = document.getElementById(id);
    if (!old || old.getAttribute('href') === href) return;
    if (old._next && old._next.parentNode) old._next.parentNode.removeChild(old._next);
    var n = old.cloneNode(false);
    n.removeAttribute('id'); n.setAttribute('href', href);
    var done = function () { if (old.parentNode) old.parentNode.removeChild(old); n.id = id; };
    n.addEventListener('load', done); n.addEventListener('error', done);
    old._next = n;
    old.parentNode.insertBefore(n, old.nextSibling);
  }
  Shop.brand = function () { return root.getAttribute('data-brand') || 'd'; };
  Shop.setBrand = function (b, noSave) {
    if (!BOOT.brands[b]) return;
    swapLink('brand-css', BOOT.brands[b].css);
    swapLink('brand-fonts', BOOT.brands[b].fonts);
    root.setAttribute('data-brand', b);
    if (!noSave) store.set('shop.brand', b);
    $$('.logo-mk').forEach(function (n) { n.innerHTML = LOGOS[b]; });
    $$('[data-brand-btn]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-brand-btn') === b)); });
    Shop.emit('brand', b);
  };

  var pvBtn;
  function updatePV() {
    if (!pvBtn) return;
    var on = root.classList.contains('preview');
    pvBtn.innerHTML = '<span aria-hidden="true">' + (on ? '🖥️' : '📱') + '</span> ' + esc(t(on ? 'desktop_view' : 'preview'));
    pvBtn.setAttribute('aria-pressed', String(on));
  }
  Shop.setLang = function (l, noSave) {
    lang = l === 'bn' ? 'bn' : 'en';
    root.setAttribute('lang', lang);
    if (!noSave) store.set('shop.lang', lang);
    Shop.applyI18n(document);
    sweep(document.body);
    $$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    updatePV();
    Shop.emit('lang', lang);
  };

  /* ------------------------------------------------------------------ renderPage */
  Shop.renderPage = function (body, o) {
    o = o || {};
    var frame = document.getElementById('frame');
    var showCookie = !store.get('shop.cookie') || /resetcookie/.test(location.search);
    if (/resetcookie/.test(location.search)) store.del('shop.cookie');
    frame.innerHTML = headerHTML(o) + '<main id="main">' + body + '</main>' + footerHTML() + dockHTML(o, showCookie) +
      '<div class="ovl ovl-toast" id="toast-layer"><div class="toast" role="status" aria-live="polite"></div></div><div class="ovl" id="minicart"></div>';
    root.classList.toggle('has-sbar', !!o.sbar);
    if (!document.querySelector('.skip')) {
      document.body.insertBefore(el('<a class="skip" href="#main" ' + Shop.X('skip') + '</a>'), frame);
      var bs = ['a', 'b', 'c', 'd'].map(function (b) { return '<button type="button" data-brand-btn="' + b + '" aria-pressed="false" title="' + esc(BOOT.brands[b] ? BOOT.brands[b].name : b) + '">' + b.toUpperCase() + '</button>'; }).join('');
      var ps = ['launch', 'full'].map(function (x) { return '<button type="button" data-phase-btn="' + x + '" aria-pressed="' + (PHASE === x) + '">' + (x === 'full' ? 'Full' : 'Launch') + '</button>'; }).join('');
      var fab = el('<div class="fab"><div class="seg phase-sw" role="group" ' + Shop.XA('aria-label', 'phase_lbl') + ' title="Demo phase: Launch = COD only, Full = online pay, advance, pre-order">' + ps + '</div><div class="seg brand-sw" role="group" ' + Shop.XA('aria-label', 'brand_lbl') + '>' + bs + '</div><button class="pv" type="button"></button></div>');
      document.body.appendChild(fab);
      pvBtn = $('.pv', fab);
    }
    Shop.applyI18n(frame);
    Shop.setLang(lang, true);
    watchDigits();
    Shop.setBrand(Shop.brand(), true);
    refreshCounts(); tick();
    // header height -> --hdr-h (for sticky bars that sit under the header)
    var hdr = $('.hdr', frame);
    function measure() { frame.style.setProperty('--hdr-h', hdr.offsetHeight + 'px'); }
    measure();
    if (window.ResizeObserver) new ResizeObserver(measure).observe(hdr); else window.addEventListener('resize', measure);
    // dock (cookie bar + bottom nav / sticky bar) height -> --dock-h: keeps the floating brand/preview switcher above it
    var dock = $('.dock', frame);
    function measureDock() { root.style.setProperty('--dock-h', (dock ? dock.offsetHeight : 0) + 'px'); }
    measureDock();
    if (dock && window.ResizeObserver) new ResizeObserver(measureDock).observe(dock);
    if (o.onReady) o.onReady(frame);
    return frame;
  };

  /* ------------------------------------------------------------------ breadcrumb helpers */
  // list items: { href, k (i18n key) | en+bn | text }; the LAST item is the current page (no link)
  Shop.crumbs = function (list) {
    return '<nav class="crumbs" ' + Shop.XA('aria-label', 'bc_lbl') + '><ol>' + list.map(function (c, i) {
      var inner = c.k ? '<span ' + Shop.X(c.k) + '</span>' : c.text != null ? esc(c.text) : '<span ' + Shop.LX(c.en, c.bn) + '</span>';
      return '<li>' + (i < list.length - 1 ? '<a href="' + c.href + '">' + inner + '</a>' : '<span aria-current="page">' + inner + '</span>') + '</li>';
    }).join('') + '</ol></nav>';
  };
  // Home > main > group > item > leaf for a category node (4 levels)
  Shop.catCrumbs = function (node, last) {
    var list = [{ href: 'home.html', k: 'bc_home' }];
    path(node).forEach(function (n) { list.push({ href: Shop.url.category(n.slug), en: n.en, bn: n.bn }); });
    if (last) list.push(last);
    else if (list.length === 1) list.push({ k: 'all_products' });
    return list;
  };

  /* ------------------------------------------------------------------ global event delegation (once) */
  document.addEventListener('click', function (e) {
    var tg = e.target, b;
    if (!tg.closest) return;
    var a = tg.closest('a[href="#"]');
    if (a) e.preventDefault();
    if ((b = tg.closest('.heart[data-id]'))) {
      var now = wish.toggle(b.getAttribute('data-id'));
      Shop.toast(t(now ? 'wish_added' : 'wish_removed'));
    } else if ((b = tg.closest('[data-lang]'))) { Shop.setLang(b.getAttribute('data-lang')); }
    else if ((b = tg.closest('[data-brand-btn]'))) { Shop.setBrand(b.getAttribute('data-brand-btn')); }
    else if ((b = tg.closest('[data-phase-btn]'))) {
      var ph = b.getAttribute('data-phase-btn');
      if (ph !== PHASE) {   // phase changes products / methods / copy everywhere: remember it, drop ?phase= from the URL and reload
        store.set('shop.phase', ph);
        try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])phase=[^&#]*(&|$)/, function (m, a, z) { return z ? a : ''; }) + location.hash); } catch (er) { /* file:// quirks */ }
        location.reload();
      }
    }
    else if (tg.closest('.js-theme')) { setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
    else if (tg.closest('.cookie-ok, .cookie-x')) { store.set('shop.cookie', '1'); var c = $('.cookie'); if (c) c.parentNode.removeChild(c); }
    else if (tg.closest('.pv')) {
      root.classList.toggle('preview');
      // page may be scrolled down; reset so the 390px frame is in view
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('frame').scrollTop = 0;
      updatePV();
    } else if ((b = tg.closest('[data-close]'))) {
      var o = b.closest('.ovl, .ovl-m'); if (o) ovl.close(o);
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('form[method=get]')) return; // real navigation (header search)
    e.preventDefault();
    if (f.classList.contains('news-f')) {
      var inp = $('input', f);
      inp.value = ''; inp.setAttribute('placeholder', t('thanks')); inp.removeAttribute('data-i18n-attr');
    }
  });
})();
