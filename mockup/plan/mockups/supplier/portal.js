/* Supplier portal (agent E): login -> orders to fulfil, ready for pickup, history, products. Mock data, in-memory state. */
(function () {
  'use strict';
  var A = window.Admin, $ = A.$, esc = A.esc, bdt = A.fmt.bdt;
  var SUP = { name: 'Sylhet Tea & Spice', user: 'Rubel Ahmed', email: 'rubel@sylhettea.com', route: 'direct', pickup: 'Zindabazar, Sylhet' };
  var PROD = [['TEA-500', 'Sylhet Premium Tea 500g', '🍵', 320, 84], ['TEA-1K', 'Sylhet Premium Tea 1kg', '🍵', 610, 41], ['HNY-500', 'Sundarban Honey 500g', '🍯', 480, 7], ['SPC-MIX', 'Mixed Spice Box (8 pcs)', '🌶️', 540, 26], ['GHE-1L', 'Pure Ghee 1L', '🧈', 980, 0], ['CHT-250', 'Hill Tracts Turmeric 250g', '🟡', 160, 63], ['GTE-100', 'Green Tea Leaves 100g', '🌿', 210, 52], ['MST-5L', 'Cold-pressed Mustard Oil 5L', '🫒', 1020, 18]];
  function pName(s) { return PROD.filter(function (p) { return p[0] === s; })[0][1]; }
  function pIcon(s) { return PROD.filter(function (p) { return p[0] === s; })[0][2]; }
  var NOW = Date.now();
  var orders = [
    { no: 'BD-24318', area: 'Rahim U., Dhanmondi, Dhaka', hrs: 3, items: [['TEA-500', 2], ['HNY-500', 1]] },
    { no: 'BD-24305', area: 'Nusrat J., Agrabad, Chattogram', hrs: 19, items: [['SPC-MIX', 1]] },
    { no: 'BD-24291', area: 'Sabbir H., Uttara, Dhaka', hrs: 27, items: [['GHE-1L', 1], ['TEA-1K', 1], ['CHT-250', 3]] },
    { no: 'BD-24287', area: 'Tasnim A., Zindabazar, Sylhet', hrs: 8, items: [['GTE-100', 4]] }
  ].map(function (o) { o.items = o.items.map(function (i) { return { sku: i[0], qty: i[1], st: 'pending', note: '' }; }); o.state = 'todo'; return o; });
  var ready = [{ no: 'BD-24250', area: 'Mou S., Rajshahi', items: [['TEA-500', 3]], courier: 'Pathao', code: 'PTH-88213447', window: 'Today 14:00 – 17:00', rider: 'Hasan (01712-445566)', parcels: 1, picked: false }];
  var hist = [];
  (function () { var st = ['Delivered', 'Delivered', 'Delivered', 'Delivered', 'Returned', 'Cancelled (out of stock)'], i; for (i = 0; i < 22; i++) hist.push({ no: 'BD-' + (24200 - i * 7), date: new Date(NOW - (i * 1.4 + 2) * 86400000), items: 1 + i % 3, total: 320 * (1 + i % 4), st: st[i % 6 === 5 ? 5 : i % 7 === 4 ? 4 : 0], ontime: i % 6 !== 3 }); })();
  var stock = {}; PROD.forEach(function (p) { stock[p[0]] = p[4]; });
  var st = { in: false, tab: 'todo' };
  try { st.in = sessionStorage.getItem('sp.in') === '1'; } catch (e) { /* ignore */ }
  function badge(t, k) { return '<span class="a-badge ' + k + '">' + esc(t) + '</span>'; }
  function sla(h) { var left = 24 - h; return left < 0 ? '<span class="sp-sla-bad">Overdue ' + (-left) + ' h</span>' : left <= 6 ? '<span class="sp-sla-warn">Confirm within ' + left + ' h</span>' : '<span class="sp-sla-ok">Confirm within ' + left + ' h</span>'; }

  function login() {
    $('#app').innerHTML = '<div class="sp-login"><form class="sp-login-card" id="sp-form"><div class="sp-brand">Shop<b>Name</b><small>Supplier portal</small></div>' +
      '<div class="a-field" style="margin-top:20px"><label for="sp-e">Email</label><input id="sp-e" type="email" value="' + SUP.email + '" autocomplete="username"></div>' +
      '<div class="a-field"><label for="sp-p">Password</label><input id="sp-p" type="password" value="demo1234" autocomplete="current-password"></div><div class="a-err" id="sp-err" hidden>Enter your email and password.</div>' +
      '<button class="a-btn primary" style="width:100%;justify-content:center;margin-top:6px">Sign in</button><p style="text-align:center;margin:12px 0 0"><a href="#" id="sp-forgot" style="font-size:12.5px">Forgot password?</a></p>' +
      '<p class="a-hint" style="margin-top:14px;text-align:center">Demo: any password works. Accounts are created by ShopName staff only; ask your account manager for an invite.</p></form></div>';
    $('#sp-form').onsubmit = function (e) { e.preventDefault(); if (!$('#sp-e').value || !$('#sp-p').value) { $('#sp-err').hidden = false; return; } st.in = true; try { sessionStorage.setItem('sp.in', '1'); } catch (er) { /* ignore */ } app(); };
    $('#sp-forgot').onclick = function (e) { e.preventDefault(); A.toast('Password reset link sent to your email (mock)', 'info'); };
  }

  function orderCard(o) {
    var decided = o.items.every(function (i) { return i.st !== 'pending'; }), anyOk = o.items.some(function (i) { return i.st === 'ok'; });
    return '<div class="sp-order"><div class="sp-oh"><h3>#' + o.no + '</h3>' + badge('To fulfil', 'warn') + sla(o.hrs) + '<span class="p-grow" style="flex:1"></span><span class="a-hint">Forwarded ' + o.hrs + ' h ago</span></div>' +
      '<div class="sp-route">' + A.icons.truck + (SUP.route === 'direct' ? '<span>Ship <b>direct to customer</b>: ' + esc(o.area) + '. Courier picks up from you; label is printed by the courier.</span>' : '<span>Deliver to <b>ShopName warehouse</b> (Tejgaon, Dhaka).</span>') + '</div>' +
      o.items.map(function (i, k) {
        var s = stock[i.sku], low = s < i.qty;
        return '<div class="sp-item"><div class="sp-th">' + pIcon(i.sku) + '</div><div><b>' + esc(pName(i.sku)) + '</b><div class="a-hint">' + i.sku + ' · your stock: ' + s + (low ? ' <span class="sp-sla-bad">(not enough)</span>' : '') + '</div>' + (i.note ? '<div class="a-hint">Note: ' + esc(i.note) + '</div>' : '') + '</div><div class="q">× ' + i.qty + '</div><div class="sp-act">' +
          (i.st === 'pending' ? '<button class="a-btn sm primary" data-conf="' + o.no + '|' + k + '">' + A.icons.check + ' Confirm stock</button><button class="a-btn sm danger" data-oos="' + o.no + '|' + k + '">Out of stock</button>' : i.st === 'ok' ? badge('Stock confirmed', 'ok') + '<button class="a-btn sm ghost" data-undo="' + o.no + '|' + k + '">Undo</button>' : badge('Out of stock', 'danger') + '<button class="a-btn sm ghost" data-undo="' + o.no + '|' + k + '">Undo</button>') + '</div></div>';
      }).join('') +
      '<div class="sp-of"><span class="a-hint">' + (decided ? (anyOk ? 'Pack the confirmed items, then mark ready. ShopName books the courier pickup for you.' : 'All items unavailable: order will be cancelled for this supplier.') : 'Confirm or reject every item to continue.') + '</span><button class="a-btn primary" data-ready="' + o.no + '"' + (decided ? '' : ' disabled') + '>' + (anyOk ? 'Mark ready for pickup' : 'Close order') + '</button></div></div>';
  }
  function tabTodo() {
    var t = orders.filter(function (o) { return o.state === 'todo'; });
    return '<div class="sp-note">Confirm stock within 24 h of forwarding. Late or out-of-stock items lower your score and may route future orders elsewhere. Pickup is booked on ShopName\'s Pathao/Steadfast account: you never pay courier fees.</div>' + (t.length ? t.map(orderCard).join('') : '<div class="sp-empty"><h3>All caught up</h3>New orders appear here automatically.</div>');
  }
  function tabReady() {
    return ready.length ? ready.map(function (r) {
      return '<div class="sp-order"><div class="sp-oh"><h3>#' + r.no + '</h3>' + badge(r.picked ? 'Picked up' : 'Awaiting courier pickup', r.picked ? 'ok' : 'info') + '</div>' +
        '<div class="sp-route">' + A.icons.truck + '<span>' + r.items.map(function (i) { return esc(pName(i[0])) + ' × ' + i[1]; }).join(', ') + ' · ' + esc(r.area) + '</span></div>' +
        '<div class="sp-pick"><div><span>Courier (booked by ShopName)</span><b>' + r.courier + '</b></div><div><span>Consignment code</span><b class="p-mono">' + r.code + '</b></div><div><span>Pickup window</span><b>' + r.window + '</b></div><div><span>Rider</span><b>' + r.rider + '</b></div><div><span>Pickup address</span><b>' + esc(SUP.pickup) + '</b></div><div><span>Parcels</span><b>' + r.parcels + '</b></div></div>' +
        '<div class="sp-of"><span class="a-hint">Hand the sealed parcel to the rider with the printed slip.</span><button class="a-btn" data-print="' + r.no + '">Print packing slip</button></div></div>';
    }).join('') : '<div class="sp-empty"><h3>Nothing waiting for pickup</h3></div>';
  }
  function tabHist() {
    return '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Order</th><th>Date</th><th class="num">Items</th><th class="num">Your payout</th><th>Outcome</th><th>On time</th></tr></thead><tbody>' + hist.map(function (h) {
      return '<tr><td>#' + h.no + '</td><td>' + A.fmt.date(h.date) + '</td><td class="num">' + h.items + '</td><td class="num">' + bdt(h.total) + '</td><td>' + badge(h.st, h.st === 'Delivered' ? 'ok' : h.st === 'Returned' ? 'warn' : 'danger') + '</td><td>' + (h.ontime ? badge('On time', 'ok') : badge('Late', 'warn')) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  function tabProd() {
    return '<div class="sp-note">Product names, photos and selling prices are managed by ShopName. You can only update your <b>available stock</b>; customers see items as out of stock when this reaches 0.</div><div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Product</th><th>SKU</th><th class="num">Your price</th><th class="num">Stock</th><th></th></tr></thead><tbody>' + PROD.map(function (p) {
      var s = stock[p[0]]; return '<tr><td><span style="font-size:20px;vertical-align:middle">' + p[2] + '</span> ' + esc(p[1]) + ' ' + (s === 0 ? badge('Out of stock', 'danger') : s < 10 ? badge('Low', 'warn') : '') + '</td><td class="p-mono">' + p[0] + '</td><td class="num">' + bdt(p[3]) + '</td><td class="num"><input class="sp-stock" type="number" min="0" value="' + s + '" data-sku="' + p[0] + '" aria-label="Stock ' + p[0] + '"></td><td><button class="a-btn sm" data-save="' + p[0] + '">Update</button></td></tr>'; }).join('') + '</tbody></table></div></div>';
  }

  function stats() {
    var todo = orders.filter(function (o) { return o.state === 'todo'; }).length;
    return '<div class="sp-stats"><div class="a-stat"><div class="l">To fulfil</div><div class="v">' + todo + '</div><div class="d ' + (todo ? 'down' : 'neutral') + '">confirm within 24 h</div></div><div class="a-stat"><div class="l">Awaiting pickup</div><div class="v">' + ready.filter(function (r) { return !r.picked; }).length + '</div></div><div class="a-stat"><div class="l">On-time (90 d)</div><div class="v">91%</div><div class="d up">target 90%</div></div><div class="a-stat"><div class="l">Out-of-stock rate</div><div class="v">3.0%</div><div class="d neutral">lower is better</div></div></div>';
  }
  function render() {
    var todo = orders.filter(function (o) { return o.state === 'todo'; }).length;
    var tabs = [['todo', 'Orders to fulfil', todo], ['ready', 'Ready for pickup', ready.length], ['hist', 'History', 0], ['prod', 'Products & stock', 0]];
    $('#sp-main').innerHTML = stats() + '<div class="sp-nav" role="tablist">' + tabs.map(function (t) { return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + (t[2] ? '<span class="n">' + t[2] + '</span>' : '') + '</button>'; }).join('') + '</div>' + { todo: tabTodo, ready: tabReady, hist: tabHist, prod: tabProd }[st.tab]();
  }
  function find(k) { var p = k.split('|'); var o = orders.filter(function (x) { return x.no === p[0]; })[0]; return [o, o && o.items[+p[1]]]; }

  function readyModal(o) {
    var okItems = o.items.filter(function (i) { return i.st === 'ok'; });
    if (!okItems.length) { o.state = 'closed'; hist.unshift({ no: o.no, date: new Date(), items: o.items.length, total: 0, st: 'Cancelled (out of stock)', ontime: true }); render(); A.toast('Order closed: ShopName will notify the customer', 'warn'); return; }
    var b = A.modal.open('<p>' + okItems.map(function (i) { return esc(pName(i.sku)) + ' × ' + i.qty; }).join('<br>') + '</p><div class="a-field"><label>Number of parcels</label><input id="rd-n" type="number" min="1" value="1"></div><div class="a-field"><label>Approx. weight (kg)</label><input id="rd-w" type="number" min="0.1" step="0.1" value="1"></div><div class="a-field"><label>Ready from</label><select id="rd-t"><option>Now</option><option>Today 4 pm</option><option>Tomorrow 10 am</option></select></div><div class="a-hint">ShopName will book a Pathao/Steadfast pickup at ' + esc(SUP.pickup) + ' on its own courier account.</div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="rd-ok">Confirm &amp; request pickup</button></div>', { title: 'Mark #' + o.no + ' ready for pickup', size: 'sm' });
    $('#rd-ok', b).onclick = function () {
      okItems.forEach(function (i) { stock[i.sku] = Math.max(0, stock[i.sku] - i.qty); });
      o.state = 'ready'; var cour = 'Pathao';
      ready.unshift({ no: o.no, area: o.area, items: okItems.map(function (i) { return [i.sku, i.qty]; }), courier: cour, code: 'PTH-' + (88213447 + Math.floor(Math.random() * 90000)), window: 'Tomorrow 11:00 – 14:00', rider: 'Assigned at pickup', parcels: +$('#rd-n', b).value || 1, picked: false });
      A.modal.close(); st.tab = 'ready'; render(); A.toast('Pickup booked on ShopName\'s ' + cour + ' account', 'ok');
    };
  }
  function oosModal(o, i) {
    var b = A.modal.open('<p><b>' + esc(pName(i.sku)) + '</b> × ' + i.qty + '</p><div class="a-field"><label>Available quantity (if partial)</label><input id="oo-q" type="number" min="0" max="' + (i.qty - 1) + '" value="0"></div><div class="a-field"><label>Note for ShopName</label><textarea id="oo-n" rows="2" placeholder="e.g. restock expected Sunday"></textarea></div><div class="a-hint">The customer is notified and refunded for this item. Repeated stock-outs affect your supplier score.</div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn danger" id="oo-ok">Mark out of stock</button></div>', { title: 'Out of stock', size: 'sm' });
    $('#oo-ok', b).onclick = function () { i.st = 'oos'; i.note = $('#oo-n', b).value; stock[i.sku] = 0; A.modal.close(); render(); A.toast('Item marked out of stock; ShopName notified', 'warn'); };
  }

  function app() {
    $('#app').innerHTML = '<header class="sp-top"><div class="sp-brand">Shop<b>Name</b> <small style="display:inline;font-size:12px;opacity:.8;font-weight:600">Supplier</small></div><div class="sp-who"><span>' + esc(SUP.name) + ' · ' + esc(SUP.user) + '</span><button class="a-btn sm icon" id="sp-theme" aria-label="Toggle dark mode">◐</button><button class="a-btn sm" id="sp-out">Sign out</button></div></header><main class="sp-wrap"><div id="sp-main"></div></main>';
    render();
    $('#sp-out').onclick = function () { st.in = false; try { sessionStorage.removeItem('sp.in'); } catch (e) { /* ignore */ } login(); };
    $('#sp-theme').onclick = function () { var d = document.documentElement.getAttribute('data-theme') !== 'dark'; if (A.setTheme) A.setTheme(d ? 'dark' : 'light'); else document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'); };
    $('#sp-main').addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab) { st.tab = t.dataset.tab; render(); return; }
      var r;
      if (t.dataset.conf) { r = find(t.dataset.conf); if (stock[r[1].sku] < r[1].qty) { A.toast('Your stock (' + stock[r[1].sku] + ') is lower than the quantity. Update stock or mark out of stock.', 'warn'); return; } r[1].st = 'ok'; render(); }
      else if (t.dataset.oos) { r = find(t.dataset.oos); oosModal(r[0], r[1]); }
      else if (t.dataset.undo) { r = find(t.dataset.undo); r[1].st = 'pending'; r[1].note = ''; render(); }
      else if (t.dataset.ready) { readyModal(orders.filter(function (o) { return o.no === t.dataset.ready; })[0]); }
      else if (t.dataset.print) A.toast('Packing slip sent to your printer (mock)', 'info');
      else if (t.dataset.save) { var v = +$('[data-sku="' + t.dataset.save + '"]').value; if (isNaN(v) || v < 0) { A.toast('Enter a valid stock number', 'danger'); return; } stock[t.dataset.save] = Math.floor(v); render(); A.toast('Stock updated: ' + t.dataset.save + ' = ' + Math.floor(v) + ' (storefront updates in ~1 min)', 'ok'); }
    });
  }
  if (st.in) app(); else login();
})();
