(function () {
  var D = window.SalesData, A = window.Admin, esc = A.esc, I = A.icons, bdt = A.fmt.bdt;
  var TABS = [['requested', 'Requested'], ['approved', 'Approved'], ['picked_up', 'Picked up'], ['inspected', 'Inspected'], ['refunded', 'Refunded'], ['rejected', 'Rejected']];
  var TONE = { requested: 'warn', approved: 'info', picked_up: 'info', inspected: 'info', refunded: 'ok', rejected: 'muted' };
  var tab = 'requested', q = '', cur = null;
  var R = D.RETURNS;
  R.forEach(function (r) { r.shipPayer = r.fault === 'our_fault' ? 'us' : 'customer'; r.method = r.refundTo; r.final = null; });

  function netAmount(r) { return Math.max(0, r.amount - (r.shipPayer === 'customer' ? r.shipFee || 120 : 0)); }
  function needsApproval(r) { return netAmount(r) > D.RET_THRESHOLD && !r.approved; }
  function counts() { var c = {}; TABS.forEach(function (t) { c[t[0]] = 0; }); R.forEach(function (r) { c[r.status]++; }); return c; }

  var body = '<div class="s-notice">' + I.warn + '<div>Return window: 7 days default (per category or product override). Return shipping is paid by us when it is our fault, by the customer for change of mind. Refunds above <b>' + bdt(D.RET_THRESHOLD) + '</b> need approval from someone with <code>refund.approve_high</code>.</div></div>' +
    '<div class="s-tabs-wrap"><div class="a-tabs" id="r-tabs" role="tablist"></div></div>' +
    '<div class="a-toolbar"><input type="search" id="r-q" placeholder="Search return, order or customer" style="flex:1;min-width:200px"></div>' +
    '<div class="a-card" style="margin-top:12px"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Return</th><th>Order</th><th>Customer</th><th>Item</th><th>Reason</th><th>Window</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody id="r-rows"></tbody></table></div></div>';

  function drawList() {
    var c = counts();
    A.$('#r-tabs').innerHTML = TABS.map(function (t) { return '<button class="a-tab" role="tab" data-rtab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + ' <span class="a-count">' + c[t[0]] + '</span></button>'; }).join('');
    var list = R.filter(function (r) { return r.status === tab && (!q || (r.id + r.orderId + r.cname).toLowerCase().indexOf(q) >= 0); });
    A.$('#r-rows').innerHTML = list.length ? list.map(function (r) {
      var ok = r.daysSince <= r.window;
      return '<tr class="s-click" data-rid="' + r.id + '"><td><b class="s-orderno">' + r.id + '</b><span class="s-sub">' + A.fmt.ago(r.date) + '</span></td><td>#' + r.orderId + '</td><td>' + esc(r.cname) + '<span class="s-sub">' + esc(r.phone) + '</span></td>' +
        '<td>' + r.items.map(function (i) { return i.emoji + ' ' + esc(i.name) + ' × ' + i.qty; }).join('<br>') + '</td><td>' + esc(r.reason) + '<span class="s-sub">' + (r.fault === 'our_fault' ? 'Our fault' : 'Change of mind') + '</span></td>' +
        '<td><span class="a-badge ' + (ok ? 'ok' : 'danger') + '">' + (ok ? 'Within' : 'Outside') + ' ' + r.window + 'd</span><span class="s-sub">Day ' + r.daysSince + '</span></td><td class="num"><b>' + bdt(r.amount) + '</b>' + (needsApproval(r) ? '<span class="s-sub" style="color:var(--warn,#d97706)">Needs approval</span>' : '') + '</td>' +
        '<td><span class="a-badge ' + TONE[r.status] + '">' + D.RET_STATUS[r.status] + '</span></td></tr>';
    }).join('') : '<tr><td colspan="8"><div class="a-empty">No returns in this stage.</div></td></tr>';
  }

  function restoreNote(r) {
    var o = D.order(r.orderId) || { points: 0, wallet: 0, couponCode: '' };
    var bits = [];
    if (o.points) bits.push('Redeemed points (' + o.points + ' pts) are restored in proportion to the returned value.');
    if (o.couponCode) bits.push('Coupon ' + o.couponCode + ' is re-issued only if the whole order is returned.');
    if (o.wallet) bits.push('Wallet amount used (' + bdt(o.wallet) + ') goes back to the store wallet proportionally.');
    bits.push('Points earned on this order are reversed (or never credited if still inside the return window).');
    return '<ul style="margin:6px 0 0;padding-left:18px">' + bits.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>';
  }

  function detail(r) {
    var ok = r.daysSince <= r.window, net = netAmount(r), need = needsApproval(r), st = r.status;
    var canEditSet = st === 'inspected' || st === 'picked_up' || st === 'approved' || st === 'requested';
    var h = '<div class="s-row" style="margin-bottom:12px"><span class="a-badge ' + TONE[st] + '">' + D.RET_STATUS[st] + '</span><span class="s-muted s-small">Order <a class="s-link" href="order.html?id=' + r.orderId + '">#' + r.orderId + '</a> · ' + esc(r.cname) + ' · ' + esc(r.phone) + '</span></div>';
    if (need && st !== 'refunded' && st !== 'rejected') {
      h += '<div class="s-approve"><b>Needs approval.</b> Refund ' + bdt(net) + ' is above the ' + bdt(D.RET_THRESHOLD) + ' threshold.<div class="s-row" style="margin-top:8px"><button class="a-btn accent sm" data-ract="approve_high" data-perm="refund.approve_high" data-perm-mode="disable">Approve high-value refund</button><span class="s-small s-muted">Only roles with <code>refund.approve_high</code> (Owner, Manager) can approve.</span></div></div>';
    } else if (r.big && r.approved) h += '<div class="s-notice">' + I.check + '<div>High-value refund approved by Sumon (Manager).</div></div>';
    h += '<div class="s-sec"><h4>Items &amp; reason</h4>' + r.items.map(function (i) { return '<div class="s-item"><div class="s-thumb">' + i.emoji + '</div><div><div class="t">' + esc(i.name) + '</div><div class="s-small s-muted">Qty ' + i.qty + '</div></div><div class="p">' + bdt(i.price * i.qty) + '</div></div>'; }).join('') +
      '<div style="margin-top:8px"><b>' + esc(r.reason) + '</b> <span class="a-badge ' + (r.fault === 'our_fault' ? 'danger' : 'muted') + '">' + (r.fault === 'our_fault' ? 'Our fault' : 'Change of mind') + '</span></div>' + (r.note ? '<div class="s-muted s-small" style="margin-top:4px">“' + esc(r.note) + '”</div>' : '') + '</div>';
    h += '<div class="s-sec"><h4>Customer photos</h4>' + (r.photos ? '<div class="s-ret-photos">' + Array.apply(null, Array(r.photos)).map(function (_, k) { return '<div class="s-ret-photo" title="Photo ' + (k + 1) + '">' + (k % 2 ? '📦' : r.items[0].emoji) + '</div>'; }).join('') + '</div>' : '<div class="s-muted s-small">No photos uploaded (not required for change of mind).</div>') + '</div>';
    h += '<div class="s-sec"><h4>Return window</h4><div class="s-check ' + (ok ? 'ok' : 'bad') + '">' + (ok ? I.check : I.x) + '<span>' + (ok ? 'Within window: day ' + r.daysSince + ' of ' + r.window : 'Outside window: day ' + r.daysSince + ' of ' + r.window + ' (exception needs a manager)') + '</span></div><div class="s-small s-muted" style="margin-top:4px">' + esc(r.winSource) + '</div></div>';
    if (st === 'rejected') { h += '<div class="s-sec"><h4>Rejection</h4><div>' + esc(r.reject) + '</div></div>'; return h; }
    h += '<div class="s-sec"><h4>Return shipping paid by</h4><div class="s-col" style="gap:6px"><label class="s-opt"><input type="radio" name="payer" value="us"' + (r.shipPayer === 'us' ? ' checked' : '') + (canEditSet ? '' : ' disabled') + '><div><b>We pay</b> (our fault)<div class="s-small s-muted">Pickup is on our courier account, nothing deducted</div></div></label>' +
      '<label class="s-opt"><input type="radio" name="payer" value="customer"' + (r.shipPayer === 'customer' ? ' checked' : '') + (canEditSet ? '' : ' disabled') + '><div><b>Customer pays</b> (change of mind)<div class="s-small s-muted">' + bdt(r.shipFee || 120) + ' deducted from the refund</div></div></label></div></div>';
    if (st === 'picked_up' || st === 'inspected' || st === 'refunded') {
      h += '<div class="s-sec"><h4>Inspection result</h4>' + (st === 'picked_up' ? '<select id="r-insp"><option value="">Select result…</option><option>Unused, original packaging</option><option>Defective confirmed</option><option>Used / damaged by customer</option><option>Wrong item returned</option></select>' : '<div class="a-badge info">' + esc(r.inspection) + '</div>') + '</div>';
    }
    h += '<div class="s-sec"><h4>Refund</h4><div class="s-col" style="gap:6px"><label class="s-opt"><input type="radio" name="rm" value="original"' + (r.method === 'original' ? ' checked' : '') + (canEditSet ? '' : ' disabled') + '><div><b>Original method</b><div class="s-small s-muted">COD order: manual bKash / bank payout</div></div></label>' +
      '<label class="s-opt"><input type="radio" name="rm" value="wallet"' + (r.method === 'wallet' ? ' checked' : '') + (canEditSet ? '' : ' disabled') + '><div><b>Store wallet</b><div class="s-small s-muted">Instant credit, spend-only</div></div></label></div>' +
      '<div class="s-totals" style="margin-top:10px"><span>Item value</span><span>' + bdt(r.amount) + '</span>' + (r.shipPayer === 'customer' ? '<span>Return shipping (customer)</span><span class="neg" style="color:var(--danger,#dc2626)">−' + bdt(r.shipFee || 120) + '</span>' : '') + '<span class="grand">Refund amount</span><span class="grand">' + bdt(net) + '</span></div>' +
      '<div class="s-adv"><b>Restoration on refund</b>' + restoreNote(r) + '</div></div>';
    var f = '';
    if (st === 'requested') f = '<button class="a-btn primary" data-ract="approve" >Approve return</button><button class="a-btn danger" data-ract="reject">Reject</button>';
    if (st === 'approved') f = '<button class="a-btn primary" data-ract="pickup">' + I.truck + ' Schedule courier pickup</button>';
    if (st === 'picked_up') f = '<button class="a-btn primary" data-ract="inspect">Save inspection</button>';
    if (st === 'inspected') f = '<button class="a-btn accent" data-ract="refund" data-perm="orders.refund" data-perm-mode="disable"' + (need ? ' disabled title="Needs approval first"' : '') + '>Issue refund ' + bdt(net) + '</button>';
    if (st === 'refunded') f = '<span class="a-badge ok">Refunded ' + bdt(net) + ' to ' + (r.method === 'wallet' ? 'store wallet' : 'original method') + '</span>';
    return h + '<div class="s-foot">' + f + '</div>';
  }

  function open(r) {
    cur = r; A.drawer.open(detail(r), { title: r.id + ' · ' + r.cname, width: 520 });
    A.applyPerms(document);
  }
  function setStatus(r, s, msg) { r.status = s; A.toast(msg, 'ok'); drawList(); open(r); }
  function onClick(e) {
    var t = e.target.closest('[data-rid],[data-rtab],[data-ract]'); if (!t) return;
    if (t.dataset.rtab) { tab = t.dataset.rtab; drawList(); return; }
    if (t.dataset.rid && !t.dataset.ract) { if (e.target.closest('a')) return; open(R.filter(function (x) { return x.id === t.dataset.rid; })[0]); return; }
    var r = cur; if (!r) return;
    var a = t.dataset.ract;
    if (a === 'approve') setStatus(r, 'approved', 'Return approved, customer notified');
    else if (a === 'reject') {
      A.modal.open('<div class="a-field"><label>Rejection reason (sent to customer)</label><select id="rj-r"><option>Outside the return window</option><option>Item used or damaged by customer</option><option>Not eligible for return (category rule)</option><option>Other</option></select></div><div class="s-row" style="justify-content:flex-end;margin-top:12px"><button class="a-btn ghost" onclick="Admin.modal.close()">Cancel</button><button class="a-btn danger" id="rj-go">Reject return</button></div>', { title: 'Reject ' + r.id, size: 'sm' });
      A.$('#rj-go').onclick = function () { r.reject = A.$('#rj-r').value + '.'; A.modal.close(); setStatus(r, 'rejected', 'Return rejected, customer notified'); };
    }
    else if (a === 'pickup') setStatus(r, 'picked_up', 'Pickup booked and parcel collected (demo)');
    else if (a === 'inspect') { var v = A.$('#r-insp').value; if (!v) { A.toast('Choose an inspection result', 'warn'); return; } r.inspection = v; if (/Used|Wrong/.test(v)) A.toast('Consider a partial refund or rejection', 'warn'); setStatus(r, 'inspected', 'Inspection saved'); }
    else if (a === 'approve_high') { r.approved = true; r.big = true; A.toast('High-value refund approved', 'ok'); drawList(); open(r); }
    else if (a === 'refund') { if (needsApproval(r)) { A.toast('Needs approval first', 'warn'); return; } setStatus(r, 'refunded', 'Refund of ' + bdt(netAmount(r)) + ' issued to ' + (r.method === 'wallet' ? 'store wallet' : 'original method')); }
  }
  function onChange(e) {
    var t = e.target; if (!cur || !t.name) return;
    if (t.name === 'payer') { cur.shipPayer = t.value; open(cur); drawList(); }
    if (t.name === 'rm') { cur.method = t.value; }
  }

  A.renderPage({
    active: 'returns', title: 'Returns & refunds', crumbs: [['Sales', ''], ['Returns & refunds', 'returns.html']],
    actions: '<span class="s-small s-muted">Approval threshold: <b>' + bdt(D.RET_THRESHOLD) + '</b> (Settings)</span>',
    body: body,
    onReady: function () {
      drawList();
      A.$('#r-q').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); drawList(); });
      if (window._retBound) return; window._retBound = 1;
      document.addEventListener('click', onClick);
      document.addEventListener('change', onChange);
      var rid = new URLSearchParams(location.search).get('id');
      if (rid) { var r = R.filter(function (x) { return x.id === rid; })[0]; if (r) { tab = r.status; drawList(); open(r); } }
    }
  });
})();
