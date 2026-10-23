/* Products list (agent C) */
(function () {
  var D = CatalogData, A = Admin, P = D.products, PER = 10;
  var st = { tab: 'all', q: '', cat: '', brand: '', ful: '', sup: '', min: '', max: '', page: 1, sel: {} };
  var TABS = [['all', 'All'], ['active', 'Active'], ['draft', 'Draft'], ['oos', 'Out of stock'], ['low', 'Low stock'], ['pre', 'Pre-order'], ['archived', 'Archived']];
  function inTab(p, t) {
    return t === 'all' ? true : t === 'active' ? p.status === 'active' : t === 'draft' ? p.status === 'draft' : t === 'archived' ? p.status === 'archived' :
      t === 'oos' ? (p.stock === 0 && p.status !== 'archived') : t === 'low' ? (p.low && p.status !== 'archived') : t === 'pre' ? p.preorder : true;
  }
  function filtered(ignoreTab) {
    var q = st.q.toLowerCase(), ids = st.cat ? D.descendants(st.cat) : null;
    return P.filter(function (p) {
      if (!ignoreTab && !inTab(p, st.tab)) return false;
      if (q && (p.title + ' ' + p.sku + ' ' + p.brand).toLowerCase().indexOf(q) < 0) return false;
      if (ids && !p.cats.some(function (c) { return ids.indexOf(c) >= 0; })) return false;
      if (st.brand && p.brand !== st.brand) return false;
      if (st.ful && p.fulfil !== st.ful) return false;
      if (st.sup && p.supplier !== st.sup) return false;
      if (st.min !== '' && p.price < +st.min) return false;
      if (st.max !== '' && p.price > +st.max) return false;
      return true;
    });
  }
  function stBadge(p) { return '<span class="a-badge ' + (p.status === 'active' ? 'ok' : p.status === 'draft' ? 'warn' : 'muted') + '">' + p.status + '</span>'; }
  function stars(r) { var f = Math.round(r); return '<span class="c-stars">' + '★★★★★'.slice(0, f) + '<i>' + '★★★★★'.slice(f) + '</i></span> <small class="c-sub">' + r.toFixed(1) + '</small>'; }
  function catOptions(sel, withEmpty) {
    return (withEmpty ? '<option value="">' + withEmpty + '</option>' : '') + D.cats.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + new Array(c.level).join('   ') + (c.level > 1 ? '↳ ' : '') + A.esc(c.name) + '</option>';
    }).join('');
  }
  function row(p) {
    var low = p.stock === 0 ? 'c-out' : p.low ? 'c-low' : '';
    return '<tr class="click" data-id="' + p.id + '"><td class="chk"><input type="checkbox" data-sel="' + p.id + '"' + (st.sel[p.id] ? ' checked' : '') + ' aria-label="Select"></td>' +
      '<td><div class="c-cell">' + D.thumb(p) + '<div><a class="c-link" href="product-edit.html?id=' + p.id + '"><b>' + A.esc(p.title) + '</b></a><small>' + A.esc(p.brand) + '</small></div></div></td>' +
      '<td class="c-mono">' + p.sku + '</td><td>' + A.esc(D.byId[p.primary].name) + (p.cats.length > 1 ? ' <span class="a-badge muted">+' + (p.cats.length - 1) + '</span>' : '') + '<span class="sub">' + A.esc(D.byId[D.byId[p.primary].parent].name) + '</span></td>' +
      '<td class="num"><b>' + A.fmt.bdt(p.price) + '</b>' + (p.old ? '<span class="c-old">' + A.fmt.bdt(p.old) + '</span>' : '') + '</td>' +
      '<td class="num ' + low + '">' + p.stock + (p.low && p.stock ? ' <span class="a-badge warn">low</span>' : '') + (p.stock === 0 ? ' <span class="a-badge danger">out</span>' : '') + '</td>' +
      '<td class="num">' + A.fmt.num(p.sold) + '</td><td>' + stars(p.rating) + '</td><td>' + stBadge(p) + '</td>' +
      '<td>' + (p.fulfil === 'dropship' ? '<span class="a-badge info">Dropship</span>' : '<span class="a-badge muted">Stock</span>') + '</td>' +
      '<td>' + (p.advance ? '<span class="a-badge warn" title="Requires advance payment (applies when advance payments are enabled)">Adv ' + p.advance + '%</span>' : '') + (p.preorder ? ' <span class="a-badge info">Pre-order</span>' : '') + '</td>' +
      '<td class="act"><a class="a-btn ghost sm icon" href="product-edit.html?id=' + p.id + '" aria-label="Edit">' + A.icons.edit + '</a></td></tr>';
  }
  function render() {
    var list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER)); if (st.page > pages) st.page = pages;
    var slice = list.slice((st.page - 1) * PER, st.page * PER);
    A.$$('.a-tab', document).forEach(function (t) { var k = t.dataset.tab; t.setAttribute('aria-selected', k === st.tab); A.$('.a-count', t).textContent = filtered(true).filter(function (p) { return inTab(p, k); }).length; });
    var n = Object.keys(st.sel).length;
    var bulk = A.$('#bulk'); bulk.hidden = !n; A.$('#bn', bulk).textContent = n + ' selected';
    var allOn = slice.length && slice.every(function (p) { return st.sel[p.id]; });
    A.$('#tbl').innerHTML = '<div class="a-table-wrap"><table class="a-table"><thead><tr><th class="chk"><input type="checkbox" id="all"' + (allOn ? ' checked' : '') + ' aria-label="Select all"></th><th>Product</th><th>SKU</th><th>Category</th><th class="num">Price</th><th class="num">Stock</th><th class="num">Sold</th><th>Rating</th><th>Status</th><th>Fulfilment</th><th>Flags</th><th></th></tr></thead><tbody>' +
      (slice.length ? slice.map(row).join('') : '<tr><td colspan="12"><div class="a-empty">' + A.icons.products + '<h3>No products match</h3><p>Try clearing some filters.</p></div></td></tr>') + '</tbody></table></div>' +
      '<div class="a-pager"><span>' + (list.length ? ((st.page - 1) * PER + 1) + '–' + Math.min(list.length, st.page * PER) : 0) + ' of ' + list.length + ' products</span><div class="pg">' +
      '<button data-pg="' + (st.page - 1) + '"' + (st.page < 2 ? ' disabled' : '') + '>‹</button>' + Array.apply(null, Array(pages)).map(function (_, i) { return '<button data-pg="' + (i + 1) + '"' + (i + 1 === st.page ? ' class="on" aria-current="page"' : '') + '>' + (i + 1) + '</button>'; }).join('') +
      '<button data-pg="' + (st.page + 1) + '"' + (st.page >= pages ? ' disabled' : '') + '>›</button></div></div>';
  }
  function selIds() { return Object.keys(st.sel).map(Number); }
  function bulkSetCategory() {
    var b = A.modal.open('<div class="a-field"><label>New primary category for ' + selIds().length + ' products</label><select id="bc">' + catOptions('', 'Choose category…') + '</select><span class="a-hint">The product keeps its other categories.</span></div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="bok">Apply</button></div>', { title: 'Set category', size: 'sm' });
    A.$('#bok', b).onclick = function () {
      var c = A.$('#bc', b).value; if (!c) { A.toast('Choose a category first', 'warn'); return; }
      selIds().forEach(function (id) { var p = D.prodById[id]; p.primary = c; if (p.cats.indexOf(c) < 0) p.cats.unshift(c); }); D.recount(); A.modal.close(); A.toast('Category updated for ' + selIds().length + ' products'); st.sel = {}; render();
    };
  }
  function bulkDelete() {
    var ids = selIds(), ps = ids.map(function (i) { return D.prodById[i]; }), withO = ps.filter(function (p) { return p.orders > 0; }), without = ps.length - withO.length;
    var b = A.modal.open('<p>Delete <b>' + ps.length + '</b> selected products?</p><div class="c-counts"><div><b>' + without + '</b><span>deleted permanently (no orders)</span></div><div><b>' + withO.length + '</b><span>archived (have orders)</span></div><div><b>' + ps.length + '</b><span>total selected</span></div></div>' +
      '<div class="c-warnbox">' + A.icons.warn + '<span>Products that have been ordered are never deleted: they are <b>archived</b> (hidden from the store, kept in order history).</span></div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn danger" id="dok">Delete / archive</button></div>', { title: 'Delete products', size: 'sm' });
    A.$('#dok', b).onclick = function () {
      ps.forEach(function (p) { if (p.orders > 0) { p.status = 'archived'; } else { P.splice(P.indexOf(p), 1); delete D.prodById[p.id]; } });
      D.recount(); A.modal.close(); A.toast(without + ' deleted, ' + withO.length + ' archived', 'warn'); st.sel = {}; render();
    };
  }
  function ready(root) {
    var sup = D.suppliers.map(function (s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
    A.$('#tabs').innerHTML = TABS.map(function (t) { return '<button class="a-tab" role="tab" data-tab="' + t[0] + '">' + t[1] + ' <span class="a-count">0</span></button>'; }).join('');
    A.$('#f-cat').innerHTML = catOptions('', 'All categories'); A.$('#f-brand').innerHTML = '<option value="">All brands</option>' + D.brands.map(function (b) { return '<option>' + b + '</option>'; }).join(''); A.$('#f-sup').innerHTML = '<option value="">Any supplier</option>' + sup;
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; st.page = 1; render(); return; }
      var pg = e.target.closest('[data-pg]'); if (pg && !pg.disabled) { st.page = +pg.dataset.pg; render(); return; }
      var tr = e.target.closest('tr.click'); if (tr && !e.target.closest('a,input,button')) { location.href = 'product-edit.html?id=' + tr.dataset.id; return; }
      var act = e.target.closest('[data-bulk]'); if (!act) return; var k = act.dataset.bulk, ids = selIds();
      if (k === 'activate' || k === 'draft') { ids.forEach(function (i) { D.prodById[i].status = k === 'activate' ? 'active' : 'draft'; }); A.toast(ids.length + ' products set to ' + (k === 'activate' ? 'active' : 'draft')); st.sel = {}; render(); }
      else if (k === 'cat') bulkSetCategory(); else if (k === 'delete') bulkDelete(); else if (k === 'clear') { st.sel = {}; render(); }
    });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'all') { A.$$('#tbl [data-sel]').forEach(function (c) { if (t.checked) st.sel[c.dataset.sel] = 1; else delete st.sel[c.dataset.sel]; }); render(); }
      else if (t.dataset.sel) { if (t.checked) st.sel[t.dataset.sel] = 1; else delete st.sel[t.dataset.sel]; render(); }
      else if (t.dataset.f) { st[t.dataset.f] = t.value; st.page = 1; render(); }
    });
    root.addEventListener('input', function (e) { var t = e.target; if (t.dataset.f && (t.type === 'search' || t.type === 'number')) { st[t.dataset.f] = t.value; st.page = 1; render(); } });
    A.$('#f-clear').onclick = function () { st.q = st.cat = st.brand = st.ful = st.sup = st.min = st.max = ''; A.$$('[data-f]').forEach(function (i) { i.value = ''; }); st.page = 1; render(); };
    render();
  }
  A.renderPage({
    active: 'products', title: 'Products', crumbs: [['Catalog'], ['Products']],
    actions: '<button class="a-btn" id="exp">' + A.icons.download + ' Export CSV</button><a class="a-btn primary" href="product-edit.html" data-perm="products.edit">' + A.icons.plus + ' Add product</a>',
    body: '<div class="a-tabs" id="tabs" role="tablist"></div><div class="a-toolbar" style="margin-top:12px">' +
      '<input type="search" class="grow" data-f="q" placeholder="Search title, SKU or brand…" aria-label="Search products">' +
      '<select id="f-cat" data-f="cat" aria-label="Category"></select><select id="f-brand" data-f="brand" aria-label="Brand"></select>' +
      '<select data-f="ful" aria-label="Fulfilment"><option value="">Stock + dropship</option><option value="stock">In stock (own)</option><option value="dropship">Dropship</option></select><select id="f-sup" data-f="sup" aria-label="Supplier"></select>' +
      '<input type="number" min="0" data-f="min" placeholder="Min ৳" style="width:90px" aria-label="Min price"><input type="number" min="0" data-f="max" placeholder="Max ৳" style="width:90px" aria-label="Max price"><button class="a-btn ghost sm" id="f-clear">Clear</button></div>' +
      '<div class="c-bulk" id="bulk" hidden><b id="bn"></b><button class="a-btn sm" data-bulk="activate">Activate</button><button class="a-btn sm" data-bulk="draft">Set to draft</button><button class="a-btn sm" data-bulk="cat">Set category…</button>' +
      '<button class="a-btn sm danger" data-bulk="delete" data-perm="products.delete" data-perm-mode="disable">' + A.icons.trash + ' Delete…</button><button class="a-btn sm ghost" data-bulk="clear">Clear selection</button></div><div id="tbl"></div>',
    onReady: ready
  });
  var ex = A.$('#exp'); if (ex) ex.onclick = function () { A.toast('Exported ' + filtered().length + ' products (mock)', 'info'); };
})();
