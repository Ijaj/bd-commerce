/* Home page (home.html, brand-a/b/c.html). */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, $$ = Shop.$$, X = Shop.X, icon = Shop.icon, t = Shop.t;
  var mains = Shop.data.mains;

  function bandHTML(idx) {
    var type = idx % 3, k, items = '', id = 'band' + idx, more = '<a class="link" href="category.html"><span ' + X('view_all') + '</span>' + icon('chevR', 16) + '</a>';
    if (type === 0) {
      for (k = 0; k < 8; k++) {
        var p = Shop.data.deal(Shop.data.product(300 + idx * 20 + k));
        items += Shop.card(p, { progress: 30 + Math.floor(Shop.rng(p.id * 3 + 1)() * 68) });
      }
      return '<section class="band flash" aria-labelledby="' + id + '"><div class="band-h"><h2 id="' + id + '">' + icon('bolt', 22) + ' <span ' + X('flash') + '</span></h2>' + Shop.cdHTML() + more + '</div><div class="hscroll">' + items + '</div></section>';
    }
    if (type === 1) {
      var rec = Shop.recent.get().map(Shop.data.getProduct).filter(Boolean);
      for (k = 0; k < 9; k++) items += Shop.card(rec[k] || Shop.data.product(400 + idx * 20 + k), { size: 'xs' });
      return '<section class="band recent" aria-labelledby="' + id + '"><div class="band-h"><h2 id="' + id + '" ' + X('recent') + '</h2>' + more + '</div><div class="hscroll rv">' + items + '</div></section>';
    }
    var ev = Math.floor(idx / 3) % 2;
    return '<section class="band event ev-' + ev + ' on-dark" aria-labelledby="' + id + '"><div class="ev-t"><span class="ev-k" ' + X('event_tag') + '</span>' +
      '<h2 id="' + id + '" ' + X('event' + ev + '_t') + '</h2><p ' + X('event' + ev + '_s') + '</p>' +
      '<a class="btn btn-accent" href="event.html" ' + X('event_cta') + '</a></div><div class="ev-art" aria-hidden="true">' + (ev ? '🌙🎁' : '🪔✨') + '</div></section>';
  }

  function body() {
    var i, arts = ['📱<span>🎧</span><span>💻</span>', '🥬<span>🍎</span><span>🥛</span>', '👗<span>👜</span><span>👟</span>'];
    var slides = '', dots = '';
    for (i = 1; i <= 3; i++) {
      slides += '<div class="slide" style="background:var(--sl' + i + ')" role="group" aria-roledescription="slide" data-i18n-attr="aria-label=slide_of" data-n="' + i + '" data-m="3" aria-label="' + t('slide_of', { n: i, m: 3 }) + '">' +
        '<div class="sl-t"><span class="sl-k" ' + X('s' + i + '_k') + '</span><h2 ' + X('s' + i + '_t') + '</h2><p ' + X('s' + i + '_s') + '</p>' +
        '<a class="btn btn-accent" href="' + Shop.url.category(['electronics', 'groceries', 'fashion'][i - 1]) + '" ' + X('cta_shop') + '</a></div><div class="sl-art" aria-hidden="true">' + arts[i - 1] + '</div></div>';
      dots += '<button type="button" class="dot" data-i18n-attr="aria-label=goto" data-n="' + i + '" aria-label="' + t('goto', { n: i }) + '"></button>';
    }
    var h = '<h1 class="sr-only" ' + X('h1_home') + '</h1>';
    h += '<section class="wrap hero" ' + Shop.XA('aria-label', 'featured') + '>' + Shop.catMenuHTML() +
      '<div class="car" role="region" aria-roledescription="carousel" ' + Shop.XA('aria-label', 'promo_lbl') + '><div class="car-track">' + slides + '</div>' +
      '<button type="button" class="car-btn car-prev" ' + Shop.XA('aria-label', 'prev') + '>' + icon('chevL', 20) + '</button>' +
      '<button type="button" class="car-btn car-next" ' + Shop.XA('aria-label', 'next') + '>' + icon('chevR', 20) + '</button>' +
      '<button type="button" class="car-pp" aria-label="">' + icon('pause', 14) + '</button><div class="dots">' + dots + '</div></div></section>';
    h += '<section class="wrap" aria-labelledby="h-cats"><div class="sec-head"><h2 id="h-cats" ' + X('shop_by') + '</h2><a class="link" href="category.html"><span ' + X('view_all') + '</span>' + icon('chevR', 16) + '</a></div><div class="tiles">' +
      mains.map(function (c) {
        return '<a class="tile" href="' + Shop.url.category(c.slug) + '"><div class="ph" style="--h:' + c.h + '"><span aria-hidden="true">' + c.e + '</span></div><span class="chip" style="--h:' + c.h + '" ' + X(c.k) + '</span></a>';
      }).join('') + '</div></section>';
    h += '<section class="wrap feed" aria-labelledby="h-feed"><div class="sec-head"><h2 id="h-feed" ' + X('just_for_you') + '</h2></div><div id="feed"></div>' +
      '<div class="more"><button class="btn btn-ghost" id="more" type="button" ' + X('load_more') + '</button><p class="count" id="count" aria-live="polite"></p></div></section>';
    return h;
  }

  var feed = { n: 0, grid: null, band: 0 };
  function addProducts(count) {
    var box = $('#feed'), i, batch = [];
    for (i = 0; i < count; i++) batch.push(Shop.data.product(feed.n + i));
    batch = Shop.oosLast(batch); // out-of-stock items sink to the end of each batch
    batch.forEach(function (p) {
      if (!feed.grid) { feed.grid = Shop.el('<div class="grid"></div>'); box.appendChild(feed.grid); }
      feed.grid.appendChild(Shop.el(Shop.card(p)));
      feed.n++;
      if (feed.n % 12 === 0) { box.appendChild(Shop.el(bandHTML(feed.band++))); feed.grid = null; }
    });
    Shop.applyI18n(box);
    Shop.tick();
    updateCount();
  }
  function updateCount() { var c = $('#count'); if (c) c.textContent = t('showing', { n: feed.n }); }

  function initCarousel() {
    var car = $('.car'), track = $('.car-track', car), slides = $$('.slide', car), dots = $$('.dot', car), pp = $('.car-pp', car);
    var idx = 0, timer = null, n = slides.length, userPaused = Shop.reduceMotion, hover = false, touching = false;
    function go(i) {
      idx = (i + n) % n;
      track.style.transform = 'translateX(-' + idx * 100 + '%)';
      slides.forEach(function (s, j) { if (j === idx) s.removeAttribute('inert'); else s.setAttribute('inert', ''); s.setAttribute('aria-hidden', String(j !== idx)); });
      dots.forEach(function (d, j) { d.setAttribute('aria-current', String(j === idx)); });
    }
    function should() { return !userPaused && !hover && !touching && !document.hidden && !car.matches(':focus-within'); }
    function sync() { if (timer) { clearInterval(timer); timer = null; } if (should()) timer = setInterval(function () { go(idx + 1); }, 5000); }
    function ppUpdate() {
      var key = userPaused ? 'play' : 'pause';
      pp.setAttribute('data-i18n-attr', 'aria-label=' + key); pp.setAttribute('aria-label', t(key));
      pp.innerHTML = icon(userPaused ? 'play' : 'pause', 14);
    }
    pp.addEventListener('click', function () { userPaused = !userPaused; ppUpdate(); sync(); });
    $('.car-prev', car).addEventListener('click', function () { go(idx - 1); sync(); });
    $('.car-next', car).addEventListener('click', function () { go(idx + 1); sync(); });
    dots.forEach(function (d, j) { d.addEventListener('click', function () { go(j); sync(); }); });
    car.addEventListener('mouseenter', function () { hover = true; sync(); });
    car.addEventListener('mouseleave', function () { hover = false; sync(); });
    car.addEventListener('focusin', sync);
    car.addEventListener('focusout', function () { setTimeout(sync, 0); });
    var x0 = null;
    car.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; touching = true; sync(); }, { passive: true });
    car.addEventListener('touchend', function (e) {
      if (x0 !== null) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1)); }
      x0 = null; touching = false; sync();
    });
    document.addEventListener('visibilitychange', sync);
    ppUpdate(); go(0); sync();
  }

  Shop.renderPage(body(), {
    active: 'home',
    onReady: function () {
      addProducts(40);
      initCarousel();
      $('#more').addEventListener('click', function () { addProducts(20); });
      Shop.on('lang', updateCount);
    }
  });
})();
