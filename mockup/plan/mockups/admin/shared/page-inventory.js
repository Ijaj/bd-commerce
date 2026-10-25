/* Inventory (agent C) */
(function () {
  var D = CatalogData, A = Admin, esc = A.esc, PER = 12;
  var st = { q: '', loc: '', chip: '', page: 1, sel: {} }, moves = {};
  var REASON = { received: 'Stock received', damaged: 'Damaged / lost', correction: 'Stock-count correction', return: 'Return restock', order: 'Order reserved/shipped' };
  function rows() {
    var out = [];
    D.products.forEach(function (p) { if (p.status === 'archived') return; p.variants.forEach(function (v) { out.push({ p: p, v: v }); }); });
    return out;
  }
  function loc(p) { if (p.fulfil === 'dropship') { var s = D.suppliers.filter(function (x) { return x.id === p.supplier; })[0]; return 'Supplier · ' + (s ? s.name : '—'); } return p.id % 2 ? 'Main warehouse (Dhaka)' : 'Chattogram warehouse'; }
  function avail(v) { return Math.max(0, v.stock - v.reserved); }
  function state(v) { var a = avail(v); return a <= 0 ? 'out' : a <= v.thr ? 'low' : 'ok'; }
  function filt() {
    var q = st.q.toLowerCase();
    return rows().filter(function (r) {
      var s = state(r.v);
      if (q && (r.p.title + ' ' + r.v.sku + ' ' + r.v.combo.join(' ')).toLowerCase().indexOf(q) < 0) return false;
      if (st.loc && loc(r.p) !== st.loc && !(st.loc === 'Supplier' && r.p.fulfil === 'dropship')) return false;
      if (st.chip === 'low' && s !== 'low') return false;
      if (st.chip === 'out' && s !== 'out') return false;
      if (st.chip === 'attn' && s === 'ok') return false;
      return true;
    });
  }
  function hist(sku, v) {
    if (moves[sku]) return moves[sku];
    var seed = 0; for (var i = 0; i < sku.length; i++) seed = (seed * 31 + sku.charCodeAt(i)) % 9973;
    var list = [], n = v.stock, d = 22;
    var kinds = [['order', -1, 'Order #BD-' + (24000 + seed % 400) + ' shipped'], ['received', 1, 'PO received (GRN)'], ['order', -1, 'Order #BD-' + (23800 + seed % 300) + ' shipped'], ['return', 1, 'Return #R-' + (200 + seed % 90) + ' restocked'], ['damaged', -1, 'Damaged in warehouse'], ['received', 1, 'Opening stock']];
    kinds.forEach(function (k, i) { var q = 1 + ((seed >> i) % 6) + (k[0] === 'received' ? 20 : 0); list.push({ at: '2026-10-' + ('0' + Math.max(1, d - i * 3)).slice(-2) + 'T1' + (i % 9) + ':10:00', type: k[0], delta: k[1] * q, note: k[2], by: k[0] === 'order' ? 'System' : 'Rubel (Warehouse)' }); });
    return (moves[sku] = list);
  }
  function stBadge(s) { return s === 'out' ? '<span class="a-badge danger">Out of stock</span>' : s === 'low' ? '<span class="a-badge warn">Low stock</span>' : '<span class="a-badge ok">OK</span>'; }
  function row(r) {
    var p = r.p, v = r.v, s = state(v), a = avail(v), key = v.sku;
    return '<tr><td class="chk"><input type="checkbox" data-sel="' + key + '"' + (st.sel[key] ? ' checked' : '') + ' aria-label="Select"></td><td><div class="c-cell">' + D.thumb(p, 'sm') + '<div><a class="c-link" href="product-edit.html?id=' + p.id + '"><b>' + esc(p.title) + '</b></a><small>' + (v.combo.length ? esc(v.combo.join(' / ')) : 'Default') + (v.active ? '' : ' · inactive') + '</small></div></div></td>' +
      '<td class="c-mono">' + esc(v.sku) + '</td><td class="num"><span class="c-qty">' + v.stock + '</span></td><td class="num">' + v.reserved + '</td><td class="num"><span class="c-qty ' + (s === 'out' ? 'c-out' : s === 'low' ? 'c-low' : '') + '">' + a + '</span></td><td class="num">' + v.thr + '</td><td>' + esc(loc(p)) + '</td><td>' + stBadge(s) + '</td>' +
      '<td class="act"><button class="a-btn sm" data-adj="' + key + '">Adjust</button> <button class="a-btn sm ghost" data-hist="' + key + '">History</button>' + (s !== 'ok' ? ' <a class="a-btn sm accent" href="purchase-orders.html?new=1&sku=' + encodeURIComponent(v.sku) + '&supplier=' + (p.supplier || '') + '">Reorder</a>' : '') + '</td></tr>';
  }
  function find(sku) { var f = null; rows().forEach(function (r) { if (r.v.sku === sku) f = r; }); return f; }
  function render() {
    var list = filt(), pages = Math.max(1, Math.ceil(list.length / PER)); if (st.page > pages) st.page = pages;
    var slice = list.slice((st.page - 1) * PER, st.page * PER), all = rows();
    A.$$('[data-chip]').forEach(function (c) { c.classList.toggle('primary', c.dataset.chip === st.chip); });
    A.$('#kp').innerHTML = [['SKUs tracked', all.length, ''], ['Low stock', all.filter(function (r) { return state(r.v) === 'low'; }).length, 'warn'], ['Out of stock', all.filter(function (r) { return state(r.v) === 'out'; }).length, 'danger'], ['Units on hand', A.fmt.num(all.reduce(function (a, r) { return a + r.v.stock; }, 0)), '']].map(function (k) { return '<div class="a-stat"><div class="a-stat-l">' + k[0] + '</div><div class="a-stat-v">' + k[1] + '</div></div>'; }).join('');
    var n = Object.keys(st.sel).length; A.$('#rbar').hidden = !n; A.$('#rn').textContent = n + ' selected';
    A.$('#tbl').innerHTML = '<div class="a-table-wrap"><table class="a-table"><thead><tr><th class="chk"><input type="checkbox" id="all" aria-label="Select all"></th><th>Product / variant</th><th>SKU</th><th class="num">On hand</th><th class="num">Reserved</th><th class="num">Available</th><th class="num">Low at</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>' +
      (slice.length ? slice.map(row).join('') : '<tr><td colspan="10"><div class="a-empty">' + A.icons.inventory + '<h3>Nothing here</h3><p>No SKUs match these filters.</p></div></td></tr>') + '</tbody></table></div>' +
      '<div class="a-pager"><span>' + (list.length ? ((st.page - 1) * PER + 1) + '–' + Math.min(list.length, st.page * PER) : 0) + ' of ' + list.length + ' SKUs</span><div class="pg"><button data-pg="' + (st.page - 1) + '"' + (st.page < 2 ? ' disabled' : '') + '>‹</button>' +
      Array.apply(null, Array(pages)).map(function (_, i) { return '<button data-pg="' + (i + 1) + '"' + (i + 1 === st.page ? ' class="on"' : '') + '>' + (i + 1) + '</button>'; }).join('') + '<button data-pg="' + (st.page + 1) + '"' + (st.page >= pages ? ' disabled' : '') + '>›</button></div></div>';
  }
  function adjust(sku) {
    var r = find(sku), v = r.v;
    var b = A.modal.open('<p><b>' + esc(r.p.title) + '</b><br><span class="c-sub">' + esc(v.combo.join(' / ') || 'Default') + ' · <span class="c-mono">' + esc(sku) + '</span> · on hand <b>' + v.stock + '</b>, reserved ' + v.reserved + '</span></p>' +
      '<div class="c-2col" style="margin-top:12px"><div class="a-field"><label>Reason *</label><select id="ar"><option value="received">Stock received (+)</option><option value="damaged">Damaged / lost (−)</option><option value="correction">Stock-count correction (±)</option><option value="return">Return restock (+)</option></select></div><div class="a-field"><label id="aql">Quantity *</label><input type="number" id="aq" value="1" step="1"><span class="a-err" hidden></span></div></div>' +
      '<div class="a-field"><label>Note</label><input id="an" placeholder="e.g. PO-1042 / shelf recount"></div><div class="c-infobox"><span id="apv"></span></div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="aok">Save adjustment</button></div>', { title: 'Adjust stock', size: 'sm' });
    function delta() { var q = parseInt(A.$('#aq', b).value, 10) || 0, k = A.$('#ar', b).value; q = Math.abs(q) * ((k === 'damaged') ? -1 : (A.$('#aq', b).value < 0 && k === 'correction' ? -1 : 1)); return q; }
    function pv() {
      var k = A.$('#ar', b).value, q = parseInt(A.$('#aq', b).value, 10) || 0, d = k === 'damaged' ? -Math.abs(q) : k === 'correction' ? q : Math.abs(q);
      A.$('#aql', b).textContent = k === 'correction' ? 'Quantity (use − to remove)' : 'Quantity *'; A.$('#apv', b).innerHTML = 'New on hand: <b>' + (v.stock + d) + '</b> (' + (d >= 0 ? '+' : '') + d + ') · available ' + Math.max(0, v.stock + d - v.reserved); return d;
    }
    b.addEventListener('input', pv); b.addEventListener('change', pv); pv();
    A.$('#aok', b).onclick = function () {
      var d = pv(), k = A.$('#ar', b).value; if (!d) { var e = A.$('.a-err', b); e.textContent = 'Enter a non-zero quantity'; e.hidden = false; return; }
      if (v.stock + d < 0) { var e2 = A.$('.a-err', b); e2.textContent = 'Stock cannot go below 0'; e2.hidden = false; return; }
      v.stock += d; r.p.stock = r.p.variants.reduce(function (a, x) { return a + x.stock; }, 0); hist(sku, v).unshift({ at: new Date().toISOString().slice(0, 19), type: k, delta: d, note: A.$('#an', b).value || REASON[k], by: 'You (Sadia Akter)' });
      A.modal.close(); A.toast('Stock adjusted: ' + (d > 0 ? '+' : '') + d + ' on ' + sku); render();
    };
  }
  function history(sku) {
    var r = find(sku), h = hist(sku, r.v);
    A.drawer.open('<p><b>' + esc(r.p.title) + '</b><br><span class="c-sub">' + esc(r.v.combo.join(' / ') || 'Default') + ' · <span class="c-mono">' + esc(sku) + '</span> · on hand <b>' + r.v.stock + '</b></span></p><ul class="c-hist">' +
      h.map(function (m) { return '<li><span class="d ' + (m.delta > 0 ? 'p' : 'n') + '">' + (m.delta > 0 ? '+' : '') + m.delta + '</span><div><b>' + esc(REASON[m.type] || m.type) + '</b><div class="c-sub">' + esc(m.note) + ' · ' + esc(m.by) + '</div></div><small class="c-sub">' + A.fmt.dt(m.at) + '</small></li>'; }).join('') + '</ul>', { title: 'Movement history', width: 440 });
  }
  A.renderPage({
    active: 'inventory', title: 'Inventory', crumbs: [['Catalog'], ['Inventory']],
    actions: '<a class="a-btn" href="purchase-orders.html">' + A.icons.po + ' Purchase orders</a><button class="a-btn" id="exp">' + A.icons.download + ' Export</button>',
    body: '<div class="a-grid-4" id="kp" style="margin-bottom:12px"></div><div class="a-toolbar"><input type="search" class="grow" id="q" placeholder="Search product, variant or SKU…" aria-label="Search">' +
      '<select id="loc" aria-label="Location"><option value="">All locations</option><option>Main warehouse (Dhaka)</option><option>Chattogram warehouse</option><option value="Supplier">Supplier (dropship)</option></select>' +
      '<button class="a-btn sm" data-chip="attn">Needs attention</button><button class="a-btn sm" data-chip="low">Low stock</button><button class="a-btn sm" data-chip="out">Out of stock</button><button class="a-btn sm ghost" data-chip="">Clear</button></div>' +
      '<div class="c-bulk" id="rbar" hidden><b id="rn"></b><button class="a-btn sm accent" id="reo">Reorder selected → purchase order</button></div><div id="tbl"></div>',
    onReady: function (root) {
      A.$('#q').oninput = function () { st.q = this.value; st.page = 1; render(); };
      A.$('#loc').onchange = function () { st.loc = this.value; st.page = 1; render(); };
      A.$('#exp').onclick = function () { A.toast('Stock sheet exported (mock)', 'info'); };
      A.$('#reo').onclick = function () { location.href = 'purchase-orders.html?new=1&skus=' + encodeURIComponent(Object.keys(st.sel).join(',')); };
      root.addEventListener('click', function (e) {
        var t = e.target, b;
        if ((b = t.closest('[data-chip]'))) { st.chip = b.dataset.chip; st.page = 1; render(); }
        else if ((b = t.closest('[data-pg]'))) { if (!b.disabled) { st.page = +b.dataset.pg; render(); } }
        else if ((b = t.closest('[data-adj]'))) adjust(b.dataset.adj);
        else if ((b = t.closest('[data-hist]'))) history(b.dataset.hist);
      });
      root.addEventListener('change', function (e) {
        var t = e.target;
        if (t.id === 'all') { A.$$('[data-sel]').forEach(function (c) { if (t.checked) st.sel[c.dataset.sel] = 1; else delete st.sel[c.dataset.sel]; }); render(); }
        else if (t.dataset.sel) { if (t.checked) st.sel[t.dataset.sel] = 1; else delete st.sel[t.dataset.sel]; render(); }
      });
      render();
    }
  });
})();
