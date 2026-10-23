(function () {
  'use strict';
  var A = window.Admin, D = window.SRD, $ = A.$, $$ = A.$$, esc = A.esc, bdt = A.fmt.bdt, I = A.icons;
  var f = { q: '', sr: '', area: '', chip: 'all' };
  function badge(t, k) { return '<span class="a-badge ' + k + '">' + esc(t) + '</span>'; }
  function live(id) { return D.sales.filter(function (s) { return s.shop === id && D.isLive(s); }); }
  function totalSales(id) { return live(id).reduce(function (a, s) { return a + s.total; }, 0); }
  function areas() { var o = {}; D.shops.forEach(function (s) { o[s.area.split(',').pop().trim()] = 1; }); return Object.keys(o).sort(); }
  function list() {
    var q = f.q.toLowerCase();
    return D.shops.filter(function (s) {
      return (!q || (s.name + s.owner + s.phone + s.area).toLowerCase().indexOf(q) >= 0) && (!f.sr || s.sr === f.sr) && (!f.area || s.area.indexOf(f.area) >= 0) &&
        (f.chip === 'all' || (f.chip === 'new' && s.isNew) || (f.chip === 'due' && D.shopDue(s.id) > 0) || (f.chip === 'blocked' && s.blocked));
    });
  }
  function rows() {
    var l = list();
    return l.length ? l.map(function (s) {
      var d = D.shopDue(s.id), last = live(s.id).map(function (x) { return x.date; }).sort().pop();
      return '<tr class="s-clk" data-id="' + s.id + '"><td><b>' + esc(s.name) + '</b><div class="s-muted">' + esc(s.owner) + '</div></td><td>' + esc(s.phone) + '</td><td>' + esc(s.area) + '</td><td>' + esc(D.srById(s.sr).name) + '</td><td><div class="s-flags">' + (s.isNew ? badge('New: review', 'info') : '') + (s.blocked ? badge('Blocked', 'danger') : '') + (!s.isNew && !s.blocked ? badge('Active', 'ok') : '') + '</div></td><td class="num">' + bdt(totalSales(s.id)) + '</td><td class="num ' + (d ? 's-due' : '') + '">' + bdt(d) + '</td><td>' + (last ? D.fd(last) : '<span class="s-muted">none</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="8"><div class="a-empty">No shops match.</div></td></tr>';
  }
  function body() {
    var nw = D.shops.filter(function (s) { return s.isNew; }).length, owing = D.shops.filter(function (s) { return D.shopDue(s.id) > 0; }).length, td = D.shops.reduce(function (a, s) { return a + D.shopDue(s.id); }, 0);
    return '<div class="s-kpis"><div class="a-stat"><div class="l">B2B shops</div><div class="v">' + D.shops.length + '</div></div><div class="a-stat"><div class="l">New: review</div><div class="v">' + nw + '</div><div class="d ' + (nw ? 'down' : '') + '">added by SRs in the field</div></div><div class="a-stat"><div class="l">Shops with due</div><div class="v">' + owing + '</div></div><div class="a-stat"><div class="l">Total due</div><div class="v">' + bdt(td) + '</div><div class="d"><a href="b2b-dues.html">aging report</a></div></div></div>' +
      '<div class="a-toolbar"><input class="grow" id="f-q" type="search" placeholder="Search shop, owner, phone, area" aria-label="Search"><select id="f-sr" aria-label="SR"><option value="">All SRs</option>' + D.srs.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') + '</select><select id="f-area" aria-label="Area"><option value="">All areas</option>' + areas().map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select>' +
      [['all', 'All'], ['new', 'New: review'], ['due', 'With due'], ['blocked', 'Blocked']].map(function (c) { return '<button class="a-btn sm' + (f.chip === c[0] ? ' primary' : '') + '" data-chip="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Shop</th><th>Phone</th><th>Area</th><th>Added by SR</th><th>Flags</th><th class="num">Total sales</th><th class="num">Current due</th><th>Last sale</th></tr></thead><tbody id="sh-rows">' + rows() + '</tbody></table></div></div>' +
      '<p class="a-hint" style="margin-top:8px">Shops are independent businesses, not linked to online customers. SR-added shops can be sold to straight away; mark them reviewed after checking name, phone and address.</p>';
  }
  function detail(id) {
    var s = D.SBY[id], d = D.shopDue(id), ag = D.aging(id), tab = 'sales';
    function inner() {
      var ss = D.sales.filter(function (x) { return x.shop === id && x.status !== 'cancelled'; });
      var tbl;
      if (tab === 'sales') tbl = '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Date</th><th>Memo</th><th>Status</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Due</th></tr></thead><tbody>' + (ss.length ? ss.map(function (x) { return '<tr><td>' + D.fd(x.date) + '</td><td class="s-mono">' + (x.memo || '-') + '</td><td>' + badge(x.status === 'submitted' ? 'Pending' : x.status, x.status === 'rejected' ? 'danger' : x.status === 'submitted' ? 'warn' : 'ok') + '</td><td class="num">' + bdt(x.total) + '</td><td class="num">' + bdt(x.paid) + '</td><td class="num ' + (x.due && D.isLive(x) ? 's-due' : '') + '">' + bdt(x.due) + '</td></tr>'; }).join('') : '<tr><td colspan="6">No sales yet.</td></tr>') + '</tbody></table></div>';
      else { var lr = D.ledger(id); tbl = '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Date</th><th>Entry</th><th>Ref</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead><tbody>' + (lr.length ? lr.map(function (r) { return '<tr class="' + (r.pending ? 's-mute' : '') + '"><td>' + D.fd(r.date) + '</td><td>' + r.type + '</td><td class="s-mono">' + esc(r.ref || '') + (r.pending ? ' (awaiting confirm)' : '') + '</td><td class="num">' + (r.pending ? '(' + bdt(r.pending) + ')' : r.amt > 0 ? '+' + bdt(r.amt) : '-' + bdt(-r.amt)) + '</td><td class="num"><b>' + (r.pending ? '' : bdt(r.bal)) + '</b></td></tr>'; }).join('') : '<tr><td colspan="5">No ledger entries.</td></tr>') + '</tbody></table></div>'; }
      return '<div class="s-dtabs"><button data-dt="sales" aria-selected="' + (tab === 'sales') + '">Sales history</button><button data-dt="ledger" aria-selected="' + (tab === 'ledger') + '">Due ledger</button></div>' + tbl;
    }
    var b = A.drawer.open('<div class="s-flags" style="margin-bottom:10px">' + (s.isNew ? badge('New: review', 'info') : '') + (s.blocked ? badge('Blocked', 'danger') : '') + '</div><dl class="a-kv"><dt>Owner</dt><dd>' + esc(s.owner) + '</dd><dt>Phone</dt><dd>' + esc(s.phone) + '</dd><dt>Address</dt><dd>' + esc(s.addr) + ', ' + esc(s.area) + '</dd><dt>Added</dt><dd>' + D.fd(s.since) + ' by ' + esc(D.srById(s.sr).name) + '</dd></dl>' +
      '<div class="s-kpis" style="margin-top:14px"><div class="a-stat"><div class="l">Total sales</div><div class="v">' + bdt(totalSales(id)) + '</div></div><div class="a-stat"><div class="l">Current due</div><div class="v ' + (d ? 's-due' : '') + '">' + bdt(d) + '</div><div class="d">' + (ag.oldest ? 'oldest ' + ag.oldest + ' days' : 'clear') + '</div></div></div>' +
      '<div class="s-act" style="margin-bottom:6px">' + (s.isNew ? '<button class="a-btn primary" data-rev data-perm="sr.manage" data-perm-mode="disable">' + I.check + ' Mark reviewed</button>' : '') + '<button class="a-btn' + (s.blocked ? '' : ' danger') + '" data-blk data-perm="sr.manage" data-perm-mode="disable">' + (s.blocked ? 'Unblock shop' : 'Block shop') + '</button></div><div id="dt-body">' + inner() + '</div>', { title: s.name, width: 640 });
    b.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.dt) { tab = t.dataset.dt; $('#dt-body', b).innerHTML = inner(); }
      else if (t.hasAttribute('data-rev')) { s.isNew = false; A.toast(s.name + ' marked reviewed', 'ok'); A.drawer.close(); paint(); }
      else if (t.hasAttribute('data-blk')) { s.blocked = !s.blocked; A.toast(s.blocked ? 'Shop blocked: SRs cannot sell to it' : 'Shop unblocked', s.blocked ? 'warn' : 'ok'); A.drawer.close(); paint(); }
    });
  }
  function paint() {
    var host = $('#b2'); host.innerHTML = body();
    $('#f-q', host).value = f.q; $('#f-sr', host).value = f.sr; $('#f-area', host).value = f.area;
    $('#f-q', host).oninput = function (e) { f.q = e.target.value; $('#sh-rows').innerHTML = rows(); };
    $('#f-sr', host).onchange = function (e) { f.sr = e.target.value; paint(); };
    $('#f-area', host).onchange = function (e) { f.area = e.target.value; paint(); };
    $$('[data-chip]', host).forEach(function (b) { b.onclick = function () { f.chip = b.dataset.chip; paint(); }; });
    A.applyPerms(host);
  }
  function onReady() {
    paint();
    $('#b2').addEventListener('click', function (e) { var r = e.target.closest('tr[data-id]'); if (r) detail(r.dataset.id); });
    var m = /[?&]id=(b\d+)/.exec(location.search); if (m && D.SBY[m[1]]) detail(m[1]);
  }
  A.renderPage({ active: 'b2b-shops', title: 'B2B shops', crumbs: [['People & partners', '#'], ['B2B shops']], actions: '', body: '<div id="b2"></div>', onReady: onReady });
})();
