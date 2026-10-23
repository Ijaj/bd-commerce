/* Search page: search.html?q=phone[&c=<main slug>]   (English-only search, per product rules) */
(function () {
  'use strict';
  var Shop = window.Shop, X = Shop.X, icon = Shop.icon, t = Shop.t, esc = Shop.esc, D = Shop.data;
  Shop.i18n({
    en: { res_for: 'Results for "{q}"', res_none: 'No results for "{q}"', res_all: 'Search ShopName', dym: 'Did you mean', rel_cats: 'Related categories', no_t: "We couldn't find anything for \"{q}\"", no_s: 'Check the spelling, use fewer or more general words, or try one of these.',
      no_tips: 'Search tips', tip1: 'Use English words, e.g. "phone", "saree", "rice"', tip2: 'Try a brand or product type', tip3: 'Browse a category instead', popular_s: 'Popular searches', popular_p: 'Popular products right now', browse: 'Browse categories',
      all_s: 'Type something in the search box above. Popular searches', in_cat: 'in {cat}' },
    bn: { res_for: '"{q}"-এর ফলাফল', res_none: '"{q}"-এর কোনো ফলাফল নেই', res_all: 'ShopName-এ খুঁজুন', dym: 'আপনি কি বোঝাতে চেয়েছেন', rel_cats: 'সম্পর্কিত ক্যাটাগরি', no_t: '"{q}" এর জন্য কিছু পাওয়া যায়নি', no_s: 'বানান দেখুন, কম বা সাধারণ শব্দ ব্যবহার করুন, অথবা নিচের একটি চেষ্টা করুন।',
      no_tips: 'সার্চ টিপস', tip1: 'ইংরেজি শব্দ ব্যবহার করুন, যেমন "phone", "saree", "rice"', tip2: 'ব্র্যান্ড বা পণ্যের ধরন লিখুন', tip3: 'বরং একটি ক্যাটাগরি ব্রাউজ করুন', popular_s: 'জনপ্রিয় সার্চ', popular_p: 'এখন জনপ্রিয় পণ্য', browse: 'ক্যাটাগরি ব্রাউজ করুন',
      all_s: 'উপরের সার্চ বক্সে কিছু লিখুন। জনপ্রিয় সার্চ', in_cat: '{cat}-এ' }
  });
  var q = (Shop.qparam('q') || '').trim(), cslug = Shop.qparam('c') || '';
  var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  var all = D.all();
  function hay(p) {
    if (p._hay) return p._hay;
    var cats = p.cats.map(function (c) { var n = D.catBySlug[c], s = ''; while (n && n.level) { s += ' ' + n.en; n = n.parent; } return s; }).join(' ');
    return (p._hay = (p.title + ' ' + p.brand + ' ' + cats).toLowerCase());
  }
  function matches(toks) {
    return all.filter(function (p) {
      if (cslug && !p.cats.some(function (c) { return D.inCat(c, cslug); })) return false;
      var h = hay(p); return toks.every(function (w) { return h.indexOf(w) >= 0; });
    });
  }
  var results = tokens.length ? matches(tokens) : [];

  // did-you-mean: nearest vocabulary word (edit distance <= 2) for tokens that match nothing
  var vocab = null;
  function lev(a, b) {
    var m = a.length, n = b.length, i, j, d = [];
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function suggest() {
    if (!tokens.length) return null;
    if (!vocab) { var seen = {}; all.forEach(function (p) { hay(p).split(/[^a-z]+/).forEach(function (w) { if (w.length > 3) seen[w] = 1; }); }); vocab = Object.keys(seen); }
    var changed = false, out = tokens.map(function (w) {
      if (matches([w]).length) return w;
      var best = null, bd = 3;
      vocab.forEach(function (v) { if (Math.abs(v.length - w.length) <= 2) { var dd = lev(w, v); if (dd < bd) { bd = dd; best = v; } } });
      if (best && w.length >= 4) { changed = true; return best; }
      return w;
    });
    return changed && matches(out).length ? out.join(' ') : null;
  }
  var dym = results.length < 6 ? suggest() : null;

  function relCats() {
    var cnt = {};
    results.forEach(function (p) { var n = D.catBySlug[p.cats[0]]; [n, n.parent].forEach(function (x) { if (x && x.level >= 2) cnt[x.slug] = (cnt[x.slug] || 0) + 1; }); });
    return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 8).map(function (s) { return [D.catBySlug[s], cnt[s]]; });
  }
  function catChips(list, showCount) {
    return '<ul class="chips">' + list.map(function (x) { var n = x[0] || x; return '<li><a class="chipl" href="' + Shop.url.category(n.slug) + '"><span ' + Shop.LX(n.en, n.bn) + '</span>' + (showCount ? ' <em>' + x[1] + '</em>' : '') + '</a></li>'; }).join('') + '</ul>';
  }
  var POPULAR = ['phone', 'laptop', 'saree', 'rice', 'earbuds', 'watch', 'helmet', 'perfume'];
  function popularSearches() { return '<ul class="chips">' + POPULAR.map(function (w) { return '<li><a class="chipl" href="' + Shop.url.search(w) + '">' + w + '</a></li>'; }).join('') + '</ul>'; }
  function popularProducts() {
    var top = all.filter(function (p) { return !p.oos; }).sort(function (a, b) { return b.sold - a.sold; }).slice(0, 12);
    return '<div class="grid">' + top.map(function (p) { return Shop.card(p); }).join('') + '</div>';
  }

  var html = '<div class="wrap lst">' + Shop.crumbs([{ href: 'home.html', k: 'bc_home' }, { k: 'search' }]);
  if (!tokens.length) {
    html += '<header class="srch-h"><h1 ' + X('res_all') + '</h1><p ' + X('all_s') + '</p></header>' + popularSearches() +
      '<section class="empty-sec"><h2 class="sec-h2" ' + X('browse') + '</h2>' + catChips(D.mains) + '<h2 class="sec-h2" ' + X('popular_p') + '</h2>' + popularProducts() + '</section></div>';
  } else if (!results.length) {
    html += '<header class="srch-h"><h1 id="sh1">' + esc(t('res_none', { q: q })) + '</h1></header>' +
      (dym ? '<p class="dym"><span ' + X('dym') + '</span>: <a href="' + Shop.url.search(dym) + '"><b>' + esc(dym) + '</b></a>?</p>' : '') +
      '<section class="empty"><div class="empty-i" aria-hidden="true">🔎</div><h2>' + esc(t('no_t', { q: q })) + '</h2><p ' + X('no_s') + '</p>' +
      '<div class="tips"><h3 ' + X('no_tips') + '</h3><ul><li ' + X('tip1') + '</li><li ' + X('tip2') + '</li><li ' + X('tip3') + '</li></ul></div></section>' +
      '<section class="empty-sec"><h2 class="sec-h2" ' + X('popular_s') + '</h2>' + popularSearches() + '<h2 class="sec-h2" ' + X('browse') + '</h2>' + catChips(D.mains) +
      '<h2 class="sec-h2" ' + X('popular_p') + '</h2>' + popularProducts() + '</section></div>';
  } else {
    var rc = relCats();
    html += '<header class="srch-h"><h1 id="sh1"></h1>' + (cslug && D.catBySlug[cslug] ? '<p class="muted"><span ' + X('in_cat').replace('data-i18n="in_cat">', 'data-i18n="in_cat" data-cat="' + esc(D.catBySlug[cslug].en) + '">') + '</span></p>' : '') + '</header>' +
      (dym ? '<p class="dym"><span ' + X('dym') + '</span>: <a href="' + Shop.url.search(dym) + '"><b>' + esc(dym) + '</b></a>?</p>' : '') +
      (rc.length ? '<nav class="rel-cats" ' + Shop.XA('aria-label', 'rel_cats') + '><h2 class="sec-h3" ' + X('rel_cats') + '</h2>' + catChips(rc, true) + '</nav>' : '') + '<div id="lst"></div></div>';
  }

  Shop.renderPage(html, {
    active: 'cats', q: q, c: cslug,
    onReady: function (frame) {
      document.title = (q ? q + ' - ' : '') + 'Search - ShopName';
      if (results.length) {
        var h1 = Shop.$('#sh1', frame);
        var setH = function () { h1.textContent = t('res_for', { q: q }) + ' (' + results.length + ')'; };
        setH(); Shop.on('lang', setH);
        var first = {}; tokens.forEach(function (w, i) { first[w] = i; });
        Shop.listing.mount(Shop.$('#lst', frame), {
          items: results,
          attrKeys: Object.keys(D.attrs).filter(function (k) { var n = results.filter(function (p) { return p.attrs[k]; }).length; return n >= results.length * 0.3; }),
          rank: function (p) {
            var title = p.title.toLowerCase(), s = 0;
            tokens.forEach(function (w) { var i = title.indexOf(w); if (i === 0) s += 4; else if (i > 0) s += title.charAt(i - 1) === ' ' ? 3 : 1.5; if (p.brand.toLowerCase().indexOf(w) >= 0) s += 2; });
            // category head noun (last word of the leaf category, e.g. "Smartphones") matching a token = the product IS that thing -> strong boost
            var leaf = D.catBySlug[p.cats[0]], head = leaf ? leaf.en.toLowerCase().split(/[\s&-]+/).pop() : '';
            tokens.forEach(function (w) { if (head && head.indexOf(w) >= 0) s += 6; });
            return s + p.sold / 20000 + p.rating / 10;
          }
        });
      } else {
        var h = Shop.$('#sh1', frame); if (h) { var sh = function () { h.textContent = t('res_none', { q: q }); var h2 = Shop.$('.empty h2', frame); if (h2) h2.textContent = t('no_t', { q: q }); }; Shop.on('lang', sh); }
      }
    }
  });
})();
