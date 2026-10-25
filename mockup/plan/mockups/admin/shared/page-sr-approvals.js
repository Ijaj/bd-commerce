(function () {
  'use strict';
  var A = window.Admin, D = window.SRD, $ = A.$, $$ = A.$$, esc = A.esc, bdt = A.fmt.bdt, I = A.icons;
  var tab = 'sales', mc = {};
  function badge(t, k) { return '<span class="a-badge ' + k + '">' + esc(t) + '</span>'; }
  function audit(a, e, b, af) { try { A.audit.log(a, e, b, af); } catch (er) { /* ignore */ } }
  function pendSales() { return D.sales.filter(function (s) { return s.status === 'submitted'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  function pendCols() { return D.collections.filter(function (c) { return c.status === 'pending'; }); }
  function ago(d) { var n = D.days(d, D.TODAY); return n === 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; }
  function pc(a, b) { return Math.round((a / b - 1) * 1000) / 10; }

  function card(s) {
    var sh = D.SBY[s.shop], sr = D.srById(s.sr), lt = D.listTotal(s), low = s.items.filter(function (i) { return i.price < D.PBY[i.sku].list; }).length, due = D.shopDue(s.shop);
    var disc = pc(s.total, lt);
    return '<div class="a-card s-q" data-sale="' + s.id + '"><div class="s-q-h"><h3>' + esc(sh.name) + '</h3>' + (sh.isNew ? badge('New shop: review', 'info') : '') + badge(s.delivery === 'sr' ? 'SR delivers' : 'Staff delivers', 'muted') +
      '<span class="s-grow"></span><span class="s-muted">' + esc(sr.name) + ' · submitted ' + ago(s.date) + ' · ' + s.id + '</span></div>' +
      (low ? '<div class="s-alert danger">' + I.warn + '<span><b>' + low + ' of ' + s.items.length + ' item' + (low > 1 ? 's' : '') + ' priced below list.</b> Overall ' + disc + '% vs list total (' + bdt(lt - s.total) + ' less).</span></div>' : '') +
      (due > 0 ? '<div class="s-alert">' + I.warn + '<span>Shop already owes <b class="s-due">' + bdt(due) + '</b>' + (D.aging(sh.id).c ? ', of which ' + bdt(D.aging(sh.id).c) + ' is over 60 days old' : '') + '.</span></div>' : '') +
      (sh.isNew ? '<div class="s-alert">' + I.warn + '<span>Shop added by ' + esc(sr.name) + ' on ' + D.fd(sh.since) + ': ' + esc(sh.owner) + ', ' + esc(sh.phone) + ', ' + esc(sh.area) + '. Check the details when approving.</span></div>' : '') +
      '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">SR price</th><th class="num">List price</th><th class="num">Diff</th><th class="num">Line total</th></tr></thead><tbody>' +
      s.items.map(function (i) { var p = D.PBY[i.sku], d = pc(i.price, p.list), lw = i.price < p.list; return '<tr class="' + (lw ? 's-low' : '') + '"><td>' + p.ic + ' ' + esc(p.en) + '<div class="s-muted s-mono">' + i.sku + '</div></td><td class="num">' + i.qty + '</td><td class="num"><b>' + bdt(i.price) + '</b></td><td class="num">' + bdt(p.list) + '</td><td class="num ' + (lw ? 's-low-pct' : '') + '">' + (d === 0 ? '0%' : (d > 0 ? '+' : '') + d + '%') + '</td><td class="num">' + bdt(i.qty * i.price) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="s-q-f"><div>' + (s.note ? '<div class="s-muted">SR note</div><div style="max-width:380px">' + esc(s.note) + '</div>' : '<div class="s-muted">No SR note.</div>') + '<div class="s-muted" style="margin-top:6px">Stock is reserved; approving deducts it and issues the memo.</div></div>' +
      '<div class="s-sum"><span class="l">Total</span><span class="r t">' + bdt(s.total) + '</span><span class="l">List total</span><span class="r">' + bdt(lt) + '</span><span class="l">Collected now</span><span class="r">' + bdt(s.paid) + '</span><span class="l">Goes to due (baki)</span><span class="r ' + (s.due ? 's-due' : 's-ok') + '">' + bdt(s.due) + '</span></div>' +
      '<div class="s-act"><button class="a-btn danger" data-rej="' + s.id + '" data-perm="sr.approve" data-perm-mode="disable">' + I.x + ' Reject</button><button class="a-btn primary" data-app="' + s.id + '" data-perm="sr.approve" data-perm-mode="disable">' + I.check + ' Approve</button></div></div></div>';
  }
  function salesTab() { var l = pendSales(); return l.length ? l.map(card).join('') : '<div class="a-card"><div class="a-empty">' + I.check + '<h3>Queue is clear</h3><p>New SR sales appear here after the SR submits them.</p></div></div>'; }
  function colTab() {
    var l = pendCols();
    return '<div class="a-banner info">' + I.warn + '<div>SRs record money they collected against a shop\'s due. Confirm only after the cash or transfer is verified. Confirmed amounts reduce the shop due and count toward the SR\'s commission.</div></div>' +
      (l.length ? '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Date</th><th>SR</th><th>Shop</th><th>Method</th><th>Reference / note</th><th class="num">Amount</th><th class="num">Shop due now</th><th></th></tr></thead><tbody>' + l.map(function (c) {
        return '<tr data-col="' + c.id + '"><td>' + D.fd(c.date) + '</td><td>' + esc(D.srById(c.sr).name) + '</td><td><b>' + esc(D.SBY[c.shop].name) + '</b><div class="s-muted">' + esc(D.SBY[c.shop].area) + '</div></td><td>' + esc(c.method) + '</td><td>' + (c.note ? esc(c.note) : '<span class="s-muted">none</span>') + '</td><td class="num"><b>' + bdt(c.amount) + '</b></td><td class="num">' + bdt(D.shopDue(c.shop)) + '</td><td style="white-space:nowrap"><button class="a-btn sm danger" data-crej="' + c.id + '" data-perm="sr.approve" data-perm-mode="disable">Reject</button> <button class="a-btn sm primary" data-cok="' + c.id + '" data-perm="sr.approve" data-perm-mode="disable">' + I.check + ' Confirm</button></td></tr>'; }).join('') + '</tbody></table></div></div>' : '<div class="a-card"><div class="a-empty">' + I.check + '<h3>No collections waiting</h3></div></div>');
  }
  function histTab() {
    var l = D.sales.filter(function (s) { return s.status !== 'submitted' && s.status !== 'cancelled'; }).slice(0, 14);
    return '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Date</th><th>SR</th><th>Shop</th><th>Memo</th><th class="num">Total</th><th>Decision</th></tr></thead><tbody>' + l.map(function (s) { return '<tr><td>' + D.fd(s.date) + '</td><td>' + esc(D.srById(s.sr).name) + '</td><td>' + esc(D.SBY[s.shop].name) + '</td><td class="s-mono">' + (s.memo || '') + '</td><td class="num">' + bdt(s.total) + '</td><td>' + (s.status === 'rejected' ? badge('Rejected', 'danger') + ' <span class="s-muted">' + esc(s.rejectReason || '') + '</span>' : badge(s.status === 'delivered' ? 'Approved, delivered' : 'Approved', 'ok')) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  function tabs() {
    return '<div class="a-tabs s-tabsbar">' + [['sales', 'Sales to approve', pendSales().length], ['cols', 'Due collections', pendCols().length], ['hist', 'Recent decisions', '']].map(function (t) { return '<button class="a-tab" data-t="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + (t[2] !== '' ? ' <span class="a-count">' + t[2] + '</span>' : '') + '</button>'; }).join('') + '</div>';
  }
  function kpis() {
    var ps = pendSales(), v = ps.reduce(function (a, s) { return a + s.total; }, 0), lowN = ps.filter(function (s) { return s.items.some(function (i) { return i.price < D.PBY[i.sku].list; }); }).length;
    return '<div class="s-kpis"><div class="a-stat"><div class="l">Sales waiting</div><div class="v">' + ps.length + '</div><div class="d">' + bdt(v) + ' value</div></div><div class="a-stat"><div class="l">Priced below list</div><div class="v">' + lowN + '</div><div class="d ' + (lowN ? 'down' : '') + '">check before approving</div></div><div class="a-stat"><div class="l">Collections to confirm</div><div class="v">' + pendCols().length + '</div><div class="d">' + bdt(pendCols().reduce(function (a, c) { return a + c.amount; }, 0)) + '</div></div><div class="a-stat"><div class="l">New shops to review</div><div class="v">' + D.shops.filter(function (s) { return s.isNew; }).length + '</div><div class="d"><a href="b2b-shops.html">open B2B shops</a></div></div></div>';
  }
  function paint() {
    $('#sa').innerHTML = kpis() + tabs() + (tab === 'sales' ? salesTab() : tab === 'cols' ? colTab() : histTab());
    A.applyPerms($('#sa'));
  }
  function next(ym) { var n = 0; D.sales.forEach(function (s) { if (s.memo && s.memo.indexOf('SR-' + ym) === 0) n = Math.max(n, +s.memo.slice(-4)); }); return 'SR-' + ym + '-' + ('000' + (n + 1)).slice(-4); }
  function rejectModal(title, who, fn) {
    var b = A.modal.open('<p class="s-muted" style="margin-top:0">' + who + '</p><div class="a-field"><label for="rj-p">Common reason</label><select id="rj-p"><option value="">Choose…</option><option>Price too low for this quantity</option><option>Stock not available for some items</option><option>Shop has an old unpaid balance; collect first</option><option>Wrong item or quantity, please re-submit</option><option>Payment not received / cannot be verified</option></select></div><div class="a-field"><label for="rj-t">Reason shown to the SR *</label><textarea id="rj-t" rows="3" placeholder="Explain what the SR should change"></textarea></div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn danger" id="rj-ok">Reject</button></div>', { title: title, size: 'sm' });
    $('#rj-p', b).onchange = function (e) { if (e.target.value) $('#rj-t', b).value = e.target.value; };
    $('#rj-ok', b).onclick = function () { var r = $('#rj-t', b).value.trim(); if (!r) { A.toast('Write a reason for the SR', 'warn'); return; } A.modal.close(); fn(r); };
  }
  function onReady(root) {
    paint();
    $('#sa').addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.t) { tab = t.dataset.t; paint(); return; }
      var s;
      if (t.dataset.app) {
        s = D.sales.filter(function (x) { return x.id === t.dataset.app; })[0];
        var warn = s.items.some(function (i) { return i.price < D.PBY[i.sku].list; });
        A.confirm('Approve <b>' + bdt(s.total) + '</b> sale by ' + esc(D.srById(s.sr).name) + ' to <b>' + esc(D.SBY[s.shop].name) + '</b>?' + (warn ? '<br><span class="s-warn">Some prices are below list.</span>' : '') + '<br><span class="s-muted">Stock is deducted, a numbered memo is issued, and ' + bdt(s.due) + ' goes to the shop due ledger.</span>', 'Approve', function () {
          s.status = 'approved'; s.approvedBy = 'You'; s.approvedOn = D.TODAY; s.memo = next(D.TODAY.slice(2, 4) + D.TODAY.slice(5, 7)); s.date = D.TODAY;
          audit('sr_sale.approve', s.id + ' ' + s.memo, 'submitted', 'approved'); A.toast('Approved. Memo ' + s.memo + ' issued, SR notified', 'ok'); paint();
        });
      } else if (t.dataset.rej) {
        s = D.sales.filter(function (x) { return x.id === t.dataset.rej; })[0];
        rejectModal('Reject SR sale', esc(D.srById(s.sr).name) + ' to ' + esc(D.SBY[s.shop].name) + ', ' + bdt(s.total) + '. Reserved stock is released.', function (r) { s.status = 'rejected'; s.rejectReason = r; s.rejectedBy = 'You'; s.paid = 0; audit('sr_sale.reject', s.id, 'submitted', 'rejected: ' + r); A.toast('Rejected; stock released, SR notified', 'warn'); paint(); });
      } else if (t.dataset.cok) {
        var c = D.collections.filter(function (x) { return x.id === t.dataset.cok; })[0];
        A.confirm('Confirm <b>' + bdt(c.amount) + '</b> (' + esc(c.method) + ') collected by ' + esc(D.srById(c.sr).name) + ' from <b>' + esc(D.SBY[c.shop].name) + '</b>?<br><span class="s-muted">The shop due drops and it counts toward the SR\'s commission this month.</span>', 'Confirm', function () { c.status = 'confirmed'; c.confirmedBy = 'You'; c.date = c.date; audit('b2b_collection.confirm', c.id, 'pending', 'confirmed'); A.toast('Collection confirmed, shop due updated', 'ok'); paint(); });
      } else if (t.dataset.crej) {
        var k = D.collections.filter(function (x) { return x.id === t.dataset.crej; })[0];
        rejectModal('Reject collection', esc(D.srById(k.sr).name) + ', ' + bdt(k.amount) + ' from ' + esc(D.SBY[k.shop].name) + '.', function (r) { D.collections.splice(D.collections.indexOf(k), 1); audit('b2b_collection.reject', k.id, 'pending', 'rejected: ' + r); A.toast('Collection rejected, SR notified', 'warn'); paint(); });
      }
    });
  }
  A.renderPage({ active: 'sr-approvals', title: 'SR approvals', crumbs: [['People & partners', '#'], ['SR approvals']], actions: '<a class="a-btn" href="../sr/index.html" target="_blank">Open SR portal</a>', body: '<div id="sa"></div>', onReady: onReady });
})();
