(function () {
  var D = window.SalesData, A = window.Admin, esc = A.esc, I = A.icons;
  var T = D.TICKETS;
  var ST = { open: ['Open', 'warn'], pending: ['Pending customer', 'info'], solved: ['Solved', 'ok'] };
  var CH = { web: ['Web form', I.tickets], app: ['App', I.user], phone: ['Phone call', I.phone] };
  var F = { q: '', st: 'active', ch: '', mine: false }, selId = null, mode = 'reply', draftText = '';
  var ME = 'Nabila (Support)';

  var body = '<div class="s-tk" id="tk"><div class="s-tk-list"><div class="hd">' +
    '<input type="search" id="tk-q" placeholder="Search subject, order or customer">' +
    '<div class="s-row"><select id="tk-st" style="flex:1"><option value="active">Open + Pending</option><option value="open">Open</option><option value="pending">Pending customer</option><option value="solved">Solved</option><option value="all">All</option></select>' +
    '<select id="tk-ch" style="flex:1"><option value="">All channels</option><option value="web">Web form</option><option value="app">App</option><option value="phone">Phone</option></select></div>' +
    '<label class="s-row s-small"><input type="checkbox" id="tk-mine"> Assigned to me</label></div><div class="rows" id="tk-rows"></div></div><div class="s-tk-detail" id="tk-detail"></div></div>';

  function list() {
    return T.filter(function (t) {
      if (F.st === 'active' ? t.status === 'solved' : (F.st !== 'all' && t.status !== F.st)) return false;
      if (F.ch && t.channel !== F.ch) return false;
      if (F.mine && t.assignee !== ME) return false;
      if (F.q && (t.id + t.subject + t.orderId + t.cname).toLowerCase().indexOf(F.q) < 0) return false;
      return true;
    }).sort(function (a, b) { return b.updated - a.updated; });
  }
  function drawList() {
    var l = list();
    A.$('#tk-rows').innerHTML = l.length ? l.map(function (t) {
      return '<button class="s-tk-row" data-tk="' + t.id + '" aria-current="' + (t.id === selId) + '"><div class="l1"><span class="s-ch">' + CH[t.channel][1] + CH[t.channel][0] + '</span><span>' + A.fmt.ago(t.updated) + '</span></div>' +
        '<div class="l2">' + esc(t.subject) + '</div><div class="l3"><span class="a-badge ' + ST[t.status][1] + '">' + ST[t.status][0] + '</span>' + (t.priority === 'urgent' || t.priority === 'high' ? '<span class="s-pri-' + t.priority + ' s-small">' + t.priority + '</span>' : '') + '<span class="s-small s-muted">' + esc(t.cname) + ' · #' + t.orderId + '</span></div></button>';
    }).join('') : '<div class="a-empty" style="padding:20px">No tickets match.</div>';
  }
  function drawDetail() {
    var box = A.$('#tk-detail'), tk = A.$('#tk');
    var t = T.filter(function (x) { return x.id === selId; })[0];
    tk.classList.toggle('has-sel', !!t);
    if (!t) { box.innerHTML = '<div class="s-tk-empty"><div>' + I.tickets.replace('<svg', '<svg width="32" height="32"') + '<p>Select a ticket to read the thread.</p></div></div>'; return; }
    var o = D.order(t.orderId);
    var sel = function (id, cur, opts) { return '<select id="' + id + '" aria-label="' + id + '">' + opts.map(function (x) { var v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>'; };
    box.innerHTML = '<div class="s-tk-top"><div class="s-row"><button class="a-btn sm ghost s-tk-back" id="tk-back">‹ Tickets</button><span class="s-small s-muted">' + t.id + ' · ' + CH[t.channel][0] + ' · opened ' + A.fmt.dt(t.created) + '</span></div><h3>' + esc(t.subject) + '</h3>' +
      '<div class="s-tk-meta">' + sel('tk-s', t.status, [['open', 'Open'], ['pending', 'Pending customer'], ['solved', 'Solved']]) + sel('tk-p', t.priority, ['low', 'normal', 'high', 'urgent']) +
      sel('tk-a', t.assignee, [['', 'Unassigned']].concat(D.STAFF)) +
      '<span class="s-small">Order <a class="s-link" href="order.html?id=' + t.orderId + '">#' + t.orderId + '</a>' + (o ? ' <span class="a-badge ' + D.STATUS_TONE[o.status] + '">' + D.STATUS_LABEL[o.status] + '</span>' : '') + '</span>' +
      '<span class="s-small">Customer <a class="s-link" href="customer.html?id=' + t.cid + '">' + esc(t.cname) + '</a> · ' + esc(t.phone) + '</span></div></div>' +
      '<div class="s-thread" id="tk-thread">' + t.msgs.map(function (m) {
        var label = m.from === 'note' ? 'Internal note · ' + m.name : m.from === 'call' ? 'Phone call logged · ' + m.name : m.name;
        return '<div class="s-msg ' + m.from + '"><div class="who">' + esc(label) + ' · ' + A.fmt.dt(m.at) + '</div>' + esc(m.text) + '</div>';
      }).join('') + '</div>' +
      '<div class="s-reply' + (mode === 'note' ? ' note' : '') + '"><div class="s-spread"><div class="modes"><button data-mode="reply" aria-pressed="' + (mode === 'reply') + '">Reply to customer</button><button data-mode="note" aria-pressed="' + (mode === 'note') + '">Internal note</button></div>' +
      '<select id="tk-macro" style="max-width:190px"><option value="">Macros…</option>' + D.MACROS.map(function (m, k) { return '<option value="' + k + '">' + esc(m[0]) + '</option>'; }).join('') + '</select></div>' +
      '<textarea id="tk-text" placeholder="' + (mode === 'note' ? 'Internal note, not visible to the customer' : 'Write a reply. Sent via ' + (t.channel === 'phone' ? 'SMS' : t.channel === 'app' ? 'in-app inbox + push' : 'email') + '.') + '">' + esc(draftText) + '</textarea>' +
      '<div class="s-spread"><span class="s-small s-muted">' + (mode === 'note' ? 'Staff only' : 'Customer is notified') + '</span><button class="a-btn primary" id="tk-send">' + (mode === 'note' ? 'Add note' : 'Send reply') + '</button></div></div>';
    var th = A.$('#tk-thread'); th.scrollTop = th.scrollHeight;
  }
  function openCall() {
    A.modal.open('<div class="a-grid-2"><div class="a-field"><label>Customer phone</label><input id="pc-ph" placeholder="01XXXXXXXXX" value="' + (D.CUSTOMERS[2].phone) + '"></div><div class="a-field"><label>Linked order</label><select id="pc-o"><option value="">None</option>' + D.ORDERS.slice(0, 12).map(function (o) { return '<option value="' + o.id + '">#' + o.id + ' · ' + esc(o.cname) + '</option>'; }).join('') + '</select></div>' +
      '<div class="a-field"><label>Direction</label><select id="pc-d"><option>Inbound</option><option>Outbound</option></select></div><div class="a-field"><label>Duration (min)</label><input id="pc-m" type="number" min="1" value="3"></div>' +
      '<div class="a-field"><label>Priority</label><select id="pc-p"><option>normal</option><option>low</option><option>high</option><option>urgent</option></select></div><div class="a-field"><label>Outcome</label><select id="pc-out"><option>Needs follow-up</option><option>Resolved on call</option><option>Escalated</option></select></div></div>' +
      '<div class="a-field"><label>Subject</label><input id="pc-s" placeholder="e.g. Customer asks about delivery delay"></div><div class="a-field"><label>Call summary</label><textarea id="pc-t" rows="3"></textarea></div>' +
      '<div class="s-row" style="justify-content:flex-end"><button class="a-btn ghost" onclick="Admin.modal.close()">Cancel</button><button class="a-btn primary" id="pc-go">Create ticket</button></div>', { title: 'Log phone call', size: 'md' });
    A.$('#pc-go').onclick = function () {
      var s = A.$('#pc-s').value.trim(); if (!s) { A.toast('Add a subject', 'warn'); return; }
      var ph = A.$('#pc-ph').value.trim(), oid = A.$('#pc-o').value, o = D.order(oid) || D.ORDERS[0];
      var c = D.CUSTOMERS.filter(function (x) { return x.phone === ph; })[0] || D.customer(o.cid);
      var now = new Date(), res = A.$('#pc-out').value === 'Resolved on call';
      var t = { id: 'TK-' + (3330 + T.length), subject: s, channel: 'phone', status: res ? 'solved' : 'open', priority: A.$('#pc-p').value, assignee: ME, orderId: o.id, cid: c.id, cname: c.name, phone: c.phone, created: now, updated: now, msgs: [{ from: 'call', name: ME, text: A.$('#pc-d').value + ' call, ' + A.$('#pc-m').value + ' min. Outcome: ' + A.$('#pc-out').value + '. ' + A.$('#pc-t').value.trim(), at: now }] };
      T.unshift(t); selId = t.id; F.st = 'active'; A.$('#tk-st').value = 'active'; A.modal.close(); drawList(); drawDetail(); A.toast('Phone call logged as ' + t.id, 'ok');
    };
  }

  A.renderPage({
    active: 'tickets', title: 'Support tickets', crumbs: [['Sales', ''], ['Support tickets', 'tickets.html']],
    actions: '<button class="a-btn primary" id="tk-call">' + I.phone + ' Log phone call</button>', body: body,
    onReady: function (root) {
      drawList(); drawDetail();
      A.$('#tk-call').onclick = openCall;
      if (root._sb) return; root._sb = 1;
      root.addEventListener('input', function (e) { if (e.target.id === 'tk-q') { F.q = e.target.value.trim().toLowerCase(); drawList(); } if (e.target.id === 'tk-text') draftText = e.target.value; });
      root.addEventListener('change', function (e) {
        var id = e.target.id, t = T.filter(function (x) { return x.id === selId; })[0];
        if (id === 'tk-st') { F.st = e.target.value; drawList(); } else if (id === 'tk-ch') { F.ch = e.target.value; drawList(); } else if (id === 'tk-mine') { F.mine = e.target.checked; drawList(); }
        else if (t && id === 'tk-s') { t.status = e.target.value; t.msgs.push({ from: 'note', name: 'System', text: 'Status changed to ' + ST[t.status][0], at: new Date() }); drawList(); drawDetail(); }
        else if (t && id === 'tk-p') { t.priority = e.target.value; drawList(); }
        else if (t && id === 'tk-a') { t.assignee = e.target.value; A.toast(t.assignee ? 'Assigned to ' + t.assignee : 'Unassigned', 'ok'); }
        else if (id === 'tk-macro' && e.target.value !== '') { var m = D.MACROS[+e.target.value][1], tt = T.filter(function (x) { return x.id === selId; })[0]; draftText = m.replace('{name}', tt.cname.split(' ')[0]).replace('{order}', '#' + tt.orderId); mode = 'reply'; drawDetail(); }
      });
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tk],[data-mode],#tk-send,#tk-back'); if (!b) return;
        if (b.dataset.tk) { selId = b.dataset.tk; draftText = ''; mode = 'reply'; drawList(); drawDetail(); }
        else if (b.dataset.mode) { mode = b.dataset.mode; drawDetail(); }
        else if (b.id === 'tk-back') { selId = null; drawList(); drawDetail(); }
        else if (b.id === 'tk-send') {
          var t = T.filter(function (x) { return x.id === selId; })[0], txt = (A.$('#tk-text').value || '').trim(); if (!t || !txt) { A.toast('Write something first', 'warn'); return; }
          t.msgs.push({ from: mode === 'note' ? 'note' : 'staff', name: ME, text: txt, at: new Date() }); t.updated = new Date();
          if (mode === 'reply' && t.status === 'open') t.status = 'pending';
          draftText = ''; drawList(); drawDetail(); A.toast(mode === 'note' ? 'Note added' : 'Reply sent', 'ok');
        }
      });
      var first = list()[0]; var want = new URLSearchParams(location.search).get('id');
      if (want) selId = want; else if (window.innerWidth > 860 && first) selId = first.id;
      drawList(); drawDetail();
    }
  });
})();
