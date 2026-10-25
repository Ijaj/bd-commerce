(function () {
  'use strict';
  var A = window.Admin, D = window.SRD, $ = A.$, $$ = A.$$, esc = A.esc, bdt = A.fmt.bdt, I = A.icons;
  var YM = '2026-10', tab = 'team', cs = {};
  function badge(t, k) { return '<span class="a-badge ' + k + '">' + esc(t) + '</span>'; }
  function audit(a, e, b, af) { try { A.audit.log(a, e, b, af); } catch (er) { /* ignore */ } }
  function pc(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function st(srId, ym) { var k = srId + ym; return cs[k] || (cs[k] = D.commStatus[ym]); }
  function teamTab() {
    var tot = { sold: 0, target: 0, coll: 0, comm: 0, due: 0 };
    var rows = D.srs.map(function (s) {
      var m = D.monthStats(s.id, YM), due = D.srDue(s.id), n = D.shops.filter(function (x) { return x.sr === s.id; }).length, p = pc(m.sold, m.target);
      tot.sold += m.sold; tot.target += m.target; tot.coll += m.collected; tot.comm += m.commission; tot.due += due;
      return '<tr><td><div style="display:flex;gap:9px;align-items:center"><span class="a-avatar">' + esc(s.name[0]) + '</span><div><b>' + esc(s.name) + '</b><div class="s-muted">' + esc(s.phone) + ' · ' + esc(s.area) + '</div></div></div></td><td class="num">' + bdt(m.target) + '</td><td class="num"><b>' + bdt(m.sold) + '</b></td><td style="min-width:120px"><div class="s-row" style="gap:6px;flex-wrap:nowrap"><div class="s-bar ' + (p >= 100 ? 'ok' : '') + ' s-grow"><i style="width:' + Math.min(100, p) + '%"></i></div><b>' + p + '%</b></div></td><td class="num">' + bdt(m.collected) + '<div class="s-muted">' + pc(m.collected, m.sold) + '% of sold</div></td><td class="num">' + (m.bp / 100) + '%' + (s.bp == null ? '<div class="s-muted">default</div>' : '') + '</td><td class="num"><b>' + bdt(m.commission) + '</b></td><td class="num"><span class="s-due">' + bdt(due) + '</span><div class="s-muted">' + n + ' shops</div></td><td><button class="a-btn sm" data-edit="' + s.id + '" data-perm="sr.manage" data-perm-mode="disable">' + I.edit + ' Edit</button></td></tr>';
    }).join('');
    return '<div class="s-kpis"><div class="a-stat"><div class="l">Team target</div><div class="v">' + bdt(tot.target) + '</div></div><div class="a-stat"><div class="l">Sold so far</div><div class="v">' + bdt(tot.sold) + '</div><div class="d">' + pc(tot.sold, tot.target) + '% of target</div></div><div class="a-stat"><div class="l">Collected</div><div class="v">' + bdt(tot.coll) + '</div></div><div class="a-stat"><div class="l">Commission accrued</div><div class="v">' + bdt(tot.comm) + '</div></div><div class="a-stat"><div class="l">Dues on SR shops</div><div class="v">' + bdt(tot.due) + '</div></div></div>' +
      '<div class="s-two"><div class="a-card"><div class="a-card-h"><h2>' + D.fm(YM) + '</h2><span class="s-muted">8 days left</span></div><div class="a-table-wrap"><table class="a-table"><thead><tr><th>SR</th><th class="num">Target</th><th class="num">Sold</th><th>Achieved</th><th class="num">Collected</th><th class="num">Commission %</th><th class="num">Commission</th><th class="num">Dues outstanding</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="a-card"><div class="a-card-h"><h2>Default commission</h2></div><div class="a-card-b"><div class="a-field"><label for="dbp">Default rate</label><div class="s-unit"><input class="a-input" id="dbp" type="number" step="0.1" min="0" max="20" value="' + D.settings.defaultBp / 100 + '"><span>%</span></div><div class="a-hint">Used for any SR without their own rate.</div></div><button class="a-btn primary" id="dbs" data-perm="sr.manage" data-perm-mode="disable">Save</button><hr style="border:0;border-top:1px solid var(--border);margin:14px 0"><p class="s-muted" style="margin:0"><b>How commission works:</b> rate × money collected in the month (cash paid at sale plus staff-confirmed due collections). Credit sales earn nothing until the money is collected (Q120).</p></div></div></div>';
  }
  function commTab() {
    var out = '';
    D.MONTHS.slice().reverse().forEach(function (ym) {
      out += '<div class="a-card" style="margin-bottom:12px"><div class="a-card-h"><h2>' + D.fm(ym) + '</h2></div><div class="a-table-wrap"><table class="a-table"><thead><tr><th>SR</th><th class="num">Paid at sale</th><th class="num">Due collections</th><th class="num">Base</th><th class="num">Rate</th><th class="num">Commission</th><th>Status</th><th></th></tr></thead><tbody>' + D.srs.map(function (s) {
        var m = D.monthStats(s.id, ym), x = st(s.id, ym);
        return '<tr><td>' + esc(s.name) + '</td><td class="num">' + bdt(m.atSale) + '</td><td class="num">' + bdt(m.dueCol) + '</td><td class="num">' + bdt(m.collected) + '</td><td class="num">' + (m.bp / 100) + '%</td><td class="num"><b>' + bdt(m.commission) + '</b></td><td>' + badge(x === 'paid' ? 'Paid' : x === 'approved' ? 'Approved' : ym === YM ? 'Accruing' : 'Pending', x === 'paid' ? 'ok' : x === 'approved' ? 'info' : 'warn') + '</td><td style="white-space:nowrap">' + (x === 'pending' && ym !== YM ? '<button class="a-btn sm primary" data-cs="' + s.id + '|' + ym + '|approved" data-perm="sr.manage" data-perm-mode="disable">Approve</button>' : x === 'approved' ? '<button class="a-btn sm primary" data-cs="' + s.id + '|' + ym + '|paid" data-perm="sr.manage" data-perm-mode="disable">Mark paid</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    });
    return '<div class="a-banner info">' + I.warn + '<div>The current month stays "Accruing" until it ends; staff approve, then pay with salary or bKash outside the system.</div></div>' + out;
  }
  function tabs() { return '<div class="a-tabs s-tabsbar">' + [['team', 'Team this month'], ['comm', 'Commission payouts']].map(function (t) { return '<button class="a-tab" data-t="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>'; }
  function paint() { var h = $('#st'); h.innerHTML = tabs() + (tab === 'team' ? teamTab() : commTab()); A.applyPerms(h); }
  function edit(id) {
    var s = D.srById(id), m = D.monthStats(id, YM);
    var b = A.modal.open('<form id="ef"><dl class="a-kv" style="margin-bottom:12px"><dt>Phone</dt><dd>' + esc(s.phone) + '</dd><dt>Area</dt><dd>' + esc(s.area) + '</dd></dl><div class="a-field"><label for="et">' + D.fm(YM) + ' sales target</label><div class="s-unit"><span style="border-left:1px solid var(--border);border-radius:4px 0 0 4px;border-right:0">৳</span><input class="a-input" style="border-radius:0 4px 4px 0!important" id="et" type="number" min="0" step="1000" value="' + m.target + '"></div></div><div class="a-field"><label class="s-row" style="gap:6px"><input type="checkbox" id="ed"' + (s.bp == null ? ' checked' : '') + '> Use default rate (' + D.settings.defaultBp / 100 + '%)</label></div><div class="a-field"><label for="ep">Own commission rate</label><div class="s-unit"><input class="a-input" id="ep" type="number" step="0.1" min="0" max="20" value="' + D.bpOf(s) / 100 + '"><span>% of money collected</span></div></div><div class="a-hint">Rate changes apply to money collected from now on; paid months are not recalculated.</div><div class="a-actions"><button type="button" class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary">Save</button></div></form>', { title: 'Edit ' + s.name, size: 'sm' });
    function sync() { $('#ep', b).disabled = $('#ed', b).checked; } $('#ed', b).onchange = sync; sync();
    $('#ef', b).onsubmit = function (e) {
      e.preventDefault(); var t = +$('#et', b).value, bp = Math.round(parseFloat($('#ep', b).value) * 100);
      if (!(t >= 0)) { A.toast('Enter a valid target', 'warn'); return; } if (!$('#ed', b).checked && !(bp >= 0)) { A.toast('Enter a commission rate', 'warn'); return; }
      D.targets[id][YM] = t; s.bp = $('#ed', b).checked ? null : bp; audit('sr.update', s.name, { target: m.target, bp: D.bpOf(s) }, { target: t, bp: s.bp }); A.modal.close(); A.toast('Saved for ' + s.name, 'ok'); paint();
    };
  }
  function onReady() {
    paint();
    $('#st').addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.t) { tab = t.dataset.t; paint(); }
      else if (t.dataset.edit) edit(t.dataset.edit);
      else if (t.id === 'dbs') { var v = Math.round(parseFloat($('#dbp').value) * 100); if (!(v >= 0)) { A.toast('Enter a rate', 'warn'); return; } D.settings.defaultBp = v; audit('sr.default_commission', 'settings', null, v / 100 + '%'); A.toast('Default rate saved', 'ok'); paint(); }
      else if (t.dataset.cs) { var p = t.dataset.cs.split('|'); cs[p[0] + p[1]] = p[2]; audit('sr.commission.' + p[2], p[0] + ' ' + p[1], null, p[2]); A.toast('Marked ' + p[2], 'ok'); paint(); }
    });
  }
  A.renderPage({ active: 'sr-team', title: 'SR team', crumbs: [['People & partners', '#'], ['SR team']], actions: '<a class="a-btn" href="../sr/index.html" target="_blank">Open SR portal</a>', body: '<div id="st"></div>', onReady: onReady });
})();
