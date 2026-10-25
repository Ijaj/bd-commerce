(function () {
  var D = window.SalesData, A = window.Admin, esc = A.esc, I = A.icons;
  var TABS = [['all', 'All'], ['pending_payment', 'Pending payment'], ['processing', 'Processing'], ['on_hold', 'On hold'], ['partially_shipped', 'Partially shipped'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['flagged', 'Flagged']];
  var PER = 15;
  var F = { tab: 'all', q: '', from: '', to: '', method: '', pay: '', courier: '', zone: '', source: '', page: 1 };
  var sel = {};

  function match(o, ignoreTab) {
    if (!ignoreTab) {
      if (F.tab === 'flagged') { if (!o.risk) return false; }
      else if (F.tab !== 'all' && o.status !== F.tab) return false;
    }
    if (F.q) { var q = F.q.toLowerCase(); if ((o.id + ' ' + o.phone + ' ' + o.cname).toLowerCase().indexOf(q) < 0) return false; }
    if (F.from && o.date < new Date(F.from + 'T00:00:00+06:00')) return false;
    if (F.to && o.date > new Date(F.to + 'T23:59:59+06:00')) return false;
    if (F.method && o.method !== F.method) return false;
    if (F.pay && o.payStatus !== F.pay) return false;
    if (F.courier === 'none') { if (o.courier) return false; } else if (F.courier && o.courier !== F.courier) return false;
    if (F.zone && o.zone !== F.zone) return false;
    if (F.source && o.source !== F.source) return false;
    return true;
  }
  function counts() {
    var c = {};
    TABS.forEach(function (t) { c[t[0]] = 0; });
    D.ORDERS.forEach(function (o) { if (!match(o, true)) return; c.all++; c[o.status]++; if (o.risk) c.flagged++; });
    return c;
  }
  function opts(list, cur, blank) { return '<option value="">' + blank + '</option>' + list.map(function (x) { var v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join(''); }

  var body = '<div class="s-notice">' + I.warn + '<div><b>Launch mode: COD only.</b> Online payments, advance payment and pre-orders are OFF via settings flags, so “Pending payment” (bKash advance) orders only appear once those flags are enabled. A few are seeded here to show that state.</div></div>' +
    '<div class="s-tabs-wrap"><div class="a-tabs" id="o-tabs" role="tablist"></div></div>' +
    '<div class="a-toolbar" id="o-tool">' +
    '<input class="a-input" id="f-q" type="search" placeholder="Search order no, phone or name" style="flex:1;min-width:200px">' +
    '<label class="s-row s-small s-muted">From <input id="f-from" type="date"></label><label class="s-row s-small s-muted">To <input id="f-to" type="date"></label>' +
    '</div>' +
    '<div class="s-toolbar-2">' +
    '<select id="f-method" aria-label="Payment method">' + opts(['COD', 'bKash', 'Nagad', 'Card'], '', 'Payment method: all') + '</select>' +
    '<select id="f-pay" aria-label="Payment status">' + opts(['COD due', 'COD collected', 'Awaiting advance', 'Voided'], '', 'Payment status: all') + '</select>' +
    '<select id="f-courier" aria-label="Courier">' + opts([['Pathao', 'Pathao'], ['Steadfast', 'Steadfast'], ['none', 'Not booked']], '', 'Courier: all') + '</select>' +
    '<select id="f-zone" aria-label="Zone">' + opts(Object.keys(D.ZONES), '', 'Zone: all') + '</select>' +
    '<select id="f-source" aria-label="Source">' + opts(['Web', 'Android', 'iOS'], '', 'Source: all') + '</select>' +
    '<button class="a-btn ghost sm" id="f-clear">Clear filters</button></div>' +
    '<div class="s-bulkbar" id="o-bulk" hidden style="margin-top:10px"></div>' +
    '<div class="a-card" style="margin-top:12px"><div class="a-table-wrap"><table class="a-table"><thead><tr>' +
    '<th style="width:34px"><input type="checkbox" id="o-all" aria-label="Select all on page"></th><th>Order</th><th>Date</th><th>Customer</th><th class="num">Items</th><th class="num">Total</th><th>Payment</th><th>Status</th><th>Risk</th><th>Courier</th></tr></thead><tbody id="o-rows"></tbody></table></div>' +
    '<div class="a-card-b" id="o-pager"></div></div>';

  function rows() { return D.ORDERS.filter(function (o) { return match(o); }); }

  function drawTabs() {
    var c = counts();
    A.$('#o-tabs').innerHTML = TABS.map(function (t) { return '<button class="a-tab" role="tab" data-tab="' + t[0] + '" aria-selected="' + (F.tab === t[0]) + '">' + t[1] + ' <span class="a-count">' + c[t[0]] + '</span></button>'; }).join('');
  }
  function drawBulk() {
    var ids = Object.keys(sel).filter(function (k) { return sel[k]; });
    var b = A.$('#o-bulk');
    b.hidden = !ids.length;
    if (!ids.length) return;
    b.innerHTML = '<b>' + ids.length + ' selected</b>' +
      '<button class="a-btn sm" data-bulk="print">' + I.download + ' Print invoices</button>' +
      '<button class="a-btn sm" data-bulk="book" data-perm="orders.edit">' + I.truck + ' Book courier</button>' +
      '<button class="a-btn sm" data-bulk="pack" data-perm="orders.edit">' + I.check + ' Mark packed</button>' +
      '<button class="a-btn sm" data-bulk="csv">' + I.download + ' Export CSV</button>' +
      '<button class="a-btn ghost sm" data-bulk="clear">Clear</button>';
    A.applyPerms(b);
  }
  function drawTable() {
    var list = rows(), pages = Math.max(1, Math.ceil(list.length / PER));
    if (F.page > pages) F.page = pages;
    var pg = list.slice((F.page - 1) * PER, F.page * PER);
    A.$('#o-rows').innerHTML = pg.length ? pg.map(function (o) {
      var risk = o.risk ? '<span class="s-risk ' + (o.risk.sev === 'warn' ? 'warn' : '') + '" tabindex="0" data-tip="' + esc(o.risk.msg) + '" aria-label="' + esc(o.risk.msg) + '">' + I.warn + '</span>' : '<span class="s-muted">–</span>';
      return '<tr class="s-click" data-id="' + o.id + '"><td><input type="checkbox" data-sel="' + o.id + '"' + (sel[o.id] ? ' checked' : '') + ' aria-label="Select ' + o.id + '"></td>' +
        '<td><a class="s-orderno" href="order.html?id=' + o.id + '">#' + o.id + '</a><span class="s-sub">' + o.source + '</span></td>' +
        '<td>' + A.fmt.dt(o.date) + '<span class="s-sub">' + A.fmt.ago(o.date) + '</span></td>' +
        '<td><b>' + esc(o.cname) + '</b><span class="s-sub">' + esc(o.phone) + ' · ' + esc(o.zone) + '</span></td>' +
        '<td class="num">' + o.items.reduce(function (s, i) { return s + i.qty; }, 0) + '</td><td class="num"><b>' + A.fmt.bdt(o.total) + '</b></td>' +
        '<td><span class="a-badge ' + D.payTone(o.payStatus) + '">' + o.payStatus + '</span><span class="s-sub">' + o.method + '</span></td>' +
        '<td><span class="a-badge ' + D.STATUS_TONE[o.status] + '">' + D.STATUS_LABEL[o.status] + '</span></td><td>' + risk + '</td>' +
        '<td>' + (o.courier || '<span class="s-muted">Not booked</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="10"><div class="a-empty">No orders match these filters.</div></td></tr>';
    var allBox = A.$('#o-all'); allBox.checked = pg.length > 0 && pg.every(function (o) { return sel[o.id]; });
    A.$('#o-pager').innerHTML = '<div class="a-pager"><span class="s-muted s-small">' + (list.length ? ((F.page - 1) * PER + 1) + '–' + Math.min(list.length, F.page * PER) + ' of ' + list.length : '0') + ' orders</span>' +
      '<span class="s-row"><button class="a-btn sm" data-pg="-1"' + (F.page <= 1 ? ' disabled' : '') + '>Prev</button><span class="s-small">Page ' + F.page + ' / ' + pages + '</span><button class="a-btn sm" data-pg="1"' + (F.page >= pages ? ' disabled' : '') + '>Next</button></span></div>';
    drawTabs(); drawBulk();
  }

  function csv(ids) {
    var out = ['Order,Date,Customer,Phone,Items,Total,Payment,Status,Courier,Zone'];
    D.ORDERS.filter(function (o) { return ids.indexOf(o.id) >= 0; }).forEach(function (o) {
      out.push([o.id, o.date.toISOString().slice(0, 10), '"' + o.cname + '"', o.phone, o.items.length, o.total, o.payStatus, D.STATUS_LABEL[o.status], o.courier || '', o.zone].join(','));
    });
    try {
      var url = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/csv' }));
      var a = document.createElement('a'); a.href = url; a.download = 'orders.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    } catch (e) { }
  }

  A.renderPage({
    active: 'orders', title: 'Orders', crumbs: [['Sales', ''], ['Orders', 'orders.html']],
    actions: '<button class="a-btn" id="o-export">' + I.download + ' Export all CSV</button>',
    body: body,
    onReady: function (root) {
      drawTable();
      if (root._sb) return; root._sb = 1;
      var timer;
      root.addEventListener('input', function (e) {
        var id = e.target.id;
        if (id === 'f-q') { clearTimeout(timer); timer = setTimeout(function () { F.q = e.target.value.trim(); F.page = 1; drawTable(); }, 150); }
      });
      root.addEventListener('change', function (e) {
        var t = e.target, id = t.id;
        var map = { 'f-from': 'from', 'f-to': 'to', 'f-method': 'method', 'f-pay': 'pay', 'f-courier': 'courier', 'f-zone': 'zone', 'f-source': 'source' };
        if (map[id]) { F[map[id]] = t.value; F.page = 1; drawTable(); return; }
        if (id === 'o-all') { var list = rows().slice((F.page - 1) * PER, F.page * PER); list.forEach(function (o) { sel[o.id] = t.checked; }); drawTable(); return; }
        if (t.dataset.sel) { sel[t.dataset.sel] = t.checked; drawBulk(); var l = rows().slice((F.page - 1) * PER, F.page * PER); A.$('#o-all').checked = l.every(function (o) { return sel[o.id]; }); }
      });
      root.addEventListener('click', function (e) {
        var t = e.target.closest('[data-tab],[data-pg],[data-bulk],#f-clear,#o-export,tr.s-click');
        if (!t) return;
        if (e.target.closest('input,a,.s-risk')) { if (!(t.matches('[data-tab],[data-pg],[data-bulk]'))) return; }
        if (t.dataset.tab) { F.tab = t.dataset.tab; F.page = 1; drawTable(); return; }
        if (t.dataset.pg) { F.page += +t.dataset.pg; drawTable(); return; }
        if (t.id === 'f-clear') { F = { tab: F.tab, q: '', from: '', to: '', method: '', pay: '', courier: '', zone: '', source: '', page: 1 }; ['f-q', 'f-from', 'f-to', 'f-method', 'f-pay', 'f-courier', 'f-zone', 'f-source'].forEach(function (i) { A.$('#' + i).value = ''; }); drawTable(); return; }
        if (t.id === 'o-export') { csv(D.ORDERS.map(function (o) { return o.id; })); A.toast('Exported ' + D.ORDERS.length + ' orders to CSV', 'ok'); return; }
        if (t.dataset.bulk) {
          var ids = Object.keys(sel).filter(function (k) { return sel[k]; }), b = t.dataset.bulk;
          if (b === 'clear') { sel = {}; drawTable(); }
          else if (b === 'print') A.toast('Printing ' + ids.length + ' invoices (A4, VAT portion + BIN shown)', 'ok');
          else if (b === 'csv') { csv(ids); A.toast('Exported ' + ids.length + ' selected orders', 'ok'); }
          else if (b === 'pack') { A.toast(ids.length + ' orders marked packed', 'ok'); }
          else if (b === 'book') {
            A.modal.open('<div class="a-field"><label>Courier</label><select id="bk-c"><option>Pathao</option><option>Steadfast</option></select><div class="a-hint">Books ' + ids.length + ' orders via the courier API. Orders with split shipments book the first (stock) shipment only; dropship shipments wait for supplier confirmation.</div></div><div class="s-row" style="justify-content:flex-end;margin-top:12px"><button class="a-btn ghost" onclick="Admin.modal.close()">Cancel</button><button class="a-btn primary" id="bk-go">Book now</button></div>', { title: 'Book courier', size: 'sm' });
            A.$('#bk-go').onclick = function () {
              var c = A.$('#bk-c').value, n = 0;
              D.ORDERS.forEach(function (o) { if (sel[o.id] && o.status === 'processing' && !o.courier) { o.courier = c; n++; } });
              A.modal.close(); A.toast(n + ' orders booked with ' + c + (ids.length - n ? ' (' + (ids.length - n) + ' skipped: not in Processing or already booked)' : ''), n ? 'ok' : 'warn'); drawTable();
            };
          }
          return;
        }
        if (t.matches('tr.s-click')) location.href = 'order.html?id=' + t.dataset.id;
      });
    }
  });
})();
