(function () {
  'use strict';
  var A = Admin, F = A.fmt, M = 60000, H = 60 * M, PS = 12;
  var actors = ['Sadia Akter (Owner)', 'Kamrul Hasan (Manager)', 'Rubel Mia (Order staff)', 'Tania Sultana (Catalog editor)', 'Imtiaz Ahmed (Marketing)', 'System'];
  var seed = [
    ['orders.edit', 'order:BD-10477', 2, { items: [{ sku: 'EB-X2-BLK', qty: 1 }], address: 'Mirpur 10, Dhaka' }, { items: [{ sku: 'EB-X2-BLK', qty: 2 }], address: 'Mirpur 12, Dhaka' }, 'Customer notified by SMS'],
    ['refund.approve', 'refund:RF-2208', 0, { status: 'pending_approval', amount: 18500 }, { status: 'approved', amount: 18500, method: 'bKash' }, ''],
    ['customers.flag', 'customer:Tanvir Hasan', 1, { risky: false }, { risky: true, reason: 'Refused 2 COD parcels' }, ''],
    ['products.price_update', 'product:Smart Watch Fit S3', 3, { price: 3400, sale_price: null }, { price: 3400, sale_price: 2999 }, ''],
    ['settings.update', 'settings:Orders', 0, { refund_threshold: '10000' }, { refund_threshold: '15000' }, ''],
    ['staff.2fa_reset', 'staff:Nasrin Parvin', 0, { tfa: true }, { tfa: false }, ''],
    ['auth.login', 'staff:Kamrul Hasan', 1, null, { device: 'Safari / iPhone', new_device: true }, ''],
    ['coupons.create', 'coupon:EID25', 4, null, { type: 'percent', value: 25, min_order: 2000, stacking: false }, ''],
    ['orders.cancel', 'order:BD-10431', 2, { status: 'Processing' }, { status: 'Cancelled', reason: 'Customer request' }, ''],
    ['customers.wallet_adjust', 'customer:Nusrat Jahan', 1, { wallet: 0 }, { wallet: 500, note: 'Goodwill for late delivery' }, ''],
    ['roles.update', 'role:Catalog editor', 0, { removed: ['products.delete'] }, { added: ['inventory.view'] }, ''],
    ['orders.hold', 'order:BD-10470', 5, { status: 'Processing' }, { status: 'On hold', rule: 'velocity: same phone x3 / 1h' }, 'Automatic'],
    ['products.delete', 'product:Old Phone Case', 3, { status: 'active' }, { status: 'archived', note: 'Has orders — archived, not deleted' }, ''],
    ['settings.update', 'settings:Security', 0, { session_timeout: '60' }, { session_timeout: '30' }, ''],
    ['delivery.zone_update', 'zone:Dhaka City', 1, { base: 60, per_kg: 15 }, { base: 70, per_kg: 15 }, ''],
    ['staff.disable', 'staff:Nasrin Parvin', 0, { status: 'active' }, { status: 'disabled' }, ''],
    ['returns.approve', 'return:RT-0412', 2, { status: 'requested' }, { status: 'approved', shipping: 'we pay' }, ''],
    ['campaigns.send', 'campaign:Eid teaser', 4, null, { channel: 'sms', recipients: 8420 }, ''],
    ['orders.edit', 'order:BD-10402', 2, { qty: 1 }, { qty: 3 }, ''],
    ['auth.login_failed', 'staff:unknown', 5, null, { identifier: 'admin@shopname.com', attempts: 5 }, 'Locked for 15 min']
  ];
  var ips = ['103.145.22.18', '119.30.44.201', '103.145.22.77', '139.99.12.5', '27.147.200.34'];
  var rows = [], n = 0;
  for (var i = 0; i < 56; i++) { var s = seed[i % seed.length]; rows.push({ id: 's' + i, ts: Date.now() - (14 + i * 47 + (i % 5) * 13) * M, actor: actors[s[2]], action: s[0], entity: s[1], before: s[3], after: s[4], ip: s[2] === 5 ? '—' : ips[(i + s[2]) % ips.length], extra: s[5] }); }
  A.store.get('admin.audit', []).forEach(function (r) { rows.push(r); });
  rows.sort(function (a, b) { return b.ts - a.ts; });
  var fl = { q: '', actor: '', area: '', range: 'all', page: 1 };
  function area(a) { return a.split('.')[0]; }
  function filtered() {
    var cut = fl.range === 'all' ? 0 : Date.now() - { '24h': 24 * H, '7d': 7 * 24 * H, '30d': 30 * 24 * H }[fl.range];
    return rows.filter(function (r) { return r.ts >= cut && (!fl.actor || r.actor === fl.actor) && (!fl.area || area(r.action) === fl.area) && (!fl.q || (r.action + ' ' + r.entity + ' ' + r.actor + ' ' + r.ip).toLowerCase().indexOf(fl.q.toLowerCase()) >= 0); });
  }
  function tone(a) { return /delete|disable|cancel|failed|revoked/.test(a) ? 'danger' : /flag|hold|reset|wallet|refund|roles|settings/.test(a) ? 'warn' : 'info'; }
  function pretty(o, other, side) {
    if (o == null) return '<span class="a-muted">— none —</span>';
    var lines = JSON.stringify(o, null, 2).split('\n');
    var ol = other == null ? [] : JSON.stringify(other, null, 2).split('\n');
    return lines.map(function (l) { var diff = ol.indexOf(l) < 0 && other != null; return '<span class="' + (diff ? (side === 'b' ? 'rm' : 'ad') : '') + '">' + A.esc(l) + '</span>'; }).join('');
  }
  function drawer(r) {
    A.drawer.open('<dl class="a-kv" style="margin-bottom:14px"><dt>Action</dt><dd><code>' + A.esc(r.action) + '</code></dd><dt>Entity</dt><dd>' + A.esc(r.entity) + '</dd><dt>Actor</dt><dd>' + A.esc(r.actor) + '</dd><dt>When</dt><dd>' + F.dt(r.ts) + ' (' + F.ago(r.ts) + ')</dd><dt>IP address</dt><dd>' + A.esc(r.ip) + '</dd>' + (r.extra ? '<dt>Note</dt><dd>' + A.esc(r.extra) + '</dd>' : '') + '</dl>' +
      '<div class="diff"><div><h4>Before</h4><pre>' + pretty(r.before, r.after, 'b') + '</pre></div><div><h4>After</h4><pre>' + pretty(r.after, r.before, 'a') + '</pre></div></div><p class="a-hint" style="margin-top:10px">Audit entries are append-only and cannot be edited or deleted.</p>', { title: 'Audit entry', width: 560 });
  }
  function draw() {
    var all = filtered(), pages = Math.max(1, Math.ceil(all.length / PS)); if (fl.page > pages) fl.page = pages;
    var pg = all.slice((fl.page - 1) * PS, fl.page * PS);
    A.$('#au-body').innerHTML = pg.length ? pg.map(function (r) {
      return '<tr class="click" data-id="' + r.id + '"><td class="a-nowrap">' + F.dt(r.ts) + '<span class="sub">' + F.ago(r.ts) + '</span></td><td>' + A.esc(r.actor) + '</td><td><span class="a-badge ' + tone(r.action) + ' act-tag">' + A.esc(r.action) + '</span></td><td>' + A.esc(r.entity) + '</td><td class="a-nowrap">' + r.ip + '</td><td class="act"><button class="a-btn sm" data-id="' + r.id + '">' + A.icons.eye + 'Diff</button></td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="a-empty">' + A.icons.search + '<h3>No matching entries</h3><p>Try clearing a filter.</p></div></td></tr>';
    var btns = ''; for (var p = 1; p <= pages; p++) btns += '<button' + (p === fl.page ? ' aria-current="page"' : '') + ' data-pg="' + p + '">' + p + '</button>';
    A.$('#au-pager').innerHTML = '<span>' + all.length + ' entries</span><div class="pg">' + btns + '</div>';
    var pills = []; if (fl.actor) pills.push(['actor', fl.actor]); if (fl.area) pills.push(['area', fl.area]); if (fl.range !== 'all') pills.push(['range', fl.range]);
    A.$('#au-pills').innerHTML = pills.map(function (x) { return '<span class="a-pill">' + A.esc(x[1]) + '<button data-clr="' + x[0] + '" aria-label="Remove filter">' + A.icons.x + '</button></span>'; }).join('');
  }
  var areas = []; rows.forEach(function (r) { if (areas.indexOf(area(r.action)) < 0) areas.push(area(r.action)); }); areas.sort();
  A.renderPage({ active: 'audit', title: 'Audit log', crumbs: [['Admin', 'index.html'], ['System'], ['Audit log']],
    actions: '<button class="a-btn" id="au-exp">' + A.icons.download + 'Export CSV</button>',
    body: '<div class="a-toolbar"><input type="search" id="au-q" class="grow" placeholder="Search action, entity, actor, IP…" aria-label="Search audit log"><select id="au-actor" aria-label="Actor"><option value="">All actors</option>' + actors.map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select><select id="au-area" aria-label="Area"><option value="">All areas</option>' + areas.map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select><select id="au-range" aria-label="Date range"><option value="all">All time</option><option value="24h">Last 24 h</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><span id="au-pills" class="a-row"></span></div>' +
      '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>IP</th><th class="act"></th></tr></thead><tbody id="au-body"></tbody></table></div><div class="a-pager" id="au-pager"></div></div>',
    onReady: function (root) {
      draw();
      function bind(id, key) { A.$(id).addEventListener(id === '#au-q' ? 'input' : 'change', function () { fl[key] = this.value; fl.page = 1; draw(); }); }
      bind('#au-q', 'q'); bind('#au-actor', 'actor'); bind('#au-area', 'area'); bind('#au-range', 'range');
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-id],[data-pg],[data-clr]'); if (!b) return;
        if (b.dataset.pg) { fl.page = +b.dataset.pg; draw(); }
        else if (b.dataset.clr) { var k = b.dataset.clr === 'area' ? 'area' : b.dataset.clr; fl[k] = k === 'range' ? 'all' : ''; A.$('#au-' + k).value = fl[k]; draw(); }
        else drawer(rows.filter(function (r) { return r.id === b.dataset.id; })[0]);
      });
      A.$('#au-exp').onclick = function () { A.toast('Exported ' + filtered().length + ' entries to CSV (demo)', 'info'); };
    } });
})();
