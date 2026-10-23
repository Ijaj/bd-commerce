/* Customer profile (agent E) */
(function () {
  'use strict';
  var A = window.Admin, PD = window.PD, $ = A.$, esc = A.esc, bdt = A.fmt.bdt;
  var m = /[?&]id=([^&]+)/.exec(location.search), id = m ? decodeURIComponent(m[1]) : 'C1001';
  var c = PD.customers.filter(function (x) { return x.id === id; })[0];
  if (!c) {
    A.renderPage({ active: 'customers', title: 'Customer not found', crumbs: [['Customers', 'customers.html'], ['Not found']], body: '<div class="a-card"><div class="a-empty"><h3>No customer with ID ' + esc(id) + '</h3><p><a href="customers.html">Back to customers</a></p></div></div>' });
    return;
  }
  var R = PD.rng(parseInt(c.id.slice(1), 10) * 7919);
  function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  var NOW = PD.NOW;
  function ago(n, h) { return new Date(NOW.getTime() - n * 86400000 - (h || 0) * 3600000); }

  /* ---- generated detail data ---- */
  var ST = [['Completed', 'ok'], ['Delivered', 'ok'], ['Shipped', 'info'], ['Processing', 'info'], ['Cancelled', 'muted'], ['On hold', 'warn']];
  var orders = [], oNo = 24100 + ri(0, 400);
  var shown = Math.min(c.orders, 10);
  for (var i = 0; i < shown; i++) {
    var s = i === 0 && c.lastOrder && (NOW - c.lastOrder) / 86400000 < 6 ? ST[3] : (R() < .1 ? ST[4] : (R() < .8 ? ST[ri(0, 1)] : pick(ST)));
    orders.push({ no: 'BD-' + (oNo - i * ri(5, 40)), date: i === 0 && c.lastOrder ? c.lastOrder : ago(ri(2 + i * 12, 20 + i * 25)), items: ri(1, 4), total: ri(900, 14500), st: s });
  }
  var RR = ['Wrong size', 'Damaged on arrival', 'Not as described', 'Changed mind', 'Wrong item sent', 'Late delivery'];
  var returns = [];
  for (i = 0; i < Math.min(c.returns, 6); i++) {
    var reason = pick(RR), ourFault = /Damaged|Wrong item|described|Late/.test(reason);
    returns.push({ no: 'RT-' + ri(3000, 3900), order: orders[i % Math.max(orders.length, 1)] ? orders[i % orders.length].no : 'BD-24001', date: ago(ri(5, 200)), reason: reason, fault: ourFault, amount: ri(600, 6000), status: pick(['Refunded', 'Refunded', 'Approved', 'Requested', 'Rejected']), to: pick(['Original method (COD refund via bKash)', 'Store wallet']) });
  }
  var guests = [];
  if (c.verified && (c.guest || R() < .35)) for (i = 0; i < ri(1, 3); i++) guests.push({ no: 'BD-' + ri(22000, 23900), date: ago(ri(40, 300)), phone: c.phone, total: ri(900, 7800), linked: ago(ri(1, 30)) });
  var addrs = [
    { label: 'Home', line: 'House ' + ri(1, 80) + ', Road ' + ri(1, 20) + ', ' + pick(['Dhanmondi', 'Mirpur-10', 'Uttara Sector 7', 'Banani', 'Mohammadpur']), city: c.city, def: true },
    { label: 'Office', line: 'Level ' + ri(2, 9) + ', ' + pick(['Gulshan Avenue', 'Motijheel C/A', 'Agrabad C/A', 'Zindabazar']), city: pick(['Dhaka', c.city]), def: false },
    { label: 'Parents', line: 'Village ' + pick(['Kalikapur', 'Nandipara', 'Shibpur']) + ', Post ' + pick(['Sadar', 'Bazar']), city: pick(['Cumilla', 'Bogura', 'Jashore']), def: false }
  ].slice(0, ri(1, 3));
  var wallet = [], pts = [], bal = c.wallet;
  if (c.wallet) { wallet.push({ d: ago(ri(2, 40)), type: 'Refund to wallet', ref: 'RT-' + ri(3000, 3900), amt: c.wallet, by: 'System' }); }
  if (c.orders > 4) wallet.push({ d: ago(ri(50, 120)), type: 'Spent on order', ref: 'BD-' + ri(22000, 24000), amt: -ri(2, 8) * 50, by: 'Customer' }, { d: ago(ri(130, 200)), type: 'Goodwill credit (ticket)', ref: 'T-' + ri(800, 990), amt: 200, by: 'Support' });
  var earned = c.points, pBal = c.points;
  if (c.orders) pts.push({ d: ago(ri(3, 30)), type: 'Earned on order', ref: orders[0] ? orders[0].no : '—', amt: Math.round(earned * .35) }, { d: ago(ri(40, 90)), type: 'Earned on order', ref: orders[1] ? orders[1].no : '—', amt: Math.round(earned * .45) });
  if (c.points > 400) pts.push({ d: ago(ri(10, 50)), type: 'Redeemed on checkout', ref: orders[2] ? orders[2].no : '—', amt: -300 });
  var coupons = [
    { code: 'WELCOME100', desc: '৳100 off first order', exp: ago(-ri(5, 60)), st: c.orders ? 'Used' : 'Available' },
    { code: 'EID-FREESHIP', desc: 'Free delivery over ৳1,500', exp: ago(-ri(3, 30)), st: 'Available' },
    { code: 'COLLECT-10', desc: '10% off electronics (collected)', exp: ago(-ri(1, 15)), st: 'Available' }
  ].slice(0, ri(1, 3));
  var tickets = [];
  for (i = 0; i < ri(0, 3); i++) tickets.push({ no: 'T-' + ri(800, 990), subject: pick(['Where is my parcel?', 'Wrong colour delivered', 'Refund not received yet', 'Change delivery address']), date: ago(ri(3, 150)), st: pick(['Open', 'Resolved', 'Resolved', 'Pending customer']), via: pick(['Web form', 'App', 'Phone call (staff)']) });
  var notes = [{ by: 'Rina (Support)', d: ago(ri(5, 60)), t: pick(['Customer prefers calls after 6pm.', 'Called to confirm address, all good.', 'Asked for invoice copy with BIN for office use.']) }];
  if (c.risky) notes.unshift({ by: 'Manager', d: ago(ri(1, 30)), t: 'Flagged risky: ' + c.riskReason });
  var devices = [];
  for (i = 0; i < ri(2, 4); i++) devices.push({ dev: pick(['Android 14 · Chrome', 'iPhone iOS 17 · Safari', 'Windows · Chrome', 'Android 13 · ShopName app']), ip: '103.' + ri(100, 200) + '.' + ri(1, 250) + '.' + ri(1, 250), loc: pick(['Dhaka', 'Chattogram', c.city]), last: ago(ri(0, 60), ri(0, 20)), others: R() < (c.risky ? .5 : .08) ? ri(1, 3) : 0 });

  /* ---- state ---- */
  var st = { walletBal: c.wallet, pointsBal: c.points, risky: c.risky, reason: c.riskReason, wallet: wallet, pts: pts, notes: notes, tab: 'orders' };
  function initials(n) { return n.split(' ').map(function (x) { return x[0]; }).slice(0, 2).join(''); }
  function badge(t, k) { return '<span class="a-badge ' + k + '">' + esc(t) + '</span>'; }
  function audit(a, ent, b, af, x) { try { A.audit.log(a, ent, b, af, x); } catch (e) { /* ignore */ } }

  function table(head, rows, empty) {
    if (!rows.length) return '<div class="a-empty"><h3>' + empty + '</h3></div>';
    return '<div class="a-table-wrap"><table class="a-table"><thead><tr>' + head.map(function (h) { return '<th' + (h.charAt(0) === '#' ? ' class="num"' : '') + '>' + h.replace(/^#/, '') + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function money(n) { return '<span class="' + (n < 0 ? 'p-amt-neg' : 'p-amt-pos') + '">' + (n > 0 ? '+' : '') + A.fmt.num(n) + '</span>'; }

  var panels = {
    orders: function () {
      return table(['Order', 'Date', '#Items', '#Total', 'Payment', 'Status'], orders.map(function (o) {
        return '<tr><td><a class="p-link" href="order.html?id=' + o.no + '">#' + o.no + '</a></td><td>' + PD.fd(o.date) + '</td><td class="num">' + o.items + '</td><td class="num">' + bdt(o.total) + '</td><td>COD</td><td>' + badge(o.st[0], o.st[1]) + '</td></tr>';
      }), 'No orders yet') + (c.orders > shown ? '<div class="p-pager"><span>Showing latest ' + shown + ' of ' + c.orders + ' orders</span><a class="p-link" href="orders.html">View all in Orders</a></div>' : '');
    },
    returns: function () {
      return table(['Return', 'Order', 'Date', 'Reason', 'Return shipping', '#Amount', 'Refund to', 'Status'], returns.map(function (r) {
        return '<tr><td><a class="p-link" href="returns.html">' + r.no + '</a></td><td>#' + r.order + '</td><td>' + PD.fd(r.date) + '</td><td>' + esc(r.reason) + '</td><td>' + (r.fault ? badge('We pay', 'info') : badge('Customer pays', 'muted')) + '</td><td class="num">' + bdt(r.amount) + '</td><td class="p-small">' + esc(r.to) + '</td><td>' + badge(r.status, r.status === 'Refunded' ? 'ok' : r.status === 'Rejected' ? 'danger' : 'warn') + '</td></tr>';
      }), 'No returns') + '<p class="p-muted p-small" style="padding:0 12px 10px">Return ratio ' + (c.orders ? Math.round(c.returns / c.orders * 100) : 0) + '% (' + c.returns + ' of ' + c.orders + ' orders).</p>';
    },
    guests: function () {
      return '<div class="p-note ok" style="margin:12px">Guest orders placed with this phone number were linked to this account automatically after phone OTP verification' + (c.verified ? '.' : ' — <b>pending: phone not verified yet</b>.') + '</div>' +
        table(['Guest order', 'Placed', 'Phone used', '#Total', 'Linked on'], guests.map(function (g) { return '<tr><td><a class="p-link" href="order.html?id=' + g.no + '">#' + g.no + '</a></td><td>' + PD.fd(g.date) + '</td><td>' + g.phone + '</td><td class="num">' + bdt(g.total) + '</td><td>' + PD.fd(g.linked) + ' ' + badge('OTP verified', 'ok') + '</td></tr>'; }), 'No linked guest orders');
    },
    wallet: function () {
      return '<div class="p-cols" style="padding:12px"><div><div class="p-row sp"><div><div class="p-muted p-small">Store wallet balance (spend-only)</div><b style="font-size:24px" id="cu-wbal">' + bdt(st.walletBal) + '</b></div><button class="a-btn" data-act="wallet" data-perm="customers.wallet_adjust" data-perm-mode="disable">Adjust wallet</button></div>' +
        table(['Date', 'Type', 'Ref', '#Amount', 'By'], st.wallet.map(function (w) { return '<tr><td>' + PD.fd(w.d) + '</td><td>' + esc(w.type) + '</td><td>' + w.ref + '</td><td class="num">' + money(w.amt) + '</td><td>' + esc(w.by) + '</td></tr>'; }), 'No wallet activity') + '</div>' +
        '<div><div class="p-row sp"><div><div class="p-muted p-small">Loyalty points</div><b style="font-size:24px">' + A.fmt.num(st.pointsBal) + '</b></div><button class="a-btn" data-act="points" data-perm="customers.wallet_adjust" data-perm-mode="disable">Adjust points</button></div>' +
        table(['Date', 'Type', 'Ref', '#Points'], st.pts.map(function (w) { return '<tr><td>' + PD.fd(w.d) + '</td><td>' + esc(w.type) + '</td><td>' + w.ref + '</td><td class="num">' + money(w.amt) + '</td></tr>'; }), 'No points history') + '</div></div>';
    },
    addr: function () {
      return '<div class="p-stack" style="padding:12px">' + addrs.map(function (a) { return '<div class="p-addr"><div><b>' + a.label + '</b> ' + (a.def ? badge('Default', 'info') : '') + '<div>' + esc(a.line) + ', ' + esc(a.city) + '</div><div class="p-muted p-small">Phone ' + c.phone + '</div></div></div>'; }).join('') + '</div>' +
        '<div class="p-sec" style="padding:0 12px 12px"><h4>Coupons collected in wallet</h4>' + table(['Code', 'Description', 'Expires', 'Status'], coupons.map(function (k) { return '<tr><td class="p-mono">' + k.code + '</td><td>' + esc(k.desc) + '</td><td>' + PD.fd(k.exp) + '</td><td>' + badge(k.st, k.st === 'Used' ? 'muted' : 'ok') + '</td></tr>'; }), 'No coupons') + '</div>';
    },
    tickets: function () {
      return table(['Ticket', 'Subject', 'Channel', 'Date', 'Status'], tickets.map(function (t) { return '<tr><td><a class="p-link" href="tickets.html">' + t.no + '</a></td><td>' + esc(t.subject) + '</td><td>' + t.via + '</td><td>' + PD.fd(t.date) + '</td><td>' + badge(t.st, t.st === 'Resolved' ? 'ok' : t.st === 'Open' ? 'warn' : 'info') + '</td></tr>'; }), 'No tickets');
    },
    notes: function () {
      return '<div style="padding:12px"><div class="a-field"><label for="cu-note">Internal note (staff only)</label><textarea id="cu-note" rows="2" placeholder="Visible to staff only…"></textarea></div><button class="a-btn primary sm" data-act="addnote">Add note</button><div class="p-mt">' +
        st.notes.map(function (n) { return '<div class="p-note-item"><b>' + esc(n.by) + '</b> <span class="p-muted p-small">' + PD.fd(n.d) + '</span><div>' + esc(n.t) + '</div></div>'; }).join('') + '</div></div>';
    },
    dev: function () {
      var shared = devices.some(function (d) { return d.others; });
      return (shared ? '<div class="p-note danger" style="margin:12px">Device or IP also seen on other accounts — velocity flag raised. Review before approving large COD orders.</div>' : '') +
        table(['Device', 'IP', 'Location', 'Last seen', 'Also used by'], devices.map(function (d) { return '<tr><td>' + d.dev + '</td><td class="p-mono">' + d.ip + '</td><td>' + esc(d.loc) + '</td><td>' + A.fmt.dt(d.last) + '</td><td>' + (d.others ? badge(d.others + ' other account' + (d.others > 1 ? 's' : ''), 'danger') : '<span class="p-muted">—</span>') + '</td></tr>'; }), 'No devices');
    }
  };
  var TABS = [['orders', 'Orders', orders.length], ['returns', 'Returns', returns.length], ['guests', 'Linked guest orders', guests.length], ['wallet', 'Wallet & points'], ['addr', 'Addresses & coupons', addrs.length], ['tickets', 'Tickets', tickets.length], ['notes', 'Notes', null], ['dev', 'Devices & IPs', devices.length]];

  function riskBox() {
    return st.risky ? '<div class="p-flag"><div class="p-row sp"><b>' + badge('Risky customer', 'danger') + '</b><button class="a-btn sm" data-act="risk" data-perm="customers.flag" data-perm-mode="disable">Remove flag</button></div><div class="p-mt" style="margin-top:8px">Reason: ' + esc(st.reason) + '</div><div class="p-muted p-small" style="margin-top:6px">Risky customers must pay advance when advance payments are enabled (currently OFF at launch).</div></div>'
      : '<div class="p-row sp"><span class="p-muted p-small">Not flagged as risky.</span><button class="a-btn sm" data-act="risk" data-perm="customers.flag" data-perm-mode="disable">Mark as risky</button></div>';
  }
  function profile() {
    return '<div class="a-card"><div class="a-card-b"><div class="p-row"><span class="p-av lg">' + esc(initials(c.name)) + '</span><div><h2 style="margin:0">' + esc(c.name) + '</h2><div class="p-muted p-small">' + c.id + ' · ' + c.segment + (st.risky ? ' · ' : '') + (st.risky ? badge('Risky', 'danger') : '') + '</div></div></div>' +
      '<dl class="p-kvl p-mt"><dt>Phone</dt><dd>' + c.phone + ' ' + (c.verified ? badge('OTP verified', 'ok') : badge('Unverified', 'warn')) + '</dd><dt>Email</dt><dd>' + (esc(c.email) || '—') + '</dd><dt>City</dt><dd>' + esc(c.city) + '</dd><dt>Joined</dt><dd>' + PD.fd(c.joined) + '</dd><dt>Last order</dt><dd>' + PD.fd(c.lastOrder) + '</dd><dt>Account</dt><dd>' + (c.guest ? 'Started as guest, now registered' : 'Registered customer') + '</dd></dl>' +
      '<div class="p-mt">' + riskBox() + '</div></div></div>';
  }
  function statsRow() {
    return '<div class="p-statrow p-mb"><div class="p-st"><span>Orders</span><b>' + c.orders + '</b></div><div class="p-st"><span>Total spent</span><b>' + bdt(c.spent) + '</b></div><div class="p-st"><span>AOV</span><b>' + bdt(c.orders ? Math.round(c.spent / c.orders) : 0) + '</b></div><div class="p-st"><span>Return ratio</span><b>' + (c.orders ? Math.round(c.returns / c.orders * 100) : 0) + '%</b></div><div class="p-st"><span>Wallet</span><b>' + bdt(st.walletBal) + '</b></div><div class="p-st"><span>Points</span><b>' + A.fmt.num(st.pointsBal) + '</b></div></div>';
  }
  function tabs() {
    return '<div class="a-tabs p-tabsbar" role="tablist">' + TABS.map(function (t) { return '<button class="a-tab" role="tab" data-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + (t[2] ? ' <span class="a-count">' + t[2] + '</span>' : '') + '</button>'; }).join('') + '</div>';
  }
  function draw() {
    $('#cu-profile').innerHTML = profile();
    $('#cu-stats').innerHTML = statsRow();
    $('#cu-tabs').innerHTML = tabs();
    $('#cu-panel').innerHTML = panels[st.tab]();
    A.applyPerms($('#cu-root'));
  }

  function modalAdjust(kind) {
    var isW = kind === 'wallet', cur = isW ? st.walletBal : st.pointsBal;
    var b = A.modal.open('<div class="p-note p-mb">Current ' + (isW ? 'wallet balance <b>' + bdt(cur) + '</b> (spend-only store credit)' : 'points balance <b>' + A.fmt.num(cur) + '</b>') + '. Use a negative number to deduct.</div>' +
      '<div class="a-field"><label for="adj-amt">Amount (' + (isW ? '৳' : 'points') + ')</label><input id="adj-amt" type="number" step="' + (isW ? 10 : 1) + '" placeholder="e.g. 200 or -100"></div>' +
      '<div class="a-field"><label for="adj-reason">Reason (required)</label><textarea id="adj-reason" rows="3" placeholder="e.g. Goodwill credit for delayed delivery, ticket T-912"></textarea><div class="a-err" id="adj-err" hidden></div></div>' +
      '<div class="p-muted p-small">This action is written to the audit log with your name, amount and reason.</div>' +
      '<div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="adj-ok">Apply adjustment</button></div>', { title: isW ? 'Adjust wallet' : 'Adjust loyalty points', size: 'sm' });
    $('#adj-ok', b).onclick = function () {
      var amt = parseFloat($('#adj-amt', b).value), why = $('#adj-reason', b).value.trim(), err = $('#adj-err', b);
      var msg = isNaN(amt) || amt === 0 ? 'Enter a non-zero amount.' : !why ? 'A reason is required.' : (cur + amt < 0 ? 'Balance cannot go below zero.' : '');
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      if (isW) { st.walletBal += amt; st.wallet.unshift({ d: NOW, type: 'Manual adjustment: ' + why, ref: '—', amt: amt, by: 'You' }); } else { st.pointsBal += amt; st.pts.unshift({ d: NOW, type: 'Manual adjustment: ' + why, ref: '—', amt: amt }); }
      audit(isW ? 'customer.wallet_adjust' : 'customer.points_adjust', c.id + ' ' + c.name, String(cur), String(cur + amt), why);
      A.modal.close(); st.tab = 'wallet'; draw(); A.toast((isW ? 'Wallet' : 'Points') + ' adjusted by ' + (amt > 0 ? '+' : '') + amt + ' (audit logged)', 'ok');
    };
  }
  function modalRisk() {
    var on = st.risky;
    var b = A.modal.open((on ? '<p>Remove the risky flag from <b>' + esc(c.name) + '</b>? Advance-payment rules will no longer apply because of this flag.</p>'
      : '<div class="p-note warn p-mb">Risky customers must pay advance when advance payments are enabled (feature flag currently OFF at launch; admin sets the advance %).</div>') +
      '<div class="a-field"><label for="rk-reason">Reason (required)</label><textarea id="rk-reason" rows="3" placeholder="' + (on ? 'Why is the flag being removed?' : 'e.g. Refused 2 COD deliveries, courier complaint') + '"></textarea><div class="a-err" id="rk-err" hidden>A reason is required.</div></div>' +
      '<div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn ' + (on ? 'primary' : 'danger') + '" id="rk-ok">' + (on ? 'Remove flag' : 'Mark as risky') + '</button></div>', { title: on ? 'Remove risky flag' : 'Mark as risky', size: 'sm' });
    $('#rk-ok', b).onclick = function () {
      var why = $('#rk-reason', b).value.trim(); if (!why) { $('#rk-err', b).hidden = false; return; }
      st.risky = !on; st.reason = on ? '' : why; st.notes.unshift({ by: 'You', d: NOW, t: (on ? 'Risky flag removed: ' : 'Flagged risky: ') + why });
      audit(on ? 'customer.unflag_risky' : 'customer.flag_risky', c.id + ' ' + c.name, String(on), String(!on), why);
      A.modal.close(); draw(); A.toast(on ? 'Risky flag removed' : 'Customer marked as risky', on ? 'ok' : 'warn');
    };
  }

  A.renderPage({
    active: 'customers', title: c.name, crumbs: [['Dashboard', 'index.html'], ['Customers', 'customers.html'], [c.name]],
    actions: '<a class="a-btn" href="customers.html">‹ All customers</a>',
    body: '<div id="cu-root"><div class="p-profile"><div id="cu-profile"></div><div><div id="cu-stats"></div><div class="a-card"><div id="cu-tabs"></div><div id="cu-panel"></div></div></div></div></div>',
    onReady: function (root) {
      draw();
      root.addEventListener('click', function (e) {
        var t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; draw(); return; }
        var a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
        if (a.dataset.act === 'wallet') modalAdjust('wallet');
        else if (a.dataset.act === 'points') modalAdjust('points');
        else if (a.dataset.act === 'risk') modalRisk();
        else if (a.dataset.act === 'addnote') { var v = $('#cu-note').value.trim(); if (!v) return; st.notes.unshift({ by: 'You', d: NOW, t: v }); draw(); A.toast('Note added', 'ok'); }
      });
    }
  });
})();
