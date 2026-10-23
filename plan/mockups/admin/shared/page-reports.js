/* Reports (agent E) */
(function () {
  'use strict';
  var A = window.Admin, PD = window.PD, $ = A.$, esc = A.esc, bdt = A.fmt.bdt, num = A.fmt.num;
  var NOW = PD ? PD.NOW : new Date(2026, 9, 23), DAY = 86400000, VAT = 15, BIN = '000123456-0103';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function hash(n, s) { var x = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dayIdx(d) { return Math.floor(d.getTime() / DAY); }
  var st = { tab: 'sales', preset: '30', from: iso(new Date(NOW - 29 * DAY)), to: iso(NOW) };

  /* ---------- fake daily model ---------- */
  function day(i) { // i = day index
    var dow = new Date(i * DAY).getUTCDay(), growth = 1 + (i - dayIdx(NOW)) / 900;
    var season = [0.92, 0.95, 1, 1.04, 0.85, 1.12, 1.08][dow];
    var orders = Math.round((74 * growth * season) * (0.85 + hash(i, 1) * .3));
    var aov = 2350 + hash(i, 2) * 500;
    var visitors = Math.round(orders * (38 + hash(i, 3) * 10));
    return { orders: orders, rev: Math.round(orders * aov), visitors: visitors, newC: Math.round(orders * (0.38 + hash(i, 4) * .12)), ret: Math.round(orders * 0.052 * (0.6 + hash(i, 5) * .8)) };
  }
  function range() {
    var a = new Date(st.from + 'T00:00:00'), b = new Date(st.to + 'T00:00:00'); if (b < a) { var t = a; a = b; b = t; }
    var out = []; for (var i = dayIdx(a); i <= dayIdx(b); i++) out.push({ i: i, d: new Date(i * DAY + 12 * 3600000), v: day(i) });
    return out;
  }
  function buckets(days) { // returns [{label, orders, rev, visitors, newC, ret}]
    var n = days.length, mode = n <= 35 ? 'd' : n <= 130 ? 'w' : 'm', map = {}, order = [];
    days.forEach(function (x) {
      var d = x.d, key, label;
      if (mode === 'd') { key = x.i; label = d.getDate() + ' ' + MON[d.getMonth()]; }
      else if (mode === 'w') { key = Math.floor((x.i + 3) / 7); var ws = new Date((key * 7 - 3) * DAY); label = ws.getUTCDate() + ' ' + MON[ws.getUTCMonth()]; }
      else { key = d.getFullYear() * 12 + d.getMonth(); label = MON[d.getMonth()] + " '" + String(d.getFullYear()).slice(2); }
      if (!map[key]) { map[key] = { label: label, orders: 0, rev: 0, visitors: 0, newC: 0, ret: 0 }; order.push(key); }
      var m = map[key]; ['orders', 'rev', 'visitors', 'newC', 'ret'].forEach(function (k) { m[k] += x.v[k]; });
    });
    return order.map(function (k) { return map[k]; });
  }
  function sum(arr, k) { return arr.reduce(function (a, x) { return a + x[k]; }, 0); }
  function pct(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '—'; }
  function share(total, parts) { var s = parts.reduce(function (a, p) { return a + p[1]; }, 0); var acc = 0; return parts.map(function (p, i) { var v = i === parts.length - 1 ? total - acc : Math.round(total * p[1] / s); acc += v; return { label: p[0], value: v }; }); }
  function stat(l, v, d, cls) { return '<div class="a-stat"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d ' + (cls || 'neutral') + '">' + d + '</div>' : '') + '</div>'; }
  function card(t, b, extra) { return '<div class="a-card"><div class="a-card-h"><h3>' + t + '</h3>' + (extra || '') + '</div><div class="a-card-b">' + b + '</div></div>'; }
  function tbl(head, rows) { return '<div class="a-table-wrap"><table class="a-table"><thead><tr>' + head.map(function (h) { return '<th' + (h.charAt(0) === '#' ? ' class="num"' : '') + '>' + h.replace(/^#/, '') + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (head[i].charAt(0) === '#' ? ' class="num"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
  var CATS = [['Electronics', 34], ['Fashion', 27], ['Home & Living', 14], ['Beauty', 9], ['Kids', 8], ['Grocery', 5], ['Sports', 3]];

  /* ---------- custom SVG: stacked bars ---------- */
  function stacked(items, keys, cols, w, h) {
    var L = 40, B = 22, T = 8, max = Math.max.apply(null, items.map(function (x) { return keys.reduce(function (a, k) { return a + x[k]; }, 0); }).concat([1]));
    var bw = (w - L - 6) / items.length, s = '<svg class="p-ch" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Stacked bar chart">';
    for (var g = 0; g <= 4; g++) { var y = T + (h - T - B) * (1 - g / 4); s += '<line class="gl" x1="' + L + '" x2="' + w + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 5) + '" y="' + (y + 3) + '" text-anchor="end">' + Math.round(max * g / 4) + '</text>'; }
    items.forEach(function (x, i) {
      var acc = 0, step = Math.max(1, Math.ceil(items.length / 10));
      keys.forEach(function (k, ki) { var hh = (h - T - B) * x[k] / max, y = h - B - acc - hh; acc += hh; s += '<rect x="' + (L + i * bw + bw * .15).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * .7).toFixed(1) + '" height="' + hh.toFixed(1) + '" fill="' + cols[ki] + '"><title>' + x.label + ' — ' + k + ': ' + x[k] + '</title></rect>'; });
      if (i % step === 0) s += '<text x="' + (L + i * bw + bw / 2) + '" y="' + (h - 6) + '" text-anchor="middle">' + x.label + '</text>';
    });
    return s + '</svg>';
  }
  function legend(items) { return '<div class="p-leg">' + items.map(function (i) { return '<span><i style="background:' + i[1] + '"></i>' + i[0] + '</span>'; }).join('') + '</div>'; }
  var C = A.chart.colors;
  function lineChart(vals, labels, fmt) { var step = Math.max(1, Math.ceil(labels.length / 8)); return A.chart.line(vals, { w: 640, h: 220, labels: labels.map(function (l, i) { return i % step === 0 ? l : ''; }), fmt: fmt }); }

  /* ---------- tabs ---------- */
  var TABS = {
    sales: function (days, bk) {
      var rev = sum(bk, 'rev'), ord = sum(bk, 'orders'), refunds = Math.round(rev * 0.036);
      var half = Math.floor(days.length / 2), prev = days.slice(0, half).reduce(function (a, x) { return a + x.v.rev; }, 0), cur = days.slice(half).reduce(function (a, x) { return a + x.v.rev; }, 0), dl = prev ? ((cur - prev) / prev * 100) : 0;
      var catRows = share(rev, CATS).map(function (c) { return { label: c.label, value: c.value }; });
      return '<div class="a-grid-4 p-mb">' + stat('Revenue (VAT incl.)', bdt(rev), Math.abs(dl).toFixed(1) + '% vs first half', dl >= 0 ? 'up' : 'down') + stat('Orders', num(ord), 'excl. cancelled') + stat('Average order value', bdt(Math.round(rev / Math.max(ord, 1)))) + stat('Refunded', bdt(refunds), pct(refunds, rev) + ' of revenue') + '</div>' +
        '<div class="a-grid-2">' + card('Revenue over time', lineChart(bk.map(function (x) { return x.rev; }), bk.map(function (x) { return x.label; }))) + card('Orders & AOV over time', lineChart(bk.map(function (x) { return Math.round(x.rev / Math.max(x.orders, 1)); }), bk.map(function (x) { return x.label; }), function (v) { return bdt(v); }) + '<div class="p-muted p-small">Average order value per ' + (bk.length === days.length ? 'day' : bk.length > 12 && days.length <= 130 ? 'week' : 'period') + '.</div>') + '</div>' +
        '<div class="a-grid-2 p-mt">' + card('Revenue by category', A.chart.bars(catRows, { fmt: function (v) { return bdt(v); }, labelW: 110 })) + card('By payment method', A.chart.donut(share(ord, [['Cash on delivery', 100]])) + '<div class="p-note p-mt">Launch mode: <b>COD only</b>. bKash / Nagad / card appear here once <code>online_payments_enabled</code> is turned on in Settings.</div>') + '</div>';
    },
    products: function (days) {
      var scale = days.length / 30, R = PD.rng(31);
      var rows = PD.products.map(function (p, i) { var u = Math.round((60 - i * 2.4 + R() * 14) * scale * (i > 15 ? .3 : 1)); return { p: p, units: Math.max(u, 0), rev: Math.max(u, 0) * p.price }; });
      var top = rows.slice().sort(function (a, b) { return b.rev - a.rev; }).slice(0, 10), low = rows.slice().sort(function (a, b) { return a.units - b.units; }).slice(0, 6);
      var sv = {}; PD.products.forEach(function (p) { sv[p.cat] = (sv[p.cat] || 0) + p.stock * p.cost; }); var svItems = Object.keys(sv).map(function (k) { return { label: k, value: sv[k] }; }).sort(function (a, b) { return b.value - a.value; }), tot = svItems.reduce(function (a, x) { return a + x.value; }, 0);
      return '<div class="a-grid-4 p-mb">' + stat('Units sold', num(rows.reduce(function (a, r) { return a + r.units; }, 0))) + stat('Active products', PD.products.length) + stat('Out of stock', PD.products.filter(function (p) { return !p.stock; }).length, 'lose sales', 'down') + stat('Stock value (at cost)', bdt(tot)) + '</div>' +
        '<div class="a-grid-2">' + card('Top sellers', tbl(['Product', '#Units', '#Revenue', '#Stock'], top.map(function (r) { return [esc(r.p.name) + '<div class="p-muted p-small">' + r.p.sku + '</div>', r.units, bdt(r.rev), r.p.stock]; }))) +
        card('Low performers', tbl(['Product', '#Units', '#Stock', 'Hint'], low.map(function (r) { return [esc(r.p.name), r.units, r.p.stock, r.p.stock > 60 ? '<span class="a-badge warn">Overstock: discount</span>' : r.units === 0 ? '<span class="a-badge danger">No sales</span>' : '<span class="a-badge muted">Slow</span>']; }))) + '</div>' +
        '<div class="p-mt">' + card('Stock value by category (at cost)', A.chart.bars(svItems, { fmt: function (v) { return bdt(v); }, labelW: 110 })) + '</div>';
    },
    customers: function (days, bk) {
      var nc = sum(bk, 'newC'), ord = sum(bk, 'orders'), rc = Math.max(ord - nc, 0);
      var items = bk.map(function (x) { return { label: x.label, New: x.newC, Returning: Math.max(x.orders - x.newC, 0) }; });
      var cohorts = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], R = PD.rng(55), rowsH = '';
      cohorts.forEach(function (c, ci) { var size = 300 + Math.round(R() * 260); rowsH += '<tr><td><b>' + c + ' 2026</b></td><td class="num">' + size + '</td>'; for (var m = 0; m < 6; m++) { if (m > 5 - ci) { rowsH += '<td></td>'; continue; } var v = m === 0 ? 100 : Math.round(34 * Math.pow(.72, m - 1) + R() * 5); rowsH += '<td style="background:color-mix(in srgb,var(--primary) ' + Math.round(v * .75) + '%,var(--surface));color:' + (v > 55 ? 'var(--on-primary)' : 'var(--text)') + '">' + v + '%</td>'; } rowsH += '</tr>'; });
      return '<div class="a-grid-4 p-mb">' + stat('New customers', num(nc)) + stat('Returning orders', num(rc), pct(rc, ord) + ' of orders') + stat('Repeat rate (90d)', '31%', 'ordered 2+ times') + stat('Avg lifetime value', bdt(11400)) + '</div>' +
        '<div class="a-grid-2">' + card('New vs returning customers (orders)', stacked(items, ['New', 'Returning'], [C[0], C[1]], 640, 230) + legend([['New', C[0]], ['Returning', C[1]]])) +
        card('Customer segments', A.chart.donut(share(PD.customers.length, [['Regular', 52], ['New', 20], ['VIP', 8], ['Dormant', 20]])) + '<div class="p-muted p-small p-mt">Segments are used for targeted coupons and campaigns.</div>') + '</div>' +
        '<div class="p-mt">' + card('Cohort retention (orders per signup month)', '<div class="a-table-wrap"><table class="a-table p-heat"><thead><tr><th>Cohort</th><th class="num">Customers</th><th>Month 0</th><th>M+1</th><th>M+2</th><th>M+3</th><th>M+4</th><th>M+5</th></tr></thead><tbody>' + rowsH + '</tbody></table></div>') + '</div>';
    },
    traffic: function (days, bk) {
      var vis = sum(bk, 'visitors'), ord = sum(bk, 'orders'), sess = Math.round(vis * 1.34), views = Math.round(vis * 4.2), cart = Math.round(views * .082), co = Math.round(cart * .46);
      var src = share(vis, [['Facebook', 31], ['Google (organic + ads)', 24], ['Direct', 19], ['TikTok', 11], ['Instagram', 6], ['YouTube', 3], ['SMS / email', 4], ['Affiliates', 2]]);
      var fn = [['Product views', views], ['Add to cart', cart], ['Checkout started', co], ['Orders', ord]];
      var pages = [['/', .22], ['/category/electronics', .11], ['/p/wireless-earbuds-pro', .07], ['/event/eid-mega-sale', .09], ['/category/fashion', .08], ['/cart', .05], ['/p/smart-watch-fit-2', .04], ['/search', .06]];
      return '<div class="a-grid-4 p-mb">' + stat('Visitors', num(vis), 'own tracking, no 3rd-party') + stat('Sessions', num(sess)) + stat('Conversion', pct(ord, sess), 'sessions → orders') + stat('Cart abandonment', pct(cart - ord, cart)) + '</div>' +
        '<div class="a-grid-2">' + card('Traffic sources', A.chart.bars(src, { labelW: 140 }) + '<div class="p-muted p-small">Source = UTM / referrer captured by our visitor tracking; affiliate clicks counted separately.</div>') +
        card('Funnel', '<div class="p-funnel">' + fn.map(function (f, i) { var w = Math.max(f[1] / views * 100, 3); return '<div class="p-fn"><span>' + f[0] + '</span><div><div class="bar" style="width:' + w.toFixed(1) + '%"></div></div><span><b>' + num(f[1]) + '</b> <span class="p-muted">' + (i ? pct(f[1], fn[i - 1][1]) : '') + '</span></span></div>'; }).join('') + '</div>') + '</div>' +
        '<div class="p-mt">' + card('Top pages', tbl(['Page', '#Views', '#Share', '#Avg time'], pages.map(function (p, i) { return ['<span class="p-mono">' + p[0] + '</span>', num(Math.round(views * p[1])), (p[1] * 100).toFixed(0) + '%', (1 + i % 3) + ':' + ('0' + (12 + i * 7) % 60).slice(-2)]; }))) + '</div>';
    },
    vat: function (days) {
      var a = new Date(st.from + 'T00:00:00'), b = new Date(st.to + 'T00:00:00'), ms = {}, ks = [];
      days.forEach(function (x) { var k = x.d.getFullYear() * 12 + x.d.getMonth(); if (!ms[k]) { ms[k] = { m: MON[x.d.getMonth()] + ' ' + x.d.getFullYear(), g: 0, o: 0 }; ks.push(k); } ms[k].g += x.v.rev; ms[k].o += x.v.orders; });
      var totG = 0, totV = 0, rows = ks.map(function (k) { var m = ms[k], g = m.g, v = Math.round(g * VAT / (100 + VAT)); totG += g; totV += v; return [m.m, num(m.o), bdt(g), bdt(g - v), bdt(v)]; });
      rows.push(['<b>Total</b>', '', '<b>' + bdt(totG) + '</b>', '<b>' + bdt(totG - totV) + '</b>', '<b>' + bdt(totV) + '</b>']);
      return '<div class="p-note p-mb">Prices are <b>VAT-inclusive</b> at a single store rate of <b>' + VAT + '%</b>. VAT portion = gross × ' + VAT + ' / ' + (100 + VAT) + '. BIN printed on every invoice: <b class="p-mono">' + BIN + '</b>. Refunded orders are netted in the month of refund.</div>' +
        '<div class="a-grid-4 p-mb">' + stat('Gross sales (incl. VAT)', bdt(totG)) + stat('Net sales (excl. VAT)', bdt(totG - totV)) + stat('VAT collected', bdt(totV)) + stat('BIN', '<span style="font-size:15px">' + BIN + '</span>') + '</div>' +
        card('VAT by month', tbl(['Month', '#Orders', '#Gross (VAT incl.)', '#Net sales', '#VAT portion'], rows));
    },
    affiliates: function (days) {
      var sc = days.length / 30, R = PD.rng(91), nm = ['Rafi Tech Reviews', 'Moni\'s Style Diary', 'Dhaka Deals FB Page', 'Sadia Home Tips', 'TechBangla Tube', 'Fahim Gadgets', 'Mitu Beauty Corner'];
      var rows = nm.map(function (n, i) { var clicks = Math.round((900 - i * 110 + R() * 200) * sc), orders = Math.round(clicks * (.021 + R() * .02)), sales = orders * Math.round(2300 + R() * 700), rate = i % 3 === 0 ? 7 : 5, com = Math.round(sales * rate / 100); return { n: n, code: n.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) + (10 + i), clicks: clicks, orders: orders, sales: sales, rate: rate, pend: Math.round(com * .35), appr: Math.round(com * .65) }; });
      var T = function (k) { return rows.reduce(function (a, r) { return a + r[k]; }, 0); };
      return '<div class="a-grid-4 p-mb">' + stat('Affiliate clicks', num(T('clicks'))) + stat('Affiliate orders', num(T('orders')), pct(T('orders'), T('clicks')) + ' conversion') + stat('Affiliate sales', bdt(T('sales'))) + stat('Commission (pending + approved)', bdt(T('pend') + T('appr')), 'approved after return window') + '</div>' +
        card('Affiliate performance', tbl(['Affiliate', 'Code', '#Clicks', '#Orders', '#Sales', '#Rate', '#Pending', '#Approved'], rows.map(function (r) { return [esc(r.n), '<span class="p-mono">' + r.code + '</span>', num(r.clicks), r.orders, bdt(r.sales), r.rate + '%', bdt(r.pend), bdt(r.appr)]; })));
    },
    returns: function (days, bk) {
      var ord = sum(bk, 'orders'), ret = sum(bk, 'ret');
      var reasons = share(ret, [['Wrong size / fit', 26], ['Damaged on arrival', 18], ['Not as described', 17], ['Changed mind', 22], ['Wrong item sent', 9], ['Late delivery', 8]]);
      var byCat = share(ret, [['Fashion', 41], ['Electronics', 27], ['Home & Living', 12], ['Beauty', 9], ['Kids', 7], ['Grocery', 4]]);
      var ours = reasons[1].value + reasons[2].value + reasons[4].value + reasons[5].value;
      return '<div class="a-grid-4 p-mb">' + stat('Returns', num(ret)) + stat('Return rate', pct(ret, ord), 'of delivered orders') + stat('Refunded value', bdt(ret * 2100)) + stat('Our fault (we pay shipping)', pct(ours, ret), bdt(ours * 120) + ' return shipping', 'down') + '</div>' +
        '<div class="a-grid-2">' + card('Return reasons', A.chart.donut(reasons)) + card('Returns by category', A.chart.bars(byCat, { labelW: 110 })) + '</div>' +
        '<div class="p-mt">' + card('Return rate over time', lineChart(bk.map(function (x) { return +(x.ret / Math.max(x.orders, 1) * 100).toFixed(1); }), bk.map(function (x) { return x.label; }), function (v) { return v + '%'; })) + '</div>';
    }
  };
  var TAB_LBL = [['sales', 'Sales'], ['products', 'Products'], ['customers', 'Customers'], ['traffic', 'Traffic'], ['vat', 'VAT'], ['affiliates', 'Affiliates'], ['returns', 'Returns']];

  function csvOf() {
    var rows = [], days = range(), bk = buckets(days);
    if (st.tab === 'sales') { rows.push(['Period', 'Orders', 'Revenue_BDT', 'AOV_BDT']); bk.forEach(function (x) { rows.push([x.label, x.orders, x.rev, Math.round(x.rev / Math.max(x.orders, 1))]); }); }
    else { var t = $('#rp-body table'); if (t) A.$$('tr', t).forEach(function (tr) { rows.push(A.$$('th,td', tr).map(function (c) { return c.textContent.trim(); })); }); }
    return rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
  }
  function exportCsv() {
    var csv = csvOf(), name = 'report-' + st.tab + '-' + st.from + '_' + st.to + '.csv';
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { /* ignore */ }
    A.toast('Exported ' + name, 'ok');
  }
  function draw() {
    var days = range(), bk = buckets(days);
    $('#rp-tabs').innerHTML = TAB_LBL.map(function (t) { return '<button class="a-tab" data-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + '</button>'; }).join('');
    $('#rp-body').innerHTML = TABS[st.tab](days, bk);
    $('#rp-meta').textContent = days.length + ' days · grouped by ' + (days.length <= 35 ? 'day' : days.length <= 130 ? 'week' : 'month');
  }

  A.renderPage({
    active: 'reports', title: 'Reports', crumbs: [['Dashboard', 'index.html'], ['Reports']],
    actions: '<button class="a-btn" id="rp-csv">' + A.icons.download + ' Export CSV</button><button class="a-btn" id="rp-pdf">Print / PDF</button>',
    body: '<div class="a-card p-mb"><div class="a-toolbar"><div class="p-rng"><select id="rp-preset" class="a-select"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="custom">Custom range</option></select>' +
      '<input type="date" id="rp-from" class="a-input" value="' + st.from + '" aria-label="From"><span class="p-muted">to</span><input type="date" id="rp-to" class="a-input" value="' + st.to + '" aria-label="To"></div><span class="p-grow"></span><span class="p-muted p-small" id="rp-meta"></span></div></div>' +
      '<div class="a-tabs p-tabsbar" id="rp-tabs" role="tablist"></div><div id="rp-body"></div>',
    onReady: function (root) {
      draw();
      root.addEventListener('click', function (e) { var t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; draw(); } });
      $('#rp-preset').onchange = function () { if (this.value !== 'custom') { st.to = iso(NOW); st.from = iso(new Date(NOW - (+this.value - 1) * DAY)); $('#rp-from').value = st.from; $('#rp-to').value = st.to; draw(); } };
      function custom() { st.from = $('#rp-from').value || st.from; st.to = $('#rp-to').value || st.to; $('#rp-preset').value = 'custom'; draw(); }
      $('#rp-from').onchange = custom; $('#rp-to').onchange = custom;
      $('#rp-csv').onclick = exportCsv; $('#rp-pdf').onclick = function () { window.print(); };
    }
  });
})();
