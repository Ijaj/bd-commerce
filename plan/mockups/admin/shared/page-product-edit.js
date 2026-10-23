/* Product editor (agent C). ?id=101 edits, no id = new product */
(function () {
  var D = CatalogData, A = Admin, esc = A.esc;
  var qid = new URLSearchParams(location.search).get('id'), P = qid ? D.prodById[+qid] : null, isNew = !P;
  var EMO = ['📦', '🖼️', '🔍', '🧾'];
  var S, dirty = false, ready = false, vrows = {}, flags = D.flags();

  /* ---------- state ---------- */
  function initState() {
    if (P) {
      S = { title: P.title, bn: P.bn, slug: P.slug, slugEdited: true, brand: P.brand, short: P.short, shortBn: P.shortBn, desc: P.desc, yt: '', cats: P.cats.slice(), primary: P.primary, open: {},
        attr: {}, opts: P.opts.map(function (o) { return { name: o.name, values: o.values.slice() }; }), price: P.price, old: P.old || '', fulfil: P.fulfil, supplier: P.supplier || '', supSku: P.supSku, cost: P.cost, route: P.route || 'direct',
        weight: P.weight, delivery: '', advReq: P.advance > 0, advance: P.advance || '', preorder: P.preorder, preDate: P.preDate, preAdv: P.preorder ? 25 : '', retMode: 'inherit', retDays: 7, thr: 5,
        seoT: P.title + ' | ShopName', seoD: P.short, status: P.status, pubDate: P.created + 'T10:00', pin: P.pin, boost: P.boost, media: [] };
      S.media = [P.emoji, EMO[0], EMO[1]].map(function (e) { return { e: e }; });
      P.variants.forEach(function (v) { vrows[v.combo.length ? v.combo.join(' / ') : 'Default'] = { sku: v.sku, price: v.price, old: v.old || '', stock: v.stock, weight: v.weight, img: 0, active: v.active }; });
      P.cats.forEach(function (c) { D.ancestors(c).forEach(function (a) { S.open[a.id] = 1; }); });
      S.cats.forEach(function (c) { var o = D.byId[c]; if (o.attrs.length) S.open[o.id] = 1; });
      var first = D.attrsFor(S.cats); first.forEach(function (a, i) { S.attr[a.n] = a.v[i % a.v.length]; });
    } else {
      S = { title: '', bn: '', slug: '', slugEdited: false, brand: '', short: '', shortBn: '', desc: '', yt: '', cats: [], primary: '', open: { c1: 1 }, attr: {}, opts: [], price: '', old: '', fulfil: 'stock', supplier: '', supSku: '', cost: '', route: 'direct',
        weight: '', delivery: '', advReq: false, advance: '', preorder: false, preDate: '', preAdv: '', retMode: 'inherit', retDays: 7, thr: 5, seoT: '', seoD: '', status: 'draft', pubDate: '', pin: false, boost: 0, media: [] };
    }
  }
  var baseSku = function () { return P ? P.sku : 'BD-NEW-' + (S.slug ? S.slug.slice(0, 4).toUpperCase() : '001'); };

  /* ---------- sanitiser ---------- */
  var OK = { P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, UL: 1, OL: 1, LI: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, H2: 1, H3: 1, H4: 1, IMG: 1, A: 1, BLOCKQUOTE: 1, DIV: 1, SPAN: 1 };
  var ATT = { A: ['href'], IMG: ['src', 'alt'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'], DIV: ['data-yt'] };
  function sanitize(html) {
    var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html'), removed = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 8) { ch.remove(); return; }
        if (ch.nodeType !== 1) return;
        var tag = ch.tagName;
        if (/^(SCRIPT|STYLE|OBJECT|EMBED|FORM|LINK|META|NOSCRIPT|INPUT|BUTTON)$/.test(tag)) { ch.remove(); removed++; return; }
        if (tag === 'IFRAME') { var m = (ch.getAttribute('src') || '').match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/); if (m) { var d = doc.createElement('div'); d.setAttribute('data-yt', m[1]); ch.replaceWith(d); } else { ch.remove(); removed++; } return; }
        walk(ch);
        if (!OK[tag]) { while (ch.firstChild) ch.parentNode.insertBefore(ch.firstChild, ch); ch.remove(); removed++; return; }
        Array.prototype.slice.call(ch.attributes).forEach(function (a) {
          var okA = (ATT[tag] || []).indexOf(a.name) >= 0;
          if (okA && /^(href|src)$/.test(a.name) && /^\s*(javascript|vbscript|data:text)/i.test(a.value)) okA = false;
          if (!okA) { ch.removeAttribute(a.name); removed++; }
        });
        if (tag === 'DIV' && ch.hasAttribute('data-yt')) ch.textContent = '';
      });
    })(doc.body);
    return { html: doc.body.innerHTML, removed: removed };
  }
  function toView(h) { return h.replace(/<div data-yt="([\w-]{11})"><\/div>/g, '<iframe src="https://www.youtube-nocookie.com/embed/$1" width="560" height="315" allowfullscreen></iframe>'); }
  function decorate(ed) { A.$$('[data-yt]', ed).forEach(function (d) { d.className = 'yt'; d.contentEditable = 'false'; d.textContent = '▶ YouTube video · ' + d.getAttribute('data-yt'); }); }
  function ytId(u) { var m = String(u).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : ''; }

  /* ---------- html pieces ---------- */
  function tpl(o) { return '<section class="a-card" id="' + o.id + '"><div class="a-card-h"><h3>' + o.h + '</h3>' + (o.r || '') + '</div><div class="a-card-b">' + (o.note ? '<p class="c-card-note">' + o.note + '</p>' : '') + o.b + '</div></section>'; }
  function fld(label, inner, hint, extra) { return '<div class="a-field"' + (extra || '') + '><label>' + label + '</label>' + inner + (hint ? '<span class="a-hint">' + hint + '</span>' : '') + '<span class="a-err" hidden></span></div>'; }
  function inp(k, type, ph, extra) { return '<input type="' + (type || 'text') + '" data-k="' + k + '" value="' + esc(S[k] == null ? '' : S[k]) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (extra || '') + '>'; }
  function sw(k, label, on, dis) { return '<label class="a-switch"><input type="checkbox" data-k="' + k + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><span>' + label + '</span></label>'; }

  function flagNote(key, name) {
    var on = flags[key];
    return '<div class="c-warnbox" style="margin-bottom:10px">' + A.icons.warn + '<span>' + (on ? '<b>' + name + ' flag is ON</b> (demo).' : '<b>' + name + ' are OFF at launch</b> (feature flag in Settings → Payments / Store). You can prepare values now; they take effect when the flag is enabled.') +
      ' <a href="#" class="c-link" data-flag="' + key + '">' + (on ? 'Demo: turn flag off' : 'Demo: pretend flag is on') + '</a></span></div>';
  }
  function basic() {
    return tpl({ id: 's-basic', h: 'Basic information', b: '<div class="c-2col">' + fld('Title <span class="c-lang">EN</span> *', inp('title', 'text', 'e.g. Samsung Galaxy A55 5G')) + fld('Title <span class="c-lang">BN</span>', inp('bn', 'text', 'বাংলা শিরোনাম', ' lang="bn" style="font-family:\'Noto Sans Bengali\',sans-serif"')) + '</div>' +
      '<div class="c-2col">' + fld('Slug (URL)', '<div class="a-input-grp"><span>/p/</span>' + inp('slug', 'text', 'auto-from-title') + '</div>', 'Auto-generated from title; edit to override.') +
      fld('Brand', '<select data-k="brand"><option value="">— none —</option>' + D.brands.map(function (b) { return '<option' + (S.brand === b ? ' selected' : '') + '>' + b + '</option>'; }).join('') + '</select>') + '</div>' +
      '<div class="c-2col">' + fld('Short description <span class="c-lang">EN</span>', '<textarea data-k="short" rows="3" maxlength="200">' + esc(S.short) + '</textarea>') + fld('Short description <span class="c-lang">BN</span>', '<textarea data-k="shortBn" rows="3" maxlength="200" lang="bn" style="font-family:\'Noto Sans Bengali\',sans-serif">' + esc(S.shortBn) + '</textarea>') + '</div>' });
  }
  function descCard() {
    return tpl({ id: 's-desc', h: 'Description', r: '<button class="a-btn sm" id="htmlToggle">&lt;/&gt; View HTML</button>', b:
      '<div class="c-wys"><div class="c-tb" id="tb"><button data-cmd="bold" title="Bold"><b>B</b></button><button data-cmd="italic" title="Italic"><i>I</i></button><button data-cmd="insertUnorderedList" title="Bulleted list">• List</button><button data-cmd="insertOrderedList" title="Numbered list">1. List</button>' +
      '<button data-cmd="table" title="Insert table">▦ Table</button><button data-cmd="image" title="Insert image">🖼 Image</button><button data-cmd="youtube" title="Embed YouTube">▶ YouTube</button><span class="sp"></span><small class="c-sub" id="wcount"></small></div>' +
      '<div class="c-ed" id="ed" contenteditable="true" aria-label="Description editor"></div><textarea class="c-html" id="html" hidden spellcheck="false"></textarea></div>' +
      '<p class="a-hint" style="margin-top:6px" id="htmlNote">Rich-text editor (mock). Pasted content is cleaned on save.</p>' });
  }
  function mediaCard() {
    return tpl({ id: 's-media', h: 'Media', b: '<div class="a-dropzone" id="dz" tabindex="0">' + A.icons.upload + '<div><b>Drop images here</b> or click to add (mock). JPG/PNG/WebP, max 5 MB, min 800×800.</div></div><div class="c-media" id="media"></div><p class="a-hint">Drag thumbnails to reorder. The first image is the main one and the store card image.</p>' +
      '<div class="c-yt"><div class="a-field" style="flex:1;margin:0"><label>YouTube video URL</label><input type="url" data-k="yt" id="yt" placeholder="https://www.youtube.com/watch?v=…" value="' + esc(S.yt) + '"></div><div id="ytprev" class="c-sub"></div></div>' });
  }
  function catCard() {
    return tpl({ id: 's-cats', h: 'Categories', note: 'A product can sit in many categories (up to 4 levels deep). Pick one primary category for breadcrumbs.', b: '<div class="c-tree-pick" id="ctree"></div><div class="c-chips" id="cchips"></div>' + fld('Primary category *', '<select data-k="primary" id="prim"></select>') });
  }
  function attrCard() { return tpl({ id: 's-attr', h: 'Attributes', note: 'Inherited from the selected categories. These values power the storefront filters.', b: '<div id="attrs"></div>' }); }
  function varCard() {
    return tpl({ id: 's-var', h: 'Variants', r: '<span class="c-sub">up to 2 option types</span>', note: 'Each combination gets its own SKU, price, stock and image.', b: '<div id="opts"></div><div id="vtable"></div>' });
  }
  function priceCard() {
    return tpl({ id: 's-price', h: 'Pricing', b: '<div class="c-3col">' + fld('Selling price (৳) *', '<div class="a-input-grp"><span>৳</span>' + inp('price', 'number', '0', ' min="0"') + '</div>', 'Used by variants unless overridden.') + fld('Old price (৳)', '<div class="a-input-grp"><span>৳</span>' + inp('old', 'number', 'optional', ' min="0"') + '</div>', 'Shown struck-through; discount % is automatic.') +
      '<div class="a-field"><label>Discount</label><div id="disc" style="padding:8px 0;font-weight:700"></div></div></div><div class="c-infobox">' + A.icons.info + '<span>All prices are <b>VAT-inclusive</b> (single store rate). The invoice shows the VAT portion and BIN automatically.</span></div>' });
  }
  function invCard() {
    return tpl({ id: 's-inv', h: 'Inventory & fulfilment', b: '<div class="c-radio" id="ful"><label><input type="radio" name="ful" value="stock"' + (S.fulfil === 'stock' ? ' checked' : '') + '> Own stock (our warehouse)</label><label><input type="radio" name="ful" value="dropship"' + (S.fulfil === 'dropship' ? ' checked' : '') + '> Dropship (supplier ships)</label></div><div id="fulbody" style="margin-top:14px"></div>' });
  }
  function delCard() {
    return tpl({ id: 's-del', h: 'Delivery', b: '<div class="c-2col">' + fld('Weight (kg)', inp('weight', 'number', '0.5', ' min="0" step="0.05"'), 'Drives the per-kg delivery charge. Variants can override.') + fld('Delivery charge override (৳)', inp('delivery', 'number', 'Zone rate', ' min="0"'), 'Blank = zone rate. 0 = free delivery for this product.') + '</div>' });
  }
  function advCard() {
    return tpl({ id: 's-adv', h: 'Advance payment', b: '<div id="advbody"></div>' });
  }
  function preCard() {
    return tpl({ id: 's-pre', h: 'Pre-order', b: '<div id="prebody"></div>' });
  }
  function retCard() { return tpl({ id: 's-ret', h: 'Return window', b: '<div class="c-row-flex"><div class="a-field" style="margin:0"><select data-k="retMode" id="retMode"><option value="inherit">Inherit (category / store default)</option><option value="custom">Custom days</option><option value="none">Not returnable</option></select></div><div class="a-field" id="retDaysF" style="margin:0" hidden>' + '<div class="a-input-grp">' + inp('retDays', 'number', '7', ' min="1" max="60"') + '<span>days</span></div></div></div><p class="a-hint" id="retHint"></p>' }); }
  function seoCard() {
    return tpl({ id: 's-seo', h: 'SEO', b: fld('SEO title <span class="c-cnt" id="c1"></span>', inp('seoT', 'text', 'Page title', ' maxlength="70"')) + fld('Meta description <span class="c-cnt" id="c2"></span>', '<textarea data-k="seoD" rows="2" maxlength="180">' + esc(S.seoD) + '</textarea>') + '<div class="c-seo" id="snip"></div>' });
  }
  function sideCard() {
    return '<aside class="c-side" style="display:grid;gap:14px">' +
      tpl({ id: 's-status', h: 'Status & publishing', b: fld('Status', '<select data-k="status"><option value="draft"' + (S.status === 'draft' ? ' selected' : '') + '>Draft (hidden)</option><option value="active"' + (S.status === 'active' ? ' selected' : '') + '>Active (live)</option><option value="archived"' + (S.status === 'archived' ? ' selected' : '') + '>Archived</option></select>') +
        fld('Publish date', inp('pubDate', 'datetime-local'), 'Future date = scheduled.') + (isNew ? '' : '<dl class="a-kv"><dt>Sold</dt><dd>' + A.fmt.num(P.sold) + '</dd><dt>Created</dt><dd>' + A.fmt.date(P.created) + '</dd><dt>Rating</dt><dd>' + P.rating + ' (' + P.ratingN + ')</dd></dl>') }) +
      tpl({ id: 's-feed', h: 'Home feed', b: sw('pin', 'Pin to home feed', S.pin) + '<div class="a-field" style="margin-top:12px"><label>Boost weight</label><div class="a-range"><input type="range" min="0" max="100" step="5" data-k="boost" value="' + S.boost + '" data-unit="%"><output>' + S.boost + '%</output></div><span class="a-hint">Extra weight in the weighted-random feed (works with the admin sliders on Home &amp; feed).</span></div>' }) +
      tpl({ id: 's-check', h: 'Readiness', b: '<ul class="c-checklist" id="chk"></ul>' }) +
      (isNew ? '' : tpl({ id: 's-danger', h: 'Danger zone', b: '<button class="a-btn danger" id="del" data-perm="products.delete" data-perm-mode="disable">' + A.icons.trash + ' Delete product…</button><p class="a-hint" style="margin-top:6px">' + (P.orders ? 'This product has ' + P.orders + ' orders, so it will be archived, not deleted.' : 'No orders yet, so it will be removed permanently.') + '</p>' })) + '</aside>';
  }

  /* ---------- dynamic regions ---------- */
  function rMedia() {
    A.$('#media').innerHTML = S.media.map(function (m, i) { return '<div class="c-mt" draggable="true" data-i="' + i + '">' + m.e + (i === 0 ? '<span class="main">Main</span>' : '') + '<span class="ctl"><button data-mv="-1" title="Move left">‹</button><button data-mv="1" title="Move right">›</button><button data-rm title="Remove">×</button></span></div>'; }).join('') || '<span class="c-sub">No images yet.</span>';
    var id = ytId(S.yt); A.$('#ytprev').innerHTML = S.yt ? (id ? '<span class="a-badge ok">Video ' + id + '</span>' : '<span class="a-badge danger">Not a valid YouTube link</span>') : '';
  }
  function treeHtml(ids) {
    return ids.map(function (id) {
      var c = D.byId[id], has = c.children.length, op = S.open[id];
      return '<div class="c-tp" style="padding-left:' + ((c.level - 1) * 20) + 'px">' + (has ? '<button class="tg" data-tg="' + id + '" aria-label="Expand">' + (op ? '▾' : '▸') + '</button>' : '<span style="width:18px;display:inline-block"></span>') +
        '<label><input type="checkbox" data-cat="' + id + '"' + (S.cats.indexOf(id) >= 0 ? ' checked' : '') + '> ' + esc(c.name) + ' <span class="a-badge muted">L' + c.level + '</span></label></div>' + (has && op ? treeHtml(c.children) : '');
    }).join('');
  }
  function rCats() {
    A.$('#ctree').innerHTML = treeHtml(D.roots().map(function (c) { return c.id; }));
    A.$('#cchips').innerHTML = S.cats.map(function (id) { return '<span class="c-chip' + (id === S.primary ? ' prim' : '') + '">' + esc(D.path(id)) + (id === S.primary ? ' · primary' : '') + '<button data-cx="' + id + '" aria-label="Remove">×</button></span>'; }).join('') || '<span class="c-sub">No category selected.</span>';
    A.$('#prim').innerHTML = '<option value="">— choose —</option>' + S.cats.map(function (id) { return '<option value="' + id + '"' + (id === S.primary ? ' selected' : '') + '>' + esc(D.path(id)) + '</option>'; }).join('');
    rAttrs(); rRet(); rCheck();
  }
  function rAttrs() {
    var at = D.attrsFor(S.cats);
    A.$('#attrs').innerHTML = at.length ? '<div class="c-2col">' + at.map(function (a) {
      return fld(esc(a.n) + ' <span class="c-sub">· from ' + esc(a.from) + '</span>', '<select data-attr="' + esc(a.n) + '"><option value="">—</option>' + a.v.map(function (v) { return '<option' + (S.attr[a.n] === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select>');
    }).join('') + '</div>' : '<div class="a-empty" style="padding:14px">Select a category to see its attributes (e.g. Colour, Material, RAM).</div>';
  }
  function validOpts() { return S.opts.filter(function (o) { return o.values.length; }); }
  function rowsList() {
    var oo = validOpts(), cs = D.combos(oo), out = [];
    cs.forEach(function (c, i) {
      var key = c.length ? c.join(' / ') : 'Default';
      if (!vrows[key]) vrows[key] = { sku: baseSku() + (c.length ? '-' + c.map(function (x) { return x.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase(); }).join('') : ''), price: S.price, old: S.old, stock: 0, weight: S.weight, img: 0, active: true };
      out.push({ key: key, r: vrows[key] });
    });
    return out;
  }
  var OPTN = ['Colour', 'Size', 'Storage', 'RAM', 'Material', 'Length', 'Capacity'];
  function rOpts() {
    A.$('#opts').innerHTML = S.opts.map(function (o, i) {
      return '<div class="c-opt" data-o="' + i + '"><div class="c-opt-h"><div class="a-field" style="margin:0"><label>Option ' + (i + 1) + ' name</label><input list="optn" data-on="' + i + '" value="' + esc(o.name) + '" placeholder="e.g. Colour"></div>' +
        '<div class="a-field" style="margin:0"><label>Values <small class="c-sub">(Enter or comma to add)</small></label><div class="c-valin">' + o.values.map(function (v, j) { return '<span class="c-chip">' + esc(v) + '<button data-ov="' + i + ':' + j + '" aria-label="Remove">×</button></span>'; }).join('') + '<input data-ovin="' + i + '" placeholder="Add value…"></div></div></div><div style="text-align:right;margin-top:6px"><button class="a-btn ghost sm" data-orm="' + i + '">Remove option</button></div></div>';
    }).join('') + '<datalist id="optn">' + OPTN.map(function (n) { return '<option value="' + n + '">'; }).join('') + '</datalist>' +
      (S.opts.length < 2 ? '<button class="a-btn sm" id="addOpt">' + A.icons.plus + ' Add option type' + (S.opts.length ? ' (2nd)' : '') + '</button> <span class="c-sub">e.g. Colour × Size</span>' : '<span class="c-sub">Maximum of 2 option types reached.</span>');
    rVTable();
  }
  function rVTable() {
    var rows = rowsList(), n = rows.length, tot = 0; rows.forEach(function (x) { tot += +x.r.stock || 0; });
    var ds = S.fulfil === 'dropship';
    A.$('#vtable').innerHTML = '<div class="c-bulkrow"><b style="align-self:center">Bulk edit</b>' + ['price:Price ৳', 'old:Old price ৳', 'stock:Stock', 'weight:Weight kg'].map(function (s) { var p = s.split(':'); return '<div class="a-field"><label>' + p[1] + '</label><input type="number" min="0" step="any" data-bf="' + p[0] + '"></div>'; }).join('') + '<button class="a-btn sm primary" id="bapply" style="margin-bottom:12px">Apply to all ' + n + '</button></div>' +
      '<div class="a-table-wrap"><table class="a-table c-vt"><thead><tr><th>Combination</th><th>SKU</th><th>Price ৳</th><th>Old ৳</th><th>' + (ds ? 'Supplier stock' : 'Stock') + '</th><th>Weight</th><th>Image</th><th>Active</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var k = esc(x.key), r = x.r;
        return '<tr><td><b>' + k + '</b></td><td><input type="text" data-vr="' + k + '|sku" value="' + esc(r.sku) + '" style="width:150px"></td>' + ['price', 'old', 'stock', 'weight'].map(function (f) { return '<td><input type="number" min="0" step="any" data-vr="' + k + '|' + f + '" value="' + esc(r[f]) + '"></td>'; }).join('') +
          '<td><select data-vr="' + k + '|img">' + S.media.map(function (m, i) { return '<option value="' + i + '"' + (+r.img === i ? ' selected' : '') + '>' + m.e + ' #' + (i + 1) + '</option>'; }).join('') + '</select></td><td><label class="a-switch"><input type="checkbox" data-vr="' + k + '|active"' + (r.active ? ' checked' : '') + '></label></td></tr>';
      }).join('') + '</tbody></table></div><p class="a-hint" style="margin-top:6px">' + (n === 1 && !validOpts().length ? 'No options: the product has a single SKU.' : n + ' combinations') + ' · total stock <b>' + tot + '</b>' + (ds ? ' (confirmed by the supplier)' : '') + '</p>';
    rCheck();
  }
  function rFul() {
    var sup = D.suppliers.filter(function (s) { return s.id === S.supplier; })[0];
    if (S.fulfil === 'stock') {
      A.$('#fulbody').innerHTML = '<div class="c-2col">' + fld('Low-stock threshold', inp('thr', 'number', '5', ' min="0"'), 'Flags the variant on Inventory when stock falls to this level.') + '<div class="a-field"><label>Location</label><input value="Main warehouse (Dhaka)" disabled></div></div><p class="a-hint">Per-variant stock is entered in the Variants table above and adjusted from Inventory.</p>';
    } else {
      var margin = (+S.price && +S.cost) ? Math.round((S.price - S.cost) / S.price * 100) : null;
      A.$('#fulbody').innerHTML = '<div class="c-2col">' + fld('Supplier *', '<select data-k="supplier" id="supSel"><option value="">— choose supplier —</option>' + D.suppliers.map(function (s) { return '<option value="' + s.id + '"' + (S.supplier === s.id ? ' selected' : '') + '>' + s.name + '</option>'; }).join('') + '</select>', sup ? '<a class="c-link" href="suppliers.html">Open supplier</a> · default route: ' + (sup.route === 'direct' ? 'ship direct to customer' : 'via our warehouse') : 'Links this product to the supplier.') +
        fld('Supplier SKU', inp('supSku', 'text', 'Supplier\'s code')) + '</div><div class="c-2col">' + fld('Cost price (৳)', '<div class="a-input-grp"><span>৳</span>' + inp('cost', 'number', '0', ' min="0"') + '</div>', margin !== null ? 'Margin: <b>' + margin + '%</b> (VAT-inclusive prices)' : 'Used for margin reports.') + '</div>' +
        '<div class="a-field"><label>Dropship route</label><div class="c-radio" id="route"><label><input type="radio" name="route" value="direct"' + (S.route === 'direct' ? ' checked' : '') + '> Ship direct to customer</label><label><input type="radio" name="route" value="warehouse"' + (S.route === 'warehouse' ? ' checked' : '') + '> Via our warehouse first</label></div><span class="a-hint">Direct parcels are booked on OUR courier account with pickup at the supplier. Splits into a separate shipment from in-stock items.</span></div>';
    }
  }
  function rAdv() {
    var dis = !flags.advance;
    A.$('#advbody').innerHTML = flagNote('advance', 'Advance payments') + '<div class="' + (dis ? 'c-disabled' : '') + '">' + sw('advReq', 'Requires advance payment for this product', S.advReq, dis) + '<div class="a-field" style="margin-top:12px;max-width:260px"><label>Advance %</label><div class="a-input-grp">' + inp('advance', 'number', '20', ' min="1" max="100"' + (dis ? ' disabled' : '')) + '<span>%</span></div></div></div>' +
      '<p class="a-hint">Also use this for dropship items. When several triggers apply (product %, risky customer, high-value item), their %s are added together (capped at 100%). COD orders with a delivery fee also pay that fee in advance.</p>';
  }
  function rPre() {
    var dis = !flags.preorder;
    A.$('#prebody').innerHTML = flagNote('preorder', 'Pre-orders') + '<div class="' + (dis ? 'c-disabled' : '') + '">' + sw('preorder', 'Sell as pre-order', S.preorder, dis) + '<div class="c-2col" style="margin-top:12px">' + fld('Expected availability date', inp('preDate', 'date', '', dis ? ' disabled' : '')) + fld('Advance % to reserve', '<div class="a-input-grp">' + inp('preAdv', 'number', '25', ' min="1" max="100"' + (dis ? ' disabled' : '')) + '<span>%</span></div>') + '</div></div>' +
      '<p class="a-hint" style="opacity:.8">Hidden at launch: the storefront shows no pre-order badge until <code>preorders_enabled</code> is switched on.</p>';
  }
  function retEffective() {
    var days = 7, src = 'store default';
    var pc = S.primary ? D.ancestors(S.primary).concat(D.byId[S.primary]).reverse() : [];
    for (var i = 0; i < pc.length; i++) if (pc[i].ret) { days = pc[i].ret; src = 'category “' + pc[i].name + '”'; break; }
    return { days: days, src: src };
  }
  function rRet() {
    var e = retEffective(), m = S.retMode;
    A.$('#retDaysF').hidden = m !== 'custom';
    A.$('#retHint').innerHTML = m === 'inherit' ? 'Effective window: <b>' + e.days + ' days</b> (from ' + e.src + ').' : m === 'custom' ? 'This product overrides the category / store default (' + e.days + ' days).' : 'Customers will see “Non-returnable” on the product page and at checkout.';
  }
  function rSeo() {
    var t = S.seoT || S.title, d = S.seoD || S.short;
    A.$('#c1').textContent = (S.seoT || '').length + '/70'; A.$('#c2').textContent = (S.seoD || '').length + '/180';
    A.$('#snip').innerHTML = '<div class="u">shopname.com.bd › p › ' + esc(S.slug || 'product-slug') + '</div><div class="t">' + esc(t || 'Product title') + '</div><div class="d">' + esc(d || 'Meta description appears here.') + '</div>';
  }
  function rCheck() {
    var items = [['Title (EN + BN)', S.title && S.bn], ['At least one image', S.media.length > 0], ['Category selected', S.cats.length > 0 && S.primary], ['Price set', +S.price > 0], ['Stock entered', rowsList().some(function (x) { return +x.r.stock > 0; }) || S.fulfil === 'dropship'], ['SEO description', (S.seoD || '').length > 20]];
    A.$('#chk').innerHTML = items.map(function (i) { return '<li class="' + (i[1] ? 'ok' : 'no') + '">' + (i[1] ? '✔' : '○') + ' ' + i[0] + '</li>'; }).join('');
  }
  function rDisc() { var d = (+S.old > +S.price && +S.price) ? Math.round((S.old - S.price) / S.old * 100) : 0; A.$('#disc').innerHTML = d ? '<span class="a-badge ok">-' + d + '%</span>' : '<span class="c-sub">—</span>'; }

  function markDirty() { if (!ready) return; dirty = true; var m = A.$('#sbmsg'); m.textContent = 'Unsaved changes'; m.className = 'msg dirty'; }

  /* ---------- editor ---------- */
  function setupEditor(root) {
    var ed = A.$('#ed'), ta = A.$('#html'), tgl = A.$('#htmlToggle'), mode = 'rich';
    ed.innerHTML = S.desc || '<p></p>'; decorate(ed);
    function count() { A.$('#wcount').textContent = (ed.textContent || '').trim().split(/\s+/).filter(Boolean).length + ' words'; }
    count(); ed.addEventListener('input', function () { count(); S.desc = ed.innerHTML; markDirty(); });
    ed.addEventListener('paste', function (e) { var cd = e.clipboardData; if (!cd) return; e.preventDefault(); var h = cd.getData('text/html'), r = h ? sanitize(h) : { html: esc(cd.getData('text/plain')).replace(/\n/g, '<br>'), removed: 0 }; document.execCommand('insertHTML', false, r.html); if (r.removed) A.toast('Pasted content cleaned (' + r.removed + ' unsafe item(s) stripped)', 'warn'); });
    A.$('#tb').addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    A.$('#tb').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmd]'); if (!b || mode !== 'rich') return; var c = b.dataset.cmd; ed.focus();
      if (c === 'table') document.execCommand('insertHTML', false, '<table><tbody><tr><th>Spec</th><th>Value</th></tr><tr><td>Model</td><td>—</td></tr><tr><td>Warranty</td><td>1 year</td></tr></tbody></table><p></p>');
      else if (c === 'image') document.execCommand('insertHTML', false, '<img alt="Product photo" src="data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="140"><rect width="320" height="140" fill="#ecebf8"/><text x="160" y="78" font-size="38" text-anchor="middle">🖼️</text></svg>') + '"><p></p>');
      else if (c === 'youtube') {
        var m = A.modal.open('<div class="a-field"><label>YouTube URL</label><input id="yu" placeholder="https://youtu.be/…" value="https://www.youtube.com/watch?v=dQw4w9WgXcQ"><span class="a-err" hidden>Not a valid YouTube link</span></div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="yok">Embed</button></div>', { title: 'Embed YouTube video', size: 'sm' });
        A.$('#yok', m).onclick = function () { var id = ytId(A.$('#yu', m).value); if (!id) { A.$('.a-err', m).hidden = false; return; } A.modal.close(); ed.focus(); document.execCommand('insertHTML', false, '<div data-yt="' + id + '"></div><p></p>'); decorate(ed); S.desc = ed.innerHTML; markDirty(); };
      } else document.execCommand(c);
      S.desc = ed.innerHTML; count(); markDirty();
    });
    tgl.onclick = function () {
      if (mode === 'rich') {
        var r = sanitize(ed.innerHTML); ta.value = toView(r.html).replace(/></g, '>\n<'); mode = 'html'; ed.hidden = true; ta.hidden = false; A.$$('#tb [data-cmd]').forEach(function (b) { b.disabled = true; });
        tgl.classList.add('primary'); tgl.textContent = '✎ Visual editor';
        A.$('#htmlNote').innerHTML = '<b>Sanitized HTML.</b> <code>&lt;script&gt;</code>, inline <code>on…=</code> handlers, <code>javascript:</code> links, styles and non-YouTube iframes are stripped on save. <span id="strip">' + (r.removed ? r.removed + ' unsafe item(s) already removed.' : 'Nothing to strip.') + '</span>';
      } else {
        var r2 = sanitize(ta.value); ed.innerHTML = r2.html || '<p></p>'; decorate(ed); S.desc = r2.html; mode = 'rich'; ed.hidden = false; ta.hidden = true; A.$$('#tb [data-cmd]').forEach(function (b) { b.disabled = false; });
        tgl.classList.remove('primary'); tgl.innerHTML = '&lt;/&gt; View HTML'; A.$('#htmlNote').textContent = r2.removed ? 'Applied. ' + r2.removed + ' unsafe item(s) were stripped.' : 'Rich-text editor (mock). Pasted content is cleaned on save.'; count();
        if (r2.removed) A.toast(r2.removed + ' unsafe item(s) stripped from HTML', 'warn');
      }
    };
    ta.addEventListener('input', function () { var r = sanitize(ta.value); A.$('#strip').textContent = r.removed ? '⚠ ' + r.removed + ' unsafe item(s) will be stripped.' : 'Nothing to strip.'; markDirty(); });
  }

  /* ---------- wiring ---------- */
  function setK(el) {
    var k = el.dataset.k, v = el.type === 'checkbox' ? el.checked : el.value;
    S[k] = v;
    if (k === 'title') { if (!S.slugEdited) { S.slug = D.slug(S.title); A.$('[data-k=slug]').value = S.slug; } if (!P && !S.seoTEdited) { S.seoT = S.title ? S.title + ' | ShopName' : ''; A.$('[data-k=seoT]').value = S.seoT; } rSeo(); rCheck(); }
    else if (k === 'slug') { S.slugEdited = true; rSeo(); }
    else if (k === 'seoT') { S.seoTEdited = true; rSeo(); } else if (k === 'seoD' || k === 'short') { rSeo(); rCheck(); }
    else if (k === 'price' || k === 'old') { rDisc(); rCheck(); } else if (k === 'bn') rCheck();
    else if (k === 'yt') rMedia();
    else if (k === 'primary') { rCats(); } else if (k === 'retMode' || k === 'retDays') rRet();
    else if (k === 'supplier') { var s = D.suppliers.filter(function (x) { return x.id === v; })[0]; if (s) S.route = s.route; rFul(); }
    else if (k === 'cost') rFul();
    else if (k === 'boost') { /* output handled by core */ }
    else if (k === 'pin') A.$('[data-k=boost]').disabled = !S.pin;
  }
  function wire(root) {
    root.addEventListener('input', function (e) {
      var t = e.target; markDirty();
      if (t.dataset.k && t.type !== 'checkbox' && t.tagName !== 'SELECT') { if (t.dataset.k === 'cost') return; setK(t); }
      else if (t.dataset.vr) { var p = t.dataset.vr.split('|'); vrows[p[0]][p[1]] = t.type === 'checkbox' ? t.checked : t.value; }
    });
    root.addEventListener('change', function (e) {
      var t = e.target; markDirty();
      if (t.dataset.k) { setK(t); }
      else if (t.dataset.attr) S.attr[t.dataset.attr] = t.value;
      else if (t.dataset.cat) { var id = t.dataset.cat, i = S.cats.indexOf(id); if (t.checked && i < 0) S.cats.push(id); else if (!t.checked && i >= 0) S.cats.splice(i, 1); if (S.cats.indexOf(S.primary) < 0) S.primary = S.cats[0] || ''; rCats(); }
      else if (t.dataset.vr) { var p = t.dataset.vr.split('|'); vrows[p[0]][p[1]] = t.type === 'checkbox' ? t.checked : t.value; if (p[1] === 'stock') rVTable(); }
      else if (t.name === 'ful') { S.fulfil = t.value; rFul(); rVTable(); }
      else if (t.name === 'route') S.route = t.value;
      else if (t.dataset.on != null) { S.opts[+t.dataset.on].name = t.value; rVTable(); }
      if (t.dataset.k === 'advReq' || t.dataset.k === 'preorder') { /* state only */ }
    });
    root.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t.dataset.ovin != null && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addVal(+t.dataset.ovin, t); }
    });
    root.addEventListener('focusout', function (e) { var t = e.target; if (t.dataset.ovin != null && t.value.trim()) addVal(+t.dataset.ovin, t); });
    function addVal(i, inpEl) { var v = inpEl.value.replace(/,/g, '').trim(); if (!v) return; var o = S.opts[i]; if (o.values.indexOf(v) < 0) o.values.push(v); inpEl.value = ''; markDirty(); rOpts(); var n = A.$('[data-ovin="' + i + '"]'); if (n) n.focus(); }
    root.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-tg]'))) { S.open[b.dataset.tg] = !S.open[b.dataset.tg]; rCats(); return; }
      if ((b = t.closest('[data-cx]'))) { var i = S.cats.indexOf(b.dataset.cx); S.cats.splice(i, 1); if (S.cats.indexOf(S.primary) < 0) S.primary = S.cats[0] || ''; markDirty(); rCats(); return; }
      if (t.closest('#dz')) { S.media.push({ e: EMO[S.media.length % EMO.length] }); markDirty(); rMedia(); A.toast('Image added (mock upload)', 'info'); rVTable(); return; }
      if ((b = t.closest('.c-mt'))) {
        var idx = +b.dataset.i;
        if (t.closest('[data-rm]')) { S.media.splice(idx, 1); } else if ((t.closest('[data-mv]'))) { var d = +t.closest('[data-mv]').dataset.mv, j = idx + d; if (j < 0 || j >= S.media.length) return; var m = S.media.splice(idx, 1)[0]; S.media.splice(j, 0, m); } else return;
        markDirty(); rMedia(); rVTable(); return;
      }
      if (t.closest('#addOpt')) { S.opts.push({ name: S.opts.length ? 'Size' : 'Colour', values: [] }); markDirty(); rOpts(); return; }
      if ((b = t.closest('[data-orm]'))) { S.opts.splice(+b.dataset.orm, 1); markDirty(); rOpts(); return; }
      if ((b = t.closest('[data-ov]'))) { var q = b.dataset.ov.split(':'); S.opts[+q[0]].values.splice(+q[1], 1); markDirty(); rOpts(); return; }
      if (t.closest('#bapply')) {
        var any = false; A.$$('[data-bf]').forEach(function (f) { if (f.value === '') return; any = true; rowsList().forEach(function (x) { x.r[f.dataset.bf] = f.value; }); });
        if (any) { markDirty(); rVTable(); A.toast('Applied to all combinations'); } else A.toast('Enter at least one value to apply', 'warn'); return;
      }
      if ((b = t.closest('[data-flag]'))) { e.preventDefault(); var k = b.dataset.flag; A.store.set('catalog.flag.' + k, !flags[k]); flags = D.flags(); rAdv(); rPre(); return; }
      if (t.closest('#del')) del();
    });
    /* drag-reorder thumbnails */
    var dragI = null;
    root.addEventListener('dragstart', function (e) { var m = e.target.closest && e.target.closest('.c-mt'); if (!m) return; dragI = +m.dataset.i; m.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragI); } catch (x) { /* */ } });
    root.addEventListener('dragover', function (e) { var m = e.target.closest && e.target.closest('.c-mt'); if (m && dragI != null) { e.preventDefault(); A.$$('.c-mt.over').forEach(function (x) { x.classList.remove('over'); }); m.classList.add('over'); } });
    root.addEventListener('drop', function (e) { var m = e.target.closest && e.target.closest('.c-mt'); if (!m || dragI == null) return; e.preventDefault(); var to = +m.dataset.i, it = S.media.splice(dragI, 1)[0]; S.media.splice(to, 0, it); dragI = null; markDirty(); rMedia(); rVTable(); });
    root.addEventListener('dragend', function () { dragI = null; A.$$('.c-mt').forEach(function (x) { x.classList.remove('drag', 'over'); }); });
  }
  function del() {
    var n = P.orders, b = A.modal.open('<p>' + (n ? 'This product has <b>' + n + ' orders</b>, so it will be <b>archived</b> (hidden from the store, kept in order history).' : 'This product has no orders and will be <b>deleted permanently</b>.') + '</p><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn danger" id="dok">' + (n ? 'Archive product' : 'Delete product') + '</button></div>', { title: 'Delete “' + P.title + '”?', size: 'sm' });
    A.$('#dok', b).onclick = function () { if (n) P.status = 'archived'; else { D.products.splice(D.products.indexOf(P), 1); delete D.prodById[P.id]; } A.modal.close(); A.toast(n ? 'Product archived' : 'Product deleted', 'warn'); setTimeout(function () { location.href = 'products.html'; }, 700); };
  }
  function save(publish) {
    var bad = [], f = function (sel, msg) { var el = A.$(sel); var w = el && el.closest('.a-field'); if (w) { w.classList.add('err'); var er = A.$('.a-err', w); if (er) { er.textContent = msg; er.hidden = false; } } bad.push(sel); };
    A.$$('.a-field.err').forEach(function (w) { w.classList.remove('err'); var er = A.$('.a-err', w); if (er) er.hidden = true; });
    if (!S.title.trim()) f('[data-k=title]', 'Title is required');
    if (!S.primary) f('#prim', 'Choose at least one category and a primary one');
    var hasV = validOpts().length > 0;
    if (!hasV && !(+S.price > 0)) f('[data-k=price]', 'Price is required');
    if (S.fulfil === 'dropship' && !S.supplier) f('#supSel', 'Choose a supplier for dropship items');
    if (bad.length) { A.toast('Fix ' + bad.length + ' field(s) before saving', 'danger'); var el = A.$(bad[0]); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus(); } return; }
    var r = sanitize(A.$('#ed').hidden ? A.$('#html').value : A.$('#ed').innerHTML); S.desc = r.html;
    if (publish) { S.status = 'active'; A.$('[data-k=status]').value = 'active'; }
    dirty = false; var m = A.$('#sbmsg'); m.textContent = 'All changes saved · just now'; m.className = 'msg';
    A.toast(r.removed ? 'Saved. ' + r.removed + ' unsafe HTML item(s) stripped.' : (publish ? 'Product saved and published' : 'Product saved as ' + S.status), r.removed ? 'warn' : 'ok');
  }

  /* ---------- page ---------- */
  initState();
  A.renderPage({
    active: 'products', title: isNew ? 'Add product' : 'Edit product', crumbs: [['Catalog'], ['Products', 'products.html'], [isNew ? 'New product' : P.sku]],
    actions: (isNew ? '' : '<a class="a-btn" href="../product.html" target="_blank" rel="noopener">' + A.icons.eye + ' View on store</a>') + '<a class="a-btn ghost" href="products.html">Back to list</a>',
    body: '<div class="c-edit"><div>' + basic() + descCard() + mediaCard() + catCard() + attrCard() + varCard() + priceCard() + invCard() + delCard() + advCard() + preCard() + retCard() + seoCard() + '</div>' + sideCard() + '</div>' +
      '<div class="c-savebar"><span class="msg" id="sbmsg">' + (isNew ? 'New product · not saved yet' : 'No changes') + '</span><button class="a-btn ghost" id="discard">Discard</button><button class="a-btn" id="sdraft">Save</button><button class="a-btn primary" id="spub">Save &amp; publish</button></div>',
    onReady: function (root) {
      setupEditor(root); wire(root); rMedia(); rCats(); rOpts(); rFul(); rAdv(); rPre(); rRet(); rSeo(); rDisc(); rCheck();
      A.$('[data-k=boost]').disabled = !S.pin; A.$('#retMode').value = S.retMode;
      A.$('#discard').onclick = function () { if (dirty) A.confirm('Discard all unsaved changes?', 'Discard', function () { location.reload(); }, true); else A.toast('Nothing to discard', 'info'); };
      A.$('#sdraft').onclick = function () { save(false); }; A.$('#spub').onclick = function () { save(true); };
      window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
      setTimeout(function () { ready = true; }, 50);
    }
  });
})();
