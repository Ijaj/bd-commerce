/* Affiliate self-service portal (agent E): login/apply, dashboard, link generator, payouts, payout details. Mock data. */
(function () {
  'use strict';
  var A = window.Admin, $ = A.$, esc = A.esc, bdt = A.fmt.bdt, num = A.fmt.num;
  var NOW = new Date(2026, 9, 23), DAY = 86400000, WINDOW = 7;
  var AF = { name: 'Moni\'s Style Diary', person: 'Monira Akter', email: 'moni@example.com', code: 'MONI11', rate: 5, site: 'https://shopname.example' };
  var payout = { method: 'bkash', bkash: '01712345566', holder: 'Monira Akter', bank: '', branch: '', acc: '', accName: '' };
  var st = { view: 'auth', authTab: 'login', tab: 'dash', applied: false };
  try { if (sessionStorage.getItem('af.in') === '1') st.view = 'app'; } catch (e) { /* ignore */ }
  function hash(n, s) { var x = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); }
  function badge(t, k) { return '<span class="a-badge ' + k + '">' + esc(t) + '</span>'; }

  /* data: 30 days of clicks/orders, conversions list */
  var clicks = [], orders = [], ordList = [];
  for (var i = 29; i >= 0; i--) { var c = Math.round(24 + hash(i, 1) * 26 + (29 - i) * .5); clicks.push(c); orders.push(Math.round(c * (0.03 + hash(i, 2) * .025))); }
  var PRODUCTS = ['Wireless Earbuds Pro', 'Women Kurti Set', 'Smart Watch Fit 2', 'Face Serum Vitamin C', 'Cotton Panjabi (Eid Edition)', 'Bluetooth Speaker Mini', 'Denim Jeans Slim', 'Hair Dryer 2000W'];
  (function () {
    for (var k = 0; k < 14; k++) { var age = 1 + k * 2 + Math.floor(hash(k, 3) * 2), amt = Math.round((900 + hash(k, 4) * 4200) / 10) * 10, ret = k === 5 || k === 9;
      var d = new Date(NOW - age * DAY), left = WINDOW - age;
      ordList.push({ no: 'BD-' + (24310 - k * 9), date: d, item: PRODUCTS[k % PRODUCTS.length], amt: amt, com: Math.round(amt * AF.rate / 100), st: ret ? 'Voided (returned)' : left > 0 ? 'Pending' : 'Approved', left: left }); }
  })();
  var T = function (f) { return ordList.filter(f).reduce(function (a, o) { return a + o.com; }, 0); };
  var history = [['Sep 2026', 31, 6420, 'Processing', ''], ['Aug 2026', 27, 5810, 'Paid', 'TRX 9K2LM41XQ'], ['Jul 2026', 19, 3960, 'Paid', 'TRX 8H7PQ20AA'], ['Jun 2026', 22, 4730, 'Paid', 'TRX 7D1NB65CV'], ['May 2026', 12, 2290, 'Paid', 'TRX 6B0KD93ZE'], ['Apr 2026', 8, 1410, 'Paid', 'TRX 5A8XC77RT']];
  var saved = [{ label: 'Wireless Earbuds Pro', url: '/p/wireless-earbuds-pro', clicks: 412 }, { label: 'Fashion category', url: '/category/fashion', clicks: 288 }, { label: 'Eid Mega Sale event', url: '/event/eid-mega-sale', clicks: 190 }];

  function mkLink(path) { path = (path || '/').trim(); if (/^https?:\/\//i.test(path)) { try { var u = new URL(path); path = u.pathname + (u.search || ''); } catch (e) { return null; } } if (path.charAt(0) !== '/') path = '/' + path; return AF.site + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + AF.code; }
  function copy(text) { try { navigator.clipboard.writeText(text).then(function () { A.toast('Link copied', 'ok'); }, function () { A.toast('Press Ctrl+C to copy', 'info'); }); } catch (e) { A.toast('Press Ctrl+C to copy', 'info'); } }

  /* ---------- auth ---------- */
  function auth() {
    var login = st.authTab === 'login';
    var body = st.applied ? '<div class="af-ok"><div class="big">✅</div><h3>Application received</h3><p class="a-hint">Our team reviews applications within 2 working days. We will SMS and email you once approved, and you can sign in here.</p><button class="a-btn" id="af-back">Back to sign in</button></div>' :
      login ? '<div class="a-field"><label for="a-e">Email or phone</label><input id="a-e" value="' + AF.email + '"></div><div class="a-field"><label for="a-p">Password</label><input id="a-p" type="password" value="demo1234"></div><div class="a-err" id="a-err" hidden>Enter your email and password.</div><button class="a-btn primary" id="a-go" style="width:100%;justify-content:center">Sign in</button><p style="text-align:center;margin:12px 0 0"><a href="#" id="a-fg" style="font-size:12.5px">Forgot password?</a></p><p class="a-hint" style="text-align:center">Demo: any password works.</p>' :
      '<div class="af-grid"><div class="a-field"><label>Full name</label><input id="ap-n"></div><div class="a-field"><label>Mobile (bKash)</label><input id="ap-p" placeholder="01XXXXXXXXX"></div></div><div class="a-field"><label>Email</label><input id="ap-e" type="email"></div><div class="a-field"><label>Website / Facebook / YouTube / TikTok page</label><input id="ap-u" placeholder="https://"></div><div class="a-field"><label>Audience size</label><select id="ap-a"><option>Under 1,000</option><option>1,000 – 10,000</option><option>10,000 – 100,000</option><option>100,000+</option></select></div><div class="a-field"><label>How will you promote?</label><textarea id="ap-w" rows="2"></textarea></div><label class="a-switch" style="margin-bottom:10px"><input type="checkbox" id="ap-t"><span class="a-hint">I agree to the affiliate terms (commission paid after the return window)</span></label><div class="a-err" id="a-err" hidden>Name, valid mobile number and terms are required.</div><button class="a-btn primary" id="a-ap" style="width:100%;justify-content:center">Submit application</button>';
    $('#app').innerHTML = '<div class="af-auth"><div class="af-card"><div class="af-brand">Shop<b>Name</b><small>Affiliate programme</small></div>' + (st.applied ? '' : '<div class="af-seg"><button data-at="login" aria-selected="' + login + '">Sign in</button><button data-at="apply" aria-selected="' + !login + '">Apply</button></div>' + (login ? '' : '<ul class="af-perks"><li>5% commission on every order you refer</li><li>30-day click attribution</li><li>Monthly payout via bKash or bank</li></ul><div style="height:10px"></div>')) + '<div style="margin-top:12px">' + body + '</div></div></div>';
    var root = $('.af-card');
    root.onclick = function (e) {
      var t = e.target.closest('button,a'); if (!t) return;
      if (t.dataset.at) { st.authTab = t.dataset.at; auth(); }
      else if (t.id === 'af-back') { st.applied = false; st.authTab = 'login'; auth(); }
      else if (t.id === 'a-fg') { e.preventDefault(); A.toast('Reset link sent (mock)', 'info'); }
      else if (t.id === 'a-go') { if (!$('#a-e').value || !$('#a-p').value) { $('#a-err').hidden = false; return; } st.view = 'app'; try { sessionStorage.setItem('af.in', '1'); } catch (er) { /* ignore */ } app(); }
      else if (t.id === 'a-ap') { var ok = $('#ap-n').value.trim() && /^01\d{9}$/.test($('#ap-p').value.trim()) && $('#ap-t').checked; if (!ok) { $('#a-err').hidden = false; return; } st.applied = true; auth(); }
    };
  }

  /* ---------- app panels ---------- */
  function dash() {
    var pend = T(function (o) { return o.st === 'Pending'; }), appr = T(function (o) { return o.st === 'Approved'; }), tc = clicks.reduce(function (a, b) { return a + b; }, 0), to = orders.reduce(function (a, b) { return a + b; }, 0);
    var labels = clicks.map(function (_, i) { var d = new Date(NOW - (29 - i) * DAY); return i % 5 === 0 ? d.getDate() + '/' + (d.getMonth() + 1) : ''; });
    return '<div class="af-stats"><div class="a-stat"><div class="l">Clicks (30 d)</div><div class="v">' + num(tc) + '</div></div><div class="a-stat"><div class="l">Orders</div><div class="v">' + to + '</div></div><div class="a-stat"><div class="l">Conversion</div><div class="v">' + (to / tc * 100).toFixed(1) + '%</div></div>' +
      '<div class="a-stat"><div class="l">Pending earnings</div><div class="v">' + bdt(pend) + '</div><div class="d neutral">inside ' + WINDOW + '-day return window</div></div><div class="a-stat"><div class="l">Approved (payable)</div><div class="v">' + bdt(appr) + '</div><div class="d up">paid next month</div></div><div class="a-stat"><div class="l">Paid to date</div><div class="v">' + bdt(history.filter(function (h) { return h[3] === 'Paid'; }).reduce(function (a, h) { return a + h[2]; }, 0)) + '</div></div></div>' +
      '<div class="af-note ok">Your code <span class="af-code">' + AF.code + '</span> earns <b>' + AF.rate + '%</b> per order. Commission becomes <b>approved ' + WINDOW + ' days after delivery</b> (the return window); returned orders are voided. Clicks are tracked for <b>30 days</b>; if a customer enters a different affiliate code at checkout, that code wins.</div>' +
      '<div class="af-2"><div class="a-card"><div class="a-card-h"><h3>Clicks, last 30 days</h3></div><div class="a-card-b">' + A.chart.line(clicks, { w: 640, h: 210, labels: labels }) + '</div></div><div class="a-card"><div class="a-card-h"><h3>Next payout</h3></div><div class="a-card-b"><div class="v" style="font-size:26px;font-weight:800">' + bdt(appr) + '</div><div class="a-hint">on 5 Nov 2026 via ' + (payout.method === 'bkash' ? 'bKash ' + payout.bkash.replace(/^(\d{3})\d{4}/, '$1••••') : 'bank transfer') + '</div><button class="a-btn sm" style="margin-top:10px" data-go="settings">Edit payout details</button></div></div></div>' +
      '<div class="a-card" style="margin-top:14px"><div class="a-card-h"><h3>Recent referred orders</h3></div><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Order</th><th>Date</th><th>Item</th><th class="num">Order value</th><th class="num">Commission</th><th>Status</th></tr></thead><tbody>' + ordList.map(function (o) {
        return '<tr><td>#' + o.no + '</td><td>' + A.fmt.date(o.date) + '</td><td>' + esc(o.item) + '</td><td class="num">' + bdt(o.amt) + '</td><td class="num">' + bdt(o.com) + '</td><td>' + (o.st === 'Approved' ? badge('Approved', 'ok') : o.st === 'Pending' ? badge('Pending · approves in ' + o.left + ' d', 'warn') : badge('Voided (returned)', 'danger')) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  var lg = { type: 'url', val: '', pick: '/p/wireless-earbuds-pro', out: mkLink('/') };
  var PICKS = { product: [['/p/wireless-earbuds-pro', 'Wireless Earbuds Pro'], ['/p/smart-watch-fit-2', 'Smart Watch Fit 2'], ['/p/women-kurti-set', 'Women Kurti Set'], ['/p/cotton-panjabi-eid', 'Cotton Panjabi (Eid Edition)']], category: [['/category/electronics', 'Electronics'], ['/category/fashion', 'Fashion'], ['/category/beauty', 'Beauty'], ['/category/home-living', 'Home & Living']] };
  function links() {
    var url = lg.type === 'url';
    return '<div class="af-2"><div class="a-card"><div class="a-card-h"><h3>Link generator</h3></div><div class="a-card-b">' +
      '<label class="af-opt"><input type="radio" name="lt" value="url"' + (url ? ' checked' : '') + '><span><b>Any ShopName URL</b><div class="a-hint">Paste a product, category, search or event link</div></span></label>' +
      '<label class="af-opt"><input type="radio" name="lt" value="product"' + (lg.type === 'product' ? ' checked' : '') + '><span><b>Pick a product</b></span></label><label class="af-opt"><input type="radio" name="lt" value="category"' + (lg.type === 'category' ? ' checked' : '') + '><span><b>Pick a category</b></span></label>' +
      (url ? '<div class="a-field"><label for="lg-u">Page URL</label><input id="lg-u" placeholder="https://shopname.example/p/..." value="' + esc(lg.val) + '"></div>' : '<div class="a-field"><label for="lg-p">' + (lg.type === 'product' ? 'Product' : 'Category') + '</label><select id="lg-p">' + PICKS[lg.type].map(function (p) { return '<option value="' + p[0] + '"' + (lg.pick === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>') +
      '<div class="a-field"><label>Your tracked link</label><div class="af-link"><input id="lg-o" readonly value="' + esc(lg.out || '') + '"><button class="a-btn primary" id="lg-c">Copy</button></div><span class="a-hint" id="lg-err">' + (lg.out ? 'Includes your code ' + AF.code + ' · 30-day attribution' : 'Enter a valid ShopName URL') + '</span></div></div></div>' +
      '<div class="a-card"><div class="a-card-h"><h3>Your code</h3></div><div class="a-card-b"><span class="af-code" style="font-size:20px">' + AF.code + '</span><p class="a-hint">Share this code too: customers can type it at checkout and it overrides any earlier link they clicked.</p><h4 style="margin:14px 0 6px;font-size:12px;text-transform:uppercase;color:var(--muted)">Popular links</h4>' +
      saved.map(function (s) { return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)"><span>' + esc(s.label) + '<div class="a-hint">' + s.clicks + ' clicks</div></span><button class="a-btn sm" data-cp="' + s.url + '">Copy</button></div>'; }).join('') + '</div></div></div>';
  }
  function payouts() {
    return '<div class="af-note">Payouts are made <b>monthly (by the 5th)</b> for commissions approved up to the end of the previous month, by bKash or bank transfer. Minimum payout ৳500; smaller balances roll over.</div><div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Month</th><th class="num">Orders</th><th class="num">Commission</th><th>Method</th><th>Status</th><th>Reference</th></tr></thead><tbody>' + history.map(function (h) {
      return '<tr><td>' + h[0] + '</td><td class="num">' + h[1] + '</td><td class="num">' + bdt(h[2]) + '</td><td>' + (payout.method === 'bkash' ? 'bKash' : 'Bank') + '</td><td>' + badge(h[3], h[3] === 'Paid' ? 'ok' : 'info') + '</td><td class="p-mono">' + (h[4] || 'Scheduled 5 Nov') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  function settings() {
    var b = payout.method === 'bkash';
    return '<div class="af-2"><div class="a-card"><div class="a-card-h"><h3>Payout details</h3></div><div class="a-card-b">' +
      '<label class="af-opt"><input type="radio" name="pm" value="bkash"' + (b ? ' checked' : '') + '><span><b>bKash</b><div class="a-hint">Fastest. Personal bKash number.</div></span></label><label class="af-opt"><input type="radio" name="pm" value="bank"' + (!b ? ' checked' : '') + '><span><b>Bank transfer</b><div class="a-hint">BEFTN to your bank account.</div></span></label>' +
      (b ? '<div class="af-grid"><div class="a-field"><label>bKash number</label><input id="pd-b" value="' + esc(payout.bkash) + '" placeholder="01XXXXXXXXX"></div><div class="a-field"><label>Account holder name</label><input id="pd-h" value="' + esc(payout.holder) + '"></div></div>' :
        '<div class="af-grid"><div class="a-field"><label>Bank name</label><input id="pd-bn" value="' + esc(payout.bank) + '"></div><div class="a-field"><label>Branch</label><input id="pd-br" value="' + esc(payout.branch) + '"></div><div class="a-field"><label>Account name</label><input id="pd-an" value="' + esc(payout.accName) + '"></div><div class="a-field"><label>Account number</label><input id="pd-ac" value="' + esc(payout.acc) + '"></div></div>') +
      '<div class="a-err" id="pd-err" hidden></div><button class="a-btn primary" id="pd-save">Save payout details</button><p class="a-hint">Changing payout details sends an OTP to your registered mobile and an email alert.</p></div></div>' +
      '<div class="a-card"><div class="a-card-h"><h3>Profile</h3></div><div class="a-card-b"><dl style="display:grid;grid-template-columns:90px 1fr;gap:6px;margin:0"><dt class="a-hint">Page</dt><dd style="margin:0">' + esc(AF.name) + '</dd><dt class="a-hint">Name</dt><dd style="margin:0">' + AF.person + '</dd><dt class="a-hint">Email</dt><dd style="margin:0">' + AF.email + '</dd><dt class="a-hint">Code</dt><dd style="margin:0"><span class="af-code">' + AF.code + '</span></dd><dt class="a-hint">Rate</dt><dd style="margin:0">' + AF.rate + '% per order</dd></dl></div></div></div>';
  }
  var TABS = [['dash', 'Dashboard', dash], ['links', 'Links & code', links], ['pay', 'Payouts', payouts], ['settings', 'Payout details', settings]];
  function render() {
    $('#af-nav').innerHTML = TABS.map(function (t) { return '<button data-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + '</button>'; }).join('');
    $('#af-main').innerHTML = TABS.filter(function (t) { return t[0] === st.tab; })[0][2]();
  }
  function app() {
    $('#app').innerHTML = '<header class="af-top"><div class="af-brand">Shop<b>Name</b> <span style="font-size:12px;opacity:.8;font-style:normal;text-transform:none;font-weight:600">Affiliate</span></div><div class="af-who"><span>' + esc(AF.name) + '</span><button class="a-btn sm icon" id="af-theme" aria-label="Toggle dark mode">◐</button><button class="a-btn sm" id="af-out">Sign out</button></div></header><main class="af-wrap"><div class="af-nav" id="af-nav" role="tablist"></div><div id="af-main"></div></main>';
    render();
    $('#af-out').onclick = function () { st.view = 'auth'; try { sessionStorage.removeItem('af.in'); } catch (e) { /* ignore */ } auth(); };
    $('#af-theme').onclick = function () { var d = document.documentElement.getAttribute('data-theme') !== 'dark'; if (A.setTheme) A.setTheme(d ? 'dark' : 'light'); };
    var main = $('.af-wrap');
    main.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab) { st.tab = t.dataset.tab; render(); }
      else if (t.dataset.go) { st.tab = t.dataset.go; render(); }
      else if (t.dataset.cp) copy(mkLink(t.dataset.cp));
      else if (t.id === 'lg-c') { if (lg.out) copy(lg.out); else A.toast('Enter a valid URL first', 'warn'); }
      else if (t.id === 'pd-save') savePayout();
    });
    main.addEventListener('change', function (e) {
      if (e.target.name === 'lt') { lg.type = e.target.value; lg.out = lg.type === 'url' ? mkLink(lg.val || '/') : mkLink(lg.pick = PICKS[lg.type][0][0]); render(); }
      else if (e.target.name === 'pm') { payout.method = e.target.value; render(); }
      else if (e.target.id === 'lg-p') { lg.pick = e.target.value; lg.out = mkLink(lg.pick); render(); }
    });
    main.addEventListener('input', function (e) { if (e.target.id === 'lg-u') { lg.val = e.target.value; lg.out = lg.val.trim() ? mkLink(lg.val) : null; var o = $('#lg-o'); o.value = lg.out || ''; $('#lg-err').textContent = lg.out ? 'Includes your code ' + AF.code + ' · 30-day attribution' : 'Enter a valid ShopName URL'; } });
  }
  function savePayout() {
    var err = $('#pd-err'), msg = '';
    if (payout.method === 'bkash') { var n = $('#pd-b').value.trim(), h = $('#pd-h').value.trim(); if (!/^01\d{9}$/.test(n)) msg = 'Enter a valid 11-digit bKash number starting with 01.'; else if (!h) msg = 'Account holder name is required.'; else { payout.bkash = n; payout.holder = h; } }
    else { var v = ['pd-bn', 'pd-br', 'pd-an', 'pd-ac'].map(function (i) { return $('#' + i).value.trim(); }); if (v.some(function (x) { return !x; })) msg = 'All bank fields are required.'; else if (!/^\d{8,17}$/.test(v[3])) msg = 'Account number must be 8–17 digits.'; else { payout.bank = v[0]; payout.branch = v[1]; payout.accName = v[2]; payout.acc = v[3]; } }
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    err.hidden = true; A.toast('OTP sent to your mobile. Payout details saved (mock).', 'ok');
  }
  if (st.view === 'app') app(); else auth();
})();
