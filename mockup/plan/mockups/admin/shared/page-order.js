(function () {
  var D = window.SalesData, A = window.Admin, esc = A.esc, I = A.icons, bdt = A.fmt.bdt;
  var id = (new URLSearchParams(location.search).get('id') || '').trim() || 'BD-10480';
  var o = D.order(id);
  if (!o) {
    A.renderPage({ active: 'orders', title: 'Order not found', crumbs: [['Orders', 'orders.html']], body: '<div class="a-empty">No order “' + esc(id) + '”. <a class="s-link" href="orders.html">Back to orders</a></div>' });
    return;
  }
  var cust = D.customer(o.cid) || { id: o.cid, name: o.cname, orders: 1, delivered: 0, returned: 0, risky: false, guest: [] };
  var ships = D.shipmentsFor(o);
  var S = { editing: false, draft: null, addr: o.addr, notice: '', callOutcome: '', callText: '', noteText: '', editNote: '', ship: {} };
  var calls = [], notes = [], audit = [];
  var T0 = o.date.getTime();
  function when(min) { return new Date(T0 + min * 60e3); }
  function log(kind, text, at) { audit.unshift({ kind: kind, text: text, at: at || new Date(D.NOW.getTime() + audit.length * 0) }); }
  function seed() {
    var a = [];
    a.push(['', 'Order placed from ' + o.source + ' (' + o.method + ', ' + (o.zone) + ')', 0]);
    a.push(['', 'Confirmation SMS + email sent to customer', 1]);
    if (o.risk) a.push(['warn', 'Risk flag raised: ' + o.risk.msg, 2]);
    if (o.status === 'on_hold') a.push(['warn', 'Order put on hold by Rakib (Order staff): asked to confirm address', 40]);
    if (['shipped', 'delivered', 'completed', 'partially_shipped'].indexOf(o.status) >= 0) { a.push(['ok', 'Courier booked: ' + (o.courier || 'Pathao') + ' (first shipment)', 180]); a.push(['ok', 'Courier picked up parcel', 420]); }
    if (o.status === 'delivered' || o.status === 'completed') a.push(['ok', 'Delivered, COD collected by courier', 2000]);
    if (o.status === 'completed') a.push(['ok', 'Return window closed, order completed, loyalty points credited', 11000]);
    if (o.status === 'cancelled') a.push(['warn', 'Order cancelled by Sumon (Manager): customer requested', 90]);
    a.forEach(function (x) { audit.unshift({ kind: x[0], text: x[1], at: when(x[2]) }); });
  }
  seed();
  if (o.status === 'on_hold') calls.push({ outcome: 'hold', text: 'Customer asked us to hold until Friday.', at: when(38), who: 'Rakib' });

  /* ---------- helpers ---------- */
  var handed = function () { return ships.some(function (s) { return s.status === 'in_transit' || s.status === 'delivered'; }); };
  var canEdit = function () { return ['processing', 'on_hold', 'pending_payment'].indexOf(o.status) >= 0 && !handed(); };
  function itemCount() { return o.items.reduce(function (s, i) { return s + i.qty; }, 0); }
  function goods() { return o.sub - o.discount - o.coupon - o.points - o.wallet; }
  function recalc() {
    var sub = 0, kg = 0; o.items.forEach(function (i) { sub += i.qty * i.price; kg += i.qty * i.kg; });
    o.sub = sub; o.kg = Math.round(kg * 10) / 10;
    if (o.discount) o.discount = sub > 5000 ? Math.round(sub * 0.05) : 0;
    var g = Math.max(0, goods());
    o.delivery = D.delivery(o.zone, kg, g); o.total = g + o.delivery; o.vat = Math.round(g * 15 / 115);
    ships = D.shipmentsFor(o);
  }
  function syncStatus() {
    if (o.status === 'on_hold' || o.status === 'cancelled' || o.status === 'pending_payment') return;
    var n = ships.length, h = ships.filter(function (s) { return s.status === 'in_transit' || s.status === 'delivered'; }).length, d = ships.filter(function (s) { return s.status === 'delivered'; }).length;
    var prev = o.status;
    if (d === n) { o.status = prev === 'completed' ? 'completed' : 'delivered'; o.payStatus = 'COD collected'; }
    else if (h === n) o.status = 'shipped';
    else if (h > 0) o.status = 'partially_shipped';
    else o.status = 'processing';
  }
  function shLabel(s) { return { not_booked: ['Not booked', 'muted'], booked: ['Booked, awaiting pickup', 'info'], in_transit: ['In transit', 'info'], delivered: ['Delivered', 'ok'], awaiting_supplier: ['Awaiting supplier', 'warn'] }[s]; }

  /* ---------- panels ---------- */
  function head() {
    var canRefund = (o.status === 'delivered' || o.status === 'completed' || o.advance > 0) && o.status !== 'cancelled';
    var hold = o.status === 'on_hold';
    return '<div class="s-head"><div><h2><span class="a-badge ' + D.STATUS_TONE[o.status] + '">' + D.STATUS_LABEL[o.status] + '</span> <span class="a-badge ' + D.payTone(o.payStatus) + '">' + o.payStatus + '</span>' +
      (o.risk ? ' <span class="a-badge danger">' + I.warn + ' Risk flag</span>' : '') + '</h2><div class="s-muted s-small" style="margin-top:4px">Placed ' + A.fmt.dt(o.date) + ' · ' + o.source + ' · ' + itemCount() + ' items · ' + bdt(o.total) + '</div></div>' +
      '<div class="s-actions">' +
      '<button class="a-btn" data-act="edit" data-perm="orders.edit" data-perm-mode="disable"' + (canEdit() ? '' : ' disabled title="Locked after courier hand-off"') + '>' + I.edit + ' Edit order</button>' +
      '<button class="a-btn" data-act="hold" data-perm="orders.cancel" data-perm-mode="disable"' + (['cancelled', 'delivered', 'completed', 'shipped'].indexOf(o.status) >= 0 ? ' disabled' : '') + '>' + (hold ? 'Release hold' : 'Hold') + '</button>' +
      '<button class="a-btn danger" data-act="cancel" data-perm="orders.cancel" data-perm-mode="disable"' + (o.status === 'cancelled' ? ' disabled' : '') + '>Block / cancel</button>' +
      '<button class="a-btn" data-act="invoice">' + I.download + ' Print invoice</button>' +
      '<button class="a-btn accent" data-act="refund" data-perm="orders.refund" data-perm-mode="disable"' + (canRefund ? '' : ' disabled title="Nothing to refund yet"') + '>Refund</button></div></div>' +
      (S.notice ? '<div class="s-notice">' + I.check + '<div>' + esc(S.notice) + '</div></div>' : '');
  }
  function timeline() {
    var steps = [['Order placed', when(0)], ['Processing', when(5)], ['Shipped', when(420)], ['Delivered', when(2000)], ['Completed', when(11000)]];
    var idx = { pending_payment: 0, processing: 1, on_hold: 1, partially_shipped: 2, shipped: 2, delivered: 3, completed: 4 }[o.status];
    if (o.status === 'cancelled') return '<ol class="a-timeline"><li class="done"><b>Order placed</b><div class="s-muted s-small">' + A.fmt.dt(when(0)) + '</div></li><li class="current"><b>Cancelled</b><div class="s-muted s-small">' + A.fmt.dt(when(90)) + '</div></li></ol>';
    return '<ol class="a-timeline">' + steps.map(function (s, k) {
      var cls = k < idx ? 'done' : k === idx ? 'current' : '';
      var lab = s[0];
      if (k === idx && o.status === 'on_hold') lab = 'On hold';
      if (k === idx && o.status === 'partially_shipped') lab = 'Partially shipped';
      if (k === idx && o.status === 'pending_payment') lab = 'Pending payment (advance)';
      return '<li class="' + cls + '"><b>' + lab + '</b><div class="s-muted s-small">' + (k <= idx ? A.fmt.dt(s[1]) : (k === 4 ? 'After the 7-day return window' : 'Pending')) + '</div></li>';
    }).join('') + '</ol>';
  }
  function itemsView() {
    var rows = o.items.map(function (i) {
      return '<div class="s-item"><div class="s-thumb">' + i.emoji + '</div><div><div class="t">' + esc(i.name) + '</div><div class="s-muted s-small">SKU ' + i.sku + ' · ' + (i.src === 'dropship' ? 'Dropship · ' + esc(D.SUPPLIERS[i.sup]) : 'Own stock') + '</div></div><div class="p">' + i.qty + ' × ' + bdt(i.price) + '<div class="s-muted s-small">' + bdt(i.qty * i.price) + '</div></div></div>';
    }).join('');
    return rows + '<div class="s-lock" style="margin-top:8px">' + I.lock + (canEdit() ? 'Editable until a parcel is handed to the courier.' : (o.status === 'cancelled' ? 'Order is cancelled.' : 'Locked: courier hand-off has happened. Use Returns for changes.')) + '</div>';
  }
  function diffs() {
    var d = [], base = {};
    o.items.forEach(function (i) { base[i.sku] = i; });
    S.draft.forEach(function (x) {
      var b = base[x.sku];
      if (!b) { if (!x.removed) d.push(['add', 'Add ' + x.name + ' × ' + x.qty + ' (' + bdt(x.qty * x.price) + ')']); return; }
      if (x.removed) d.push(['del', 'Remove ' + x.name + ' × ' + b.qty]);
      else if (x.qty !== b.qty) d.push(['chg', x.name + ': qty ' + b.qty + ' to ' + x.qty]);
    });
    if (S.addr !== o.addr) d.push(['chg', 'Address: “' + o.addr + '” to “' + S.addr + '”']);
    return d;
  }
  function previewTotal() {
    var sub = 0, kg = 0; S.draft.forEach(function (x) { if (!x.removed) { sub += x.qty * x.price; kg += x.qty * x.kg; } });
    var g = Math.max(0, sub - (o.discount ? (sub > 5000 ? Math.round(sub * 0.05) : 0) : 0) - o.coupon - o.points - o.wallet);
    return { sub: sub, del: D.delivery(o.zone, kg, g), total: g + D.delivery(o.zone, kg, g) };
  }
  function itemsEdit() {
    var d = diffs(), pt = previewTotal();
    var rows = S.draft.map(function (x, k) {
      return '<div class="s-edit-row' + (x.removed ? ' removed' : '') + '"><div class="s-thumb">' + x.emoji + '</div><div><div class="t s-strong">' + esc(x.name) + '</div><div class="s-muted s-small">' + x.sku + (x.src === 'dropship' ? ' · dropship' : '') + '</div></div>' +
        '<input type="number" min="1" max="20" value="' + x.qty + '" data-q="' + k + '"' + (x.removed ? ' disabled' : '') + ' aria-label="Quantity"><div class="pr s-strong" style="text-align:right">' + bdt(x.price * x.qty) + '</div>' +
        '<button class="a-btn icon ghost sm" data-act="rm" data-k="' + k + '" aria-label="' + (x.removed ? 'Restore' : 'Remove') + '" title="' + (x.removed ? 'Restore' : 'Remove') + '">' + (x.removed ? I.plus : I.trash) + '</button></div>';
    }).join('');
    var addOpts = '<option value="">Add item…</option>' + D.PRODUCTS.filter(function (p) { return !S.draft.some(function (x) { return x.pid === p.id; }); }).map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + ' — ' + bdt(p.price) + (p.src === 'dropship' ? ' (dropship)' : '') + '</option>'; }).join('');
    return '<div class="s-notice warn">' + I.warn + '<div>Edit mode. Changes are audit-logged and the customer is notified. Courier bookings are re-created on save.</div></div>' + rows +
      '<div class="s-row" style="margin:10px 0"><select id="add-it" style="flex:1;min-width:180px">' + addOpts + '</select></div>' +
      '<div class="a-field"><label>Delivery address</label><textarea id="ed-addr" rows="2">' + esc(S.addr) + '</textarea></div>' +
      '<div class="s-diff"><b>Changes' + (d.length ? ' (' + d.length + ')' : '') + '</b>' + (d.length ? '<ul>' + d.map(function (x) { return '<li class="' + x[0] + '">' + esc(x[1]) + '</li>'; }).join('') + '</ul><div style="margin-top:8px">Total: ' + bdt(o.total) + ' to <b>' + bdt(pt.total) + '</b> (delivery ' + bdt(pt.del) + ')</div>' : '<div class="s-muted">No changes yet.</div>') + '</div>' +
      '<div class="a-field" style="margin-top:10px"><label>Audit note (required)</label><input id="ed-note" placeholder="e.g. Customer called, wants 2 units and new house number" value="' + esc(S.editNote) + '"></div>' +
      '<label class="s-row s-small" style="margin:8px 0"><input type="checkbox" checked disabled> Customer will be notified (SMS + email + in-app) with the changes above</label>' +
      '<div class="s-row"><button class="a-btn primary" data-act="saveedit"' + (d.length ? '' : ' disabled') + '>Save changes</button><button class="a-btn ghost" data-act="canceledit">Discard</button></div>';
  }
  function shipments() {
    if (!ships.length) return '<div class="a-empty">No shipments.</div>';
    var dropNote = ships.length > 1 ? '<div class="s-notice">' + I.truck + '<div>Split into <b>' + ships.length + ' shipments</b> (stock + dropship). Delivery charge ' + bdt(o.delivery) + ' is collected once, on the first shipment.</div></div>' : '';
    return dropNote + '<div class="s-col">' + ships.map(function (s, k) {
      var st = shLabel(s.status), items = s.items.map(function (sku) { var it = o.items.filter(function (i) { return i.sku === sku; })[0]; return it ? it.emoji + ' ' + esc(it.name) + ' × ' + it.qty : ''; }).join(' · ');
      var booked = s.status !== 'not_booked' && s.status !== 'awaiting_supplier';
      var supSt = s.kind === 'dropship' ? '<div class="s-small s-muted">Supplier: <b>' + esc(D.SUPPLIERS[s.sup]) + '</b> · direct parcel: pickup at supplier, booked on our courier account' + (s.status === 'awaiting_supplier' ? ' · waiting for supplier to confirm stock / mark ready' : '') + '</div>' : '<div class="s-small s-muted">Ships from our warehouse (own stock)</div>';
      var btns = '';
      if (s.status === 'not_booked' || s.status === 'awaiting_supplier') btns += '<button class="a-btn primary sm" data-act="book" data-k="' + k + '" data-perm="orders.edit" data-perm-mode="disable"' + (o.status === 'cancelled' || o.status === 'on_hold' ? ' disabled title="Release hold first"' : '') + '>' + I.truck + ' Book courier</button>';
      if (s.status === 'awaiting_supplier') btns += '<button class="a-btn ghost sm" data-act="supready" data-k="' + k + '">Demo: supplier marks ready</button>';
      if (s.status === 'booked') btns += '<button class="a-btn ghost sm" data-act="pickup" data-k="' + k + '">Demo: courier picks up</button><button class="a-btn ghost sm" data-act="unbook" data-k="' + k + '">Cancel booking</button>';
      if (s.status === 'in_transit') btns += '<button class="a-btn ghost sm" data-act="deliver" data-k="' + k + '">Demo: mark delivered</button>';
      return '<div class="s-ship"><div class="s-ship-h"><div><b>' + s.label + '</b> <span class="a-badge ' + (s.kind === 'stock' ? 'ok' : 'warn') + ' s-kind">' + (s.kind === 'stock' ? 'Stock' : 'Dropship') + '</span></div><span class="a-badge ' + st[1] + '">' + st[0] + '</span></div>' +
        '<div class="s-ship-b"><div class="s-small" style="margin-bottom:4px">' + items + '</div>' + supSt +
        '<div class="s-ship-form"><div class="a-field"><label>Courier</label><select data-sc="' + k + '"' + (booked ? ' disabled' : '') + '><option' + (s.courier === 'Pathao' ? ' selected' : '') + '>Pathao</option><option' + (s.courier === 'Steadfast' ? ' selected' : '') + '>Steadfast</option></select></div>' +
        '<div class="a-field"><label>Weight (kg)</label><input type="number" step="0.1" min="0.1" value="' + s.kg + '" data-sw="' + k + '"' + (booked ? ' disabled' : '') + '></div>' +
        '<div class="a-field"><label>COD to collect</label><input value="' + bdt(s.cod) + '" disabled><div class="a-hint">' + (k === 0 ? 'Goods + whole delivery charge ' + bdt(o.delivery) : 'Goods only, delivery already on shipment 1') + '</div></div>' +
        '<div class="a-field"><label>Tracking ID</label>' + (s.tracking ? '<div><span class="s-track">' + s.tracking + '</span></div>' : '<input value="" placeholder="Assigned on booking" disabled>') + '</div></div>' +
        (btns ? '<div class="s-row" style="margin-top:10px">' + btns + '</div>' : '') + '</div></div>';
    }).join('') + '</div>';
  }
  function payments() {
    var due = o.status === 'cancelled' ? 0 : (o.payStatus === 'COD collected' ? 0 : o.total - o.advance);
    var tx = [['Order placed, ' + o.method + (o.advance ? ' advance required' : ''), o.date, o.advance ? bdt(o.advance) : bdt(o.total), o.advance ? 'Awaiting' : 'COD due']];
    if (o.payStatus === 'COD collected') tx.push(['COD collected by ' + (o.courier || 'courier'), when(2000), bdt(o.total), 'Collected']);
    if (o.status === 'cancelled') tx.push(['Order cancelled, nothing to collect', when(90), bdt(0), 'Voided']);
    return '<div class="a-kv"><div><span class="s-muted">Method</span> <b>' + o.method + '</b></div></div>' +
      '<div class="s-totals" style="margin:8px 0"><span>COD due</span><b>' + bdt(due) + '</b><span>Advance paid</span><b>' + bdt(0) + '</b>' + (o.advance ? '<span>Advance required</span><b>' + bdt(o.advance) + '</b>' : '') + '</div>' +
      '<div class="s-adv">Launch note: COD only. Online payments (bKash, Nagad, gateway) and advance payment are OFF by feature flag. ' + (o.advance ? 'This seeded order shows the future advance flow: delivery fee paid via bKash before processing.' : 'Advance fields stay at ৳0.') + '</div>' +
      '<div class="a-table-wrap" style="margin-top:10px"><table class="a-table"><thead><tr><th>Transaction</th><th>When</th><th class="num">Amount</th><th>State</th></tr></thead><tbody>' + tx.map(function (t) { return '<tr><td>' + esc(t[0]) + '</td><td>' + A.fmt.dt(t[1]) + '</td><td class="num">' + t[2] + '</td><td>' + t[3] + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function totals() {
    var z = D.ZONES[o.zone];
    return '<div class="s-totals"><span>Subtotal (' + itemCount() + ' items)</span><span>' + bdt(o.sub) + '</span>' +
      (o.discount ? '<span>Sale discount</span><span class="neg">−' + bdt(o.discount) + '</span>' : '') +
      (o.coupon ? '<span>Coupon <span class="a-badge muted">' + o.couponCode + '</span></span><span class="neg">−' + bdt(o.coupon) + '</span>' : '') +
      (o.points ? '<span>Loyalty points (' + o.points + ' pts)</span><span class="neg">−' + bdt(o.points) + '</span>' : '') +
      (o.wallet ? '<span>Store wallet</span><span class="neg">−' + bdt(o.wallet) + '</span>' : '') +
      '<span>Delivery · ' + esc(o.zone) + ' · ' + o.kg + ' kg' + (o.delivery === 0 ? ' <span class="a-badge ok">Free above ' + bdt(z.free) + '</span>' : '') + '</span><span>' + bdt(o.delivery) + '</span>' +
      '<span class="grand">Total</span><span class="grand">' + bdt(o.total) + '</span>' +
      '<span class="vat">VAT (15%) included in goods</span><span class="vat">' + bdt(o.vat) + '</span></div>';
  }
  function custCard() {
    var pct = cust.orders ? Math.round(cust.delivered / cust.orders * 100) : 0;
    var guest = (cust.guest || []).length ? '<div class="s-small" style="margin-top:8px"><b>Linked guest orders</b> (auto-linked after OTP):<br>' + cust.guest.map(function (g) { return '<a class="s-link" href="order.html?id=' + g + '">#' + g + '</a>'; }).join(', ') + '</div>' : '';
    return '<div class="s-row" style="margin-bottom:8px"><span class="a-avatar">' + esc(o.cname.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('')) + '</span><div><a class="s-link" href="customer.html?id=' + cust.id + '">' + esc(o.cname) + '</a><div class="s-small s-muted">' + cust.id + '</div></div></div>' +
      '<div class="s-small">' + I.phone + ' <b>' + esc(o.phone) + '</b></div><div class="s-small s-muted" style="margin:4px 0 10px">' + esc(S.addr) + '</div>' +
      '<div class="s-spread s-small"><span>' + cust.orders + ' orders</span><span>' + cust.delivered + ' delivered · ' + cust.returned + ' returned</span></div><div class="s-ratio"><i style="width:' + pct + '%"></i></div>' +
      '<div class="s-spread" style="margin-top:6px"><span>' + (cust.risky ? '<span class="a-badge danger">Risky customer</span>' : '<span class="a-badge ok">Normal</span>') + '</span><button class="a-btn sm" data-act="flagcust" data-perm="customers.flag" data-perm-mode="disable">' + (cust.risky ? 'Remove risky flag' : 'Mark risky') + '</button></div>' + guest;
  }
  function riskPanel() {
    if (!o.risk) return '<div class="s-muted s-small">No active risk flags on this order.</div>';
    var same = D.ORDERS.filter(function (x) { return x.phone === o.phone && x.id !== o.id; });
    return '<div class="s-flagrow">' + I.warn + '<div><b>' + esc(o.risk.msg) + '</b><div class="s-muted s-small">Rule: ' + { phone_velocity: 'same phone velocity (3+ orders / 1h)', device_velocity: 'same device, many phones', ip_velocity: 'same IP velocity (5+ / 24h)' }[o.risk.rule] + '. Flags never block the order, staff decide.</div></div></div>' +
      (same.length ? '<div class="s-small">Related orders (same phone): ' + same.slice(0, 5).map(function (x) { return '<a class="s-link" href="order.html?id=' + x.id + '">#' + x.id + '</a>'; }).join(', ') + '</div>' : '') +
      '<div class="s-row" style="margin-top:10px"><button class="a-btn sm" data-act="clearflag" data-perm="orders.edit" data-perm-mode="disable">Clear flag</button><span class="s-small s-muted">Logged in audit trail.</span></div>';
  }
  var OUT = [['confirmed', 'Confirmed'], ['noanswer', 'No answer'], ['hold', 'Asked to hold'], ['cancel', 'Wants to cancel']];
  function callPanel() {
    var stream = calls.map(function (c) { return { at: c.at, h: '<div class="s-flagrow">' + I.phone.replace('<svg', '<svg style="color:var(--info,#2563eb)"') + '<div><b>Call: ' + OUT.filter(function (x) { return x[0] === c.outcome; })[0][1] + '</b> <span class="s-muted s-small">by ' + esc(c.who) + ' · ' + A.fmt.dt(c.at) + '</span>' + (c.text ? '<div>' + esc(c.text) + '</div>' : '') + '</div></div>' }; })
      .concat(notes.map(function (n) { return { at: n.at, h: '<div class="s-flagrow">' + I.edit + '<div><b>Internal note</b> <span class="s-muted s-small">by ' + esc(n.who) + ' · ' + A.fmt.dt(n.at) + '</span><div>' + esc(n.text) + '</div></div></div>' }; }))
      .sort(function (a, b) { return b.at - a.at; });
    return '<div class="a-field"><label>Log a call to ' + esc(o.phone) + '</label><div class="s-calls" id="co-chips">' + OUT.map(function (x) { return '<button class="s-chip-btn" data-co="' + x[0] + '" aria-pressed="' + (S.callOutcome === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="a-field"><input id="co-text" placeholder="Call note (optional)" value="' + esc(S.callText) + '"></div><button class="a-btn sm primary" data-act="logcall"' + (S.callOutcome ? '' : ' disabled') + '>Log call</button>' +
      (S.callOutcome === 'hold' ? '<div class="s-small s-muted" style="margin-top:6px">Tip: use “Hold” in the header to stop processing.</div>' : '') + (S.callOutcome === 'cancel' ? '<div class="s-small s-muted" style="margin-top:6px">Tip: use “Block / cancel” in the header and pick “Customer requested”.</div>' : '') +
      '<hr style="border:0;border-top:1px solid var(--border);margin:12px 0"><div class="a-field"><label>Internal note (staff only)</label><textarea id="nt-text" rows="2" placeholder="Visible to staff only">' + esc(S.noteText) + '</textarea></div><button class="a-btn sm" data-act="addnote">Add note</button>' +
      '<div style="margin-top:10px">' + (stream.length ? stream.map(function (x) { return x.h; }).join('') : '<div class="s-muted s-small">No calls or notes yet.</div>') + '</div>';
  }
  function auditPanel() { return '<div class="s-log">' + audit.map(function (e) { return '<div class="e ' + e.kind + '"><div>' + esc(e.text) + '<div class="at">' + A.fmt.dt(e.at) + '</div></div></div>'; }).join('') + '</div>'; }

  function card(title, inner, extra) { return '<div class="a-card"><div class="a-card-h"><b>' + title + '</b>' + (extra || '') + '</div><div class="a-card-b">' + inner + '</div></div>'; }
  function draw() {
    A.$('#od').innerHTML = head() + '<div class="s-layout"><div class="s-col">' +
      card('Status', timeline()) +
      card('Items', S.editing ? itemsEdit() : itemsView(), '') +
      card('Shipments', shipments(), ships.length > 1 ? '<span class="a-badge info">' + ships.length + ' shipments</span>' : '') +
      card('Payments', payments()) + card('Totals', totals()) +
      '</div><div class="s-col">' + card('Customer', custCard()) + card('Risk flags', riskPanel(), o.risk ? '<span class="a-badge danger">1</span>' : '') + card('Calls &amp; notes', callPanel()) + card('Activity &amp; audit trail', auditPanel()) + '</div></div>';
    A.applyPerms(A.$('#od'));
  }

  /* ---------- actions ---------- */
  function startEdit() { S.editing = true; S.addr = o.addr; S.editNote = ''; S.draft = o.items.map(function (i) { return { pid: i.pid, name: i.name, emoji: i.emoji, sku: i.sku, qty: i.qty, price: i.price, kg: i.kg, src: i.src, sup: i.sup, removed: false }; }); draw(); }
  function saveEdit() {
    var note = (A.$('#ed-note') || {}).value || S.editNote; note = note.trim();
    if (!note) { A.toast('Add an audit note first', 'warn'); var n = A.$('#ed-note'); if (n) n.focus(); return; }
    var d = diffs();
    o.items = S.draft.filter(function (x) { return !x.removed; }).map(function (x) { return { pid: x.pid, name: x.name, emoji: x.emoji, sku: x.sku, qty: x.qty, price: x.price, kg: x.kg, src: x.src, sup: x.sup }; });
    if (!o.items.length) { A.toast('An order needs at least one item. Cancel it instead.', 'danger'); startEdit(); return; }
    o.addr = S.addr; recalc();
    log('note', 'Order edited by You: ' + d.map(function (x) { return x[1]; }).join('; ') + '. Note: ' + note);
    log('', 'Customer notified (SMS, email, in-app) of order changes');
    S.editing = false; S.notice = 'Order updated, audit entry written and the customer was notified.'; draw(); A.toast('Order updated, customer notified', 'ok');
  }
  function modalBtns(go, label, cls) { return '<div class="s-row" style="justify-content:flex-end;margin-top:14px"><button class="a-btn ghost" onclick="Admin.modal.close()">Cancel</button><button class="a-btn ' + (cls || 'primary') + '" id="' + go + '">' + label + '</button></div>'; }
  function openCancel() {
    var warn = handed() ? '<div class="s-notice danger">' + I.warn + '<div>A parcel is already with the courier. Cancelling here means return-to-sender; consider Returns instead.</div></div>' : '';
    A.modal.open(warn + '<div class="a-field"><label>Reason</label><select id="cx-r"><option>Customer requested</option><option>Unreachable by phone</option><option>Fake / prank order</option><option>Fraud suspected</option><option>Out of stock</option><option>Other</option></select></div>' +
      '<div class="a-field"><label>Note (audit log)</label><textarea id="cx-n" rows="2"></textarea></div>' +
      '<label class="s-row s-small"><input type="checkbox" id="cx-b" data-perm="customers.flag"> Also block this phone from placing COD orders</label>' +
      '<label class="s-row s-small"><input type="checkbox" id="cx-s" checked> Return reserved stock</label><label class="s-row s-small"><input type="checkbox" id="cx-m" checked> Notify customer</label>' + modalBtns('cx-go', 'Cancel order', 'danger'), { title: 'Block / cancel #' + o.id, size: 'sm' });
    A.applyPerms(A.$('#cx-b').closest('label'));
    A.$('#cx-go').onclick = function () {
      var r = A.$('#cx-r').value, n = A.$('#cx-n').value.trim(), b = A.$('#cx-b').checked;
      o.status = 'cancelled'; o.payStatus = 'Voided'; ships.forEach(function (s) { if (s.status === 'booked') { s.status = 'not_booked'; s.tracking = ''; } });
      log('warn', 'Order cancelled by You. Reason: ' + r + (n ? '. ' + n : '')); if (b) { cust.risky = true; log('warn', 'Customer phone blocked for COD and flagged risky'); }
      A.modal.close(); S.editing = false; S.notice = 'Order cancelled (' + r + ').'; draw(); A.toast('Order cancelled', 'warn');
    };
  }
  function openRefund() {
    var th = D.RET_THRESHOLD;
    A.modal.open('<div class="a-field"><label>Refund amount (max ' + bdt(o.total) + ')</label><input id="rf-a" type="number" min="1" max="' + o.total + '" value="' + o.total + '"></div>' +
      '<div class="a-field"><label>Refund to</label><label class="s-opt"><input type="radio" name="rfm" value="orig" checked><div><b>Original method</b><div class="s-small s-muted">COD orders: manual bKash/bank payout to the customer</div></div></label><label class="s-opt" style="margin-top:6px"><input type="radio" name="rfm" value="wallet"><div><b>Store wallet</b><div class="s-small s-muted">Instant, spend-only</div></div></label></div>' +
      '<div class="a-field"><label>Reason</label><input id="rf-r" placeholder="e.g. Partial refund for damaged item"></div><div class="s-notice warn" id="rf-w" hidden>' + I.lock + '<div>Refunds above ' + bdt(th) + ' need approval by someone with “refund.approve_high”.</div></div>' + modalBtns('rf-go', 'Issue refund', 'accent'), { title: 'Refund #' + o.id, size: 'sm' });
    var upd = function () { var a = +A.$('#rf-a').value, big = a > th, can = A.can('refund.approve_high'); A.$('#rf-w').hidden = !big || can; A.$('#rf-go').textContent = big && !can ? 'Request approval' : 'Issue refund'; };
    A.$('#rf-a').oninput = upd; upd();
    A.$('#rf-go').onclick = function () {
      var a = +A.$('#rf-a').value; if (!(a > 0 && a <= o.total)) { A.toast('Enter a valid amount', 'warn'); return; }
      var big = a > th && !A.can('refund.approve_high'), m = document.querySelector('input[name=rfm]:checked').value === 'wallet' ? 'store wallet' : 'original method';
      log(big ? 'warn' : 'ok', big ? 'Refund of ' + bdt(a) + ' requested (needs approval)' : 'Refund of ' + bdt(a) + ' issued to ' + m);
      A.modal.close(); S.notice = big ? 'Refund request sent for approval.' : 'Refund of ' + bdt(a) + ' issued to ' + m + '.'; draw(); A.toast(big ? 'Approval requested' : 'Refund issued', big ? 'warn' : 'ok');
    };
  }
  function openInvoice() {
    var rows = o.items.map(function (i) { return '<tr><td>' + esc(i.name) + '</td><td class="num">' + i.qty + '</td><td class="num">' + bdt(i.price) + '</td><td class="num">' + bdt(i.qty * i.price) + '</td></tr>'; }).join('');
    A.modal.open('<div style="font-size:13px"><div class="s-spread"><div><b style="font-size:16px">ShopName</b><div class="s-muted s-small">BIN: 000123456-0101 · Dhaka, Bangladesh</div></div><div style="text-align:right"><b>Invoice #INV-' + o.num + '</b><div class="s-small s-muted">' + A.fmt.date(o.date) + '</div></div></div><hr style="border:0;border-top:1px solid var(--border);margin:10px 0"><div class="s-small"><b>' + esc(o.cname) + '</b> · ' + esc(o.phone) + '<br>' + esc(o.addr) + '</div>' +
      '<div class="a-table-wrap" style="margin:10px 0"><table class="a-table"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + totals() + '</div>' +
      '<div class="s-row" style="justify-content:flex-end;margin-top:12px"><button class="a-btn ghost" onclick="Admin.modal.close()">Close</button><button class="a-btn primary" id="iv-p">' + I.download + ' Print / PDF</button></div>', { title: 'Invoice preview', size: 'md' });
    A.$('#iv-p').onclick = function () { A.modal.close(); A.toast('Invoice sent to printer', 'ok'); };
  }
  function addAudit(kind, t) { log(kind, t); }

  function onClick(e) {
    var t = e.target.closest('[data-act],[data-co]'); if (!t) return;
    if (t.dataset.co) { S.callOutcome = S.callOutcome === t.dataset.co ? '' : t.dataset.co; S.callText = (A.$('#co-text') || {}).value || ''; S.noteText = (A.$('#nt-text') || {}).value || ''; draw(); return; }
    var a = t.dataset.act, k = +t.dataset.k, s = ships[k];
    if (a === 'edit') return startEdit();
    if (a === 'canceledit') { S.editing = false; draw(); return; }
    if (a === 'saveedit') return saveEdit();
    if (a === 'rm') { S.draft[k].removed = !S.draft[k].removed; S.addr = (A.$('#ed-addr') || {}).value; S.editNote = (A.$('#ed-note') || {}).value || ''; draw(); return; }
    if (a === 'hold') { var h = o.status === 'on_hold'; o.status = h ? 'processing' : 'on_hold'; log('warn', h ? 'Hold released by You' : 'Order put on hold by You'); S.notice = h ? 'Hold released, order is Processing again.' : 'Order is on hold. Nothing ships until released.'; draw(); return; }
    if (a === 'cancel') return openCancel();
    if (a === 'refund') return openRefund();
    if (a === 'invoice') return openInvoice();
    if (a === 'book') {
      s.courier = s.courier || 'Pathao'; s.tracking = (s.courier === 'Pathao' ? 'PT' : 'SF') + (o.num * 7 + k * 131) + 'BD'; s.status = 'booked'; o.courier = o.courier || s.courier;
      log('ok', s.label + ' booked with ' + s.courier + ', tracking ' + s.tracking + ', COD ' + bdt(s.cod) + (k === 0 && o.delivery ? ' (includes delivery ' + bdt(o.delivery) + ')' : '')); A.toast('Booked with ' + s.courier + ' · ' + s.tracking, 'ok'); draw(); return;
    }
    if (a === 'unbook') { log('warn', s.label + ' booking cancelled (' + s.tracking + ')'); s.status = 'not_booked'; s.tracking = ''; draw(); return; }
    if (a === 'supready') { s.status = 'not_booked'; log('ok', 'Supplier ' + D.SUPPLIERS[s.sup] + ' confirmed stock and marked ' + s.label + ' ready'); draw(); return; }
    if (a === 'pickup') { s.status = 'in_transit'; log('ok', s.label + ' picked up by ' + s.courier + ': order is now locked for editing'); syncStatus(); S.notice = ''; draw(); return; }
    if (a === 'deliver') { s.status = 'delivered'; log('ok', s.label + ' delivered' + (k === 0 ? ', COD collected' : '')); syncStatus(); draw(); return; }
    if (a === 'flagcust') { cust.risky = !cust.risky; log('warn', 'Customer ' + (cust.risky ? 'marked risky' : 'risky flag removed') + ' by You'); draw(); return; }
    if (a === 'clearflag') { log('ok', 'Risk flag cleared by You: “' + o.risk.msg + '”'); o.risk = null; draw(); A.toast('Flag cleared', 'ok'); return; }
    if (a === 'logcall') { var tx = (A.$('#co-text') || {}).value || ''; calls.unshift({ outcome: S.callOutcome, text: tx.trim(), at: new Date(D.NOW), who: 'You' }); log('note', 'Call logged: ' + OUT.filter(function (x) { return x[0] === S.callOutcome; })[0][1] + (tx ? ' — ' + tx : '')); S.callOutcome = ''; S.callText = ''; draw(); A.toast('Call logged', 'ok'); return; }
    if (a === 'addnote') { var nt = ((A.$('#nt-text') || {}).value || '').trim(); if (!nt) return; notes.unshift({ text: nt, at: new Date(D.NOW), who: 'You' }); log('note', 'Internal note added'); S.noteText = ''; draw(); return; }
  }

  A.renderPage({
    active: 'orders', title: 'Order #' + o.id, crumbs: [['Orders', 'orders.html'], ['#' + o.id, '']],
    actions: '<a class="a-btn" href="orders.html">Back to orders</a>',
    body: '<div id="od"></div>',
    onReady: function (root) {
      draw();
      if (root._sb) return; root._sb = 1;
      root.addEventListener('click', onClick);
      root.addEventListener('change', function (e) {
        var t = e.target;
        if (t.dataset.q !== undefined) { S.draft[+t.dataset.q].qty = Math.max(1, Math.min(20, +t.value || 1)); S.addr = (A.$('#ed-addr') || {}).value; S.editNote = (A.$('#ed-note') || {}).value || ''; draw(); }
        else if (t.id === 'add-it' && t.value) { var p = D.PRODUCTS.filter(function (x) { return x.id === t.value; })[0]; S.addr = (A.$('#ed-addr') || {}).value; S.editNote = (A.$('#ed-note') || {}).value || ''; S.draft.push({ pid: p.id, name: p.name, emoji: p.emoji, sku: p.id + '-1', qty: 1, price: p.price, kg: p.kg, src: p.src, sup: p.sup || null, removed: false }); draw(); }
        else if (t.id === 'ed-addr') { S.addr = t.value; draw(); }
        else if (t.dataset.sc !== undefined) { ships[+t.dataset.sc].courier = t.value; }
        else if (t.dataset.sw !== undefined) { ships[+t.dataset.sw].kg = +t.value || 0.1; }
      });
    }
  });
})();
