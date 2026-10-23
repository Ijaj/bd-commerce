/* Delivery zones, calculator, couriers (agent E) */
(function () {
  'use strict';
  var A = window.Admin, PD = window.PD, $ = A.$, esc = A.esc, bdt = A.fmt.bdt;
  function audit(a, e, b, af, x) { try { A.audit.log(a, e, b, af, x); } catch (er) { /* ignore */ } }
  var DISTRICTS = ['Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur', 'Chapainawabganj', 'Chattogram', 'Chuadanga', 'Cox\'s Bazar', 'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur', 'Feni', 'Gaibandha', 'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokati', 'Jhenaidah', 'Joypurhat', 'Khagrachhari', 'Khulna', 'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona', 'Nilphamari', 'Noakhali', 'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur', 'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon'];
  var UP = {
    'Dhaka': ['Dhaka Metro (all thanas)', 'Savar', 'Keraniganj', 'Dhamrai', 'Dohar', 'Nawabganj'],
    'Gazipur': ['Gazipur Sadar', 'Tongi', 'Kaliakair', 'Kapasia', 'Sreepur', 'Kaliganj'],
    'Narayanganj': ['Narayanganj Sadar', 'Rupganj', 'Sonargaon', 'Bandar', 'Araihazar'],
    'Chattogram': ['Chattogram City', 'Sitakunda', 'Hathazari', 'Patiya', 'Raozan', 'Mirsharai', 'Sandwip'],
    'Sylhet': ['Sylhet Sadar', 'Beanibazar', 'Companiganj', 'Jaintapur', 'Zakiganj'],
    'Cumilla': ['Cumilla Sadar', 'Chandina', 'Daudkandi', 'Laksam', 'Muradnagar']
  };
  var z = function (id, en, bn, base, bw, extra, a, b, free, loc, cour) { return { id: id, en: en, bn: bn, base: base, bw: bw, extra: extra, eta: [a, b], free: free, loc: loc, courier: cour }; };
  var zones = [
    z('Z1', 'Inside Dhaka City', 'ঢাকা শহরের ভেতরে', 60, 1, 15, 1, 2, 3000, { 'Dhaka': ['Dhaka Metro (all thanas)'] }, 'pathao'),
    z('Z2', 'Dhaka Suburbs', 'ঢাকার আশেপাশে', 90, 1, 20, 2, 3, 5000, { 'Dhaka': ['Savar', 'Keraniganj', 'Dhamrai', 'Dohar', 'Nawabganj'], 'Manikganj': null, 'Munshiganj': null }, 'pathao'),
    z('Z3', 'Gazipur & Narayanganj (launch offer)', 'গাজীপুর ও নারায়ণগঞ্জ (লঞ্চ অফার)', 100, 1, 20, 2, 3, 0, { 'Gazipur': null, 'Narayanganj': null }, 'pathao'),
    z('Z4', 'Major Cities', 'বড় শহর', 120, 1, 25, 2, 4, null, { 'Chattogram': null, 'Sylhet': null, 'Rajshahi': null, 'Khulna': null, 'Barishal': null, 'Rangpur': null, 'Mymensingh': null, 'Cumilla': null }, 'pathao'),
    z('Z5', 'Rest of Bangladesh', 'বাংলাদেশের অন্যান্য স্থান', 140, 1, 30, 3, 5, null, {}, 'steadfast'),
    z('Z6', 'Hill & Remote Areas', 'পাহাড়ি ও দুর্গম এলাকা', 180, 1, 40, 4, 7, null, { 'Bandarban': null, 'Rangamati': null, 'Khagrachhari': null, 'Bhola': null }, 'steadfast')
  ];
  (function () { var used = {}; zones.forEach(function (x) { Object.keys(x.loc).forEach(function (d) { used[d] = 1; }); }); DISTRICTS.forEach(function (d) { if (!used[d]) zones[4].loc[d] = null; }); })();
  var couriers = {
    pathao: { name: 'Pathao Courier', color: '#e11d48', enabled: true, env: 'Production', keys: [['Client ID', '7Hx2••••••••Qm9Z'], ['Client secret', '••••••••••••••••••••••••'], ['Username', 'ops@shopname.example'], ['Password', '••••••••••••']], store: 'Store #214880' },
    steadfast: { name: 'Steadfast Courier', color: '#0369a1', enabled: true, env: 'Production', keys: [['API key', 'sf_live_••••••••••••a91c'], ['Secret key', '••••••••••••••••••••']], store: 'Merchant #SF-77231' }
  };
  var pickups = [{ name: 'Main warehouse', addr: 'Plot 18, Road 3, Tejgaon I/A, Dhaka-1208', type: 'Own', pathao: 'Store #214880', sf: 'Default' }];
  PD.suppliers.filter(function (s) { return s.route === 'direct'; }).forEach(function (s) { pickups.push({ name: s.name, addr: s.pickup, type: 'Supplier pickup', pathao: 'Store #' + (214900 + s.id.slice(1) * 7), sf: 'Auto-create' }); });
  var st = { tab: 'zones' };

  function freeTxt(f) { return f === null ? '<span class="p-muted">Never free</span>' : f === 0 ? '<span class="a-badge ok">Always free</span>' : 'Above ' + bdt(f); }
  function locCount(x) { var d = Object.keys(x.loc); var up = 0; d.forEach(function (k) { if (x.loc[k]) up += x.loc[k].length; }); return d.length + ' district' + (d.length === 1 ? '' : 's') + (up ? ' · ' + up + ' upazila' + (up === 1 ? '' : 's') : ''); }
  function locPreview(x) { var d = Object.keys(x.loc); return d.slice(0, 3).map(function (k) { return k + (x.loc[k] ? ' (' + x.loc[k].length + ' areas)' : ''); }).join(', ') + (d.length > 3 ? ' +' + (d.length - 3) + ' more' : ''); }

  function zonesPanel() {
    var h = '<div class="p-note p-mb"><b>One delivery charge per order</b>, even when the order is split into several shipments (stock + dropship). We do not run our own riders or pickup points: every parcel goes through Pathao or Steadfast. Charge = base + extra per kg above the base weight; free when subtotal reaches the zone\'s <i>free above</i> amount (<b>blank = never free</b>, <b>0 = always free</b>).</div>' +
      '<div class="a-card"><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Zone (EN / বাংলা)</th><th class="num">Base charge</th><th class="num">Base weight</th><th class="num">Extra / kg</th><th>ETA</th><th>Free delivery</th><th>Coverage</th><th>Courier</th><th></th></tr></thead><tbody>';
    zones.forEach(function (x) {
      h += '<tr><td><b>' + esc(x.en) + '</b><div class="p-muted p-small" lang="bn">' + esc(x.bn) + '</div></td><td class="num">' + bdt(x.base) + '</td><td class="num">' + x.bw + ' kg</td><td class="num">' + bdt(x.extra) + '</td><td>' + x.eta[0] + '–' + x.eta[1] + ' days</td><td>' + freeTxt(x.free) + '</td><td><div>' + locCount(x) + '</div><div class="p-muted p-small">' + esc(locPreview(x)) + '</div></td><td>' + couriers[x.courier].name.split(' ')[0] + '</td><td><button class="a-btn sm" data-z="' + x.id + '">' + A.icons.edit + ' Edit</button></td></tr>';
    });
    return h + '</tbody></table></div></div>';
  }

  /* zone editor */
  function ownerOf(d, u, self) {
    for (var i = 0; i < zones.length; i++) { var x = zones[i]; if (x.id === self || !(d in x.loc)) continue; if (x.loc[d] === null) return x; if (u == null) { if (x.loc[d] && x.loc[d].length === (UP[d] || []).length) return x; } else if (x.loc[d].indexOf(u) >= 0) return x; }
    return null;
  }
  function openZone(id) {
    var orig = zones.filter(function (x) { return x.id === id; })[0], isNew = !orig;
    var d = isNew ? z('Z' + (zones.length + 1), '', '', 100, 1, 25, 2, 4, null, {}, 'pathao') : JSON.parse(JSON.stringify(orig));
    var expand = {}, q = '';
    var b = A.modal.open('<div id="ze"></div>', { title: isNew ? 'New delivery zone' : 'Edit zone — ' + d.en, size: 'lg' });
    function draw() {
      var dis = DISTRICTS.filter(function (n) { return !q || n.toLowerCase().indexOf(q) >= 0; });
      var chips = dis.map(function (n) {
        var mine = d.loc[n], has = n in d.loc, o = ownerOf(n, null, d.id), cls = 'p-chip' + (has ? (mine === null ? ' on' : ' part') : '') + (o && !has ? ' dis' : '');
        return '<span><span class="' + cls + '" data-d="' + n + '" title="' + (o && !has ? 'Already in ' + esc(o.en) : '') + '">' + (has && mine === null ? '✓ ' : '') + esc(n) + (has && mine ? ' (' + mine.length + ')' : '') + (UP[n] ? ' <span data-x="' + n + '" style="opacity:.7">' + (expand[n] ? '▴' : '▾') + '</span>' : '') + '</span>' +
          (expand[n] && UP[n] ? '<div class="p-up p-chips">' + UP[n].map(function (u) { var inz = has && (mine === null || mine.indexOf(u) >= 0), ou = ownerOf(n, u, d.id); return '<span class="p-chip' + (inz ? ' on' : '') + (ou && !inz ? ' dis' : '') + '" data-u="' + n + '|' + u + '" title="' + (ou && !inz ? 'Already in ' + esc(ou.en) : '') + '">' + (inz ? '✓ ' : '') + esc(u) + '</span>'; }).join('') + '</div>' : '') + '</span>';
      }).join(' ');
      $('#ze', b).innerHTML = '<div class="p-cols"><div class="a-field"><label>Zone name (English)</label><input id="ze-en" value="' + esc(d.en) + '"></div><div class="a-field"><label>Zone name (বাংলা)</label><input id="ze-bn" lang="bn" value="' + esc(d.bn) + '"></div></div>' +
        '<div class="p-cols3"><div class="a-field"><label>Base charge (৳)</label><input id="ze-base" type="number" min="0" value="' + d.base + '"></div><div class="a-field"><label>Base weight (kg)</label><input id="ze-bw" type="number" min="0.1" step="0.1" value="' + d.bw + '"></div><div class="a-field"><label>Extra per kg (৳)</label><input id="ze-extra" type="number" min="0" value="' + d.extra + '"></div>' +
        '<div class="a-field"><label>ETA min (days)</label><input id="ze-a" type="number" min="0" value="' + d.eta[0] + '"></div><div class="a-field"><label>ETA max (days)</label><input id="ze-b" type="number" min="0" value="' + d.eta[1] + '"></div>' +
        '<div class="a-field"><label>Free delivery above (৳)</label><input id="ze-free" type="number" min="0" placeholder="blank = never free" value="' + (d.free === null ? '' : d.free) + '"><span class="a-hint">Blank = never free · 0 = always free</span></div></div>' +
        '<div class="a-field"><label>Default courier</label><select id="ze-cour"><option value="pathao"' + (d.courier === 'pathao' ? ' selected' : '') + '>Pathao</option><option value="steadfast"' + (d.courier === 'steadfast' ? ' selected' : '') + '>Steadfast</option></select></div>' +
        '<div class="a-field"><label>Location mapping — ' + locCount(d) + '</label><input id="ze-q" type="search" placeholder="Filter districts…" value="' + esc(q) + '"><div class="p-loc p-mt"><div class="p-chips">' + chips + '</div></div><span class="a-hint">Click a district to include it whole; use ▾ to pick individual upazilas. Districts already in another zone are greyed out.</span></div>' +
        '<div class="a-err" id="ze-err" hidden></div><div class="a-actions">' + (isNew ? '' : '<button class="a-btn danger" id="ze-del">Delete zone</button>') + '<span class="p-grow"></span><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="ze-save">Save zone</button></div>';
      var qi = $('#ze-q', b); if (qi && q) { qi.focus(); qi.setSelectionRange(q.length, q.length); }
    }
    function read() {
      d.en = $('#ze-en', b).value; d.bn = $('#ze-bn', b).value; d.base = +$('#ze-base', b).value || 0; d.bw = +$('#ze-bw', b).value || 1; d.extra = +$('#ze-extra', b).value || 0;
      d.eta = [+$('#ze-a', b).value || 0, +$('#ze-b', b).value || 0]; var f = $('#ze-free', b).value.trim(); d.free = f === '' ? null : Math.max(0, +f); d.courier = $('#ze-cour', b).value;
    }
    draw();
    b.addEventListener('input', function (e) { if (e.target.id === 'ze-q') { q = e.target.value.toLowerCase(); var s = e.target.value; read(); draw(); } });
    b.addEventListener('click', function (e) {
      var x = e.target.closest('[data-x]'); if (x) { read(); expand[x.dataset.x] = !expand[x.dataset.x]; draw(); e.stopPropagation(); return; }
      var u = e.target.closest('[data-u]'); if (u) {
        if (u.classList.contains('dis')) return; read(); var p = u.dataset.u.split('|'), n = p[0], up = p[1];
        if (!(n in d.loc)) d.loc[n] = [up]; else if (d.loc[n] === null) d.loc[n] = UP[n].filter(function (k) { return k !== up; }); else { var i = d.loc[n].indexOf(up); if (i >= 0) d.loc[n].splice(i, 1); else d.loc[n].push(up); }
        if (d.loc[n] && d.loc[n].length === 0) delete d.loc[n]; if (d.loc[n] && UP[n] && d.loc[n].length === UP[n].length && !ownerOf(n, null, d.id) && false) d.loc[n] = null; draw(); return;
      }
      var c = e.target.closest('[data-d]'); if (c) { if (c.classList.contains('dis')) return; read(); var dn = c.dataset.d; if (dn in d.loc) delete d.loc[dn]; else d.loc[dn] = null; draw(); return; }
      if (e.target.id === 'ze-save') {
        read(); var err = $('#ze-err', b), m = !d.en.trim() ? 'English zone name is required.' : !Object.keys(d.loc).length ? 'Map at least one district.' : d.eta[1] < d.eta[0] ? 'ETA max must be ≥ ETA min.' : '';
        if (m) { err.textContent = m; err.hidden = false; return; }
        if (isNew) zones.push(d); else zones[zones.indexOf(orig)] = d;
        audit('delivery.zone_' + (isNew ? 'create' : 'update'), d.id + ' ' + d.en, isNew ? '' : 'base ' + orig.base + ', free ' + orig.free, 'base ' + d.base + ', free ' + d.free);
        A.modal.close(); render(); A.toast('Zone saved', 'ok');
      }
      if (e.target.id === 'ze-del') A.confirm('Delete zone <b>' + esc(d.en) + '</b>? Its districts become unmapped until assigned to another zone.', 'Delete zone', function () { zones.splice(zones.indexOf(orig), 1); audit('delivery.zone_delete', d.id + ' ' + d.en); render(); A.toast('Zone deleted', 'warn'); }, true);
    });
  }

  /* calculator */
  var calc = { zone: 'Z1', w: 1.5, sub: 1800, ship: 2 };
  function calcOut() {
    var x = zones.filter(function (y) { return y.id === calc.zone; })[0], extraKg = Math.ceil(Math.max(0, calc.w - x.bw)), raw = x.base + extraKg * x.extra;
    var free = x.free !== null && calc.sub >= x.free, charge = free ? 0 : raw;
    var reason = x.free === null ? 'This zone is never free' : x.free === 0 ? 'Zone is always free' : calc.sub >= x.free ? 'Subtotal ' + bdt(calc.sub) + ' ≥ ' + bdt(x.free) : 'Add ' + bdt(x.free - calc.sub) + ' more for free delivery';
    return '<div class="p-result' + (free ? ' free' : '') + '"><div class="p-muted p-small">Delivery charge for the order</div><div class="big">' + (free ? 'FREE' : bdt(charge)) + '</div><div class="p-small p-muted">' + reason + '</div>' +
      '<div class="a-kv p-mt" style="text-align:left"><div class="p-row sp"><span>Base (up to ' + x.bw + ' kg)</span><b>' + bdt(x.base) + '</b></div><div class="p-row sp"><span>Extra ' + extraKg + ' kg × ' + bdt(x.extra) + '</span><b>' + bdt(extraKg * x.extra) + '</b></div><div class="p-row sp"><span>Calculated</span><b>' + bdt(raw) + '</b></div>' + (free ? '<div class="p-row sp"><span>Free delivery applied</span><b>−' + bdt(raw) + '</b></div>' : '') + '<div class="p-row sp"><span>ETA</span><b>' + x.eta[0] + '–' + x.eta[1] + ' days</b></div></div>' +
      (calc.ship > 1 ? '<div class="p-note ok p-mt" style="text-align:left">Order split into ' + calc.ship + ' shipments (stock + dropship): the customer still pays <b>one</b> delivery charge. Shipped on the first shipment, no charge on later ones.</div>' : '') + '</div>';
  }
  function calcPanel() {
    return '<div class="p-calc"><div class="a-card"><div class="a-card-h"><h3>Calculator preview</h3></div><div class="a-card-b"><div class="a-field"><label>Zone</label><select id="c-zone">' + zones.map(function (x) { return '<option value="' + x.id + '"' + (x.id === calc.zone ? ' selected' : '') + '>' + esc(x.en) + '</option>'; }).join('') + '</select></div>' +
      '<div class="a-field"><label>Order weight (kg)</label><input id="c-w" type="number" min="0.1" step="0.1" value="' + calc.w + '"></div><div class="a-field"><label>Order subtotal (৳)</label><input id="c-sub" type="number" min="0" step="100" value="' + calc.sub + '"></div><div class="a-field"><label>Shipments in order</label><select id="c-ship"><option value="1"' + (calc.ship === 1 ? ' selected' : '') + '>1 shipment</option><option value="2"' + (calc.ship === 2 ? ' selected' : '') + '>2 shipments (stock + dropship)</option><option value="3"' + (calc.ship === 3 ? ' selected' : '') + '>3 shipments</option></select></div></div></div><div id="c-out">' + calcOut() + '</div></div>';
  }

  /* couriers */
  function courierPanel() {
    var h = '<div class="p-note p-mb">Staff pick the courier per order and book via API (Pathao, Steadfast). There are <b>no own riders</b> and <b>no pickup points</b>. Supplier pickups are booked on our courier account with the supplier address as pickup.</div><div class="p-cols">';
    ['pathao', 'steadfast'].forEach(function (k) {
      var c = couriers[k];
      h += '<div class="a-card"><div class="a-card-h"><div class="p-cour"><span class="p-logo" style="background:' + c.color + '">' + c.name[0] + '</span><div><h3 style="margin:0">' + c.name + '</h3><div class="p-muted p-small">' + c.store + ' · ' + c.env + '</div></div></div><label class="a-switch"><input type="checkbox" data-en="' + k + '"' + (c.enabled ? ' checked' : '') + '><span></span></label></div><div class="a-card-b">' +
        c.keys.map(function (kv) { return '<div class="p-row sp" style="padding:4px 0"><span class="p-muted">' + kv[0] + '</span><span class="p-secret">' + esc(kv[1]) + '</span></div>'; }).join('') +
        '<div class="p-row p-mt"><button class="a-btn sm" data-cred="' + k + '" data-perm="settings.payments" data-perm-mode="disable">' + A.icons.lock + ' Update credentials</button><button class="a-btn sm" data-test="' + k + '">Test connection</button></div></div></div>';
    });
    h += '</div><div class="a-card p-mt"><div class="a-card-h"><h3>Default courier per zone</h3></div><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Zone</th><th>Default courier</th><th>Fallback</th></tr></thead><tbody>' + zones.map(function (x) {
      return '<tr><td>' + esc(x.en) + '</td><td><select data-dc="' + x.id + '"><option value="pathao"' + (x.courier === 'pathao' ? ' selected' : '') + '>Pathao</option><option value="steadfast"' + (x.courier === 'steadfast' ? ' selected' : '') + '>Steadfast</option></select></td><td class="p-muted">' + (x.courier === 'pathao' ? 'Steadfast' : 'Pathao') + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<div class="a-card p-mt"><div class="a-card-h"><h3>Pickup addresses</h3><button class="a-btn sm" id="pk-add">' + A.icons.plus + ' Add pickup address</button></div><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Name</th><th>Type</th><th>Address</th><th>Pathao store</th><th>Steadfast</th></tr></thead><tbody>' + pickups.map(function (p) { return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + (p.type === 'Own' ? '<span class="a-badge info">Own warehouse</span>' : '<span class="a-badge muted">Supplier pickup</span>') + '</td><td>' + esc(p.addr) + '</td><td class="p-mono">' + p.pathao + '</td><td>' + p.sf + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    return h;
  }

  function render() {
    $('#dl-body').innerHTML = '<div class="a-tabs p-tabsbar" role="tablist">' + [['zones', 'Zones & charges', zones.length], ['calc', 'Calculator'], ['couriers', 'Couriers & pickups']].map(function (t) { return '<button class="a-tab" data-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + (t[2] ? ' <span class="a-count">' + t[2] + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      (st.tab === 'zones' ? zonesPanel() : st.tab === 'calc' ? calcPanel() : courierPanel());
    A.applyPerms($('#dl-body'));
  }

  A.renderPage({
    active: 'delivery', title: 'Delivery & couriers', crumbs: [['Dashboard', 'index.html'], ['Delivery & couriers']],
    actions: '<button class="a-btn primary" id="dl-new" data-perm="delivery.manage" data-perm-mode="disable">' + A.icons.plus + ' New zone</button>',
    body: '<div id="dl-body"></div>',
    onReady: function (root) {
      render();
      $('#dl-new').onclick = function () { openZone(null); };
      root.addEventListener('click', function (e) {
        var t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; render(); return; }
        var zz = e.target.closest('[data-z]'); if (zz) { openZone(zz.dataset.z); return; }
        var cr = e.target.closest('[data-cred]'); if (cr) {
          var c = couriers[cr.dataset.cred], b = A.modal.open('<div class="p-note warn p-mb">Credentials are stored encrypted and never shown again after saving.</div>' + c.keys.map(function (kv, i) { return '<div class="a-field"><label>' + kv[0] + '</label><input type="password" id="cr-' + i + '" placeholder="Leave blank to keep current" autocomplete="off"></div>'; }).join('') + '<div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="cr-ok">Save credentials</button></div>', { title: 'Update ' + c.name + ' API credentials', size: 'sm' });
          $('#cr-ok', b).onclick = function () { audit('courier.credentials', c.name, '••••', '••••'); A.modal.close(); A.toast(c.name + ' credentials updated', 'ok'); }; return;
        }
        var ts = e.target.closest('[data-test]'); if (ts) { A.toast(couriers[ts.dataset.test].name + ': connection OK (mock, 142 ms)', 'ok'); return; }
        if (e.target.id === 'pk-add' || e.target.closest('#pk-add')) {
          var b2 = A.modal.open('<div class="a-field"><label>Name</label><input id="pk-n"></div><div class="a-field"><label>Address</label><textarea id="pk-a" rows="2"></textarea></div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" id="pk-ok">Add &amp; register with couriers</button></div>', { title: 'Add pickup address', size: 'sm' });
          $('#pk-ok', b2).onclick = function () { var n = $('#pk-n', b2).value.trim(); if (!n) return; pickups.push({ name: n, addr: $('#pk-a', b2).value, type: 'Own', pathao: 'Pending', sf: 'Pending' }); A.modal.close(); render(); A.toast('Pickup address added', 'ok'); };
        }
      });
      root.addEventListener('change', function (e) {
        var t = e.target;
        if (t.dataset.en) { couriers[t.dataset.en].enabled = t.checked; audit('courier.toggle', couriers[t.dataset.en].name, '', String(t.checked)); A.toast(couriers[t.dataset.en].name + (t.checked ? ' enabled' : ' disabled'), t.checked ? 'ok' : 'warn'); }
        if (t.dataset.dc) { zones.filter(function (x) { return x.id === t.dataset.dc; })[0].courier = t.value; render(); A.toast('Default courier updated', 'ok'); }
      });
      root.addEventListener('input', function (e) {
        var id = e.target.id; if (id === 'c-w') calc.w = Math.max(0, +e.target.value || 0); else if (id === 'c-sub') calc.sub = Math.max(0, +e.target.value || 0); else if (id === 'c-zone') calc.zone = e.target.value; else if (id === 'c-ship') calc.ship = +e.target.value; else return;
        $('#c-out').innerHTML = calcOut();
      });
    }
  });
})();
