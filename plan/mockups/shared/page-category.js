/* Category page: category.html?c=<slug>  (slug of any of the 4 levels; none = all products) */
(function () {
  'use strict';
  var Shop = window.Shop, X = Shop.X, icon = Shop.icon, t = Shop.t, D = Shop.data;
  Shop.i18n({
    en: { sub_cats: 'Sub-categories', in_cat: 'Browse {n} products', ban_t: 'Free delivery above {amt}', ban_s: 'Cash on delivery and 7-day returns on most items', ban_cta: 'See deals', all_in: 'All' },
    bn: { sub_cats: 'সাব-ক্যাটাগরি', in_cat: '{n}টি পণ্য দেখুন', ban_t: '{amt}-এর বেশি অর্ডারে ফ্রি ডেলিভারি', ban_s: 'বেশিরভাগ পণ্যে ক্যাশ অন ডেলিভারি ও 7 দিনের রিটার্ন', ban_cta: 'ডিল দেখুন', all_in: 'সব' }
  });
  var slug = Shop.qparam('c') || '';
  var node = D.catBySlug[slug] || D.tree;
  var items = D.all().filter(function (p) { return !node.slug || p.cats.some(function (c) { return D.inCat(c, node.slug); }); });
  var main = node.level ? D.mains[node.main] : null;

  // sub-category chips: children, or siblings when this is a leaf
  var chipNodes = node.kids.length ? node.kids : (node.parent ? node.parent.kids : []);
  function repEmoji(n) {
    for (var i = 0; i < items.length; i++) if (D.inCat(items[i].cats[0], n.slug) || items[i].cats.some(function (c) { return D.inCat(c, n.slug); })) return items[i].emoji;
    for (var j = 0; j < D.all().length; j++) { var p = D.all()[j]; if (p.cats.some(function (c) { return D.inCat(c, n.slug); })) return p.emoji; }
    return items.length ? items[0].emoji : '🛍️';
  }
  var chips = chipNodes.map(function (n) {
    var cur = n.slug === node.slug;
    return '<li><a class="subcat" href="' + Shop.url.category(n.slug) + '"' + (cur ? ' aria-current="true"' : '') + '><span class="sc-img" style="--h:' + (main ? main.h : n.h) + '"><span aria-hidden="true">' + repEmoji(n) + '</span></span><span class="sc-n" ' + Shop.LX(n.en, n.bn) + '</span></a></li>';
  }).join('');

  var bannerSl = (main ? main.main % 3 : 0) + 1, bannerEmoji = node.level ? repEmoji(node) : '🛍️';
  var title = node.level ? '<h1 class="cat-t" ' + Shop.LX(node.en, node.bn) + '</h1>' : '<h1 class="cat-t" ' + X('all_products') + '</h1>';
  var html = '<div class="wrap lst">' + Shop.crumbs(Shop.catCrumbs(node)) +
    '<section class="cat-banner on-dark" style="background:var(--sl' + bannerSl + ')"><div class="cb-t">' + title +
    '<p class="cb-s"><span id="catCount"></span> · ' + D.freeRule('dhaka') + '</p></div><div class="cb-art" aria-hidden="true">' + bannerEmoji + '<span>' + bannerEmoji + '</span></div></section>' +
    (chips ? '<nav class="subcats" ' + Shop.XA('aria-label', 'sub_cats') + '><ul>' + chips + '</ul></nav>' : '') +
    '<div id="lst"></div></div>';

  Shop.renderPage(html, {
    active: 'cats',
    onReady: function (frame) {
      document.title = (node.level ? node.en : 'All products') + ' - ShopName';
      var L = Shop.listing.mount(Shop.$('#lst', frame), {
        items: items, attrKeys: D.attrKeysFor(node).concat(node.level ? [] : ['color']),
        rank: function (p) { return p.sold * 0.001 + p.rating; },
        onCount: function () { /* banner shows total products in category */ }
      });
      function total() { Shop.$('#catCount').textContent = t('results_n', { n: items.length }); }
      total(); Shop.on('lang', total);
    }
  });
})();
