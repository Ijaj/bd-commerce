/* Suppliers + dropship queue (agent E) */
(function () {
  'use strict';
  var A = window.Admin, PD = window.PD, $ = A.$, esc = A.esc;
  var st = { tab: 'list', qSup: '', qStatus: '' };
  function badge(t, k) { return '<span class="a-badge ' + k + '">' + esc(t) + '</span>'; }
  function audit(a, e, b, af, x) { try { A.audit.log(a, e, b, af, x); } catch (er) { /* ignore */ } }
  var ROUTE = { direct: 'Ship direct to customer', warehouse: 'Via our warehouse first' };

  /* dropship queue */
  var R = PD.rng(777), q = [];
  function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
  var STS = ['Awaiting confirmation', 'Awaiting confirmation', 'Confirmed', 'Ready for pickup', 'Out of stock', 'Confirmed'];
  var sups = PD.suppliers.filter(function (s) { return s.status === 'active'; });
  for (var i = 0; i < 16; i++) {
    var s = sups[ri(0, sups.length - 1)], p = PD.products.filter(function (x) { return x.supplier === s.id; }), pr = p.length ? p[ri(0, p.length - 1)] : PD.products[0];
    var status = STS[ri(0, STS.length - 1)], hrs = ri(1, 70);
    q.push({ id: i, order: 'BD-' + (24200 + ri(0, 90)), product: pr.name, sku: pr.sku, qty: ri(1, 3), sup: s.id, route: s.route, status: status, hrs: hrs, slaH: status === 'Awaiting confirmation' ? 24 : status === 'Confirmed' ? s.lead * 24 : 0 });
  }
  function slaCell(r) {
    if (r.status === 'Ready for pickup') return '<span class="p-sla-ok">Done — courier booked</span>';
    if (r.status === 'Out of stock') return '<span class="p-sla-bad">Needs action</span>';
    var left = r.slaH - r.hrs;
    if (left < 0) return '<span class="p-sla-bad">Overdue ' + Math.abs(left) + ' h</span>';
    if (left <= 6) return '<span class="p-sla-warn">' + left + ' h left</span>';
    return '<span class="p-sla-ok">' + left + ' h left</span>';
  }
  function stBadge(s) { return badge(s, s === 'Ready for pickup' ? 'ok' : s === 'Out of stock' ? 'danger' : s === 'Confirmed' ? 'info' : 'warn'); }

  function listPanel() {
    var h = '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Supplier</th><th>Contact</th><th>Dropship route</th><th class="num">Products</th><th class="num">Open orders</th><th>On-time</th><th class="num">Cancel rate</th><th>Status</th></tr></thead><tbody>';
    PD.suppliers.forEach(function (s) {
      h += '<tr class="p-clk" data-sup="' + s.id + '"><td><b>' + esc(s.name) + '</b><div class="p-muted p-small">' + s.id + '</div></td><td>' + esc(s.contact) + '<div class="p-muted p-small">' + s.phone + '</div></td><td>' + ROUTE[s.route] + '</td><td class="num">' + s.products + '</td><td class="num">' + s.openOrders + '</td>' +
        '<td style="min-width:120px"><div class="p-row" style="gap:6px"><div class="p-bar ' + (s.onTime >= 90 ? 'ok' : s.onTime >= 80 ? '' : 'dng') + ' p-grow"><i style="width:' + s.onTime + '%"></i></div><b>' + s.onTime + '%</b></div></td><td class="num">' + (s.cancel > 8 ? '<span class="p-sla-bad">' + s.cancel + '%</span>' : s.cancel + '%') + '</td><td>' + (s.status === 'active' ? badge('Active', 'ok') : badge('Paused', 'muted')) + '</td></tr>';
    });
    return h + '</tbody></table></div></div>';
  }
  function queueRows() {
    return q.filter(function (r) { return (!st.qSup || r.sup === st.qSup) && (!st.qStatus || r.status === st.qStatus); });
  }
  function queuePanel() {
    var rows = queueRows(), over = q.filter(function (r) { return (r.status === 'Awaiting confirmation' || r.status === 'Confirmed') && r.slaH - r.hrs < 0; }).length;
    var h = '<div class="p-note p-mb">Dropship items are forwarded to the supplier portal automatically when an order enters Processing. Suppliers confirm stock, then mark ready; the courier pickup is booked on <b>our</b> Pathao/Steadfast account. Routes: <b>direct</b> (supplier hands parcel to courier for the customer) or <b>via our warehouse</b> (we receive, check, then ship).</div>' +
      '<div class="a-card"><div class="a-toolbar"><select id="q-sup" class="a-select"><option value="">All suppliers</option>' + sups.map(function (s) { return '<option value="' + s.id + '"' + (st.qSup === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select>' +
      '<select id="q-st" class="a-select"><option value="">All statuses</option>' + ['Awaiting confirmation', 'Confirmed', 'Ready for pickup', 'Out of stock'].map(function (x) { return '<option' + (st.qStatus === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select><span class="p-grow"></span>' + (over ? badge(over + (over === 1 ? ' item' : ' items') + ' past SLA', 'danger') : '') + '</div>' +
      '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Order</th><th>Item</th><th class="num">Qty</th><th>Supplier</th><th>Route</th><th>Status</th><th>Forwarded</th><th>SLA</th><th></th></tr></thead><tbody>';
    if (!rows.length) h += '<tr><td colspan="9"><div class="a-empty"><h3>Queue is clear</h3></div></td></tr>';
    rows.forEach(function (r) {
      var s = PD.supplier(r.sup);
      h += '<tr><td><a class="p-link" href="order.html?id=' + r.order + '">#' + r.order + '</a></td><td>' + esc(r.product) + '<div class="p-muted p-small">' + r.sku + '</div></td><td class="num">' + r.qty + '</td><td>' + esc(s.name) + '</td><td class="p-small">' + (r.route === 'direct' ? 'Direct to customer' : 'Via warehouse') + '</td><td>' + stBadge(r.status) + '</td><td>' + r.hrs + ' h ago</td><td>' + slaCell(r) + '</td><td style="white-space:nowrap">' +
        (r.status === 'Out of stock' ? '<button class="a-btn sm" data-q="split" data-id="' + r.id + '">Cancel item &amp; notify</button>' : r.status === 'Ready for pickup' ? '' : '<button class="a-btn sm" data-q="nudge" data-id="' + r.id + '">Nudge supplier</button>') + '</td></tr>';
    });
    return h + '</tbody></table></div></div>';
  }

  function drawerHtml(s) {
    return '<div class="p-sec"><h4>Contact</h4><div class="p-cols"><div class="a-field"><label>Company</label><input id="sd-name" value="' + esc(s.name) + '"></div><div class="a-field"><label>Contact person</label><input id="sd-contact" value="' + esc(s.contact) + '"></div><div class="a-field"><label>Phone</label><input id="sd-phone" value="' + s.phone + '"></div><div class="a-field"><label>Email</label><input id="sd-email" value="' + esc(s.email) + '"></div></div></div>' +
      '<div class="p-sec"><h4>Dropship route</h4>' +
      '<label class="p-radio"><input type="radio" name="sd-route" value="direct"' + (s.route === 'direct' ? ' checked' : '') + '><span><b>Ship direct to customer</b><div class="p-muted p-small">Courier collects from the supplier\'s pickup address and delivers to the customer. Faster; we do not see the item.</div></span></label>' +
      '<label class="p-radio"><input type="radio" name="sd-route" value="warehouse"' + (s.route === 'warehouse' ? ' checked' : '') + '><span><b>Ship to our warehouse first</b><div class="p-muted p-small">Supplier delivers to us, we inspect and ship. Slower but safer for fragile or high-value items.</div></span></label></div>' +
      '<div class="p-sec"><h4>Pickup address (courier pickup booked on our account)</h4><div class="a-field"><textarea id="sd-pickup" rows="2">' + esc(s.pickup) + '</textarea><span class="a-hint">Appears in Delivery &amp; couriers as a pickup address.</span></div><div class="a-field"><label>Payment terms</label><input id="sd-terms" value="' + esc(s.terms) + '"></div></div>' +
      '<div class="p-sec"><h4>Portal users</h4>' + s.portal.map(function (u) { return '<div class="p-row sp" style="padding:4px 0"><div><b>' + esc(u.name) + '</b> <span class="p-muted p-small">' + esc(u.email) + '</span></div><div class="p-small">' + u.role + ' · last login ' + u.last + '</div></div>'; }).join('') + '<button class="a-btn sm p-mt" data-d="invite">' + A.icons.plus + ' Invite portal user</button> <a class="a-btn sm p-mt" href="../supplier/index.html" target="_blank">Open supplier portal</a></div>' +
      '<div class="p-sec"><h4>Linked products</h4><div class="p-row sp"><b style="font-size:20px">' + s.products + '</b><a class="p-link" href="products.html">Manage links in Products</a></div></div>' +
      '<div class="p-sec"><h4>Performance (last 90 days)</h4><div class="p-hbar"><span>On-time fulfilment</span><div class="p-bar ok"><i style="width:' + s.onTime + '%"></i></div><b>' + s.onTime + '%</b></div><div class="p-hbar"><span>Cancel / out-of-stock</span><div class="p-bar dng"><i style="width:' + Math.min(100, s.cancel * 4) + '%"></i></div><b>' + s.cancel + '%</b></div><div class="p-hbar"><span>Avg lead time</span><div class="p-bar acc"><i style="width:' + s.lead * 20 + '%"></i></div><b>' + s.lead + ' d</b></div></div>' +
      '<div class="a-actions"><button class="a-btn danger" data-d="pause">' + (s.status === 'active' ? 'Pause supplier' : 'Reactivate') + '</button><span class="p-grow"></span><button class="a-btn" data-layer-close>Close</button><button class="a-btn primary" data-d="save">Save changes</button></div>';
  }
  function openDrawer(id) {
    var s = PD.supplier(id), b = A.drawer.open(drawerHtml(s), { title: s.name, width: 520 });
    b.addEventListener('click', function (e) {
      var t = e.target.closest('[data-d]'); if (!t) return;
      if (t.dataset.d === 'save') {
        var before = s.route; s.name = $('#sd-name', b).value; s.contact = $('#sd-contact', b).value; s.phone = $('#sd-phone', b).value; s.email = $('#sd-email', b).value; s.pickup = $('#sd-pickup', b).value; s.terms = $('#sd-terms', b).value;
        s.route = $('input[name=sd-route]:checked', b).value; audit('supplier.update', s.id + ' ' + s.name, before, s.route);
        A.drawer.close(); render(); A.toast('Supplier saved', 'ok');
      } else if (t.dataset.d === 'invite') { A.toast('Invite email sent to supplier contact (mock)', 'info'); }
      else if (t.dataset.d === 'pause') { s.status = s.status === 'active' ? 'paused' : 'active'; audit('supplier.status', s.id, '', s.status); A.drawer.close(); render(); A.toast('Supplier ' + s.status, 'warn'); }
    });
  }
  function addModal() {
    var b = A.modal.open('<div class="p-cols"><div class="a-field"><label>Company name</label><input id="as-name"></div><div class="a-field"><label>Contact person</label><input id="as-contact"></div><div class="a-field"><label>Phone</label><input id="as-phone" placeholder="01XXXXXXXXX"></div><div class="a-field"><label>Email (portal login)</label><input id="as-email" type="email"></div></div>' +
      '<div class="a-field"><label>Dropship route</label><select id="as-route"><option value="direct">Ship direct to customer</option><option value="warehouse">Via our warehouse first</option></select></div><div class="a-field"><label>Pickup address</label><textarea id="as-pickup" rows="2"></textarea></div><div class="a-err" id="as-err" hidden>Company name and phone are required.</div>' +
      '<div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="as-ok">Add supplier &amp; send portal invite</button></div>', { title: 'Add supplier', size: 'md' });
    $('#as-ok', b).onclick = function () {
      var n = $('#as-name', b).value.trim(), ph = $('#as-phone', b).value.trim(); if (!n || !ph) { $('#as-err', b).hidden = false; return; }
      var sp = { id: 'S' + (PD.suppliers.length + 1 < 10 ? '0' : '') + (PD.suppliers.length + 1), name: n, contact: $('#as-contact', b).value, phone: ph, email: $('#as-email', b).value, route: $('#as-route', b).value, pickup: $('#as-pickup', b).value, onTime: 100, cancel: 0, status: 'active', products: 0, openOrders: 0, portal: [], lead: 2, terms: 'Net 15' };
      PD.suppliers.push(sp); audit('supplier.create', sp.id + ' ' + n); A.modal.close(); render(); A.toast('Supplier added; invite sent', 'ok');
    };
  }

  function tabsHtml() {
    var od = q.filter(function (r) { return r.status !== 'Ready for pickup'; }).length;
    return '<div class="a-tabs p-tabsbar" role="tablist"><button class="a-tab" data-tab="list" aria-selected="' + (st.tab === 'list') + '">Suppliers <span class="a-count">' + PD.suppliers.length + '</span></button><button class="a-tab" data-tab="queue" aria-selected="' + (st.tab === 'queue') + '">Dropship forwarding queue <span class="a-count">' + od + '</span></button><a class="a-tab" href="purchase-orders.html" style="text-decoration:none">Purchase orders ›</a></div>';
  }
  function render() { $('#su-body').innerHTML = tabsHtml() + (st.tab === 'list' ? listPanel() : queuePanel()); }

  if (document.body.dataset.page !== 'suppliers') return;
  A.renderPage({
    active: 'suppliers', title: 'Suppliers & dropship', crumbs: [['Dashboard', 'index.html'], ['Suppliers & POs']],
    actions: '<a class="a-btn" href="purchase-orders.html">' + A.icons.po + ' Purchase orders</a><button class="a-btn primary" id="su-add">' + A.icons.plus + ' Add supplier</button>',
    body: '<div id="su-body"></div>',
    onReady: function (root) {
      render();
      $('#su-add').onclick = addModal;
      root.addEventListener('click', function (e) {
        var t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; render(); return; }
        var n = e.target.closest('[data-q]');
        if (n) { var r = q[+n.dataset.id]; if (n.dataset.q === 'nudge') A.toast('Reminder sent to ' + PD.supplier(r.sup).name + ' via portal + SMS', 'info'); else { r.status = 'Ready for pickup'; q.splice(q.indexOf(r), 1); render(); A.toast('Item cancelled; customer notified, partial refund queued', 'warn'); } return; }
        var tr = e.target.closest('tr[data-sup]'); if (tr) openDrawer(tr.dataset.sup);
      });
      root.addEventListener('change', function (e) { if (e.target.id === 'q-sup') { st.qSup = e.target.value; render(); } if (e.target.id === 'q-st') { st.qStatus = e.target.value; render(); } });
    }
  });
})();
