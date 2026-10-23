/* Cart page (cart.html). ?demo=1 seeds 3 items + 3 wallet coupons when the cart is empty. */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, $$ = Shop.$$, X = Shop.X, XA = Shop.XA, T = Shop.T, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data;

  Shop.i18n({
    en: {
      cart_h: 'Shopping cart', cart_n: '{n} items', sel_all: 'Select all', sel_n: '{a} of {b} selected', remove: 'Remove', to_wish: 'Move to wishlist',
      moved: 'Moved to wishlist', removed: 'Removed from cart', low: 'Only {n} left', over: 'Only {n} available. Please reduce the quantity.', set_max: 'Set to {n}',
      oos_line: 'Out of stock. Remove it to continue.', drop_tag: 'Ships from partner seller', pre_tag: 'Pre-order: {pct}% advance, rest on delivery',
      parcels_note: 'Some items ship separately', sum_h: 'Order summary', coupon_h: 'Coupon', my_coupons: 'My coupons', coupon_pick: 'Choose a coupon from your wallet',
      cp_none: 'No coupons in your wallet yet.', cp_get: 'Collect coupons on the Offers page', cp_applied: 'Applied', cp_remove: 'Remove coupon',
      del_est: 'Delivery', del_note: 'Final delivery charge is set by your address at checkout.', checkout_n: 'Checkout ({n})', fix_stock: 'Fix stock issues to continue',
      sel_none: 'Select at least one item to check out', empty_h: 'Your cart is empty', empty_s: 'Looks like you have not added anything yet.', start: 'Start shopping',
      sugg: 'You might like', total_lbl: 'Total', secure: 'Secure checkout. Cash on delivery available.', cart_title: 'Cart', each: 'each', save_lbl: 'Save {amt}',
      qty_dec: 'Decrease quantity', qty_inc: 'Increase quantity', sel_line: 'Select {t}', pay_note: 'COD, bKash, Nagad and cards accepted'
    },
    bn: {
      cart_h: 'শপিং কার্ট', cart_n: '{n}টি আইটেম', sel_all: 'সব সিলেক্ট করুন', sel_n: '{b}টির মধ্যে {a}টি সিলেক্টেড', remove: 'সরান', to_wish: 'উইশলিস্টে সরান',
      moved: 'উইশলিস্টে সরানো হয়েছে', removed: 'কার্ট থেকে সরানো হয়েছে', low: 'মাত্র {n}টি আছে', over: 'মাত্র {n}টি পাওয়া যাচ্ছে। পরিমাণ কমান।', set_max: '{n} করুন',
      oos_line: 'স্টক নেই। চালিয়ে যেতে সরিয়ে ফেলুন।', drop_tag: 'পার্টনার বিক্রেতা থেকে আসবে', pre_tag: 'প্রি-অর্ডার: {pct}% অগ্রিম, বাকি ডেলিভারিতে',
      parcels_note: 'কিছু আইটেম আলাদাভাবে আসবে', sum_h: 'অর্ডার সারসংক্ষেপ', coupon_h: 'কুপন', my_coupons: 'আমার কুপন', coupon_pick: 'ওয়ালেট থেকে কুপন বেছে নিন',
      cp_none: 'ওয়ালেটে এখনও কোনো কুপন নেই।', cp_get: 'অফার পেজ থেকে কুপন সংগ্রহ করুন', cp_applied: 'প্রয়োগ হয়েছে', cp_remove: 'কুপন সরান',
      del_est: 'ডেলিভারি', del_note: 'চূড়ান্ত ডেলিভারি চার্জ চেকআউটে আপনার ঠিকানা অনুযায়ী ঠিক হবে।', checkout_n: 'চেকআউট ({n})', fix_stock: 'চালিয়ে যেতে স্টক সমস্যা ঠিক করুন',
      sel_none: 'চেকআউটের জন্য অন্তত একটি আইটেম সিলেক্ট করুন', empty_h: 'আপনার কার্ট খালি', empty_s: 'এখনও কিছু যোগ করেননি।', start: 'কেনাকাটা শুরু করুন',
      sugg: 'আপনার পছন্দ হতে পারে', total_lbl: 'মোট', secure: 'নিরাপদ চেকআউট। ক্যাশ অন ডেলিভারি আছে।', cart_title: 'কার্ট', each: 'প্রতিটি', save_lbl: '{amt} সাশ্রয়',
      qty_dec: 'পরিমাণ কমান', qty_inc: 'পরিমাণ বাড়ান', sel_line: '{t} সিলেক্ট করুন', pay_note: 'COD, বিকাশ, নগদ ও কার্ড গ্রহণযোগ্য'
    }
  });

  var qs = location.search;
  if (/[?&]demo=1/.test(qs) && !Shop.cart.count()) {
    [11, 3, 31].forEach(function (id) { var d = D.detail(id); Shop.cart.add(id, d.defaultKey(), id === 31 ? 2 : 1); });
    if (!Shop.collected.get().length) ['WELCOME100', 'EID10', 'FREEDEL'].forEach(Shop.collected.add);
  }

  var html = '<div class="wrap cart-pg"><div id="cartRoot"></div></div>';
  var focusKey = null;

  function stockInfo(l) {
    var s = l.c.stock;
    if (s <= 0) return { k: 'oos', html: '<p class="cl-warn bad">' + icon('info', 16) + ' <span ' + X('oos_line') + '</span></p>' };
    if (l.qty > s) return { k: 'over', html: '<p class="cl-warn bad">' + icon('info', 16) + ' ' + T('over', { n: s }) + ' <button class="btn-link" type="button" data-act="max" data-key="' + Shop.lineKey(l) + '">' + T('set_max', { n: s }) + '</button></p>' };
    if (s <= 5) return { k: 'low', html: '<p class="cl-warn warn">' + icon('info', 16) + ' ' + T('low', { n: s }) + '</p>' };
    return { k: 'ok', html: '' };
  }

  function lineHTML(l) {
    var key = Shop.lineKey(l), si = stockInfo(l), on = Shop.sel.isOn(l) && si.k !== 'oos', p = l.p, c = l.c;
    var tags = '';
    if (Shop.isDrop(p)) tags += '<span class="tagx">' + icon('truck', 14) + ' <span ' + X('drop_tag') + '</span></span>';
    if (p.preorder) tags += '<span class="tagx tagx-acc">' + T('pre_tag', { pct: Shop.config.preorderPct }) + '</span>';
    var save = c.old && c.old > l.price ? c.old - l.price : 0;
    return '<li class="cline' + (si.k === 'oos' ? ' is-oos' : '') + '" data-key="' + key + '">' +
      '<label class="cl-chk"><input type="checkbox" data-act="sel" data-key="' + key + '"' + (on ? ' checked' : '') + (si.k === 'oos' ? ' disabled' : '') + ' data-i18n-attr="aria-label=sel_line" data-t="' + esc(p.title) + '" aria-label="' + esc(t('sel_line', { t: p.title })) + '"></label>' +
      '<a class="cl-img" href="' + Shop.url.product(p.id) + '" tabindex="-1" aria-hidden="true"><div class="ph" style="--h:' + c.h + '"><span>' + p.emoji + '</span></div></a>' +
      '<div class="cl-main"><a class="cl-t" href="' + Shop.url.product(p.id) + '">' + esc(p.title) + '</a>' +
      (c.label && c.label.en ? '<p class="cl-v muted" ' + Shop.LX(c.label.en, c.label.bn) + '</p>' : '') +
      (tags ? '<p class="cl-tags">' + tags + '</p>' : '') + si.html + '</div>' +
      '<div class="cl-buy"><div class="cl-pr"><b class="cl-p">' + fmt(l.price) + '</b>' + (c.old && c.old > l.price ? '<s class="old">' + fmt(c.old) + '</s>' : '') + '</div>' +
      (save ? '<span class="cl-save ok">' + T('save_lbl', { amt: fmt(save * l.qty) }) + '</span>' : '') +
      '<div class="stepper" role="group"><button type="button" data-act="dec" data-key="' + key + '"' + (l.qty <= 1 ? ' disabled' : '') + ' ' + XA('aria-label', 'qty_dec') + '>' + icon('minus', 16) + '</button>' +
      '<input type="text" inputmode="numeric" value="' + l.qty + '" data-act="qty" data-key="' + key + '" ' + XA('aria-label', 'qty') + '>' +
      '<button type="button" data-act="inc" data-key="' + key + '" ' + XA('aria-label', 'qty_inc') + '>' + icon('plus', 16) + '</button></div>' +
      '<b class="cl-tot">' + fmt(l.total) + '</b></div>' +
      '<div class="cl-act"><button class="btn-link" type="button" data-act="wish" data-key="' + key + '">' + icon('heart', 15) + ' <span ' + X('to_wish') + '</span></button>' +
      '<button class="btn-link danger" type="button" data-act="rm" data-key="' + key + '">' + icon('trash', 15) + ' <span ' + X('remove') + '</span></button></div></li>';
  }

  function emptyHTML() {
    var sugg = D.all().filter(function (p) { return !p.oos; }).sort(function (a, b) { return b.sold - a.sold; }).slice(0, 6);
    return '<section class="empty"><div class="empty-i" aria-hidden="true">🛒</div><h1 ' + X('empty_h') + '</h1><p ' + X('empty_s') + '</p>' +
      '<a class="btn btn-primary" href="home.html" ' + X('start') + '</a></section>' +
      '<section><h2 class="sec-h2" ' + X('sugg') + '</h2><div class="grid">' + sugg.map(function (p) { return Shop.card(p); }).join('') + '</div></section>';
  }

  function render() {
    var root = $('#cartRoot'); if (!root) return;
    var lines = Shop.cart.lines(), keep = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-act') ? [document.activeElement.getAttribute('data-act'), document.activeElement.getAttribute('data-key')] : null;
    if (!lines.length) { root.innerHTML = emptyHTML(); Shop.applyI18n(root); setBar(null); return; }
    var selCount = lines.filter(function (l) { return Shop.sel.isOn(l) && l.c.stock > 0; }).length;
    var selectable = lines.filter(function (l) { return l.c.stock > 0; });
    var parcels = Shop.parcels(lines);
    root.innerHTML = '<header class="pg-h"><h1 ' + X('cart_h') + '</h1><p class="muted">' + T('cart_n', { n: Shop.cart.count() }) + '</p></header>' +
      '<div class="cart-grid"><section class="cart-l" aria-label="' + esc(t('cart_h')) + '">' +
      '<div class="cart-sel"><label class="chk"><input type="checkbox" data-act="all"' + (selCount === selectable.length && selCount ? ' checked' : '') + '><span ' + X('sel_all') + '</span></label>' +
      '<span class="muted">' + T('sel_n', { a: selCount, b: lines.length }) + '</span></div>' +
      (parcels.length > 1 ? '<p class="note-box">' + icon('pkg', 18) + ' <span><b ' + X('parcels_note') + '</b> ' + T('pc_note', { n: parcels.length }) + '</span></p>' : '') +
      '<ul class="clines">' + lines.map(lineHTML).join('') + '</ul></section>' +
      '<aside class="cart-r"><div class="sumbox" id="sumbox"></div></aside></div>';
    Shop.applyI18n(root);
    renderSummary();
    if (keep) { var n = $('[data-act="' + keep[0] + '"][data-key="' + keep[1] + '"]', root); if (n && !n.disabled) n.focus(); }
  }

  function selLines() { return Shop.checkoutLines(); }

  function validApplied() { // drop applied coupons that no longer qualify (e.g. after unticking items)
    var sub = selLines().reduce(function (s, l) { return s + l.total; }, 0), a = Shop.applied.get(), keep = a.filter(function (c) { return Shop.coupon.eval(c, sub).ok; });
    if (keep.length !== a.length) Shop.applied.set(keep);
    return keep;
  }

  function renderSummary() {
    var box = $('#sumbox'); if (!box) return;
    var lines = selLines(), codes = validApplied();
    var c = Shop.calc({ lines: lines, zone: D.defaultZone(), coupons: codes, method: 'cod', user: false });
    var all = Shop.cart.lines(), bad = all.some(function (l) { return Shop.sel.isOn(l) && l.c.stock > 0 && l.qty > l.c.stock; });
    var left = c.freeLeft, pct = c.freeAbove ? Math.min(100, Math.round(c.sub / c.freeAbove * 100)) : 100;   // per-zone threshold; no bar when the zone is never free
    var chips = codes.map(function (code) {
      var d = Shop.coupon.def(code);
      return '<li class="cp-chip">' + icon('ticket', 15) + ' <b>' + code + '</b> <span class="muted" ' + Shop.LX(d.en, d.bn) + '</span><button type="button" class="icon-btn" data-cp-rm="' + code + '" ' + XA('aria-label', 'cp_remove') + '>' + icon('close', 14) + '</button></li>';
    }).join('');
    var cartHasSel = lines.length > 0;
    box.innerHTML = '<h2 class="sumbox-h" ' + X('sum_h') + '</h2>' +
      (cartHasSel && !c.freeNever ? '<div class="fd-bar"><div class="prog" aria-hidden="true"><i style="width:' + pct + '%"></i></div><p>' + icon('truck', 16) + ' ' + (left > 0 ? T('free_del_more', { amt: fmt(left) }) + ' <small class="muted">(' + D.freeRule(D.defaultZone()) + ')</small>' : T('free_del_got')) + '</p></div>' : '') +
      '<form class="cp-form" id="cpForm" novalidate><label class="sr-only" for="cpIn" ' + X('coupon_h') + '</label><input class="inp" id="cpIn" ' + XA('placeholder', 'cp_code_ph') + ' autocomplete="off" autocapitalize="characters">' +
      '<button class="btn btn-ghost" type="submit" ' + X('cp_apply') + '</button></form>' +
      '<p class="fld-e" id="cpErr" role="alert" hidden></p>' +
      '<button class="btn-link cp-wallet" type="button" id="cpWallet">' + icon('ticket', 16) + ' <span ' + X('my_coupons') + '</span> <em>(' + Shop.collected.get().length + ')</em></button>' +
      (chips ? '<ul class="cp-chips">' + chips + '</ul>' : '') +
      (cartHasSel ? Shop.sumRows(c, { est: true }) + '<p class="muted sum-note">' + icon('info', 14) + ' <span ' + X('del_note') + '</span></p>' : '<p class="muted" ' + X('sel_none') + '</p>') +
      '<button class="btn btn-primary btn-block btn-lg" type="button" id="goCheckout"' + (!cartHasSel || bad ? ' disabled' : '') + '>' + (cartHasSel ? T('checkout_n', { n: lines.reduce(function (s, l) { return s + l.qty; }, 0) }) : T('checkout')) + '</button>' +
      (bad ? '<p class="fld-e" ' + X('fix_stock') + '</p>' : '') +
      '<p class="muted sec-note">' + icon('shield', 15) + ' <span ' + X('secure') + '</span></p>';
    Shop.applyI18n(box);
    setBar(c, cartHasSel && !bad);
  }

  function setBar(c, enabled) {
    var bar = $('#cartBar'); if (!bar) return;
    if (!c) { bar.innerHTML = ''; return; }
    bar.innerHTML = '<div class="sb-tot"><small class="muted" ' + X('total_lbl') + '</small><b>' + fmt(c.total) + '</b></div>' +
      '<button class="btn btn-primary" type="button" id="goCheckout2"' + (enabled ? '' : ' disabled') + ' ' + X('checkout') + '</button>';
    Shop.applyI18n(bar);
  }

  /* coupon wallet picker (sheet) */
  function openWallet() {
    var sub = selLines().reduce(function (s, l) { return s + l.total; }, 0), applied = Shop.applied.get();
    var coll = Shop.collected.get().map(function (code) { return { code: code, d: Shop.coupon.def(code) }; }).filter(function (x) { return x.d; });
    var list = coll.length ? coll.map(function (x) {
      var isOn = applied.indexOf(x.code) >= 0, ev = Shop.coupon.eval(x.code, sub), stackOk = isOn || Shop.coupon.canStack(x.code, applied.concat(x.code));
      var msg = !ev.ok ? (ev.err === 'cp_min' ? T('cp_min', ev.vars) : T(ev.err)) : !stackOk ? T('cp_stack') : '';
      return '<li class="wc"><div class="wc-l"><b class="wc-c">' + x.code + '</b><span class="wc-v" ' + Shop.LX(x.d.en, x.d.bn) + '</span><small class="muted" ' + Shop.LX(x.d.ten, x.d.tbn) + '</small>' +
        (msg ? '<small class="bad">' + msg + '</small>' : '') + '</div>' +
        '<button class="btn ' + (isOn ? 'btn-ghost' : 'btn-primary') + ' btn-sm" type="button" data-pick="' + x.code + '"' + (!isOn && (!ev.ok || !stackOk) ? ' disabled' : '') + '>' + (isOn ? T('cp_applied') : T('cp_apply')) + '</button></li>';
    }).join('') : '<li class="wc-empty"><div class="empty-i" aria-hidden="true">🎟️</div><p ' + X('cp_none') + '</p><a class="link" href="event.html"><span ' + X('cp_get') + '</span>' + icon('chevR', 16) + '</a></li>';
    var n = Shop.ovlModal('cpOvl', Shop.modalHead('cpOvl', 'coupon_pick') + '<div class="sheet-b"><ul class="wcs">' + list + '</ul></div>', 'modal-sm');
    n.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pick]'); if (!b) return;
      var code = b.getAttribute('data-pick');
      if (Shop.applied.get().indexOf(code) >= 0) Shop.removeCoupon(code);
      else { var r = Shop.applyCoupon(code, selLines().reduce(function (s, l) { return s + l.total; }, 0)); if (r.ok) Shop.toast(t('cp_ok', { name: code })); }
      Shop.ovl.close(n);
    });
    Shop.ovl.open(n, '[data-pick]:not([disabled]), a');
  }

  function findLine(key) { return Shop.cart.lines().filter(function (l) { return Shop.lineKey(l) === key; })[0]; }
  function onClick(e) {
    var b = e.target.closest('[data-act]'), l;
    if (b && b.tagName !== 'INPUT' || (b && b.type === 'checkbox')) {
      var act = b.getAttribute('data-act'), key = b.getAttribute('data-key');
      if (act === 'all') { Shop.sel.setAll(b.checked); return; }
      l = key && findLine(key); if (!l && act !== 'all') return;
      if (act === 'sel') Shop.sel.set(l, b.checked);
      else if (act === 'inc') Shop.cart.setQty(l.id, l.variant, l.qty + 1);
      else if (act === 'dec') Shop.cart.setQty(l.id, l.variant, l.qty - 1);
      else if (act === 'max') Shop.cart.setQty(l.id, l.variant, l.c.stock);
      else if (act === 'rm') { Shop.cart.remove(l.id, l.variant); Shop.toast(t('removed')); }
      else if (act === 'wish') { if (!Shop.wish.has(l.id)) Shop.wish.toggle(l.id); Shop.cart.remove(l.id, l.variant); Shop.toast(t('moved'), { href: 'account.html#wishlist', label: t('wishlist') }); }
      return;
    }
    if ((b = e.target.closest('[data-cp-rm]'))) { Shop.removeCoupon(b.getAttribute('data-cp-rm')); return; }
    if (e.target.closest('#cpWallet')) { openWallet(); return; }
    if (e.target.closest('#goCheckout, #goCheckout2')) { location.href = 'checkout.html'; }
  }

  Shop.renderPage(html, {
    active: 'cart',
    sbar: '<div class="sbar-in" id="cartBar"></div>',
    onReady: function (frame) {
      document.title = t('cart_title') + ' - ShopName';
      render();
      frame.addEventListener('click', onClick);
      frame.addEventListener('change', function (e) {
        var inp = e.target; if (inp.getAttribute('data-act') !== 'qty') return;
        var l = findLine(inp.getAttribute('data-key')); if (!l) return;
        var q = parseInt(inp.value, 10); Shop.cart.setQty(l.id, l.variant, isNaN(q) || q < 1 ? 1 : Math.min(q, 99));
      });
      frame.addEventListener('submit', function (e) {
        if (e.target.id !== 'cpForm') return;
        var inp = $('#cpIn'), err = $('#cpErr'), r = Shop.applyCoupon(inp.value, selLines().reduce(function (s, l) { return s + l.total; }, 0));
        if (r.ok) { Shop.toast(t('cp_ok', { name: r.code })); return; }
        err.hidden = false; err.setAttribute('data-i18n', r.err); err.textContent = t(r.err, r.vars); inp.setAttribute('aria-invalid', 'true'); inp.focus();
      });
      ['cart', 'sel', 'applied', 'wish'].forEach(function (n) { Shop.on(n, function () { setTimeout(render, 0); }); });
      Shop.on('lang', function () { setTimeout(render, 0); });
    }
  });
})();
