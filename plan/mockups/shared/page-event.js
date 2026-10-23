/* Event page (event.html): ONE event at a time, built from blocks (hero + countdown, coupon strip, category tiles, flash sale, banner pair, partner offer, deals grid).
   Event prices are site-wide: the deals grid just shows discounted products. Collect buttons write shop.coupons (the coupon wallet). */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, $$ = Shop.$$, X = Shop.X, XA = Shop.XA, T = Shop.T, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data;

  Shop.i18n({
    en: {
      ev_title: 'Puja Mega Sale', ev_ends: 'Sale ends in', ev_cta2: 'Jump to deals', ev_coupons: 'Event coupons', ev_coupons_s: 'Collect now, apply at checkout from your coupon wallet',
      ev_collect: 'Collect', ev_collected: 'Collected', ev_cats: 'Shop the sale by category', ev_up: 'Up to {n}% off', ev_flash: 'Flash deals', ev_pair1_k: 'Home and kitchen', ev_pair1_t: 'Festive home makeover', ev_pair1_s: 'Lighting, decor and cookware from ৳199',
      ev_pair2_k: 'Fashion', ev_pair2_t: 'New festive collection', ev_pair2_s: 'Panjabi, saree and shoes. Free delivery in Inside Dhaka above ৳1,499', ev_shop: 'Shop now', ev_deals: 'Event deals', ev_showing: 'Showing {n} of {m} deals',
      ev_pay_k: 'Payment partner offer', ev_pay_t: '10% cashback with bKash', ev_pay_s: 'Pay with bKash on orders above {min}. Get 10% cashback up to {max} in your store wallet within 3 days.', ev_pay_tc: 'Valid on the first 2 orders per customer during the event.',
      ev_pay_cta: 'Shop and pay with bKash', ev_pay_nagad: 'Nagad: 3% off up to ৳200, all event long.', ev_see: 'See details', ev_toast: 'Coupon collected: {c}', ev_all: 'All offers', ev_sold_out: 'Sold out', n_coupons: 'Coupon wallet', cp_cart: 'Go to cart'
    },
    bn: {
      ev_title: 'পূজা মেগা সেল', ev_ends: 'সেল শেষ হতে বাকি', ev_cta2: 'ডিল দেখুন', ev_coupons: 'ইভেন্ট কুপন', ev_coupons_s: 'এখন সংগ্রহ করুন, চেকআউটে কুপন ওয়ালেট থেকে প্রয়োগ করুন',
      ev_collect: 'সংগ্রহ', ev_collected: 'সংগৃহীত', ev_cats: 'ক্যাটাগরি অনুযায়ী সেলে কিনুন', ev_up: '{n}% পর্যন্ত ছাড়', ev_flash: 'ফ্ল্যাশ ডিল', ev_pair1_k: 'বাসা ও রান্নাঘর', ev_pair1_t: 'উৎসবে ঘর সাজান', ev_pair1_s: 'লাইটিং, ডেকর ও কুকওয়্যার ৳199 থেকে',
      ev_pair2_k: 'ফ্যাশন', ev_pair2_t: 'নতুন উৎসব কালেকশন', ev_pair2_s: 'পাঞ্জাবি, শাড়ি ও জুতা। ঢাকা সিটির ভেতরে ৳1,499-এর বেশি অর্ডারে ফ্রি ডেলিভারি', ev_shop: 'এখনই কিনুন', ev_deals: 'ইভেন্ট ডিল', ev_showing: '{m}টির মধ্যে {n}টি ডিল দেখানো হচ্ছে',
      ev_pay_k: 'পেমেন্ট পার্টনার অফার', ev_pay_t: 'বিকাশে 10% ক্যাশব্যাক', ev_pay_s: '{min}-এর বেশি অর্ডারে বিকাশে পরিশোধ করুন। 3 দিনের মধ্যে স্টোর ওয়ালেটে {max} পর্যন্ত 10% ক্যাশব্যাক পাবেন।', ev_pay_tc: 'ইভেন্ট চলাকালে প্রতি গ্রাহকের প্রথম 2টি অর্ডারে প্রযোজ্য।',
      ev_pay_cta: 'কিনুন ও বিকাশে পরিশোধ করুন', ev_pay_nagad: 'নগদ: পুরো ইভেন্টজুড়ে ৳200 পর্যন্ত 3% ছাড়।', ev_see: 'বিস্তারিত', ev_toast: 'কুপন সংগৃহীত: {c}', ev_all: 'সব অফার', ev_sold_out: 'শেষ', n_coupons: 'কুপন ওয়ালেট', cp_cart: 'কার্টে যান'
    }
  });

  var EVENT_CODES = ['PUJA200', 'PUJA15', 'FREEDEL', 'WELCOME100'];
  function couponStrip() {
    return '<section class="wrap ev-sec" aria-labelledby="ev-cp"><div class="sec-head"><div><h2 id="ev-cp" ' + X('ev_coupons') + '</h2><p class="muted" ' + X('ev_coupons_s') + '</p></div><a class="link" href="account.html#coupons"><span ' + X('n_coupons') + '</span>' + icon('chevR', 16) + '</a></div>' +
      '<div class="hscroll evc">' + EVENT_CODES.map(function (code) {
        var d = Shop.coupon.def(code), have = Shop.collected.has(code);
        return '<article class="tkt tkt-ev"><div class="tkt-v"><b ' + Shop.LX(d.en, d.bn) + '</b></div><div class="tkt-b"><b class="mono">' + code + '</b><small class="muted" ' + Shop.LX(d.ten, d.tbn) + '</small><small class="muted" ' + Shop.LX(d.exp, d.ebn) + '</small></div>' +
          '<div class="tkt-a"><button class="btn ' + (have ? 'btn-ghost' : 'btn-primary') + ' btn-sm" type="button" data-collect="' + code + '"' + (have ? ' disabled' : '') + '>' + (have ? icon('check', 14) + ' <span ' + X('ev_collected') + '</span>' : '<span ' + X('ev_collect') + '</span>') + '</button></div></article>';
      }).join('') + '</div></section>';
  }
  function catTiles() {
    return '<section class="wrap ev-sec" aria-labelledby="ev-ct"><div class="sec-head"><h2 id="ev-ct" ' + X('ev_cats') + '</h2><a class="link" href="category.html"><span ' + X('ev_all') + '</span>' + icon('chevR', 16) + '</a></div><div class="tiles ev-tiles">' +
      D.mains.slice(0, 6).map(function (c, i) {
        return '<a class="tile" href="' + Shop.url.category(c.slug) + '"><div class="ph" style="--h:' + c.h + '"><span aria-hidden="true">' + c.e + '</span></div><span class="chip" style="--h:' + c.h + '" ' + X(c.k) + '</span><span class="tile-off">' + T('ev_up', { n: 30 + ((i * 7) % 5) * 10 }) + '</span></a>';
      }).join('') + '</div></section>';
  }
  function flashBlock() {
    var items = '';
    for (var k = 0; k < 8; k++) {
      var p = D.deal(D.product(160 + k * 3)), pr = 28 + Math.floor(Shop.rng(p.id * 5 + 2)() * 70);
      items += Shop.card(p, { progress: pr });
    }
    return '<section class="wrap ev-sec"><div class="band flash" aria-labelledby="ev-fl"><div class="band-h"><h2 id="ev-fl">' + icon('bolt', 22) + ' <span ' + X('ev_flash') + '</span></h2>' + Shop.cdHTML() + '</div><div class="hscroll">' + items + '</div></div></section>';
  }
  function pair() {
    var b = function (n, emoji, sl, slug) {
      return '<a class="ev-ban on-dark" style="background:var(--sl' + sl + ')" href="' + Shop.url.category(slug) + '"><div><span class="ev-k" ' + X('ev_pair' + n + '_k') + '</span><h3 ' + X('ev_pair' + n + '_t') + '</h3><p ' + X('ev_pair' + n + '_s') + '</p><span class="btn btn-accent btn-sm" ' + X('ev_shop') + '</span></div><div class="ev-ban-art" aria-hidden="true">' + emoji + '</div></a>';
    };
    return '<section class="wrap ev-sec"><div class="ev-pair">' + b(1, '🏠✨', 2, 'home-kitchen') + b(2, '👗👟', 3, 'fashion') + '</div></section>';
  }
  function partner() {
    return '<section class="wrap ev-sec"><div class="ev-pay on-dark"><div class="ev-pay-i" aria-hidden="true">' + Shop.methodChip('bkash') + '</div><div class="ev-pay-t"><span class="ev-k" ' + X('ev_pay_k') + '</span><h2 ' + X('ev_pay_t') + '</h2>' +
      '<p>' + T('ev_pay_s', { min: fmt(3000), max: fmt(500) }) + '</p><p class="ev-pay-tc">' + icon('info', 13) + ' <span ' + X('ev_pay_tc') + '</span> <span>' + T('ev_pay_nagad') + '</span></p></div><a class="btn btn-accent" href="#evDeals" ' + X('ev_pay_cta') + '</a></div></section>';
  }

  var PAGE = 24, shown = 0, list = [];
  function dealsHTML() {
    return '<section class="wrap ev-sec" id="evDeals" aria-labelledby="ev-dl"><div class="sec-head"><h2 id="ev-dl" ' + X('ev_deals') + '</h2></div><div class="grid" id="evGrid"></div>' +
      '<div class="more"><button class="btn btn-ghost" id="evMore" type="button" ' + X('load_more') + '</button><p class="count" id="evCount" aria-live="polite"></p></div></section>';
  }
  function more() {
    var g = $('#evGrid'), batch = list.slice(shown, shown + PAGE);
    batch.forEach(function (p) { g.appendChild(Shop.el(Shop.card(p))); });
    shown += batch.length; Shop.applyI18n(g);
    $('#evCount').textContent = t('ev_showing', { n: shown, m: list.length });
    if (shown >= list.length) $('#evMore').hidden = true;
  }

  var html = '<section class="wrap ev-hero-w"><div class="event ev-0 on-dark ev-hero" aria-labelledby="ev-h"><div class="ev-t"><span class="ev-k" ' + X('event_tag') + '</span><h1 id="ev-h" ' + X('event0_t') + '</h1><p ' + X('event0_s') + '</p>' +
    Shop.cdHTML() + '<p><a class="btn btn-accent" href="#evDeals" ' + X('ev_cta2') + '</a></p></div><div class="ev-art" aria-hidden="true">🪔✨<span>🎁</span></div></div></section>' +
    couponStrip() + catTiles() + flashBlock() + pair() + (Shop.isFull() ? partner() : '') + dealsHTML();

  Shop.renderPage(html, {
    active: 'offers',
    onReady: function (frame) {
      document.title = t('ev_title') + ' - ShopName';
      list = Shop.oosLast(D.all().filter(function (p) { return p.id % 2 === 0 || p.off > 10; }).slice(0, 200).map(function (p) { return D.deal(p); })).slice(0, 96);
      more(); Shop.tick();
      $('#evMore').addEventListener('click', more);
      Shop.on('lang', function () { $('#evCount').textContent = t('ev_showing', { n: shown, m: list.length }); });
      frame.addEventListener('click', function (e) {
        var b = e.target.closest('[data-collect]'); if (!b) return;
        var code = b.getAttribute('data-collect'); Shop.collected.add(code);
        b.className = 'btn btn-ghost btn-sm'; b.disabled = true; b.innerHTML = icon('check', 14) + ' <span ' + X('ev_collected') + '</span>'; Shop.applyI18n(b);
        Shop.toast(t('ev_toast', { c: code }), { href: 'cart.html', label: t('cp_cart') });
      });
    }
  });
})();
