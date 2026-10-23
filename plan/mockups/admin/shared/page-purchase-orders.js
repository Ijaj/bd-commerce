/* Purchase orders (agent E) */
(function () {
  'use strict';
  var A = window.Admin, PD = window.PD, $ = A.$, esc = A.esc, bdt = A.fmt.bdt;
  var R = PD.rng(4242);
  function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
  function audit(a, e, b, af, x) { try { A.audit.log(a, e, b, af, x); } catch (er) { /* ignore */ } }
  var KINDS = { draft: ['Draft', 'muted'], sent: ['Sent', 'info'], partial: ['Partially received', 'warn'], received: ['Received', 'ok'], cancelled: ['Cancelled', 'danger'] };
  var pos = [], seq = 1051;
  var plan = ['received', 'received', 'partial', 'partial', 'sent', 'sent', 'sent', 'draft', 'draft', 'cancelled', 'received', 'sent'];
  plan.forEach(function (stt, i) {
    var sup = PD.suppliers[(i * 2 + 1) % PD.suppliers.length], prods = PD.products.filter(function (p) { return p.supplier === sup.id; });
    if (!prods.length) prods = PD.products.slice(0, 3);
    var lines = [], n = Math.min(prods.length, ri(1, 4));
    for (var k = 0; k < n; k++) { var p = prods[k], qty = ri(2, 12) * 5; lines.push({ sku: p.sku, name: p.name, qty: qty, cost: p.cost, received: stt === 'received' ? qty : stt === 'partial' ? Math.floor(qty * R() * .7) : 0 }); }
    if (stt === 'partial' && lines.every(function (l) { return l.received === 0; })) lines[0].received = Math.floor(lines[0].qty / 2);
    pos.push({ no: 'PO-' + (seq - i), sup: sup.id, status: stt, lines: lines, created: PD.daysAgo(ri(2, 60)), expected: PD.daysAgo(ri(-14, 20)), notes: i % 3 === 0 ? 'Please pack with invoice copy.' : '' });
  });
  var st = { f: 'all' };
  function total(po) { return po.lines.reduce(function (a, l) { return a + l.qty * l.cost; }, 0); }
  function badge(po) { var k = KINDS[po.status]; return '<span class="a-badge ' + k[1] + '">' + k[0] + '</span>'; }
  function cnt(f) { return f === 'all' ? pos.length : pos.filter(function (p) { return p.status === f; }).length; }

  function render() {
    var rows = pos.filter(function (p) { return st.f === 'all' || p.status === st.f; });
    var tabs = [['all', 'All']].concat(Object.keys(KINDS).map(function (k) { return [k, KINDS[k][0]]; }));
    var h = '<div class="a-tabs p-tabsbar" role="tablist">' + tabs.map(function (t) { return '<button class="a-tab" data-f="' + t[0] + '" aria-selected="' + (st.f === t[0]) + '">' + t[1] + ' <span class="a-count">' + cnt(t[0]) + '</span></button>'; }).join('') + '</div>' +
      '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>PO</th><th>Supplier</th><th>Created</th><th>Expected</th><th class="num">Lines</th><th class="num">Received</th><th class="num">Total cost</th><th>Status</th><th></th></tr></thead><tbody>';
    if (!rows.length) h += '<tr><td colspan="9"><div class="a-empty"><h3>No purchase orders</h3></div></td></tr>';
    rows.forEach(function (po) {
      var q = po.lines.reduce(function (a, l) { return a + l.qty; }, 0), r = po.lines.reduce(function (a, l) { return a + l.received; }, 0), late = (po.status === 'sent' || po.status === 'partial') && po.expected < PD.NOW;
      h += '<tr class="p-clk" data-po="' + po.no + '"><td><b>' + po.no + '</b></td><td>' + esc(PD.supplier(po.sup).name) + '</td><td>' + PD.fd(po.created) + '</td><td>' + PD.fd(po.expected) + (late ? ' <span class="a-badge danger">Late</span>' : '') + '</td><td class="num">' + po.lines.length + '</td><td class="num">' + r + ' / ' + q + '</td><td class="num">' + bdt(total(po)) + '</td><td>' + badge(po) + '</td><td style="white-space:nowrap">' +
        (po.status === 'sent' || po.status === 'partial' ? '<button class="a-btn sm primary" data-recv="' + po.no + '">Receive goods</button>' : '') + '</td></tr>';
    });
    $('#po-body').innerHTML = h + '</tbody></table></div></div>';
  }
  function find(no) { return pos.filter(function (p) { return p.no === no; })[0]; }

  /* editor */
  function lineRow(l, i, ro, sup) {
    var opts = PD.products.filter(function (p) { return p.supplier === sup; });
    return '<tr data-i="' + i + '"><td><select data-f="sku"' + (ro ? ' disabled' : '') + '>' + opts.map(function (p) { return '<option value="' + p.sku + '"' + (p.sku === l.sku ? ' selected' : '') + '>' + esc(p.name) + ' (' + p.sku + ')</option>'; }).join('') + (opts.some(function (p) { return p.sku === l.sku; }) ? '' : '<option value="' + l.sku + '" selected>' + esc(l.name) + '</option>') + '</select></td>' +
      '<td><input type="number" min="1" data-f="qty" value="' + l.qty + '"' + (ro ? ' disabled' : '') + ' style="width:80px"></td><td><input type="number" min="0" data-f="cost" value="' + l.cost + '"' + (ro ? ' disabled' : '') + ' style="width:100px"></td><td class="num">' + bdt(l.qty * l.cost) + '</td><td>' + (ro ? '' : '<button class="a-btn ghost icon sm" data-rm="' + i + '" aria-label="Remove line">' + A.icons.trash + '</button>') + '</td></tr>';
  }
  function openEditor(po) {
    var isNew = !po, ro = po && po.status !== 'draft';
    var d = po ? JSON.parse(JSON.stringify(po)) : { no: 'PO-' + (++seq), sup: PD.suppliers[0].id, status: 'draft', lines: [], created: PD.NOW, expected: PD.daysAgo(-7), notes: '' };
    if (po) { d.created = po.created; d.expected = po.expected; }
    if (isNew) { var fp = PD.products.filter(function (p) { return p.supplier === d.sup; })[0]; if (fp) d.lines.push({ sku: fp.sku, name: fp.name, qty: 10, cost: fp.cost, received: 0 }); }
    var iso = function (x) { x = new Date(x); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var b = A.modal.open('<div id="pe"></div>', { title: (isNew ? 'New purchase order ' : '') + d.no + (ro ? ' (' + KINDS[d.status][0] + ')' : ''), size: 'lg' });
    function draw() {
      var tot = d.lines.reduce(function (a, l) { return a + l.qty * l.cost; }, 0);
      $('#pe', b).innerHTML = '<div class="p-cols3"><div class="a-field"><label>Supplier</label><select id="pe-sup"' + (ro ? ' disabled' : '') + '>' + PD.suppliers.filter(function (s) { return s.status === 'active' || s.id === d.sup; }).map(function (s) { return '<option value="' + s.id + '"' + (s.id === d.sup ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="a-field"><label>Expected delivery</label><input id="pe-exp" type="date" value="' + iso(d.expected) + '"' + (ro ? ' disabled' : '') + '></div><div class="a-field"><label>Status</label><div style="padding-top:6px">' + badge(d) + '</div></div></div>' +
        '<div class="a-table-wrap p-lines"><table class="a-table"><thead><tr><th>Product</th><th>Qty</th><th>Unit cost (৳)</th><th class="num">Line total</th><th></th></tr></thead><tbody>' + d.lines.map(function (l, i) { return lineRow(l, i, ro, d.sup); }).join('') + '</tbody></table></div>' +
        (ro ? '' : '<button class="a-btn sm p-mt" id="pe-add">' + A.icons.plus + ' Add line</button>') +
        '<div class="p-tot"><span>Total (cost, VAT-inclusive)</span><b>' + bdt(tot) + '</b></div>' +
        '<div class="a-field"><label>Notes to supplier</label><textarea id="pe-notes" rows="2"' + (ro ? ' disabled' : '') + '>' + esc(d.notes) + '</textarea></div>' +
        '<div class="a-err" id="pe-err" hidden>Add at least one line with quantity and cost.</div>' +
        '<div class="a-actions">' + (ro ? '' : '<button class="a-btn danger" id="pe-cancel">' + (isNew ? 'Discard' : 'Cancel PO') + '</button>') + '<span class="p-grow"></span><button class="a-btn" data-layer-close>Close</button>' + (ro ? '' : '<button class="a-btn" id="pe-save">Save draft</button><button class="a-btn primary" id="pe-send">Send to supplier</button>') + '</div>';
      A.applyPerms(b);
    }
    function sync() { // read inputs into d
      if (ro) return;
      d.sup = $('#pe-sup', b).value; d.expected = new Date($('#pe-exp', b).value || d.expected); d.notes = $('#pe-notes', b).value;
      A.$$('tr[data-i]', b).forEach(function (tr) { var l = d.lines[+tr.dataset.i]; var s = $('[data-f=sku]', tr).value; if (s !== l.sku) { var p = PD.products.filter(function (x) { return x.sku === s; })[0]; if (p) { l.sku = p.sku; l.name = p.name; l.cost = p.cost; } } else { l.qty = +$('[data-f=qty]', tr).value || 0; l.cost = +$('[data-f=cost]', tr).value || 0; } });
    }
    function commit(status) {
      sync(); if (!d.lines.length || d.lines.some(function (l) { return l.qty <= 0; })) { $('#pe-err', b).hidden = false; return false; }
      d.status = status; if (isNew) { pos.unshift(d); } else { Object.keys(d).forEach(function (k) { po[k] = d[k]; }); }
      audit('po.' + status, d.no, '', bdt(d.lines.reduce(function (a, l) { return a + l.qty * l.cost; }, 0))); return true;
    }
    draw();
    b.addEventListener('change', function (e) {
      if (e.target.id === 'pe-sup') { var old = d.sup; d.sup = e.target.value; if (old !== d.sup) { d.lines = []; var fp = PD.products.filter(function (p) { return p.supplier === d.sup; })[0]; if (fp) d.lines.push({ sku: fp.sku, name: fp.name, qty: 10, cost: fp.cost, received: 0 }); } draw(); return; }
      if (e.target.closest('tr[data-i]')) { sync(); draw(); }
    });
    b.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.id === 'pe-add') { sync(); var fp = PD.products.filter(function (p) { return p.supplier === d.sup; })[0] || PD.products[0]; d.lines.push({ sku: fp.sku, name: fp.name, qty: 10, cost: fp.cost, received: 0 }); draw(); }
      else if (t.dataset.rm != null) { sync(); d.lines.splice(+t.dataset.rm, 1); draw(); }
      else if (t.id === 'pe-save') { if (commit('draft')) { A.modal.close(); render(); A.toast(d.no + ' saved as draft', 'ok'); } }
      else if (t.id === 'pe-send') { if (commit('sent')) { A.modal.close(); render(); A.toast(d.no + ' sent to ' + PD.supplier(d.sup).name + ' (email + portal)', 'ok'); } }
      else if (t.id === 'pe-cancel') { if (isNew) { seq--; A.modal.close(); } else { po.status = 'cancelled'; audit('po.cancelled', po.no); A.modal.close(); render(); A.toast(po.no + ' cancelled', 'warn'); } }
    });
  }
  function openReceive(po) {
    var rem = po.lines.map(function (l) { return l.qty - l.received; });
    var b = A.modal.open('<p class="p-muted">Enter the quantity actually received for each line. Stock of the product increases immediately and the PO moves to <b>Partially received</b> or <b>Received</b>.</p>' +
      '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Product</th><th class="num">Ordered</th><th class="num">Already received</th><th class="num">Receive now</th><th class="num">Stock after</th></tr></thead><tbody>' +
      po.lines.map(function (l, i) { var p = PD.products.filter(function (x) { return x.sku === l.sku; })[0] || { stock: 0 }; return '<tr><td>' + esc(l.name) + '<div class="p-muted p-small">' + l.sku + '</div></td><td class="num">' + l.qty + '</td><td class="num">' + l.received + '</td><td class="num"><input type="number" min="0" max="' + rem[i] + '" value="' + rem[i] + '" data-rcv="' + i + '" style="width:80px"' + (rem[i] ? '' : ' disabled') + '></td><td class="num" data-after="' + i + '">' + (p.stock + rem[i]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="a-field p-mt"><label>Receiving note (damaged / short)</label><input id="rc-note" placeholder="Optional"></div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="rc-ok">Confirm receipt &amp; update stock</button></div>', { title: 'Receive goods — ' + po.no, size: 'lg' });
    b.addEventListener('input', function (e) {
      var i = e.target.dataset.rcv; if (i == null) return; var v = Math.max(0, Math.min(rem[i], +e.target.value || 0)); var l = po.lines[i], p = PD.products.filter(function (x) { return x.sku === l.sku; })[0] || { stock: 0 };
      $('[data-after="' + i + '"]', b).textContent = p.stock + v;
    });
    $('#rc-ok', b).onclick = function () {
      var got = [];
      A.$$('[data-rcv]', b).forEach(function (inp) { var i = +inp.dataset.rcv, v = Math.max(0, Math.min(rem[i], +inp.value || 0)), l = po.lines[i]; if (v) { l.received += v; var p = PD.products.filter(function (x) { return x.sku === l.sku; })[0]; if (p) p.stock += v; got.push(l.sku + ' +' + v); } });
      if (!got.length) { A.toast('Enter at least one received quantity', 'warn'); return; }
      po.status = po.lines.every(function (l) { return l.received >= l.qty; }) ? 'received' : 'partial';
      audit('po.receive', po.no, '', got.join(', '), $('#rc-note', b).value);
      A.modal.close(); render(); A.toast('Stock updated: ' + got.join(', '), 'ok');
    };
  }

  A.renderPage({
    active: 'suppliers', title: 'Purchase orders', crumbs: [['Dashboard', 'index.html'], ['Suppliers & POs', 'suppliers.html'], ['Purchase orders']],
    actions: '<a class="a-btn" href="suppliers.html">Suppliers</a><button class="a-btn primary" id="po-new">' + A.icons.plus + ' New purchase order</button>',
    body: '<div id="po-body"></div>',
    onReady: function (root) {
      render();
      $('#po-new').onclick = function () { openEditor(null); };
      root.addEventListener('click', function (e) {
        var f = e.target.closest('[data-f]'); if (f && f.classList.contains('a-tab')) { st.f = f.dataset.f; render(); return; }
        var rc = e.target.closest('[data-recv]'); if (rc) { openReceive(find(rc.dataset.recv)); return; }
        var tr = e.target.closest('tr[data-po]'); if (tr) openEditor(find(tr.dataset.po));
      });
    }
  });
})();
