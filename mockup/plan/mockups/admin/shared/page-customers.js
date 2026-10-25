/* Customers list (agent E) */
(function () {
  'use strict';
  var A = window.Admin, PD = window.PD, $ = A.$, esc = A.esc, bdt = A.fmt.bdt;
  var S = { q: '', risky: '', returns: '', seg: '', ver: '', sort: 'joined', page: 1 }, PER = 15;
  var NOW = PD.NOW.getTime();

  function ratio(c) { return c.orders ? c.returns / c.orders : 0; }
  function filtered() {
    var q = S.q.trim().toLowerCase();
    var rows = PD.customers.filter(function (c) {
      if (q && (c.name + ' ' + c.phone + ' ' + c.email + ' ' + c.id).toLowerCase().indexOf(q) < 0) return false;
      if (S.risky === 'yes' && !c.risky) return false;
      if (S.risky === 'no' && c.risky) return false;
      if (S.returns === 'has' && !c.returns) return false;
      if (S.returns === 'high' && ratio(c) < .25) return false;
      if (S.seg && c.segment !== S.seg) return false;
      if (S.ver === 'yes' && !c.verified) return false;
      if (S.ver === 'no' && c.verified) return false;
      return true;
    });
    var k = S.sort;
    rows.sort(function (a, b) {
      if (k === 'spent') return b.spent - a.spent;
      if (k === 'orders') return b.orders - a.orders;
      if (k === 'name') return a.name.localeCompare(b.name);
      return b.joined - a.joined;
    });
    return rows;
  }
  function sel(id, opts, val) { return '<select id="' + id + '" class="a-select" aria-label="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }
  function initials(n) { return n.split(' ').map(function (x) { return x[0]; }).slice(0, 2).join(''); }

  function renderTable() {
    var rows = filtered(), pages = Math.max(1, Math.ceil(rows.length / PER));
    if (S.page > pages) S.page = pages;
    var slice = rows.slice((S.page - 1) * PER, S.page * PER);
    var h = '<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th class="num">Orders</th><th class="num">Spent</th><th class="num">Returns</th><th class="num">Wallet</th><th class="num">Points</th><th>Flag</th><th>Joined</th><th>Phone OTP</th></tr></thead><tbody>';
    if (!slice.length) h += '<tr><td colspan="11"><div class="a-empty"><h3>No customers match</h3><p>Try clearing a filter.</p></div></td></tr>';
    slice.forEach(function (c) {
      var r = ratio(c);
      h += '<tr class="p-clk" data-href="customer.html?id=' + c.id + '"><td><div class="p-name"><span class="p-av">' + esc(initials(c.name)) + '</span><div><b><a class="p-link" href="customer.html?id=' + c.id + '">' + esc(c.name) + '</a></b><small>' + c.id + ' · ' + esc(c.city) + ' · ' + c.segment + '</small></div></div></td>' +
        '<td>' + c.phone + '</td><td class="p-muted">' + (esc(c.email) || '—') + '</td><td class="num">' + c.orders + '</td><td class="num">' + bdt(c.spent) + '</td>' +
        '<td class="num">' + c.returns + (c.orders ? ' <span class="p-muted p-small">(' + Math.round(r * 100) + '%)</span>' : '') + '</td>' +
        '<td class="num">' + (c.wallet ? bdt(c.wallet) : '—') + '</td><td class="num">' + A.fmt.num(c.points) + '</td>' +
        '<td>' + (c.risky ? '<span class="a-badge danger" title="' + esc(c.riskReason) + '">Risky</span>' : '<span class="p-muted">—</span>') + '</td>' +
        '<td>' + PD.fd(c.joined) + '</td><td>' + (c.verified ? '<span class="a-badge ok">Verified</span>' : '<span class="a-badge warn">Unverified</span>') + '</td></tr>';
    });
    h += '</tbody></table></div><div class="p-pager"><span>' + rows.length + ' customers · page ' + S.page + ' of ' + pages + '</span><div class="p-pg"><button data-pg="' + (S.page - 1) + '"' + (S.page <= 1 ? ' disabled' : '') + '>‹</button>';
    for (var i = 1; i <= pages; i++) h += '<button data-pg="' + i + '"' + (i === S.page ? ' aria-current="true"' : '') + '>' + i + '</button>';
    h += '<button data-pg="' + (S.page + 1) + '"' + (S.page >= pages ? ' disabled' : '') + '>›</button></div></div>';
    $('#cu-table').innerHTML = h;
  }

  function stats() {
    var c = PD.customers, risky = c.filter(function (x) { return x.risky; }).length, nw = c.filter(function (x) { return x.segment === 'New'; }).length;
    var wallet = c.reduce(function (a, x) { return a + x.wallet; }, 0), ver = c.filter(function (x) { return x.verified; }).length;
    return '<div class="a-grid-4 p-mb">' +
      '<div class="a-stat"><div class="l">Customers</div><div class="v">' + A.fmt.num(c.length) + '</div><div class="d up">+' + nw + ' new in 30 days</div></div>' +
      '<div class="a-stat"><div class="l">Phone verified</div><div class="v">' + Math.round(ver / c.length * 100) + '%</div><div class="d neutral">OTP on signup / guest link</div></div>' +
      '<div class="a-stat"><div class="l">Risky flagged</div><div class="v">' + risky + '</div><div class="d down">pay advance when enabled</div></div>' +
      '<div class="a-stat"><div class="l">Wallet liability</div><div class="v">' + bdt(wallet) + '</div><div class="d neutral">spend-only store credit</div></div></div>';
  }

  A.renderPage({
    active: 'customers', title: 'Customers', crumbs: [['Dashboard', 'index.html'], ['Customers']],
    actions: '<button class="a-btn" id="cu-export">' + A.icons.download + ' Export CSV</button>',
    body: stats() +
      '<div class="a-card"><div class="a-toolbar"><input id="cu-q" type="search" placeholder="Search name, phone, email, ID…" class="a-input" style="min-width:230px">' +
      sel('cu-risky', [['', 'All risk status'], ['yes', 'Risky only'], ['no', 'Not risky']], '') +
      sel('cu-returns', [['', 'Any returns'], ['has', 'Has returns'], ['high', 'Return ratio ≥ 25%']], '') +
      sel('cu-seg', [['', 'All segments'], ['VIP', 'VIP (৳80,000+)'], ['New', 'New (30 days)'], ['Regular', 'Regular'], ['Dormant', 'Dormant (90+ days)']], '') +
      sel('cu-ver', [['', 'Phone: any'], ['yes', 'Verified'], ['no', 'Unverified']], '') +
      sel('cu-sort', [['joined', 'Newest first'], ['spent', 'Highest spend'], ['orders', 'Most orders'], ['name', 'Name A–Z']], 'joined') +
      '</div><div id="cu-table"></div></div>' +
      '<p class="p-muted p-small p-mt">Guest orders are linked automatically to the customer once the phone number is verified by OTP. Customer contact data is shown unmasked by design (staff are accountable via the audit log).</p>',
    onReady: function (root) {
      renderTable();
      root.addEventListener('input', function (e) { if (e.target.id === 'cu-q') { S.q = e.target.value; S.page = 1; renderTable(); } });
      root.addEventListener('change', function (e) {
        var m = { 'cu-risky': 'risky', 'cu-returns': 'returns', 'cu-seg': 'seg', 'cu-ver': 'ver', 'cu-sort': 'sort' }[e.target.id];
        if (m) { S[m] = e.target.value; S.page = 1; renderTable(); }
      });
      root.addEventListener('click', function (e) {
        var pg = e.target.closest('[data-pg]'); if (pg && !pg.disabled) { S.page = +pg.dataset.pg; renderTable(); return; }
        if (e.target.closest('a,button')) return;
        var tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href;
      });
      $('#cu-export').onclick = function () { A.toast('Exported ' + filtered().length + ' customers to CSV (mock)', 'ok'); };
    }
  });
})();
