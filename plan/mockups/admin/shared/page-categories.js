/* Categories & attributes (agent C) */
(function () {
  var D = CatalogData, A = Admin, esc = A.esc;
  var COLORS = ['#4338ca', '#0f766e', '#be123c', '#a21caf', '#b45309', '#0369a1', '#15803d', '#475569'];
  var sel = null, w = null, isNew = false, open = {}, dragId = null, odrag = null;
  var TYPES = [['select', 'Select (one value)'], ['multiselect', 'Multi-select'], ['text', 'Text'], ['number', 'Number'], ['boolean', 'Yes / No']];
  function isOpt(a) { return a.t === 'select' || a.t === 'multiselect'; }
  D.cats.forEach(function (c) { if (c.level < 2) open[c.id] = 1; });

  function height(id) { var c = D.byId[id], h = 0; c.children.forEach(function (k) { h = Math.max(h, height(k)); }); return h + 1; } // levels incl. self
  function sibs(parent) { return parent ? D.byId[parent].children : D.roots().map(function (c) { return c.id; }); }
  function relevel(id, lvl) { var c = D.byId[id]; c.level = lvl; c.children.forEach(function (k) { relevel(k, lvl + 1); }); }
  function detach(id) { var c = D.byId[id]; if (c.parent) { var a = D.byId[c.parent].children; a.splice(a.indexOf(id), 1); } }
  function canMove(id, np) { if (np === id || D.descendants(id).indexOf(np) >= 0) return false; var lvl = np ? D.byId[np].level + 1 : 1; return lvl + height(id) - 1 <= 4; }
  function resort() { D.roots().forEach(function (r, i) { r.sort = i + 1; }); D.cats.forEach(function (c) { c.children.forEach(function (k, i) { D.byId[k].sort = i + 1; }); }); }
  function moveTo(id, np, before) {
    var c = D.byId[id]; detach(id); c.parent = np || null; var arr = np ? D.byId[np].children : null;
    if (np) { var i = before ? arr.indexOf(before) : -1; if (i < 0) arr.push(id); else arr.splice(i, 0, id); }
    else { /* roots order follows D.cats order */ var bi = before ? D.cats.indexOf(D.byId[before]) : -1; D.cats.splice(D.cats.indexOf(c), 1); if (bi < 0) D.cats.push(c); else D.cats.splice(D.cats.indexOf(D.byId[before]), 0, c); }
    relevel(id, np ? D.byId[np].level + 1 : 1); resort();
  }
  function ordered() { // depth-first for selects
    var out = []; (function walk(ids) { ids.forEach(function (id) { out.push(D.byId[id]); walk(D.byId[id].children); }); })(D.roots().map(function (c) { return c.id; })); return out;
  }

  /* ---------- tree ---------- */
  function node(id) {
    var c = D.byId[id], has = c.children.length, o = open[id];
    return '<div class="c-n" data-wrap="' + id + '"><div class="c-node' + (sel === id ? ' sel' : '') + '" draggable="true" data-id="' + id + '"><span class="grip" title="Drag to reorder / re-parent">⋮⋮</span>' +
      '<button class="tg' + (has ? (o ? ' open' : '') : ' none') + '" data-tg="' + id + '" aria-label="Expand">▸</button><span class="c-sw" style="background:' + c.color + '"></span><span class="nm">' + esc(c.name) + '</span><span class="lv">L' + c.level + '</span>' +
      '<span class="a-badge muted" title="Products in this category and below">' + c.count + '</span><span class="acts">' + (c.level < 4 ? '<button class="a-btn ghost sm icon" data-add="' + id + '" title="Add sub-category" aria-label="Add sub-category">' + A.icons.plus + '</button>' : '') +
      '<button class="a-btn ghost sm icon" data-del="' + id + '" title="Delete…" aria-label="Delete">' + A.icons.trash + '</button></span></div>' + (has && o ? '<div class="c-kids">' + c.children.map(node).join('') + '</div>' : '') + '</div>';
  }
  function rTree() {
    A.$('#tree').innerHTML = D.roots().map(function (r) { return node(r.id); }).join('');
    var n = D.cats.length; A.$('#tcount').textContent = n + ' categories · ' + D.products.length + ' products';
  }

  /* ---------- option list editor (select / multiselect attributes) ---------- */
  function optRow(r, i, j) {
    return '<div class="c-opt-row' + (r.err ? ' err' : '') + '" data-or="' + i + '|' + j + '"><button type="button" class="c-opt-grip" data-ogrip="' + i + '|' + j + '" aria-label="Reorder option ' + (j + 1) + ' (drag, or use Up / Down arrow keys)" title="Drag to reorder · Up / Down arrows">⋮⋮</button>' +
      '<input data-oi="' + i + '|' + j + '|en" value="' + esc(r.en) + '" placeholder="English" aria-label="Option ' + (j + 1) + ' English" autocomplete="off">' +
      '<input data-oi="' + i + '|' + j + '|bn" lang="bn" value="' + esc(r.bn) + '" placeholder="বাংলা" aria-label="Option ' + (j + 1) + ' Bengali" autocomplete="off">' +
      '<button type="button" class="a-btn ghost sm icon" data-orm="' + i + '|' + j + '" aria-label="Delete option ' + (j + 1) + '">✕</button>' + (r.err ? '<span class="a-err c-opt-err">' + esc(r.err) + '</span>' : '') + '</div>';
  }
  function optRows(a, i) { return a.o.length ? a.o.map(function (r, j) { return optRow(r, i, j); }).join('') : '<div class="c-opt-empty">No options yet. Add the values customers can pick or filter by.</div>'; }
  function optEditor(a, i) {
    return '<div class="c-opts" data-ob="' + i + '"><div class="c-opt-h"><span>Options (<span data-ocount>' + a.o.length + '</span>)</span><button type="button" class="a-btn sm" data-oadd="' + i + '">+ Add option</button></div><div class="c-opt-rows" data-orows="' + i + '">' + optRows(a, i) + '</div></div>';
  }
  function rOpts(i) { // only the rows below the header are redrawn, so the "+ Add option" button never moves
    var a = w.attrs[i], rows = A.$('[data-orows="' + i + '"]'); if (!rows) return;
    rows.innerHTML = optRows(a, i); A.$('[data-ob="' + i + '"] [data-ocount]').textContent = a.o.length;
  }
  function focusOpt(i, j, part) { var el = A.$('[data-oi="' + i + '|' + j + '|' + part + '"]'); if (el) { el.focus(); if (part !== 'grip') el.select(); } }
  function addOpt(i) { w.attrs[i].o.push({ en: '', bn: '', err: '' }); rOpts(i); focusOpt(i, w.attrs[i].o.length - 1, 'en'); }
  function moveOpt(i, from, to) { var o = w.attrs[i].o; to = Math.max(0, Math.min(o.length - 1, to)); if (from === to) return false; o.splice(to, 0, o.splice(from, 1)[0]); rOpts(i); return true; }
  function gripFocus(i, j) { var g = A.$('[data-ogrip="' + i + '|' + j + '"]'); if (g) g.focus(); }
  function checkOpts() { // drop empty rows, require EN + BN, flag duplicate EN; returns true when every option attribute is valid
    var okAll = true, changed = false;
    w.attrs.forEach(function (a) {
      if (!a.n.trim() || !isOpt(a)) return;
      var n0 = a.o.length; a.o = a.o.filter(function (r) { return r.en.trim() || r.bn.trim(); }); if (a.o.length !== n0) changed = true;
      var groups = {};
      a.o.forEach(function (r) {
        var en = r.en.trim(), bn = r.bn.trim(); r.err = '';
        if (!en) r.err = 'English name is required'; else if (!bn) r.err = 'Bengali name is required';
        if (en) (groups[en.toLowerCase()] = groups[en.toLowerCase()] || []).push(r);
      });
      Object.keys(groups).forEach(function (k) { if (groups[k].length > 1) groups[k].forEach(function (r) { if (!r.err) r.err = 'Duplicate option “' + r.en.trim() + '” — each English name must be unique'; }); });
      if (a.o.some(function (r) { return r.err; })) okAll = false;
    });
    return { ok: okAll, changed: changed };
  }

  /* ---------- editor ---------- */
  function startEdit(id) {
    sel = id; isNew = false; var c = D.byId[id];
    w = { name: c.name, bn: c.bn, slug: c.slug, parent: c.parent || '', color: c.color, image: c.image, attrs: c.attrs.map(function (a) { return { n: a.n, t: a.t, f: a.f, o: (a.o || a.v.map(function (x) { return { en: x, bn: '' }; })).map(function (x) { return { en: x.en, bn: x.bn, err: '' }; }) }; }), retMode: c.ret ? 'custom' : (c.retNone ? 'none' : 'inherit'), ret: c.ret || 7, sort: c.sort, hidden: c.hidden, slugEdited: true };
    rTree(); rEd();
  }
  function startNew(parent) {
    sel = null; isNew = true; w = { name: '', bn: '', slug: '', parent: parent || '', color: parent ? D.byId[parent].color : COLORS[0], image: false, attrs: [], retMode: 'inherit', ret: 7, sort: sibs(parent || null).length + 1, hidden: false, slugEdited: false };
    if (parent) open[parent] = 1; rTree(); rEd();
  }
  function lvlOf() { return w.parent ? D.byId[w.parent].level + 1 : 1; }
  function rEd() {
    var ed = A.$('#ed');
    if (!w) { ed.innerHTML = '<div class="a-empty">' + A.icons.categories + '<h3>Select a category</h3><p>Pick a category in the tree to edit it, or add a new one.</p></div>'; return; }
    var lvl = lvlOf(), main = lvl === 1, c = isNew ? null : D.byId[sel];
    var inh = isNew ? (w.parent ? D.attrsFor([w.parent]) : []) : D.inheritedAttrs(sel);
    var pars = ordered().filter(function (x) { return isNew ? x.level < 4 : (canMove(sel, x.id)); });
    A.$('#ed').innerHTML = '<div class="a-card"><div class="a-card-h"><h3>' + (isNew ? 'New category' : 'Edit: ' + esc(c.name)) + '</h3><span class="a-badge ' + (main ? 'info' : 'muted') + '">' + (main ? 'Main category' : 'Level ' + lvl) + '</span></div><div class="a-card-b">' +
      '<div class="c-2col"><div class="a-field"><label>Name <span class="c-lang">EN</span> *</label><input data-w="name" value="' + esc(w.name) + '"><span class="a-err" hidden></span></div><div class="a-field"><label>Name <span class="c-lang">BN</span></label><input data-w="bn" lang="bn" value="' + esc(w.bn) + '" style="font-family:\'Noto Sans Bengali\',sans-serif"></div></div>' +
      '<div class="c-2col"><div class="a-field"><label>Slug</label><div class="a-input-grp"><span>/c/</span><input data-w="slug" value="' + esc(w.slug) + '"></div></div><div class="a-field"><label>Parent category</label><select data-w="parent"><option value="">— none (main category) —</option>' + pars.map(function (p) { return '<option value="' + p.id + '"' + (p.id === w.parent ? ' selected' : '') + '>' + new Array(p.level).join('  ') + esc(p.name) + '</option>'; }).join('') + '</select><span class="a-hint">Max 4 levels.</span></div></div>' +
      '<div class="a-field"><label>Image ' + (main ? '<span style="color:var(--danger)">* required for main categories</span>' : '<span class="c-sub">(optional for sub-categories)</span>') + '</label><div class="c-imgbox"><span class="c-thumb lg" style="--tc:' + w.color + '">' + (w.image ? (c ? c.emoji : '🖼️') : '∅') + '</span><div>' + '<button class="a-btn sm" data-img="1">' + A.icons.upload + ' ' + (w.image ? 'Replace image' : 'Upload image') + '</button> ' + (w.image ? '<button class="a-btn sm ghost" data-img="0">Remove</button>' : '') + '<div class="a-hint">Square, min 600×600. Shown as the category tile on the home page.</div></div></div><span class="a-err" hidden id="imgerr"></span></div>' +
      '<div class="a-field"><label>Chip colour</label><div class="c-swatches">' + COLORS.map(function (k) { return '<button type="button" data-color="' + k + '" class="' + (k === w.color ? 'on' : '') + '" style="background:' + k + '" aria-label="Colour ' + k + '"></button>'; }).join('') + '</div></div>' +
      '<div class="a-field"><label>Attributes defined at this category</label><span class="a-hint" style="margin-bottom:6px">Inherited by every sub-category and product below, and used as storefront filters.</span>' +
      (w.attrs.length ? '<div class="c-attr c-sub" style="font-weight:700"><span>Name</span><span>Type</span><span>Filter</span><span></span></div>' : '') +
      w.attrs.map(function (a, i) {
        return '<div class="c-attr-blk"><div class="c-attr"><input data-at="' + i + '|n" value="' + esc(a.n) + '" placeholder="e.g. Material"><select data-at="' + i + '|t" aria-label="Attribute type">' + TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (a.t === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
          '<label class="a-switch" title="Use as storefront filter"><input type="checkbox" data-at="' + i + '|f"' + (a.f ? ' checked' : '') + '></label><button class="a-btn ghost sm icon" data-atrm="' + i + '" aria-label="Remove attribute">' + A.icons.x + '</button></div>' + (isOpt(a) ? optEditor(a, i) : '') + '</div>';
      }).join('') +
      '<div><button class="a-btn sm" id="addAt">' + A.icons.plus + ' Add attribute</button></div></div>' +
      '<div class="a-field"><label>Inherited from parent categories <span class="c-sub">(read-only)</span></label>' + (inh.length ? '<div class="c-inh">' + inh.map(function (a) { return '<span>' + esc(a.n) + ' <em>from ' + esc(a.from) + '</em></span>'; }).join('') + '</div>' : '<span class="c-sub">None' + (main ? ' — main categories have no parent.' : '.') + '</span>') + '</div>' +
      '<div class="c-2col"><div class="a-field"><label>Return window override</label><select data-w="retMode"><option value="inherit"' + (w.retMode === 'inherit' ? ' selected' : '') + '>Inherit (store default 7 days)</option><option value="custom"' + (w.retMode === 'custom' ? ' selected' : '') + '>Custom days</option><option value="none"' + (w.retMode === 'none' ? ' selected' : '') + '>Not returnable</option></select></div>' +
      '<div class="a-field" ' + (w.retMode === 'custom' ? '' : 'hidden') + '><label>Days</label><input type="number" min="1" max="60" data-w="ret" value="' + w.ret + '"></div></div>' +
      '<div class="c-2col"><div class="a-field"><label>Sort order</label><input type="number" min="1" data-w="sort" value="' + w.sort + '"><span class="a-hint">Position among siblings (drag in the tree also works).</span></div><div class="a-field"><label>Visibility</label><label class="a-switch"><input type="checkbox" data-w="hidden"' + (w.hidden ? '' : ' checked') + '><span>Visible in store</span></label></div></div>' +
      '<div class="a-actions" style="justify-content:space-between"><div>' + (isNew ? '' : '<button class="a-btn danger" data-del="' + sel + '" data-perm="categories.manage" data-perm-mode="disable">' + A.icons.trash + ' Delete…</button>') + '</div><div style="display:flex;gap:8px"><button class="a-btn" id="cancel">Cancel</button><button class="a-btn primary" id="save">' + (isNew ? 'Create category' : 'Save changes') + '</button></div></div></div></div>';
    A.applyPerms(ed);
  }
  function save() {
    var co = checkOpts(), ok = true;
    if (co.changed || !co.ok) rEd();
    A.$$('#ed .a-err:not(.c-opt-err)').forEach(function (e) { e.hidden = true; });
    if (!w.name.trim()) { var e1 = A.$('[data-w=name]').closest('.a-field'); e1.classList.add('err'); var er = A.$('.a-err', e1); er.textContent = 'Name is required'; er.hidden = false; ok = false; }
    if (lvlOf() === 1 && !w.image) { var ie = A.$('#imgerr'); ie.textContent = 'Main categories need an image.'; ie.hidden = false; ok = false; }
    if (!co.ok) { ok = false; var bad = A.$('.c-opt-row.err input'); if (bad) bad.focus({ preventScroll: true }); if (bad) bad.scrollIntoView({ block: 'center' }); }
    if (!ok) { A.toast('Please fix the highlighted fields', 'danger'); return; }
    var attrs = w.attrs.filter(function (a) { return a.n.trim(); }).map(function (a) {
      var o = isOpt(a) ? a.o.map(function (r) { return { en: r.en.trim(), bn: r.bn.trim() }; }) : [];   // options of non-select types are not stored
      return { n: a.n.trim(), t: a.t, v: o.map(function (r) { return r.en; }), o: o, f: a.f };
    });
    var c;
    if (isNew) {
      var maxN = Math.max.apply(null, D.cats.map(function (x) { return +x.id.slice(1); })) + 1;
      c = { id: 'c' + maxN, name: w.name.trim(), bn: w.bn, slug: w.slug || D.slug(w.name), level: lvlOf(), parent: w.parent || null, children: [], sort: +w.sort || 1, color: w.color, emoji: w.parent ? D.byId[w.parent].emoji : '🛍️', image: w.image, attrs: attrs, ret: null, hidden: false, count: 0 };
      D.cats.push(c); D.byId[c.id] = c; if (w.parent) D.byId[w.parent].children.push(c.id); sel = c.id; isNew = false;
    } else {
      c = D.byId[sel]; c.name = w.name.trim(); c.bn = w.bn; c.slug = w.slug; c.color = w.color; c.image = w.image; c.attrs = attrs;
      if ((c.parent || '') !== w.parent) { moveTo(sel, w.parent || null, null); }
    }
    c.ret = w.retMode === 'custom' ? +w.ret : null; c.retNone = w.retMode === 'none'; c.hidden = w.hidden;
    var arr = sibs(c.parent), i = arr.indexOf(c.id), want = Math.max(1, Math.min(arr.length, +w.sort || 1)) - 1;
    if (i !== want) { arr.splice(i, 1); arr.splice(want, 0, c.id); if (!c.parent) { D.cats.splice(D.cats.indexOf(c), 1); var tgt = D.roots()[want]; if (tgt) D.cats.splice(D.cats.indexOf(tgt), 0, c); else D.cats.push(c); } }
    resort(); D.recount(); A.toast('Category saved'); startEdit(c.id);
  }

  /* ---------- delete dialog ---------- */
  function delDialog(id) {
    var c = D.byId[id], sub = D.descendants(id), subs = sub.length - 1, ps = D.products.filter(function (p) { return p.cats.some(function (x) { return sub.indexOf(x) >= 0; }); }), withO = ps.filter(function (p) { return p.orders > 0; }).length;
    var below = height(id) - 1; // levels below this node
    var targets = ordered().filter(function (x) { return sub.indexOf(x.id) < 0; });
    function fits(t) { return t.level + below <= 4; }
    var firstOk = targets.filter(fits)[0];
    var b = A.modal.open('<p class="c-sub" style="margin-bottom:6px">Deleting <b>' + esc(D.path(id)) + '</b></p><div class="c-counts"><div><b>' + subs + '</b><span>sub-categories</span></div><div><b>' + ps.length + '</b><span>products inside</span></div><div><b>' + withO + '</b><span>of them have orders</span></div></div>' +
      '<div class="c-opt-del"><label class="c-choice"><input type="radio" name="dm" value="move" checked> <b>(a) Move everything to one other category</b><div class="c-sub">All ' + ps.length + ' products and ' + subs + ' sub-categor' + (subs === 1 ? 'y' : 'ies') + ' go under ONE target category, then “' + esc(c.name) + '” is deleted. Nothing is lost.</div>' +
      '<div class="a-field" style="margin:8px 0 0"><label>Target category</label><select id="tgt">' + targets.map(function (t) { var ok = fits(t); return '<option value="' + t.id + '"' + (ok ? '' : ' disabled') + (firstOk && t.id === firstOk.id ? ' selected' : '') + '>' + new Array(t.level).join('  ') + esc(t.name) + (ok ? '' : ' (too deep for 4 levels)') + '</option>'; }).join('') + '</select></div></label>' +
      '<label class="c-choice danger"><input type="radio" name="dm" value="del"> <b>(b) Delete the category, its sub-categories and ALL their products</b><div class="c-sub">Removes ' + (subs + 1) + ' categories and up to ' + ps.length + ' products.</div></label></div>' +
      '<div class="c-dangerbox" id="dwarn" hidden>' + A.icons.warn + ' <b>Destructive.</b> ' + (ps.length - withO) + ' product(s) without orders are deleted permanently. <b>' + withO + '</b> product(s) with orders are <b>archived</b> instead (hidden from the store, kept in order history).</div>' +
      '<div class="a-field" style="margin-top:12px"><label>Type <b>' + esc(c.name) + '</b> to confirm</label><input id="tc" autocomplete="off" placeholder="' + esc(c.name) + '"></div>' +
      '<div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn danger" id="dgo" disabled>Move &amp; delete category</button></div>', { title: 'Delete category', size: 'md' });
    var tc = A.$('#tc', b), go = A.$('#dgo', b);
    function mode() { return A.$('input[name=dm]:checked', b).value; }
    function upd() {
      var m = mode(); A.$('#dwarn', b).hidden = m !== 'del'; A.$('#tgt', b).disabled = m !== 'move'; go.textContent = m === 'move' ? 'Move & delete category' : 'Delete category and products';
      go.disabled = !(tc.value.trim() === c.name && (m === 'del' || (A.$('#tgt', b).value && !A.$('#tgt', b).selectedOptions[0].disabled)));
    }
    b.addEventListener('input', upd); b.addEventListener('change', upd); upd();
    go.onclick = function () {
      var m = mode(), msg;
      if (m === 'move') {
        var t = A.$('#tgt', b).value, kids = c.children.slice();
        D.products.forEach(function (p) { if (p.cats.some(function (x) { return sub.indexOf(x) >= 0; })) { p.cats = p.cats.filter(function (x) { return sub.indexOf(x) < 0; }); if (p.cats.indexOf(t) < 0) p.cats.push(t); if (sub.indexOf(p.primary) >= 0) p.primary = t; } });
        kids.forEach(function (k) { moveTo(k, t, null); });
        msg = ps.length + ' products and ' + subs + ' sub-categories moved under “' + D.byId[t].name + '”';
      } else {
        var del = 0, arch = 0;
        D.products.slice().forEach(function (p) {
          if (!p.cats.some(function (x) { return sub.indexOf(x) >= 0; })) return;
          if (p.orders > 0) { p.status = 'archived'; p.cats = p.cats.filter(function (x) { return sub.indexOf(x) < 0; }); if (sub.indexOf(p.primary) >= 0) p.primary = p.cats[0] || ''; arch++; }
          else { D.products.splice(D.products.indexOf(p), 1); delete D.prodById[p.id]; del++; }
        });
        msg = 'Deleted ' + (subs + 1) + ' categories, ' + del + ' products deleted, ' + arch + ' archived';
      }
      var gone = m === 'move' ? [id] : sub; detach(id); gone.forEach(function (x) { var o = D.byId[x]; if (o) { D.cats.splice(D.cats.indexOf(o), 1); delete D.byId[x]; } });
      D.recount(); resort(); A.modal.close(); A.toast(msg, 'warn'); if (gone.indexOf(sel) >= 0) { sel = null; w = null; } rTree(); rEd();
    };
  }

  /* ---------- wiring ---------- */
  function wire(root) {
    root.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-tg]'))) { open[b.dataset.tg] = !open[b.dataset.tg]; rTree(); return; }
      if ((b = t.closest('[data-add]'))) { startNew(b.dataset.add); return; }
      if ((b = t.closest('[data-del]'))) { delDialog(b.dataset.del); return; }
      if ((b = t.closest('.c-node'))) { startEdit(b.dataset.id); return; }
      if ((b = t.closest('[data-color]'))) { w.color = b.dataset.color; rEd(); return; }
      if ((b = t.closest('[data-img]'))) { w.image = b.dataset.img === '1'; if (w.image) A.toast('Image uploaded (mock)', 'info'); rEd(); return; }
      if (t.closest('#addAt')) { w.attrs.push({ n: '', t: 'select', o: [], f: true }); rEd(); var ins = A.$$('[data-at$="|n"]'); if (ins.length) ins[ins.length - 1].focus(); return; }
      if ((b = t.closest('[data-oadd]'))) { addOpt(+b.dataset.oadd); return; }
      if ((b = t.closest('[data-orm]'))) { var q = b.dataset.orm.split('|'), qi = +q[0], qj = +q[1]; w.attrs[qi].o.splice(qj, 1); rOpts(qi); if (w.attrs[qi].o.length) focusOpt(qi, Math.min(qj, w.attrs[qi].o.length - 1), 'en'); else A.$('[data-oadd="' + qi + '"]').focus(); return; }
      if ((b = t.closest('[data-atrm]'))) { w.attrs.splice(+b.dataset.atrm, 1); rEd(); return; }
      if (t.closest('#save')) save(); if (t.closest('#cancel')) { if (isNew) { w = null; isNew = false; rTree(); rEd(); } else startEdit(sel); }
    });
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.w && t.type !== 'checkbox' && t.tagName !== 'SELECT') { w[t.dataset.w] = t.value; if (t.dataset.w === 'name' && !w.slugEdited) { w.slug = D.slug(w.name); A.$('[data-w=slug]').value = w.slug; } if (t.dataset.w === 'slug') w.slugEdited = true; t.closest('.a-field') && t.closest('.a-field').classList.remove('err'); }
      else if (t.dataset.at) { var p = t.dataset.at.split('|'); w.attrs[+p[0]][p[1]] = t.type === 'checkbox' ? t.checked : t.value; }
      else if (t.dataset.oi) { var o = t.dataset.oi.split('|'), r = w.attrs[+o[0]].o[+o[1]]; r[o[2]] = t.value; if (r.err) { r.err = ''; var row = t.closest('.c-opt-row'); row.classList.remove('err'); var er = A.$('.c-opt-err', row); if (er) er.remove(); } }
    });
    /* option rows: Enter adds / moves to next row; Alt+Up/Down (or Up/Down on the handle) reorders; drag handle for mouse */
    root.addEventListener('keydown', function (e) {
      var t = e.target, o, i, j, n;
      if (t.dataset && t.dataset.oi) {
        o = t.dataset.oi.split('|'); i = +o[0]; j = +o[1];
        if (e.key === 'Enter') { e.preventDefault(); n = w.attrs[i].o.length; if (j === n - 1) addOpt(i); else focusOpt(i, j + 1, 'en'); }
        else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); var to = j + (e.key === 'ArrowUp' ? -1 : 1); if (moveOpt(i, j, to)) focusOpt(i, to, o[2]); }
      } else if (t.dataset && t.dataset.ogrip && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault(); o = t.dataset.ogrip.split('|'); i = +o[0]; j = +o[1]; var to2 = j + (e.key === 'ArrowUp' ? -1 : 1); if (moveOpt(i, j, to2)) gripFocus(i, to2);
      }
    });
    root.addEventListener('mousedown', function (e) { var g = e.target.closest && e.target.closest('[data-ogrip]'); if (g) g.closest('.c-opt-row').draggable = true; });
    root.addEventListener('dragstart', function (e) {
      var r = e.target.closest && e.target.closest('.c-opt-row'); if (!r) return;
      var p = r.dataset.or.split('|'); odrag = { i: +p[0], j: +p[1] }; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', r.dataset.or); } catch (x) { /* */ }
    });
    root.addEventListener('dragover', function (e) {
      var r = e.target.closest && e.target.closest('.c-opt-row'); if (!r || !odrag) return;
      var p = r.dataset.or.split('|'); if (+p[0] !== odrag.i) return; e.preventDefault();
      A.$$('.c-opt-row.drop-before, .c-opt-row.drop-after').forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
      var bb = r.getBoundingClientRect(); r.classList.add(e.clientY < bb.top + bb.height / 2 ? 'drop-before' : 'drop-after');
    });
    root.addEventListener('drop', function (e) {
      var r = e.target.closest && e.target.closest('.c-opt-row'); if (!r || !odrag) return;
      var p = r.dataset.or.split('|'); if (+p[0] !== odrag.i) return; e.preventDefault();
      var after = r.classList.contains('drop-after'), from = odrag.j, to = +p[1] + (after ? 1 : 0), i = odrag.i; odrag = null;
      if (from < to) to--; moveOpt(i, from, to);
    });
    root.addEventListener('dragend', function () { odrag = null; A.$$('.c-opt-row').forEach(function (x) { x.classList.remove('dragging', 'drop-before', 'drop-after'); x.draggable = false; }); });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.w === 'hidden') w.hidden = !t.checked;
      else if (t.dataset.w) { w[t.dataset.w] = t.value; if (t.dataset.w === 'parent' || t.dataset.w === 'retMode') rEd(); }
      else if (t.dataset.at) { var p = t.dataset.at.split('|'); w.attrs[+p[0]][p[1]] = t.type === 'checkbox' ? t.checked : t.value; if (p[1] === 't') rEd(); }   // option rows stay in memory while the type is non-select
    });
    /* drag & drop */
    root.addEventListener('dragstart', function (e) { var n = e.target.closest && e.target.closest('.c-node'); if (!n) return; dragId = n.dataset.id; n.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) { /* */ } });
    root.addEventListener('dragover', function (e) { var n = e.target.closest && e.target.closest('.c-node'); if (!n || !dragId || n.dataset.id === dragId) return; e.preventDefault(); A.$$('.c-node.dragover').forEach(function (x) { x.classList.remove('dragover'); }); n.classList.add('dragover'); });
    root.addEventListener('drop', function (e) {
      var n = e.target.closest && e.target.closest('.c-node'); if (!n || !dragId) return; e.preventDefault(); var tid = n.dataset.id, mid = dragId; dragId = null; if (tid === mid) return;
      var d = D.byId[mid], tg = D.byId[tid];
      if (d.parent === tg.parent) { moveTo(mid, tg.parent, tid); A.toast('Reordered “' + d.name + '”'); }
      else if (canMove(mid, tid)) { moveTo(mid, tid, null); open[tid] = 1; A.toast('Moved “' + d.name + '” under “' + tg.name + '”'); }
      else A.toast('Cannot move there (would exceed 4 levels or loop)', 'danger');
      D.recount(); if (sel === mid) startEdit(mid); else rTree();
    });
    root.addEventListener('dragend', function () { dragId = null; A.$$('.c-node').forEach(function (x) { x.classList.remove('dragging', 'dragover'); }); });
    A.$('#expAll').onclick = function () { var all = Object.keys(open).length < D.cats.filter(function (c) { return c.children.length; }).length; D.cats.forEach(function (c) { if (c.children.length) open[c.id] = all ? 1 : 0; }); rTree(); };
  }
  A.renderPage({
    active: 'categories', title: 'Categories & attributes', crumbs: [['Catalog'], ['Categories & attributes']],
    actions: '<button class="a-btn primary" id="addMain" data-perm="categories.manage">' + A.icons.plus + ' Add main category</button>',
    body: '<div class="c-cats"><div class="a-card"><div class="a-card-h"><h3>Category tree</h3><span class="c-sub" id="tcount"></span><button class="a-btn sm ghost" id="expAll">Expand / collapse all</button></div><div class="a-card-b"><div id="tree"></div>' +
      '<p class="a-hint" style="margin-top:10px">Drag <b>⋮⋮</b> onto a sibling to reorder, or onto another category to move it underneath (max 4 levels). Counts include sub-categories.</p></div></div><div id="ed"></div></div>',
    onReady: function (root) { rTree(); rEd(); wire(root); A.$('#addMain').onclick = function () { startNew(''); }; startEdit(D.byName('Smartphones').id); }
  });
})();
