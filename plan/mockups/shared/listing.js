/* ShopName mockups - listing.js : shared product-grid + filters + sort used by category.html and search.html.
   Shop.listing.mount(hostElement, { items: [product...], attrKeys: ['color',...], rank: fn(p)->number (optional, for "Best match"), pageSize: 24 })
   Everything filters client-side over the fake data. Desktop = sidebar; <= 1023px = sticky Filter/Sort bar + bottom sheets. */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, $$ = Shop.$$, esc = Shop.esc, t = Shop.t, X = Shop.X, icon = Shop.icon, formatBDT = Shop.formatBDT;

  Shop.i18n({
    en: {
      filters: 'Filters', filter: 'Filter', sort: 'Sort', sort_by: 'Sort by', s_rel: 'Best match', s_new: 'Newest', s_pasc: 'Price: low to high', s_pdesc: 'Price: high to low', s_rated: 'Top rated', s_sold: 'Best selling',
      f_price: 'Price (৳)', f_brand: 'Brand', f_rating: 'Customer rating', f_avail: 'Availability', f_disc: 'Discount', f_in_stock: 'In Stock', f_pre: 'Pre-Order', f_upc: 'Up-coming',
      f_any: 'Any', f_up: '{n} & up', f_off: '{n}% or more', f_min: 'Min', f_max: 'Max', f_go: 'Apply', clear_all: 'Clear all', clear_f: 'Clear filters',
      results_n: '{n} results', result_1: '1 result', show_n: 'Show {n} results', no_match: 'No products match these filters', no_match_s: 'Try removing a filter or widening the price range.',
      showing_of: 'Showing {a} of {b}', active_f: 'Active filters', close: 'Close', price_lbl: 'Price'
    },
    bn: {
      filters: 'ফিল্টার', filter: 'ফিল্টার', sort: 'সাজান', sort_by: 'সাজান', s_rel: 'সেরা মিল', s_new: 'নতুন', s_pasc: 'দাম: কম থেকে বেশি', s_pdesc: 'দাম: বেশি থেকে কম', s_rated: 'সর্বোচ্চ রেটিং', s_sold: 'সর্বাধিক বিক্রিত',
      f_price: 'দাম (৳)', f_brand: 'ব্র্যান্ড', f_rating: 'গ্রাহক রেটিং', f_avail: 'প্রাপ্যতা', f_disc: 'ছাড়', f_in_stock: 'স্টকে আছে', f_pre: 'প্রি-অর্ডার', f_upc: 'আসছে শীঘ্রই',
      f_any: 'যেকোনো', f_up: '{n} ও তার বেশি', f_off: '{n}% বা বেশি', f_min: 'সর্বনিম্ন', f_max: 'সর্বোচ্চ', f_go: 'প্রয়োগ', clear_all: 'সব মুছুন', clear_f: 'ফিল্টার মুছুন',
      results_n: '{n}টি ফলাফল', result_1: '1টি ফলাফল', show_n: '{n}টি ফলাফল দেখুন', no_match: 'এই ফিল্টারে কোনো পণ্য মেলেনি', no_match_s: 'একটি ফিল্টার সরান বা দামের সীমা বাড়ান।',
      showing_of: '{b}টির মধ্যে {a}টি দেখানো হচ্ছে', active_f: 'সক্রিয় ফিল্টার', close: 'বন্ধ করুন', price_lbl: 'দাম'
    }
  });
  (function () { var en = {}, bn = {}; for (var k in Shop.data.attrs) { en['fa_' + k] = Shop.data.attrs[k].en; bn['fa_' + k] = Shop.data.attrs[k].bn; } Shop.i18n({ en: en, bn: bn }); })();
  var SORTS = [['rel', 's_rel'], ['new', 's_new'], ['pasc', 's_pasc'], ['pdesc', 's_pdesc'], ['rated', 's_rated'], ['sold', 's_sold']];

  // Q114/Q115 availability buckets: In Stock = orderable now (not pre-order / up-coming / out of stock)
  function availOf(p) { return p.upcoming ? 'up' : p.preorder ? 'pre' : p.oos ? 'out' : 'instock'; }
  var AVAIL = [['instock', 'f_in_stock'], ['pre', 'f_pre'], ['up', 'f_upc']];

  function mount(host, cfg) {
    var items = cfg.items, pageSize = cfg.pageSize || 24, attrKeys = cfg.attrKeys || [], A = Shop.data.attrs;
    var st = { min: null, max: null, brand: [], attr: {}, rating: 0, disc: 0, avail: [], sort: 'rel' }, shown = pageSize, view = [];
    var pmin = Infinity, pmax = 0, brandCount = {}, availCount = { instock: 0, pre: 0, up: 0, out: 0 };
    items.forEach(function (p) { availCount[availOf(p)]++; pmin = Math.min(pmin, p.price); pmax = Math.max(pmax, p.price); brandCount[p.brand] = (brandCount[p.brand] || 0) + 1; });
    if (!items.length) { pmin = 0; }

    // ---- facet groups
    function grp(id, titleKey, body, open) { return '<details class="fgroup" id="fg-' + id + '"' + (open === false ? '' : ' open') + '><summary ' + X(titleKey) + '</summary><div class="fg-b">' + body + '</div></details>'; }
    function opt(name, value, labelHTML, count, extra) {
      return '<label class="fopt' + (extra ? ' ' + extra.cls : '') + '"><input type="checkbox" name="' + name + '" value="' + esc(value) + '">' + (extra ? extra.pre : '') + '<span class="fo-l">' + labelHTML + '</span><em>' + count + '</em></label>';
    }
    var fh = '';
    fh += grp('avail', 'f_avail', AVAIL.map(function (a) { return opt('avail', a[0], '<span ' + X(a[1]) + '</span>', availCount[a[0]]); }).join(''));
    fh += grp('price', 'f_price', '<div class="frow"><label><span class="sr-only" ' + X('f_min') + '</span><input type="number" name="price_min" inputmode="numeric" min="0" placeholder="' + Math.floor(pmin / 10) * 10 + '" ' + Shop.XA('aria-label', 'f_min') + '></label><span aria-hidden="true">-</span>' +
      '<label><span class="sr-only" ' + X('f_max') + '</span><input type="number" name="price_max" inputmode="numeric" min="0" placeholder="' + Math.ceil(pmax / 10) * 10 + '" ' + Shop.XA('aria-label', 'f_max') + '></label>' +
      '<button class="btn btn-sm btn-ghost" type="button" id="pgo" ' + X('f_go') + '</button></div><p class="fhint">' + formatBDT(pmin) + ' - ' + formatBDT(pmax) + '</p>');
    var brands = Object.keys(brandCount).sort(function (a, b) { return brandCount[b] - brandCount[a]; });
    if (brands.length > 1) fh += grp('brand', 'f_brand', brands.map(function (b) { return opt('brand', b, esc(b), brandCount[b]); }).join(''));
    fh += grp('rating', 'f_rating', [0, 4, 3].map(function (n) {
      return '<label class="fopt"><input type="radio" name="rating" value="' + n + '"' + (n === 0 ? ' checked' : '') + '><span class="fo-l">' + (n ? '<span class="star" aria-hidden="true">★</span> <span data-i18n="f_up" data-n="' + n + '">' + t('f_up', { n: n }) + '</span>' : '<span ' + X('f_any') + '</span>') + '</span></label>';
    }).join(''));
    attrKeys.forEach(function (k) {
      var def = A[k], counts = {};
      items.forEach(function (p) { if (p.attrs[k]) counts[p.attrs[k]] = (counts[p.attrs[k]] || 0) + 1; });
      var o = def.opts.filter(function (v) { return counts[v[0]]; });
      if (o.length < 2) return;
      fh += grp('a-' + k, 'fa_' + k, o.map(function (v) {
        return opt('a_' + k, v[0], '<span ' + Shop.LX(v[0], v[1]) + '</span>', counts[v[0]], def.type === 'color' ? { cls: 'fsw', pre: '<i class="sw" style="--c:' + v[2] + '"></i>' } : null);
      }).join(''));
    });
    fh += grp('disc', 'f_disc', [0, 10, 25, 50].map(function (n) {
      return '<label class="fopt"><input type="radio" name="disc" value="' + n + '"' + (n === 0 ? ' checked' : '') + '><span class="fo-l">' + (n ? '<span data-i18n="f_off" data-n="' + n + '">' + t('f_off', { n: n }) + '</span>' : '<span ' + X('f_any') + '</span>') + '</span></label>';
    }).join(''));

    var sortOpts = SORTS.map(function (s) { return '<option value="' + s[0] + '" ' + X(s[1]) + '</option>'; }).join('');
    var sortRadios = SORTS.map(function (s) { return '<label class="fopt"><input type="radio" name="sort_m" value="' + s[0] + '"' + (s[0] === 'rel' ? ' checked' : '') + '><span class="fo-l" ' + X(s[1]) + '</span></label>'; }).join('');

    host.innerHTML =
      '<div class="lst-bar"><button class="btn btn-ghost" type="button" id="openF" aria-haspopup="dialog">' + icon('filter', 18) + '<span ' + X('filter') + '</span><b class="fc" id="fcount" hidden></b></button>' +
      '<button class="btn btn-ghost" type="button" id="openS" aria-haspopup="dialog">' + icon('sort', 18) + '<span ' + X('sort') + '</span></button></div>' +
      '<div class="lst-grid">' +
      '<div class="ovl-m" id="fOvl"><div class="sheet-back" data-close></div><aside class="filters sheet" role="dialog" aria-modal="true" aria-labelledby="f-h">' +
      '<div class="sheet-h"><h2 id="f-h" ' + X('filters') + '</h2><button class="icon-btn" type="button" data-close ' + Shop.XA('aria-label', 'close') + '>' + icon('close', 20) + '</button></div>' +
      '<form class="sheet-b" id="fform" onsubmit="return false">' + fh + '</form>' +
      '<div class="sheet-f"><button class="btn btn-ghost" type="button" id="fclear" ' + X('clear_all') + '</button><button class="btn btn-primary" type="button" id="fshow" data-close></button></div></aside></div>' +
      '<section class="lst-main" aria-label="Results"><div class="lst-top"><p class="count" id="rc" aria-live="polite"></p>' +
      '<label class="sort-d"><span ' + X('sort_by') + '</span><select name="sort" id="sortSel">' + sortOpts + '</select></label></div>' +
      '<div class="pills" id="pills"></div><div class="grid" id="results"></div><div id="nomatch" class="empty" hidden><div class="empty-i" aria-hidden="true">🔎</div><h2 ' + X('no_match') + '</h2><p ' + X('no_match_s') + '</p><button class="btn btn-primary" type="button" id="nmclear" ' + X('clear_f') + '</button></div>' +
      '<div class="more"><button class="btn btn-ghost" id="moreBtn" type="button" ' + X('load_more') + '</button><p class="count" id="shownc" aria-live="polite"></p></div></section></div>' +
      '<div class="ovl-m" id="sOvl"><div class="sheet-back" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="s-h"><div class="sheet-h"><h2 id="s-h" ' + X('sort_by') + '</h2><button class="icon-btn" type="button" data-close ' + Shop.XA('aria-label', 'close') + '>' + icon('close', 20) + '</button></div>' +
      '<div class="sheet-b" id="sform">' + sortRadios + '</div></div></div>';
    Shop.applyI18n(host);

    var fform = $('#fform', host), sortSel = $('#sortSel', host);

    // ---- state <-> DOM
    function read() {
      var v = function (n) { var i = $('[name=' + n + ']', fform); return i && i.value !== '' ? Math.max(0, +i.value) : null; };
      st.min = v('price_min'); st.max = v('price_max');
      st.brand = $$('input[name=brand]:checked', fform).map(function (i) { return i.value; });
      st.attr = {};
      attrKeys.forEach(function (k) { var a = $$('input[name=a_' + k + ']:checked', fform).map(function (i) { return i.value; }); if (a.length) st.attr[k] = a; });
      st.rating = +($('input[name=rating]:checked', fform) || { value: 0 }).value;
      st.disc = +($('input[name=disc]:checked', fform) || { value: 0 }).value;
      st.avail = $$('input[name=avail]:checked', fform).map(function (i) { return i.value; });
    }
    function activeCount() {
      return (st.min != null || st.max != null ? 1 : 0) + st.brand.length + Object.keys(st.attr).reduce(function (n, k) { return n + st.attr[k].length; }, 0) + (st.rating ? 1 : 0) + (st.disc ? 1 : 0) + st.avail.length;
    }
    function match(p) {
      if (st.min != null && p.price < st.min) return false;
      if (st.max != null && st.max > 0 && p.price > st.max) return false;
      if (st.brand.length && st.brand.indexOf(p.brand) < 0) return false;
      for (var k in st.attr) if (st.attr[k].indexOf(p.attrs[k]) < 0) return false;
      if (st.rating && p.rating < st.rating) return false;
      if (st.disc && p.off < st.disc) return false;
      if (st.avail.length && st.avail.indexOf(availOf(p)) < 0) return false;
      return true;
    }
    var cmp = {
      rel: function (a, b) { return (cfg.rank ? cfg.rank(b) - cfg.rank(a) : 0) || a.id - b.id; },
      'new': function (a, b) { return a.age - b.age || a.id - b.id; },
      pasc: function (a, b) { return a.price - b.price || a.id - b.id; },
      pdesc: function (a, b) { return b.price - a.price || a.id - b.id; },
      rated: function (a, b) { return b.rating - a.rating || b.reviews - a.reviews; },
      sold: function (a, b) { return b.sold - a.sold; }
    };

    // ---- render
    var pillsEl = $('#pills', host), resEl = $('#results', host);
    function pill(k, v, labelHTML) { return '<button class="pill" type="button" data-k="' + k + '" data-v="' + esc(v) + '">' + labelHTML + ' ' + icon('close', 14) + '<span class="sr-only" ' + X('close') + '</span></button>'; }
    function renderPills() {
      var h = '';
      if (st.min != null || st.max != null) h += pill('price', '', '<span ' + X('price_lbl') + '</span>: ' + formatBDT(st.min || 0) + ' - ' + (st.max ? formatBDT(st.max) : '&infin;'));
      st.brand.forEach(function (b) { h += pill('brand', b, '<span ' + X('f_brand') + '</span>: ' + esc(b)); });
      Object.keys(st.attr).forEach(function (k) { st.attr[k].forEach(function (v) {
        var o = A[k].opts.filter(function (x) { return x[0] === v; })[0] || [v, v];
        h += pill('a_' + k, v, '<span ' + X('fa_' + k) + '</span>: <span ' + Shop.LX(o[0], o[1]) + '</span>'); }); });
      if (st.rating) h += pill('rating', '', '<span class="star" aria-hidden="true">★</span> ' + t('f_up', { n: st.rating }));
      if (st.disc) h += pill('disc', '', t('f_off', { n: st.disc }));
      st.avail.forEach(function (a) { h += pill('avail', a, '<span ' + X('f_avail') + '</span>: <span ' + X(AVAIL.filter(function (x) { return x[0] === a; })[0][1]) + '</span>'); });
      if (h) h += '<button class="pill-clear" type="button" id="pclear" ' + X('clear_all') + '</button>';
      pillsEl.innerHTML = h;
      pillsEl.hidden = !h;
      Shop.applyI18n(pillsEl);
      var n = activeCount(), fc = $('#fcount', host);
      fc.textContent = n; fc.hidden = !n;
    }
    function renderCounts() {
      var n = view.length;
      $('#rc', host).textContent = n === 1 ? t('result_1') : t('results_n', { n: n });
      $('#fshow', host).textContent = t('show_n', { n: n });
      var shownN = Math.min(shown, n);
      $('#shownc', host).textContent = n ? t('showing_of', { a: shownN, b: n }) : '';
      $('#moreBtn', host).hidden = shownN >= n;
      $('#nomatch', host).hidden = n > 0;
      if (cfg.onCount) cfg.onCount(n);
    }
    function renderGrid() {
      var slice = view.slice(0, shown);
      resEl.innerHTML = slice.map(function (p) { return Shop.card(p); }).join('');
      renderCounts();
    }
    function update(resetShown) {
      read();
      if (resetShown !== false) shown = pageSize;
      view = Shop.oosLast(items.filter(match).sort(cmp[st.sort] || cmp.rel));
      renderPills(); renderGrid();
    }
    function setSort(v) {
      st.sort = v; sortSel.value = v;
      var r = $('input[name=sort_m][value=' + v + ']', host); if (r) r.checked = true;
      update();
    }

    // ---- events
    fform.addEventListener('change', function () { update(); });
    $('#pgo', host).addEventListener('click', function () { update(); });
    fform.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.name && e.target.name.indexOf('price_') === 0) { e.preventDefault(); update(); } });
    sortSel.addEventListener('change', function () { setSort(sortSel.value); });
    $('#sform', host).addEventListener('change', function (e) { setSort(e.target.value); Shop.ovl.close($('#sOvl', host)); });
    function clearAll() {
      $$('input', fform).forEach(function (i) { if (i.type === 'checkbox') i.checked = false; else if (i.type === 'radio') i.checked = i.value === '0'; else i.value = ''; });
      update();
    }
    host.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('.pill'))) {
        var k = b.getAttribute('data-k'), v = b.getAttribute('data-v');
        if (k === 'price') { $('[name=price_min]', fform).value = ''; $('[name=price_max]', fform).value = ''; }
        else if (k === 'rating' || k === 'disc') { $('input[name=' + k + '][value="0"]', fform).checked = true; }
        else { var i = $$('input[name=' + k + ']', fform).filter(function (x) { return x.value === v; })[0]; if (i) i.checked = false; }
        update();
      } else if (e.target.closest('#pclear, #fclear, #nmclear')) { clearAll(); }
      else if (e.target.closest('#moreBtn')) { shown += pageSize; renderGrid(); var cs = $$('.card', resEl); if (cs[shown - pageSize]) { var a = $('.card-title', cs[shown - pageSize]); if (a) a.focus({ preventScroll: true }); } }
      else if (e.target.closest('#openF')) { Shop.ovl.open($('#fOvl', host), '#f-h'); }
      else if (e.target.closest('#openS')) { Shop.ovl.open($('#sOvl', host), 'input[name=sort_m]:checked'); }
    });
    Shop.on('lang', function () { renderPills(); renderCounts(); });
    update();
    return { update: update, state: st, count: function () { return view.length; } };
  }
  Shop.listing = { mount: mount };
})();
