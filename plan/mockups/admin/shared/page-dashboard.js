(function () {
  'use strict';
  var A = Admin, F = A.fmt, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = rng(20261023), N = 120, day0 = new Date(); day0.setHours(0, 0, 0, 0);
  var days = [];
  for (var i = N - 1; i >= 0; i--) {
    var d = new Date(day0); d.setDate(d.getDate() - i);
    var wk = [0.92, 1.05, 1.0, 1.04, 1.08, 1.22, 0.82][d.getDay()], trend = 1 + (N - i) / N * 0.35;
    var orders = Math.round((38 + R() * 16) * wk * trend), aov = Math.round(2300 + R() * 900 + (N - i) * 3);
    days.push({ d: d, orders: orders, rev: orders * aov, conv: 2.0 + R() * 0.9 + (N - i) / N * 0.4, visits: Math.round(orders / ((2.0 + R() * .9) / 100)) });
  }
  var settings = A.store.get('admin.settings', {}), onlinePay = settings.online_payments_enabled === true;
  var state = { preset: '30', from: null, to: null };

  function sliceRange() {
    var n, endIdx = N - 1;
    if (state.preset === 'custom' && state.from && state.to) {
      var a = days.findIndex(function (x) { return x.d >= state.from; }), b = days.length - 1 - days.slice().reverse().findIndex(function (x) { return x.d <= state.to; });
      if (a < 0) a = 0; if (b < a) b = a; n = b - a + 1; endIdx = b;
    } else n = state.preset === 'today' ? 1 : state.preset === 'month' ? new Date().getDate() : +state.preset;
    var cur = days.slice(endIdx - n + 1, endIdx + 1), prev = days.slice(Math.max(0, endIdx - 2 * n + 1), endIdx - n + 1);
    return { cur: cur, prev: prev, n: n };
  }
  function sum(a, k) { return a.reduce(function (s, x) { return s + x[k]; }, 0); }
  function delta(c, p, inv) { if (!p) return '<div class="d">&nbsp;</div>'; var pc = (c - p) / p * 100, up = pc >= 0; return '<div class="d ' + ((up !== !!inv) ? 'up' : 'down') + '">' + (up ? '+' : '') + pc.toFixed(1) + '% vs previous</div>'; }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function lbl(d) { return d.getDate() + ' ' + MON[d.getMonth()]; }

  var STAT = { 'Pending payment': 'info', 'Processing': 'info', 'On hold': 'warn', 'Partially shipped': 'info', 'Shipped': 'info', 'Delivered': 'ok', 'Completed': 'ok', 'Cancelled': 'muted' };
  var recent = [
    ['BD-10492', 'Rahim Uddin', 'Dhaka', 12450, 'Processing', 'COD', 6], ['BD-10491', 'Nusrat Jahan', 'Chattogram', 3290, 'Processing', 'COD', 14], ['BD-10490', 'Tanvir Hasan', 'Sylhet', 125000, 'On hold', 'COD', 22],
    ['BD-10489', 'Farzana Akter', 'Dhaka', 780, 'Processing', 'COD', 31], ['BD-10488', 'Mehedi Hasan', 'Khulna', 5640, 'Shipped', 'COD', 47], ['BD-10487', 'Sumaiya Rahman', 'Rajshahi', 2150, 'Partially shipped', 'COD', 70],
    ['BD-10486', 'Imran Hossain', 'Dhaka', 18900, 'Processing', 'COD', 95], ['BD-10485', 'Laila Begum', 'Comilla', 960, 'Delivered', 'COD', 140]
  ];
  var statuses = [['Processing', 142, 'var(--a-c1)'], ['On hold', 9, 'var(--a-c4)'], ['Shipped', 87, 'var(--a-c3)'], ['Delivered', 233, 'var(--a-c2)'], ['Completed', 410, 'var(--success)'], ['Cancelled', 31, 'var(--a-c5)']];
  var tops = [['🎧', 'Wireless Earbuds Pro X2', 'EB-X2-BLK', 214, 481500], ['👕', 'Cotton Panjabi — Navy', 'PJ-NV-M', 188, 338400], ['🍳', 'Non-stick Fry Pan 28cm', 'KT-FP-28', 151, 196300], ['⌚', 'Smart Watch Fit S3', 'SW-S3', 97, 291000], ['👟', 'Running Shoes Air Lite', 'SH-AL-42', 83, 207500]];
  var traffic = [['Direct / own tracking', 41200], ['Facebook', 28900], ['Google', 22400], ['TikTok', 9800], ['Affiliates', 5100], ['Other', 2300]];
  var alerts = [
    ['warn', 'Velocity flag: 3 orders from phone 01933-889900 in 1 hour', 'Order #BD-10490 put on hold automatically', 'order.html?id=BD-10490', 'Review', 24],
    ['danger', '2 refunds awaiting approval (৳18,500 and ৳42,000)', 'Above the ৳15,000 approval threshold', 'returns.html', 'Approve', 52],
    ['warn', '4 orders stuck in Pending payment past the 30 min timeout', 'Will auto-cancel and release stock', 'orders.html', 'View', 75],
    ['warn', 'Low stock: Wireless Earbuds Pro X2 (4 left), Fry Pan 28cm (5 left)', 'Below threshold of 10', 'inventory.html', 'Restock', 180],
    ['info', 'PO-2028 to Dhaka Gadgets Ltd is 3 days overdue', 'Expected 20 Oct 2026', 'suppliers.html', 'Open', 600]
  ];

  function kpi(l, v, d, ic, extra) { return '<div class="a-stat ' + (extra || '') + '"><div class="ic">' + A.icons[ic] + '</div><div class="l">' + l + '</div><div class="v">' + v + '</div>' + d + '</div>'; }
  function body() {
    var r = sliceRange(), c = r.cur, p = r.prev;
    var rev = sum(c, 'rev'), ord = sum(c, 'orders'), prev = sum(p, 'rev'), pord = sum(p, 'orders');
    var aov = ord ? rev / ord : 0, paov = pord ? prev / pord : 0;
    var conv = c.reduce(function (s, x) { return s + x.conv; }, 0) / c.length, pconv = p.length ? p.reduce(function (s, x) { return s + x.conv; }, 0) / p.length : 0;
    var today = state.preset === 'today';
    var labels = c.map(function (x) { return lbl(x.d); });
    var cmp = p.length === c.length ? p.map(function (x) { return x.rev; }) : [];
    return (onlinePay ? '' : '<div class="a-banner" data-perm="settings.manage">' + A.icons.truck + '<div><b>Launch mode: COD only</b> <span class="a-muted">· Online payments, advance payment and pre-orders are switched off.</span></div><span class="a-sp"></span><a class="a-btn sm" href="settings.html#payments">Feature flags</a></div>') +
      '<div class="a-toolbar" style="justify-content:space-between"><div class="db-range" id="rng">' +
      [['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['month', 'This month'], ['90', '90 days']].map(function (b) { return '<button class="a-btn sm" data-p="' + b[0] + '" aria-pressed="' + (state.preset === b[0]) + '">' + b[1] + '</button>'; }).join('') +
      '<span class="a-muted a-sm" style="margin:0 2px 0 8px">Custom</span><input type="date" id="rf" aria-label="From date" value="' + (state.from ? iso(state.from) : '') + '"><span class="a-muted">→</span><input type="date" id="rt" aria-label="To date" value="' + (state.to ? iso(state.to) : '') + '"><button class="a-btn sm" id="rapply">Apply</button></div>' +
      '<span class="a-muted a-sm">' + F.date(c[0].d) + (c.length > 1 ? ' – ' + F.date(c[c.length - 1].d) : '') + ' · vs previous ' + p.length + ' day' + (p.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="a-grid-4" style="margin-bottom:10px">' +
      kpi(today ? 'Revenue today' : 'Revenue', F.bdt(rev), delta(rev, prev), 'reports') + kpi('Orders', F.num(ord), delta(ord, pord), 'orders') + kpi('Avg order value', F.bdt(aov), delta(aov, paov), 'coupons') + kpi('Conversion rate', conv.toFixed(2) + '%', delta(conv, pconv), 'customers') + '</div>' +
      '<div class="db-kpis">' +
      '<a class="a-stat" href="orders.html?status=processing" data-perm="orders.view">' + '<div class="ic">' + A.icons.orders + '</div><div class="l">Pending to process</div><div class="v">142</div><div class="d neutral">oldest waiting 3 h</div></a>' +
      '<a class="a-stat alert" href="orders.html?status=hold" data-perm="orders.view"><div class="ic">' + A.icons.warn + '</div><div class="l">On hold / flagged</div><div class="v">9</div><div class="d down">3 velocity flags</div></a>' +
      '<a class="a-stat alert" href="inventory.html" data-perm="inventory.view"><div class="ic">' + A.icons.inventory + '</div><div class="l">Low stock</div><div class="v">17</div><div class="d down">4 out of stock</div></a>' +
      '<a class="a-stat" href="tickets.html" data-perm="tickets.view"><div class="ic">' + A.icons.tickets + '</div><div class="l">Open tickets</div><div class="v">23</div><div class="d neutral">5 unanswered &gt; 24 h</div></a>' +
      '<a class="a-stat" href="returns.html" data-perm="returns.view"><div class="ic">' + A.icons.returns + '</div><div class="l">Returns pending</div><div class="v">11</div><div class="d neutral">2 awaiting refund approval</div></a></div>' +
      '<div class="db-main"><div class="a-card"><div class="a-card-h"><h2>Sales — ' + (c.length > 1 ? 'last ' + c.length + ' days' : 'today') + '</h2><span class="a-sm a-muted">Net revenue incl. VAT</span></div>' +
      '<div class="db-chart-h"><span><i style="background:var(--a-c1)"></i>This period</span>' + (cmp.length ? '<span><i style="background:var(--muted)"></i>Previous period</span>' : '') + '</div><div class="a-card-b" style="padding-top:0">' +
      (c.length > 1 ? A.chart.line(c.map(function (x) { return x.rev; }), { w: 720, h: 250, labels: labels, compare: cmp, fmt: function (v) { return F.bdt(v); }, axisFmt: function (v) { return '৳' + A.chart.short(v); }, label: 'Daily revenue' }) : '<div class="a-empty"><p>Pick a range of at least 2 days to see the trend line.</p></div>') + '</div></div>' +
      '<div class="a-card"><div class="a-card-h"><h2>Orders by status</h2></div><div class="a-card-b">' + A.chart.donut(statuses.map(function (s) { return { label: s[0], value: s[1], color: s[2] }; }), { size: 150, thickness: 24, center: { value: String(statuses.reduce(function (a, b) { return a + b[1]; }, 0)), label: 'orders' } }) + '</div></div></div>' +
      '<div class="db-two"><div class="a-card"><div class="a-card-h"><h2>Top products</h2><a class="a-sm" href="products.html" data-perm="products.view">All products</a></div><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Product</th><th class="num">Units</th><th class="num">Revenue</th></tr></thead><tbody>' +
      tops.map(function (t) { return '<tr><td><div class="prod-cell"><span class="th">' + t[0] + '</span><div>' + A.esc(t[1]) + '<span class="sub">' + t[2] + '</span></div></div></td><td class="num">' + t[3] + '</td><td class="num"><b>' + F.bdt(t[4]) + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="a-card"><div class="a-card-h"><h2>Traffic sources</h2><span class="a-sm a-muted">Visits · own tracking + ad platforms</span></div><div class="a-card-b">' + A.chart.bars(traffic.map(function (t) { return { label: t[0], value: t[1] }; }), { w: 440, rowH: 32, labelW: 150 }) + '<div class="db-bar-sub"><span>Total visits ' + F.num(traffic.reduce(function (a, b) { return a + b[1]; }, 0)) + '</span><span>FB / Google / TikTok figures come from pixel + API sync</span></div></div></div></div>' +
      '<div class="db-two"><div class="a-card"><div class="a-card-h"><h2>Recent orders</h2><a class="a-sm" href="orders.html" data-perm="orders.view">View all</a></div><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th class="num">Total</th><th>Placed</th></tr></thead><tbody>' +
      recent.map(function (o) { return '<tr class="click" data-href="order.html?id=' + o[0] + '"><td><a href="order.html?id=' + o[0] + '"><b>#' + o[0] + '</b></a><span class="sub">' + o[5] + '</span></td><td>' + A.esc(o[1]) + '<span class="sub">' + o[2] + '</span></td><td><span class="a-badge ' + STAT[o[4]] + '">' + o[4] + '</span></td><td class="num">' + F.bdt(o[3]) + '</td><td class="a-nowrap">' + F.ago(Date.now() - o[6] * 60000) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="a-card"><div class="a-card-h"><h2>Needs attention</h2><span class="a-badge danger">' + alerts.length + '</span></div><ul class="db-alerts">' +
      alerts.map(function (a) { return '<li class="' + a[0] + '">' + A.icons.warn + '<div class="t">' + A.esc(a[1]) + '<small>' + A.esc(a[2]) + ' · ' + F.ago(Date.now() - a[5] * 60000) + '</small></div><a class="a-btn sm" href="' + a[3] + '">' + a[4] + '</a></li>'; }).join('') + '</ul></div></div>';
  }
  function draw() {
    var host = A.$('#db'); host.innerHTML = body(); A.applyPerms(host);
    A.$$('#rng [data-p]', host).forEach(function (b) { b.onclick = function () { state.preset = b.getAttribute('data-p'); draw(); }; });
    A.$('#rapply', host).onclick = function () {
      var f = A.$('#rf').value, t = A.$('#rt').value;
      if (!f || !t) { A.toast('Pick both dates', 'warn'); return; }
      if (f > t) { A.toast('“From” must be before “To”', 'warn'); return; }
      state.from = new Date(f + 'T00:00:00'); state.to = new Date(t + 'T00:00:00'); state.preset = 'custom'; draw();
    };
    A.$$('tr.click', host).forEach(function (tr) { tr.onclick = function (e) { if (!e.target.closest('a')) location.href = tr.getAttribute('data-href'); }; });
  }
  A.renderPage({ active: 'dashboard', title: 'Dashboard', crumbs: [['Admin', 'index.html'], ['Dashboard']], actions: '<button class="a-btn" id="exp" data-perm="reports.view">' + A.icons.download + 'Export</button>', body: '<div id="db"></div>',
    onReady: function () { draw(); var e = A.$('#exp'); if (e) e.onclick = function () { A.toast('Dashboard summary exported (demo)', 'info'); }; } });
  A.on('theme', function () { /* charts use css vars — nothing to do */ });
})();
