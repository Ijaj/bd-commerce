/* SR portal: login, home, new sale, my sales, memo, shops, add shop, collect due, performance. Mock data (window.SRD), in-memory state, hash routing. */
(function () {
  'use strict';
  var A = window.Admin, D = window.SRD, $ = A.$, esc = A.esc, bdt = A.fmt.bdt, I = A.icons;
  var ME = D.srById('sr1'), YM = '2026-10';
  var st = { in: false, filter: 'all', shopQ: '', shopTab: 'sales', perfYm: YM, hideInstall: false, memoLang: 'en', draft: blank() };
  st.in = true; /* mockup opens straight onto the dashboard; login is a viewable screen (#/login or Sign out) */
  function blank() { return { shop: null, items: [], delivery: 'sr', paid: '', note: '' }; }
  function mine() { return D.shops.filter(function (s) { return s.sr === ME.id; }); }
  function mySales() { return D.sales.filter(function (s) { return s.sr === ME.id; }); }
  function sale(id) { return D.sales.filter(function (s) { return s.id === id; })[0]; }
  function badge(t, k) { return '<span class="a-badge ' + k + '">' + esc(t) + '</span>'; }
  var STL = { submitted: ['Pending approval', 'warn'], approved: ['Approved', 'info'], delivered: ['Delivered', 'ok'], rejected: ['Rejected', 'danger'], cancelled: ['Cancelled', 'muted'] };
  function stBadge(s) { var x = STL[s.status]; return badge(s.status === 'approved' ? 'Approved, awaiting delivery' : x[0], x[1]); }
  function newBadge(s) { return s.isNew ? ' ' + badge('New', 'info') : ''; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function bar(p, cls) { return '<div class="sr-bar ' + (cls || '') + '"><i style="width:' + Math.min(100, p) + '%"></i></div>'; }
  function nowDays() { return 31 - 23; }

  /* ---------- login ---------- */
  function login() {
    var otp = false;
    function draw() {
      $('#app').innerHTML = '<div class="sr-login"><form class="sr-login-card sr-form" id="sr-form"><div class="sr-brand">Shop<b>Name</b><small>SR portal</small></div>' +
        '<div class="a-field" style="margin-top:20px"><label for="sr-ph">Mobile number</label><input id="sr-ph" inputmode="numeric" value="01712-345678" autocomplete="username"></div>' +
        (otp ? '<div class="a-field"><label for="sr-o">OTP (sent by SMS)</label><input id="sr-o" inputmode="numeric" maxlength="6" value="482913"></div>' : '<div class="a-field"><label for="sr-pw">Password</label><input id="sr-pw" type="password" value="demo1234" autocomplete="current-password"></div>') +
        '<div class="a-err" id="sr-err" hidden>Enter your mobile number and ' + (otp ? 'the OTP' : 'password') + '.</div>' +
        '<button class="a-btn primary" style="width:100%;justify-content:center;min-height:46px">Sign in</button>' +
        '<p style="text-align:center;margin:12px 0 0"><a href="#" id="sr-sw" style="font-size:12.5px">' + (otp ? 'Use password instead' : 'Sign in with OTP instead') + '</a></p>' +
        '<p class="a-hint" style="margin-top:14px;text-align:center">Demo: any value works (the portal opens on the dashboard without this screen). SR accounts are created by ShopName staff only.</p></form></div>';
      $('#sr-sw').onclick = function (e) { e.preventDefault(); otp = !otp; draw(); };
      $('#sr-form').onsubmit = function (e) {
        e.preventDefault(); if (!$('#sr-ph').value || !($('#sr-pw') || $('#sr-o')).value) { $('#sr-err').hidden = false; return; }
        st.in = true; location.hash = '#/home'; shell();
      };
    }
    draw();
  }

  /* ---------- shell ---------- */
  function shell() {
    $('#app').innerHTML = '<div class="sr-shell"><header class="sr-top"><div class="sr-brand">Shop<b>Name</b> <small style="display:inline;font-size:12px;opacity:.8;font-weight:600">SR</small></div><div class="sr-who"><span>' + esc(ME.name.split(' ')[0]) + '</span><button class="a-btn sm icon" id="sr-theme" aria-label="Toggle dark mode">◐</button><button class="a-btn sm" id="sr-out">Sign out</button></div></header><main class="sr-main" id="sr-main"></main><nav class="sr-tabbar" id="sr-tabs"></nav></div>';
    $('#sr-out').onclick = function () { st.in = false; location.hash = '#/login'; login(); };
    $('#sr-theme').onclick = function () { var d = document.documentElement.getAttribute('data-theme') !== 'dark'; if (A.setTheme) A.setTheme(d ? 'dark' : 'light'); else document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'); };
    $('#sr-main').addEventListener('click', onClick);
    route(true);
  }
  function tabbar(r) {
    var pend = mySales().filter(function (s) { return s.status === 'submitted'; }).length;
    var t = [['home', 'Home', I.home, '#/home'], ['sales', 'Sales', I.orders, '#/sales'], ['new-sale', 'New sale', I.plus, '#/new-sale', 'fab'], ['shops', 'Shops', I.customers, '#/shops'], ['perf', 'Me', I.user, '#/perf']];
    var on = { home: 'home', sales: 'sales', sale: 'sales', memo: 'sales', 'new-sale': 'new-sale', shops: 'shops', shop: 'shops', 'add-shop': 'shops', collect: 'shops', perf: 'perf' }[r] || 'home';
    $('#sr-tabs').innerHTML = t.map(function (x) {
      return '<a href="' + x[3] + '" class="' + (x[4] || '') + (x[0] === on ? ' on' : '') + '">' + (x[4] ? '<span class="c">' + x[2] + '</span>' : x[2]) + '<span>' + x[1] + '</span>' + (x[0] === 'sales' && pend ? '<b class="n">' + pend + '</b>' : '') + '</a>';
    }).join('');
  }

  /* ---------- router ---------- */
  function parse() { var h = (location.hash || '#/home').slice(2), q = {}, i = h.indexOf('?'); if (i >= 0) { h.slice(i + 1).split('&').forEach(function (p) { var kv = p.split('='); q[kv[0]] = decodeURIComponent(kv[1] || ''); }); h = h.slice(0, i); } var p = h.split('/'); return { r: p[0] || 'home', id: p[1], q: q }; }
  var VIEWS = { home: home, sales: salesList, sale: saleDetail, memo: memoView, 'new-sale': newSale, shops: shopsList, shop: shopDetail, 'add-shop': addShop, collect: collect, perf: perf };
  function route(top) {
    if (!st.in) return;
    var p = parse(), v = VIEWS[p.r] || home, m = $('#sr-main'); if (!m) return;
    m.innerHTML = v(p); tabbar(p.r); if (top) window.scrollTo(0, 0);
    var b = m.querySelector('[data-bind]'); if (b && binders[b.dataset.bind]) binders[b.dataset.bind](p);
  }
  window.addEventListener('hashchange', function () { if (parse().r === 'login') { st.in = false; login(); return; } if (!st.in) { st.in = true; shell(); return; } route(true); });
  function go(h) { if (location.hash === h) route(); else location.hash = h; }

  /* ---------- home ---------- */
  function home() {
    var ms = D.monthStats(ME.id, YM), pend = mySales().filter(function (s) { return s.status === 'submitted'; }), due = D.srDue(ME.id);
    var awaiting = D.collections.filter(function (c) { return c.sr === ME.id && c.status === 'pending'; });
    var rej = mySales().filter(function (s) { return s.status === 'rejected' && D.days(s.date, D.TODAY) <= 7; });
    var recent = mySales().slice(0, 3), p = pct(ms.sold, ms.target);
    return '<div data-bind="home"></div>' +
      (st.hideInstall ? '' : '<div class="sr-install">' + I.device + '<span><b>Install this app</b><br>Add to home screen for one-tap access.</span><button class="a-btn sm" data-act="install">Install</button></div>') +
      '<div class="sr-h"><h1>Hello, ' + esc(ME.name.split(' ')[0]) + '</h1><span class="sr-muted">' + D.fd(D.TODAY) + '</span></div>' +
      '<div class="sr-card"><h2>' + D.fm(YM) + ' target</h2><div class="sr-row"><div class="sr-big">' + bdt(ms.sold) + '</div><div class="sr-muted">of ' + bdt(ms.target) + '</div></div>' + bar(p) +
      '<div class="sr-row sr-muted"><span>' + p + '% of target sold</span><span>' + bdt(Math.max(0, ms.target - ms.sold)) + ' to go · ' + nowDays() + ' days left</span></div>' +
      '<hr style="border:0;border-top:1px solid var(--border);margin:12px 0"><div class="sr-row"><div><div class="sr-muted">Collected this month</div><b style="font-size:17px">' + bdt(ms.collected) + '</b></div><div style="text-align:right"><div class="sr-muted">Collection rate</div><b style="font-size:17px">' + pct(ms.collected, ms.sold) + '%</b></div></div>' + bar(pct(ms.collected, ms.sold), 'acc') + '</div>' +
      '<div class="sr-card"><h2>Commission earned so far</h2><div class="sr-big sr-ok">' + bdt(ms.commission) + '</div><div class="sr-muted" style="margin-top:4px">' + (ms.bp / 100) + '% of money collected (' + bdt(ms.atSale) + ' paid at sale + ' + bdt(ms.dueCol) + ' due collections).' + (awaiting.length ? ' ' + bdt(awaiting.reduce(function (a, c) { return a + c.amount; }, 0)) + ' awaiting staff confirm is not counted yet.' : '') + '</div></div>' +
      '<div class="sr-grid2"><a class="a-stat" href="#/sales" style="text-decoration:none;color:inherit"><div class="l">Pending approvals</div><div class="v">' + pend.length + '</div><div class="d ' + (pend.length ? 'down' : '') + '">stock reserved</div></a><a class="a-stat" href="#/shops" style="text-decoration:none;color:inherit"><div class="l">Dues on my shops</div><div class="v">' + bdt(due) + '</div><div class="d down">' + mine().filter(function (s) { return D.shopDue(s.id) > 0; }).length + ' shops owe</div></a></div>' +
      '<div class="sr-qa"><a href="#/new-sale">' + I.plus + 'New sale</a><a href="#/collect">' + I.wallet + 'Collect due</a><a href="#/add-shop">' + I.customers + 'Add shop</a></div>' +
      (rej.length ? rej.map(function (s) { return '<a class="sr-note danger" style="display:block;color:inherit;text-decoration:none" href="#/sale/' + s.id + '"><b>Rejected:</b> ' + esc(D.SBY[s.shop].name) + ', ' + bdt(s.total) + '. ' + esc(s.rejectReason || '') + '</a>'; }).join('') : '') +
      (awaiting.length ? '<div class="sr-note warn"><b>' + awaiting.length + ' collection' + (awaiting.length > 1 ? 's' : '') + ' awaiting staff confirm</b> (' + awaiting.map(function (c) { return esc(D.SBY[c.shop].name) + ' ' + bdt(c.amount); }).join(', ') + ')</div>' : '') +
      '<div class="sr-card" style="padding-bottom:6px"><div class="sr-row"><h2>Recent sales</h2><a href="#/sales" style="font-size:12.5px">See all</a></div><div class="sr-list">' + recent.map(saleItem).join('') + '</div></div>';
  }

  /* ---------- sales ---------- */
  function saleItem(s) {
    var sh = D.SBY[s.shop];
    return '<a class="sr-item" href="#/sale/' + s.id + '"><div class="t"><span>' + esc(sh.name) + '</span>' + stBadge(s) + '</div><div class="s"><span>' + D.fd(s.date) + (s.memo ? ' · ' + s.memo : '') + '</span><span><b>' + bdt(s.total) + '</b>' + (s.due > 0 && s.status !== 'rejected' ? ' · <span class="sr-due">due ' + bdt(s.due) + '</span>' : '') + '</span></div></a>';
  }
  function salesList() {
    var all = mySales(), f = st.filter;
    var chips = [['all', 'All'], ['submitted', 'Pending'], ['approved', 'Approved'], ['delivered', 'Delivered'], ['rejected', 'Rejected']];
    var list = all.filter(function (s) { return f === 'all' || s.status === f; });
    return '<div class="sr-h"><h1>My sales</h1><a class="a-btn sm primary" href="#/new-sale">' + I.plus + ' New</a></div><div class="sr-chips">' + chips.map(function (c) { var n = c[0] === 'all' ? all.length : all.filter(function (s) { return s.status === c[0]; }).length; return '<button data-filter="' + c[0] + '" aria-pressed="' + (f === c[0]) + '">' + c[1] + ' ' + n + '</button>'; }).join('') + '</div>' +
      '<div class="sr-list">' + (list.length ? list.slice(0, 40).map(saleItem).join('') : '<div class="sr-empty">No sales here yet.</div>') + '</div>';
  }
  function saleDetail(p) {
    var s = sale(p.id); if (!s) return '<div class="sr-empty">Sale not found.</div>';
    var sh = D.SBY[s.shop], lt = D.listTotal(s), steps, rej = s.status === 'rejected';
    steps = '<div class="sr-steps"><div class="done">Submitted<br>' + D.fd(s.date).slice(0, -5) + '</div><div class="' + (rej ? 'bad' : s.status === 'approved' || s.status === 'delivered' ? 'done' : '') + '">' + (rej ? 'Rejected' : 'Approved') + '</div><div class="' + (s.status === 'delivered' ? 'done' : '') + '">Delivered</div></div>';
    return '<a class="sr-back" href="#/sales">‹ My sales</a><div class="sr-h"><h1>' + esc(sh.name) + '</h1>' + stBadge(s) + '</div>' + steps +
      (s.status === 'submitted' ? '<div class="sr-note warn">Waiting for staff approval. Stock for these items is reserved for you in the meantime.</div>' : '') +
      (rej ? '<div class="sr-note danger"><b>Rejected by ' + esc(s.rejectedBy || 'staff') + ':</b> ' + esc(s.rejectReason || 'No reason given') + '</div>' : '') +
      (s.memo ? '<div class="sr-memobox"><div><div class="sr-muted">Memo number</div><b>' + s.memo + '</b></div><div style="display:flex;gap:6px"><a class="a-btn sm primary" href="#/memo/' + s.id + '">View memo</a><button class="a-btn sm" data-act="wa" data-id="' + s.id + '">Share on WhatsApp</button></div></div>' : '') +
      '<div class="sr-card"><h2>Items</h2><table class="sr-tbl"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>' + s.items.map(function (i) {
        var pr = D.PBY[i.sku], below = i.price < pr.list;
        return '<tr><td>' + pr.ic + ' ' + esc(pr.en) + '<div class="sr-muted">List ' + bdt(pr.list) + (below ? ' · <span class="sr-flag">' + Math.round((i.price / pr.list - 1) * 100) + '% below list</span>' : '') + '</div></td><td class="num">' + i.qty + '</td><td class="num">' + bdt(i.price) + '</td><td class="num">' + bdt(i.qty * i.price) + '</td></tr>'; }).join('') +
      '</tbody></table><div style="margin-top:10px"><div class="sr-row"><span>Total</span><b>' + bdt(s.total) + '</b></div><div class="sr-row sr-muted"><span>Our list total</span><span>' + bdt(lt) + '</span></div><div class="sr-row"><span>Collected at sale</span><b>' + bdt(s.paid) + '</b></div><div class="sr-row"><span>Due (baki)</span><b class="' + (s.due > 0 ? 'sr-due' : 'sr-ok') + '">' + bdt(s.due) + '</b></div></div></div>' +
      '<div class="sr-card"><h2>Details</h2><dl class="a-kv"><dt>Shop</dt><dd><a href="#/shop/' + sh.id + '">' + esc(sh.name) + '</a>' + newBadge(sh) + '</dd><dt>Delivery</dt><dd>' + (s.delivery === 'sr' ? 'I deliver (SR)' : 'ShopName staff from warehouse') + (s.deliveredOn ? '<br><span class="sr-muted">Delivered ' + D.fd(s.deliveredOn) + ' by ' + esc(s.deliveredBy === 'SR' ? ME.name : s.deliveredBy || '') + '</span>' : '') + '</dd>' + (s.approvedBy ? '<dt>Approved by</dt><dd>' + esc(s.approvedBy) + ', ' + D.fd(s.approvedOn) + '</dd>' : '') + (s.note ? '<dt>Note</dt><dd>' + esc(s.note) + '</dd>' : '') + '</dl></div>' +
      (s.status === 'approved' ? '<button class="a-btn primary" style="width:100%;justify-content:center;min-height:46px" data-act="deliver" data-id="' + s.id + '">' + (s.delivery === 'sr' ? 'Mark as delivered' : 'Mark delivered (staff delivered)') + '</button>' : '') +
      (rej ? '<button class="a-btn primary" style="width:100%;justify-content:center;min-height:46px" data-act="resubmit" data-id="' + s.id + '">Edit and resubmit</button>' : '') +
      (s.status === 'submitted' ? '<button class="a-btn danger" style="width:100%;justify-content:center;min-height:44px" data-act="cancel" data-id="' + s.id + '">Cancel this request</button>' : '');
  }

  /* ---------- memo ---------- */
  var BN_D = '০১২৩৪৫৬৭৮৯', BN_M = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  function bnd(x) { return String(x).replace(/\d/g, function (d) { return BN_D[d]; }); }
  var L = {
    en: { memo: 'Sales memo / Invoice', no: 'Memo no.', date: 'Date', buyer: 'Buyer', seller: 'Seller', owner: 'Proprietor', phone: 'Phone', addr: 'Address', sl: '#', item: 'Item', qty: 'Qty', rate: 'Rate', amt: 'Amount', total: 'Total', paid: 'Paid', due: 'Due (baki)', sr: 'Sales rep', deliv: 'Delivery', dsr: 'Delivered by SR', dst: 'Delivered by ShopName staff', sb: 'Buyer signature', ss: 'Authorised signature', thanks: 'Thank you for your business. Goods once sold are not returnable without a memo.' },
    bn: { memo: 'বিক্রয় মেমো / চালান', no: 'মেমো নং', date: 'তারিখ', buyer: 'ক্রেতা', seller: 'বিক্রেতা', owner: 'স্বত্বাধিকারী', phone: 'ফোন', addr: 'ঠিকানা', sl: 'নং', item: 'পণ্য', qty: 'পরিমাণ', rate: 'দর', amt: 'টাকা', total: 'মোট', paid: 'পরিশোধ', due: 'বাকি', sr: 'বিক্রয় প্রতিনিধি', deliv: 'ডেলিভারি', dsr: 'এসআর ডেলিভারি দেবেন', dst: 'ShopName কর্মী ডেলিভারি দেবেন', sb: 'ক্রেতার স্বাক্ষর', ss: 'কর্তৃপক্ষের স্বাক্ষর', thanks: 'আপনার সাথে ব্যবসা করতে পেরে আনন্দিত। মেমো ছাড়া বিক্রিত পণ্য ফেরত নেওয়া হবে না।' }
  };
  function memoView(p) {
    var s = sale(p.id); if (!s || !s.memo) return '<div class="sr-empty">Memo is created after staff approve the sale.</div>';
    var bn = st.memoLang === 'bn', T = L[st.memoLang], sh = D.SBY[s.shop], C = D.settings.memoCompany;
    function n(x) { return bn ? bnd(x) : x; }
    function money(x) { return n(bdt(x)); }
    var dp = s.date.split('-'), dateStr = bn ? bnd(+dp[2]) + ' ' + BN_M[dp[1] - 1] + ' ' + bnd(dp[0]) : D.fd(s.date);
    return '<a class="sr-back" href="#/sale/' + s.id + '">‹ Sale detail</a><div class="sr-memo-tools"><div class="sr-lang" role="group" aria-label="Language"><button data-lang="en" aria-pressed="' + !bn + '">EN</button><button data-lang="bn" aria-pressed="' + bn + '">বাংলা</button></div><span style="flex:1"></span><button class="a-btn sm" data-act="print">Print / PDF</button><button class="a-btn sm primary" data-act="wa" data-id="' + s.id + '">Share on WhatsApp</button></div>' +
      '<article class="sr-memo' + (bn ? ' bn' : '') + '"><div class="hd"><div><h3>' + esc(C.name) + '</h3><div>' + esc(C.addr) + '</div><div>' + T.phone + ': ' + n(C.phone) + ' · ' + n(C.bin) + '</div></div><div><div class="ttl">' + T.memo + '</div><div class="num" style="text-align:right"><b>' + T.no + ': ' + n(s.memo) + '</b></div><div style="text-align:right">' + T.date + ': ' + dateStr + '</div></div></div>' +
      '<div class="meta"><div><h4>' + T.buyer + '</h4><b>' + esc(sh.name) + '</b><div>' + T.owner + ': ' + esc(sh.owner) + '</div><div>' + T.phone + ': ' + n(sh.phone) + '</div><div>' + esc(sh.addr) + ', ' + esc(sh.area) + '</div></div><div><h4>' + T.sr + '</h4><b>' + esc(ME.name) + '</b><div>' + T.phone + ': ' + n(ME.phone) + '</div><h4 style="margin-top:6px">' + T.deliv + '</h4><div>' + (s.delivery === 'sr' ? T.dsr : T.dst) + '</div></div></div>' +
      '<table><thead><tr><th>' + T.sl + '</th><th>' + T.item + '</th><th class="num">' + T.qty + '</th><th class="num">' + T.rate + '</th><th class="num">' + T.amt + '</th></tr></thead><tbody>' + s.items.map(function (i, k) { var pr = D.PBY[i.sku]; return '<tr><td>' + n(k + 1) + '</td><td>' + esc(bn ? pr.bn : pr.en) + '</td><td class="num">' + n(i.qty) + '</td><td class="num">' + money(i.price) + '</td><td class="num">' + money(i.qty * i.price) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="tot"><div><span>' + T.total + '</span><b>' + money(s.total) + '</b></div><div><span>' + T.paid + '</span><span>' + money(s.paid) + '</span></div><div class="due"><span>' + T.due + '</span><span>' + money(s.due) + '</span></div></div>' +
      '<div class="sig"><div>' + T.sb + '</div><div>' + T.ss + '</div></div><div class="ft">' + T.thanks + '</div></article>';
  }

  /* ---------- new sale ---------- */
  function calc() { var d = st.draft, t = d.items.reduce(function (a, i) { return a + (+i.qty || 0) * (+i.price || 0); }, 0), lt = d.items.reduce(function (a, i) { return a + (+i.qty || 0) * D.PBY[i.sku].list; }, 0), paid = Math.max(0, +d.paid || 0); return { t: t, lt: lt, paid: paid, due: t - paid }; }
  function lineHtml(i, k) {
    var pr = D.PBY[i.sku], below = +i.price < pr.list;
    return '<div class="sr-line" data-line="' + k + '"><div class="top"><div><b>' + pr.ic + ' ' + esc(pr.en) + '</b><div class="sr-muted">Our list price ' + bdt(pr.list) + '</div></div><button type="button" class="a-btn sm ghost" data-act="rm" data-k="' + k + '" aria-label="Remove">' + I.x + '</button></div><div class="f"><div><label>Qty</label><input type="number" inputmode="numeric" min="1" value="' + i.qty + '" data-f="qty" data-k="' + k + '"></div><div><label>Your price (৳)</label><input type="number" inputmode="numeric" min="0" value="' + i.price + '" data-f="price" data-k="' + k + '"></div></div><div class="sr-row" style="margin-top:6px"><span class="sr-flag" data-flag="' + k + '">' + (below ? Math.round((i.price / pr.list - 1) * 100) + '% below list' : '') + '</span><b data-lt="' + k + '">' + bdt((+i.qty || 0) * (+i.price || 0)) + '</b></div></div>';
  }
  function newSale(p) {
    var d = st.draft;
    if (p.q.shop && D.SBY[p.q.shop] && !d.shop) d.shop = p.q.shop;
    var c = calc();
    return '<div data-bind="newsale"></div><div class="sr-h"><h1>New sale</h1></div><form class="sr-form" id="ns" novalidate>' +
      '<div class="a-field"><label>Buyer shop</label><div id="ns-shop">' + shopBox() + '</div></div>' +
      '<div class="a-field"><label>Items</label><div id="ns-lines">' + (d.items.length ? d.items.map(lineHtml).join('') : '<div class="sr-empty" style="padding:16px">No items yet. Tap Add item below.</div>') + '</div>' +
      '<button type="button" class="a-btn" data-act="add-open" style="width:100%;justify-content:center;min-height:44px;margin-top:4px">' + I.plus + ' Add item</button><div id="ns-add" hidden><input id="ns-ps" type="search" placeholder="Search product (name or SKU)" autocomplete="off" style="width:100%;margin-top:8px"><div id="ns-pr"></div></div></div>' +
      '<div class="a-field"><label>Delivery (R19)</label><div class="sr-radio"><label><input type="radio" name="dl" value="sr"' + (d.delivery === 'sr' ? ' checked' : '') + '><span><b>I deliver</b><br><span class="sr-muted">I take stock and drop it</span></span></label><label><input type="radio" name="dl" value="staff"' + (d.delivery === 'staff' ? ' checked' : '') + '><span><b>ShopName staff</b><br><span class="sr-muted">Delivered from warehouse</span></span></label></div></div>' +
      '<div class="a-field"><label for="ns-paid">Amount collected now (৳)</label><input id="ns-paid" type="number" inputmode="numeric" min="0" placeholder="0" value="' + esc(d.paid) + '"><div class="sr-row" style="margin-top:6px"><button type="button" class="a-btn sm" data-act="paid-full">Full amount</button><button type="button" class="a-btn sm" data-act="paid-none">Nothing (all baki)</button></div></div>' +
      '<div class="a-field"><label for="ns-note">Note for approver (optional)</label><textarea id="ns-note" placeholder="e.g. regular buyer, matched competitor price">' + esc(d.note) + '</textarea></div>' +
      '<div class="sr-sum"><div class="r"><span>Total</span><b id="ns-t">' + bdt(c.t) + '</b></div><div class="r sr-muted"><span>Our list total</span><span id="ns-lt">' + bdt(c.lt) + '</span></div><div class="r"><span>Collected now</span><span id="ns-p">' + bdt(c.paid) + '</span></div><div class="r t"><span>Due (baki)</span><span id="ns-d" class="' + (c.due > 0 ? 'sr-due' : 'sr-ok') + '">' + bdt(Math.max(0, c.due)) + '</span></div></div>' +
      '<button class="a-btn primary" style="width:100%;justify-content:center;min-height:48px">Submit for approval</button><p class="a-hint" style="text-align:center;margin-top:8px">Status becomes "Pending approval". Stock is reserved until staff approve or reject.</p></form>';
  }
  function shopBox() {
    var d = st.draft, sh = d.shop && D.SBY[d.shop];
    if (sh) return '<div class="sr-chosen"><div><b>' + esc(sh.name) + '</b>' + newBadge(sh) + '<div class="sr-muted">' + esc(sh.area) + (D.shopDue(sh.id) ? ' · current due <span class="sr-due">' + bdt(D.shopDue(sh.id)) + '</span>' : '') + '</div></div><button type="button" class="a-btn sm" data-act="shop-clear">Change</button></div>';
    return '<input id="ns-q" type="search" placeholder="Search my shops (name, owner, area)" autocomplete="off" style="width:100%"><div id="ns-sr"></div><a class="a-btn sm" style="margin-top:8px" href="#/add-shop?return=new-sale">' + I.plus + ' Add new shop</a>';
  }
  function updTotals() {
    var c = calc(), d = st.draft; $('#ns-t').textContent = bdt(c.t); $('#ns-lt').textContent = bdt(c.lt); $('#ns-p').textContent = bdt(c.paid);
    var e = $('#ns-d'); e.textContent = bdt(Math.max(0, c.due)); e.className = c.due > 0 ? 'sr-due' : 'sr-ok';
    d.items.forEach(function (i, k) { var pr = D.PBY[i.sku], f = $('[data-flag="' + k + '"]'), l = $('[data-lt="' + k + '"]'); if (f) f.textContent = +i.price < pr.list ? Math.round((i.price / pr.list - 1) * 100) + '% below list' : ''; if (l) l.textContent = bdt((+i.qty || 0) * (+i.price || 0)); });
  }
  function redrawLines() { var d = st.draft; $('#ns-lines').innerHTML = d.items.length ? d.items.map(lineHtml).join('') : '<div class="sr-empty" style="padding:16px">No items yet. Tap Add item below.</div>'; updTotals(); }
  function sub(el, fn) { el.addEventListener('input', fn); }

  /* ---------- shops ---------- */
  function shopsList() {
    var q = st.shopQ.toLowerCase(), list = mine().filter(function (s) { return !q || (s.name + s.owner + s.area + s.phone).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return D.shopDue(b.id) - D.shopDue(a.id); });
    return '<div data-bind="shops"></div><div class="sr-h"><h1>My shops</h1><a class="a-btn sm primary" href="#/add-shop">' + I.plus + ' Add shop</a></div><input id="sh-q" type="search" placeholder="Search shops" value="' + esc(st.shopQ) + '" style="width:100%;min-height:44px;font-size:16px;margin-bottom:10px"><div class="sr-muted" style="margin-bottom:8px">' + list.length + ' shops · total due <span class="sr-due">' + bdt(D.srDue(ME.id)) + '</span></div><div class="sr-list" id="sh-list">' + shopRows(list) + '</div>';
  }
  function shopRows(list) {
    return list.length ? list.map(function (s) { var d = D.shopDue(s.id); return '<a class="sr-item" href="#/shop/' + s.id + '"><div class="t"><span>' + esc(s.name) + newBadge(s) + '</span><span class="' + (d ? 'sr-due' : 'sr-ok') + '">' + (d ? bdt(d) : 'Clear') + '</span></div><div class="s"><span>' + esc(s.owner) + ' · ' + esc(s.area) + '</span><span>' + esc(s.phone) + '</span></div></a>'; }).join('') : '<div class="sr-empty">No shop matches.</div>';
  }
  function shopDetail(p) {
    var s = D.SBY[p.id]; if (!s || s.sr !== ME.id) return '<div class="sr-empty">Shop not found.</div>';
    var due = D.shopDue(s.id), ss = D.sales.filter(function (x) { return x.shop === s.id; }), live = ss.filter(D.isLive), tot = live.reduce(function (a, x) { return a + x.total; }, 0);
    var body;
    if (st.shopTab === 'sales') body = ss.length ? '<div class="sr-list">' + ss.map(saleItem).join('') + '</div>' : '<div class="sr-empty">No sales yet.</div>';
    else {
      var rows = D.ledger(s.id);
      body = rows.length ? '<div class="sr-card" style="padding:6px 8px"><table class="sr-tbl"><thead><tr><th>Date</th><th>Entry</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead><tbody>' + rows.map(function (r) {
        return '<tr' + (r.pending ? ' class="mute"' : '') + '><td>' + D.fd(r.date).slice(0, -5) + '</td><td>' + r.type + (r.type === 'Sale due' ? '<div class="sr-muted">' + r.ref + '</div>' : '<div class="sr-muted">' + esc(r.ref) + (r.pending ? ' · awaiting staff confirm' : '') + '</div>') + '</td><td class="num">' + (r.pending ? '(' + bdt(r.pending) + ')' : r.amt > 0 ? '+' + bdt(r.amt) : '−' + bdt(-r.amt)) + '</td><td class="num"><b>' + (r.pending ? '' : bdt(r.bal)) + '</b></td></tr>'; }).join('') + '</tbody></table></div><p class="a-hint">Bracketed amounts are your collections still waiting for staff to confirm; they do not reduce the balance yet.</p>' : '<div class="sr-empty">No ledger entries.</div>';
    }
    return '<div data-bind="shop"></div><a class="sr-back" href="#/shops">‹ My shops</a><div class="sr-h"><h1>' + esc(s.name) + newBadge(s) + '</h1></div>' +
      (s.isNew ? '<div class="sr-note">You added this shop on ' + D.fd(s.since) + '. You can sell to it right away; staff will review the details.</div>' : '') +
      '<div class="sr-card"><dl class="a-kv"><dt>Owner</dt><dd>' + esc(s.owner) + '</dd><dt>Phone</dt><dd><a href="tel:' + esc(s.phone.replace('-', '')) + '">' + esc(s.phone) + '</a></dd><dt>Address</dt><dd>' + esc(s.addr) + '<br>' + esc(s.area) + '</dd><dt>Customer since</dt><dd>' + D.fd(s.since) + '</dd></dl>' +
      '<div class="sr-grid2" style="margin:12px 0 0"><div class="a-stat"><div class="l">Current due</div><div class="v ' + (due ? 'sr-due' : '') + '">' + bdt(due) + '</div></div><div class="a-stat"><div class="l">Total bought</div><div class="v">' + bdt(tot) + '</div></div></div></div>' +
      '<div class="sr-qa" style="grid-template-columns:1fr 1fr"><a href="#/new-sale?shop=' + s.id + '">' + I.plus + 'New sale</a><a href="#/collect?shop=' + s.id + '">' + I.wallet + 'Collect due</a></div>' +
      '<div class="sr-tabs"><button data-stab="sales" aria-selected="' + (st.shopTab === 'sales') + '">Sales (' + ss.length + ')</button><button data-stab="ledger" aria-selected="' + (st.shopTab === 'ledger') + '">Due ledger</button></div>' + body;
  }

  /* ---------- add shop ---------- */
  function addShop(p) {
    var areas = ['Mirpur, Dhaka', 'Mohammadpur, Dhaka', 'Dhanmondi, Dhaka', 'Shyamoli, Dhaka', 'Uttara, Dhaka', 'Kallyanpur, Dhaka'];
    return '<div data-bind="addshop"></div><a class="sr-back" href="' + (p.q.return ? '#/new-sale' : '#/shops') + '">‹ Back</a><div class="sr-h"><h1>Add new shop</h1></div><div class="sr-note">New shops can be used for sales immediately. Staff see a "New" flag and review the details.</div>' +
      '<form class="sr-form" id="as" novalidate><div class="a-field"><label for="as-n">Shop name *</label><input id="as-n" placeholder="e.g. Rahman General Store"></div><div class="a-field"><label for="as-o">Owner name *</label><input id="as-o" placeholder="e.g. Abdur Rahman"></div><div class="a-field"><label for="as-p">Phone *</label><input id="as-p" inputmode="tel" placeholder="01XXXXXXXXX" maxlength="14"><div class="a-err" id="as-pe" hidden>Enter an 11-digit mobile number starting 01.</div></div><div class="a-field"><label for="as-a">Address *</label><textarea id="as-a" placeholder="House/shop no, road, market"></textarea></div><div class="a-field"><label for="as-r">Area *</label><input id="as-r" list="as-al" placeholder="e.g. Mirpur, Dhaka"><datalist id="as-al">' + areas.map(function (a) { return '<option value="' + a + '">'; }).join('') + '</datalist></div><button class="a-btn primary" style="width:100%;justify-content:center;min-height:48px">Save shop</button></form>';
  }

  /* ---------- collect due ---------- */
  function collect(p) {
    var withDue = mine().filter(function (s) { return D.shopDue(s.id) > 0; }).sort(function (a, b) { return D.shopDue(b.id) - D.shopDue(a.id); });
    var sel = p.q.shop || (withDue[0] && withDue[0].id), mc = D.collections.filter(function (c) { return c.sr === ME.id; }).slice(0, 6);
    return '<div data-bind="collect"></div><div class="sr-h"><h1>Record due collection</h1></div><div class="sr-note">Money you collected from a shop against its baki. Staff must confirm it before the shop due drops and before it counts towards your commission (R18).</div>' +
      '<form class="sr-form" id="cl" novalidate><div class="a-field"><label for="cl-s">Shop</label><select id="cl-s">' + withDue.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + ' (due ' + bdt(D.shopDue(s.id)) + ')</option>'; }).join('') + '</select></div>' +
      '<div class="a-field"><label for="cl-a">Amount collected (৳)</label><input id="cl-a" type="number" inputmode="numeric" min="1" placeholder="0"><div class="a-hint" id="cl-h"></div></div>' +
      '<div class="a-field"><label for="cl-m">Method</label><select id="cl-m"><option>Cash</option><option>bKash</option><option>Nagad</option><option>Bank transfer</option><option>Other</option></select></div><div class="a-field"><label for="cl-n">Note / reference</label><input id="cl-n" placeholder="e.g. bKash TrxID, signed receipt"></div>' +
      '<button class="a-btn primary" style="width:100%;justify-content:center;min-height:48px">Submit collection</button></form>' +
      '<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:20px 0 8px">My recent collections</h2><div id="cl-list">' + collList(mc) + '</div>';
  }
  function collList(mc) { return mc.length ? mc.map(function (c) { return '<div class="sr-item"><div class="t"><span>' + esc(D.SBY[c.shop].name) + '</span><b>' + bdt(c.amount) + '</b></div><div class="s"><span>' + D.fd(c.date) + ' · ' + esc(c.method) + '</span>' + (c.status === 'pending' ? badge('Awaiting staff confirm', 'warn') : badge('Confirmed', 'ok')) + '</div></div>'; }).join('') : '<div class="sr-empty">Nothing recorded yet.</div>'; }

  /* ---------- performance ---------- */
  function perf() {
    var ym = st.perfYm, ms = D.monthStats(ME.id, ym), p = pct(ms.sold, ms.target), cs = D.commStatus[ym];
    var csT = { paid: 'Paid', approved: 'Approved, will be paid with salary', pending: 'Accruing; final after month end' }[cs];
    return '<div class="sr-h"><h1>My performance</h1></div><div class="sr-chips">' + D.MONTHS.slice().reverse().map(function (m) { return '<button data-ym="' + m + '" aria-pressed="' + (m === ym) + '">' + D.fm(m) + '</button>'; }).join('') + '</div>' +
      '<div class="sr-card"><h2>Target</h2><div class="sr-row"><div class="sr-big">' + p + '%</div><div class="sr-muted">' + bdt(ms.sold) + ' of ' + bdt(ms.target) + '</div></div>' + bar(p, p >= 100 ? 'ok' : '') + '<div class="sr-muted">' + ms.orders + ' approved sales' + (ms.target > ms.sold ? ' · ' + bdt(ms.target - ms.sold) + ' short' : ' · target reached') + '</div></div>' +
      '<div class="sr-grid2"><div class="a-stat"><div class="l">Sold</div><div class="v">' + bdt(ms.sold) + '</div></div><div class="a-stat"><div class="l">Collected</div><div class="v">' + bdt(ms.collected) + '</div><div class="d">' + pct(ms.collected, ms.sold) + '% of sold</div></div></div>' +
      '<div class="sr-card"><h2>Commission breakdown</h2><table class="sr-tbl"><tbody><tr><td>Paid at sale</td><td class="num">' + bdt(ms.atSale) + '</td></tr><tr><td>Due collections (staff confirmed)</td><td class="num">' + bdt(ms.dueCol) + '</td></tr><tr><td><b>Money collected (base)</b></td><td class="num"><b>' + bdt(ms.collected) + '</b></td></tr><tr><td>Your rate</td><td class="num">× ' + ms.bp / 100 + '%</td></tr><tr><td><b>Commission</b></td><td class="num sr-ok"><b>' + bdt(ms.commission) + '</b></td></tr></tbody></table><div style="margin-top:8px">' + badge(csT, cs === 'paid' ? 'ok' : cs === 'approved' ? 'info' : 'warn') + '</div><p class="a-hint">Commission is a % of money actually collected in the month, not of sales on credit (Q120).</p></div>' +
      '<div class="sr-card" style="padding:8px"><h2 style="padding:6px 6px 0">By month</h2><table class="sr-tbl"><thead><tr><th>Month</th><th class="num">Sold / target</th><th class="num">Commission</th></tr></thead><tbody>' + D.MONTHS.slice().reverse().map(function (m) { var x = D.monthStats(ME.id, m); return '<tr><td>' + D.fm(m).split(' ')[0] + '<div class="sr-muted">' + D.commStatus[m] + '</div></td><td class="num">' + bdt(x.sold) + '<div class="sr-muted">of ' + bdt(x.target) + ' (' + pct(x.sold, x.target) + '%)</div></td><td class="num">' + bdt(x.commission) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="sr-card"><h2>Account</h2><dl class="a-kv"><dt>Name</dt><dd>' + esc(ME.name) + '</dd><dt>Phone</dt><dd>' + esc(ME.phone) + '</dd><dt>Area</dt><dd>' + esc(ME.area) + '</dd></dl></div>';
  }

  /* ---------- binders (after render) ---------- */
  var binders = {
    newsale: function () {
      var d = st.draft, f = $('#ns');
      sub($('#ns-paid'), function (e) { d.paid = e.target.value; updTotals(); });
      sub($('#ns-note'), function (e) { d.note = e.target.value; });
      f.addEventListener('change', function (e) { if (e.target.name === 'dl') d.delivery = e.target.value; });
      f.addEventListener('input', function (e) { var t = e.target; if (t.dataset.f) { d.items[+t.dataset.k][t.dataset.f] = t.value === '' ? '' : +t.value; updTotals(); } });
      var ps = $('#ns-ps');
      sub(ps, function () {
        var q = ps.value.toLowerCase().trim(), r = D.products.filter(function (x) { return !q || (x.en + x.sku + x.bn).toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
        $('#ns-pr').innerHTML = q ? '<div class="sr-pick">' + r.map(function (x) { return '<button type="button" data-add="' + x.sku + '"><span>' + x.ic + ' ' + esc(x.en) + '</span><span class="sr-muted">list ' + bdt(x.list) + '</span></button>'; }).join('') + '</div>' : '';
      });
      bindShopSearch();
      f.onsubmit = function (e) {
        e.preventDefault(); var c = calc();
        if (!d.shop) { A.toast('Pick the buyer shop first', 'warn'); return; }
        if (!d.items.length) { A.toast('Add at least one item', 'warn'); return; }
        if (d.items.some(function (i) { return !(+i.qty > 0) || !(+i.price > 0); })) { A.toast('Every item needs a quantity and a price', 'warn'); return; }
        if (c.paid > c.t) { A.toast('Collected amount is more than the total', 'warn'); return; }
        var ns = { id: D.nextId(), sr: ME.id, shop: d.shop, date: D.TODAY, status: 'submitted', delivery: d.delivery, note: d.note, items: d.items.map(function (i) { return { sku: i.sku, qty: +i.qty, price: +i.price }; }), paid: c.paid };
        ns.total = c.t; ns.due = c.t - c.paid; D.sales.unshift(ns); st.draft = blank(); st.filter = 'all';
        A.toast('Submitted. Status: Pending approval, stock reserved', 'ok'); go('#/sale/' + ns.id);
      };
    },
    shops: function () { var q = $('#sh-q'); sub(q, function () { st.shopQ = q.value; var l = mine().filter(function (s) { return !q.value || (s.name + s.owner + s.area + s.phone).toLowerCase().indexOf(q.value.toLowerCase()) >= 0; }).sort(function (a, b) { return D.shopDue(b.id) - D.shopDue(a.id); }); $('#sh-list').innerHTML = shopRows(l); }); },
    shop: function () {},
    addshop: function (p) {
      $('#as').onsubmit = function (e) {
        e.preventDefault(); var n = $('#as-n').value.trim(), o = $('#as-o').value.trim(), ph = $('#as-p').value.replace(/[\s-]/g, ''), a = $('#as-a').value.trim(), r = $('#as-r').value.trim();
        $('#as-pe').hidden = /^01\d{9}$/.test(ph);
        if (!n || !o || !a || !r) { A.toast('Fill in all fields', 'warn'); return; } if (!/^01\d{9}$/.test(ph)) return;
        var id = 'b' + (20 + D.shops.length), sh = { id: id, name: n, owner: o, phone: ph.slice(0, 5) + '-' + ph.slice(5), addr: a, area: r, sr: ME.id, since: D.TODAY, isNew: true };
        D.shops.push(sh); D.SBY[id] = sh; A.toast('Shop added, flagged New for staff review', 'ok');
        if (p.q.return) { st.draft.shop = id; go('#/new-sale'); } else go('#/shop/' + id);
      };
    },
    collect: function () {
      var s = $('#cl-s'), a = $('#cl-a'), h = $('#cl-h');
      function hint() { if (!s || !s.value) return; var d = D.shopDue(s.value), pend = D.collections.filter(function (c) { return c.shop === s.value && c.status === 'pending'; }).reduce(function (x, c) { return x + c.amount; }, 0); h.textContent = 'Current due ' + bdt(d) + (pend ? ' (' + bdt(pend) + ' already awaiting confirm)' : ''); a.max = d; }
      if (s) { s.onchange = hint; hint(); }
      $('#cl').onsubmit = function (e) {
        e.preventDefault(); if (!s || !s.value) { A.toast('No shop has any due', 'warn'); return; } var v = +a.value, due = D.shopDue(s.value);
        if (!(v > 0)) { A.toast('Enter the amount collected', 'warn'); return; } if (v > due) { A.toast('Amount is more than the shop due (' + bdt(due) + ')', 'warn'); return; }
        D.collections.unshift({ id: 'C' + Date.now(), shop: s.value, sr: ME.id, date: D.TODAY, amount: v, method: $('#cl-m').value, note: $('#cl-n').value, status: 'pending' });
        A.toast('Submitted. Awaiting staff confirm', 'ok'); a.value = ''; $('#cl-n').value = ''; $('#cl-list').innerHTML = collList(D.collections.filter(function (c) { return c.sr === ME.id; }).slice(0, 6)); hint();
      };
    }
  };
  function bindShopSearch() {
    var q = $('#ns-q'); if (!q) return;
    sub(q, function () {
      var v = q.value.toLowerCase().trim(), r = mine().filter(function (s) { return !v || (s.name + s.owner + s.area).toLowerCase().indexOf(v) >= 0; }).slice(0, 6);
      $('#ns-sr').innerHTML = '<div class="sr-pick">' + (r.length ? r.map(function (s) { return '<button type="button" data-shop="' + s.id + '"><span><b>' + esc(s.name) + '</b>' + newBadge(s) + '<br><span class="sr-muted">' + esc(s.area) + '</span></span><span class="' + (D.shopDue(s.id) ? 'sr-due' : 'sr-muted') + '">' + (D.shopDue(s.id) ? 'due ' + bdt(D.shopDue(s.id)) : '') + '</span></button>'; }).join('') : '<div class="sr-muted" style="padding:10px">No shop found. Use "Add new shop".</div>') + '</div>';
    });
  }

  /* ---------- clicks ---------- */
  function onClick(e) {
    var t = e.target.closest('button'); if (!t) return; var d = st.draft;
    if (t.dataset.filter) { st.filter = t.dataset.filter; return route(); }
    if (t.dataset.stab) { st.shopTab = t.dataset.stab; return route(); }
    if (t.dataset.ym) { st.perfYm = t.dataset.ym; return route(); }
    if (t.dataset.lang) { st.memoLang = t.dataset.lang; return route(); }
    if (t.dataset.shop) { d.shop = t.dataset.shop; $('#ns-shop').innerHTML = shopBox(); return; }
    if (t.dataset.add) { var pr = D.PBY[t.dataset.add]; if (d.items.some(function (i) { return i.sku === pr.sku; })) { A.toast('Already added', 'info'); return; } d.items.push({ sku: pr.sku, qty: 12, price: pr.list }); $('#ns-ps').value = ''; $('#ns-pr').innerHTML = ''; $('#ns-add').hidden = true; return redrawLines(); }
    var a = t.dataset.act, s = t.dataset.id && sale(t.dataset.id); if (!a) return;
    if (a === 'add-open') { var box = $('#ns-add'); box.hidden = !box.hidden; if (!box.hidden) $('#ns-ps').focus(); }
    else if (a === 'rm') { d.items.splice(+t.dataset.k, 1); redrawLines(); }
    else if (a === 'shop-clear') { d.shop = null; $('#ns-shop').innerHTML = shopBox(); bindShopSearch(); }
    else if (a === 'paid-full') { d.paid = String(calc().t); $('#ns-paid').value = d.paid; updTotals(); }
    else if (a === 'paid-none') { d.paid = '0'; $('#ns-paid').value = '0'; updTotals(); }
    else if (a === 'install') { st.hideInstall = true; A.toast('Installed to home screen (mock)', 'ok'); route(); }
    else if (a === 'wa') A.toast('Memo ' + s.memo + ' shared to ' + D.SBY[s.shop].owner + ' on WhatsApp (mock)', 'ok');
    else if (a === 'print') window.print();
    else if (a === 'deliver') { s.status = 'delivered'; s.deliveredOn = D.TODAY; s.deliveredBy = s.delivery === 'sr' ? 'SR' : 'Warehouse team'; A.toast('Marked delivered', 'ok'); route(); }
    else if (a === 'cancel') { s.status = 'cancelled'; A.toast('Request cancelled, reserved stock released', 'warn'); route(); }
    else if (a === 'resubmit') { st.draft = { shop: s.shop, items: s.items.map(function (i) { return { sku: i.sku, qty: i.qty, price: i.price }; }), delivery: s.delivery, paid: '', note: '' }; go('#/new-sale'); }
  }

  if (parse().r === 'login') { st.in = false; login(); } else shell();
})();
