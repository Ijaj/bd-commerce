(function () {
  'use strict';
  var A = Admin, F = A.fmt, M = 60000;
  function allRoles() { return A.roles; }
  function roleById(id) { return allRoles().filter(function (r) { return r.id === id; })[0]; }
  var staff = A.store.get('admin.staff', null) || [
    { id: 1, name: 'Sadia Akter', email: 'sadia@shopname.com', phone: '01711-000111', roles: ['owner'], tfa: true, last: Date.now() - 4 * M, status: 'active', me: true },
    { id: 2, name: 'Kamrul Hasan', email: 'kamrul@shopname.com', phone: '01819-222333', roles: ['manager'], tfa: true, last: Date.now() - 95 * M, status: 'active' },
    { id: 3, name: 'Rubel Mia', email: 'rubel@shopname.com', phone: '01915-444555', roles: ['order', 'support'], tfa: true, last: Date.now() - 22 * M, status: 'active' },
    { id: 4, name: 'Tania Sultana', email: 'tania@shopname.com', phone: '01620-666777', roles: ['catalog'], tfa: true, last: Date.now() - 26 * 60 * M, status: 'active' },
    { id: 5, name: 'Imtiaz Ahmed', email: 'imtiaz@shopname.com', phone: '01788-888999', roles: ['marketing', 'catalog'], tfa: false, last: Date.now() - 3 * 24 * 60 * M, status: 'active' },
    { id: 6, name: 'Shohag Das', email: 'shohag@shopname.com', phone: '01555-121212', roles: ['order'], tfa: false, last: null, status: 'invited' },
    { id: 7, name: 'Nasrin Parvin', email: 'nasrin@shopname.com', phone: '01844-343434', roles: ['support'], tfa: true, last: Date.now() - 40 * 24 * 60 * M, status: 'disabled' }
  ];
  var devices = [
    { id: 1, who: 'Rubel Mia', dev: 'Chrome on Windows 11', where: 'Narayanganj, BD', ip: '119.30.44.201', t: 38 },
    { id: 2, who: 'Kamrul Hasan', dev: 'Safari on iPhone', where: 'Dhaka, BD', ip: '103.145.22.77', t: 210 },
    { id: 3, who: 'Imtiaz Ahmed', dev: 'Firefox on Linux', where: 'Singapore, SG', ip: '139.99.12.5', t: 1500, odd: true }
  ];
  function save() { A.store.set('admin.staff', staff); }
  function permsOf(rids) { var o = []; rids.forEach(function (id) { var r = roleById(id); if (r) o = o.concat(r.perms); }); return o; }
  function canGrantRole(r) { var mine = A.role().perms; return r.perms.every(function (p) { return mine.indexOf(p) >= 0; }); }
  function canTouch(s) { var mine = A.role().perms; return permsOf(s.roles).every(function (p) { return mine.indexOf(p) >= 0; }); }
  function ini(n) { return n.split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase(); }
  function rolePicker(sel) {
    return '<div class="multi-roles">' + allRoles().map(function (r) {
      var ok = canGrantRole(r), on = sel.indexOf(r.id) >= 0;
      return '<label' + (ok ? '' : ' title="You can’t grant permissions you don’t have" style="opacity:.5;cursor:not-allowed"') + '><input type="checkbox" name="role" value="' + r.id + '"' + (on ? ' checked' : '') + (ok ? '' : ' disabled') + '><span><b>' + A.esc(r.name) + '</b>' + (ok ? '' : ' <span class="a-badge muted">' + A.icons.lock + ' above your level</span>') + '<small>' + A.esc(r.desc || '') + ' · ' + r.perms.length + ' permissions</small></span></label>';
    }).join('') + '</div><div class="a-hint" style="margin-top:6px">Permissions combine across roles. Nobody can grant more than they have.</div>';
  }
  function badge(r) { var x = roleById(r); return '<span class="a-badge ' + (r === 'owner' ? 'danger' : 'info') + '">' + A.esc(x ? x.name : r) + '</span>'; }
  function table() {
    return '<table class="a-table"><thead><tr><th>Staff member</th><th>Phone</th><th>Roles</th><th>2FA</th><th>Last login</th><th>Status</th><th class="act">Actions</th></tr></thead><tbody>' + staff.map(function (s) {
      var tl = canTouch(s) && !s.me, off = tl ? '' : ' disabled title="' + (s.me ? 'You can’t change your own access' : 'Their access is above yours') + '"';
      return '<tr><td><div class="prod-cell"><span class="a-avatar">' + ini(s.name) + '</span><div><b>' + A.esc(s.name) + '</b>' + (s.me ? ' <span class="a-badge muted">You</span>' : '') + '<span class="sub">' + s.email + '</span></div></div></td><td class="a-nowrap">' + s.phone + '</td>' +
        '<td><div class="role-tags">' + s.roles.map(badge).join('') + '</div></td><td>' + (s.tfa ? '<span class="a-badge ok">On</span>' : '<span class="a-badge warn">Off</span>') + '</td><td class="a-nowrap">' + (s.last ? F.ago(s.last) : '<span class="a-muted">Never</span>') + '</td>' +
        '<td>' + (s.status === 'active' ? '<span class="a-badge ok">Active</span>' : s.status === 'invited' ? '<span class="a-badge info">Invited</span>' : '<span class="a-badge muted">Disabled</span>') + '</td>' +
        '<td class="act"><button class="a-btn sm" data-edit="' + s.id + '"' + off + '>' + A.icons.edit + 'Roles</button> <button class="a-btn sm" data-r2fa="' + s.id + '"' + off + (s.tfa ? '' : ' disabled') + '>Reset 2FA</button> <button class="a-btn sm ' + (s.status === 'disabled' ? '' : 'danger') + '" data-tog="' + s.id + '"' + off + '>' + (s.status === 'disabled' ? 'Enable' : 'Disable') + '</button></td></tr>';
    }).join('') + '</tbody></table>';
  }
  function devList() {
    if (!devices.length) return '<div class="a-empty"><p>No new-device alerts.</p></div>';
    return '<ul class="dev-list">' + devices.map(function (d) {
      return '<li><span class="a-badge ' + (d.odd ? 'danger' : 'warn') + '">' + A.icons.device + '</span><div class="t"><b>' + A.esc(d.who) + '</b> signed in from a new device<small>' + d.dev + ' · ' + d.where + ' · ' + d.ip + ' · ' + F.ago(Date.now() - d.t * M) + (d.odd ? ' · unusual location' : '') + '</small></div>' +
        '<button class="a-btn sm" data-ok="' + d.id + '">It’s them</button><button class="a-btn sm danger" data-no="' + d.id + '">Not them</button></li>';
    }).join('') + '</ul>';
  }
  function draw() {
    A.$('#st-table').innerHTML = table(); A.$('#st-dev').innerHTML = devList(); A.$('#st-count').textContent = staff.length; A.$('#st-dcount').textContent = devices.length; A.applyPerms(A.$('#a-body'));
  }
  function byId(id) { return staff.filter(function (s) { return s.id === +id; })[0]; }
  function rolesNames(ids) { return ids.map(function (i) { var r = roleById(i); return r ? r.name : i; }).join(', '); }
  function drawerEdit(s) {
    var isNew = !s, d = s || { name: '', email: '', phone: '', roles: [] };
    var b = A.drawer.open('<form id="sf" novalidate>' +
      (isNew ? '<div class="a-field"><label for="sn">Full name</label><input id="sn" placeholder="e.g. Rahat Karim" autofocus><div class="a-err" hidden></div></div><div class="a-field"><label for="se">Work email</label><input id="se" type="email" placeholder="name@shopname.com"><div class="a-err" hidden></div></div><div class="a-field"><label for="sp">Mobile</label><input id="sp" placeholder="01XXX-XXXXXX"><div class="a-err" hidden></div><div class="a-hint">An invite with a one-time setup link is sent by email and SMS. They must enrol an authenticator app at first login.</div></div>'
        : '<div class="prod-cell" style="margin-bottom:14px"><span class="a-avatar lg">' + ini(d.name) + '</span><div><b>' + A.esc(d.name) + '</b><span class="sub">' + d.email + ' · ' + d.phone + '</span></div></div>') +
      '<div class="a-field"><span class="a-lab">Roles</span>' + rolePicker(d.roles) + '<div class="a-err" id="rerr" hidden>Pick at least one role.</div></div>' +
      '<div class="a-actions"><button type="button" class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" type="submit">' + (isNew ? 'Send invite' : 'Save roles') + '</button></div></form>', { title: isNew ? 'Invite staff' : 'Edit roles', width: 460 });
    A.$('#sf', b).onsubmit = function (e) {
      e.preventDefault(); var ok = true, roles = A.$$('input[name=role]:checked', b).map(function (x) { return x.value; });
      function er(id, m) { var f = A.$(id, b).closest('.a-field'), x = f.querySelector('.a-err'); f.classList.toggle('err', !!m); x.hidden = !m; x.textContent = m || ''; }
      if (isNew) {
        var n = A.$('#sn', b).value.trim(), em = A.$('#se', b).value.trim(), ph = A.$('#sp', b).value.trim();
        er('#sn', n ? '' : 'Name is required.'); er('#se', /^\S+@\S+\.\S+$/.test(em) ? '' : 'Enter a valid email.'); er('#sp', /^01[3-9][\d-]{8,10}$/.test(ph.replace(/\s/g, '')) ? '' : 'Enter a valid BD mobile number.');
        if (!n || !/^\S+@\S+\.\S+$/.test(em) || !/^01[3-9][\d-]{8,10}$/.test(ph.replace(/\s/g, ''))) ok = false;
      }
      A.$('#rerr', b).hidden = roles.length > 0; if (!roles.length) ok = false;
      if (!ok) return;
      if (isNew) { staff.push({ id: Date.now(), name: A.$('#sn', b).value.trim(), email: A.$('#se', b).value.trim(), phone: A.$('#sp', b).value.trim(), roles: roles, tfa: false, last: null, status: 'invited' }); A.audit.log('staff.invite', 'staff:' + A.$('#sn', b).value.trim(), null, { roles: rolesNames(roles) }); A.toast('Invite sent to ' + A.$('#se', b).value.trim()); }
      else { var before = rolesNames(d.roles); d.roles = roles; A.audit.log('staff.roles_update', 'staff:' + d.name, { roles: before }, { roles: rolesNames(roles) }); A.toast('Roles updated for ' + d.name); }
      save(); A.drawer.close(); draw();
    };
  }
  A.renderPage({ active: 'staff', title: 'Staff', crumbs: [['Admin', 'index.html'], ['System'], ['Staff']],
    actions: '<button class="a-btn primary" id="inv" data-perm="staff.manage">' + A.icons.plus + 'Invite staff</button>',
    body: '<div class="a-banner info">' + A.icons.lock + '<div>Session timeout <b>30 min</b> · 2FA required for all staff · new-device alerts <b>on</b>. <a href="settings.html#security">Change in Settings</a></div></div>' +
      '<div class="a-card"><div class="a-card-h"><h2>Team <span class="a-count" id="st-count"></span></h2></div><div class="a-table-wrap" id="st-table"></div></div>' +
      '<div class="a-card a-gap"><div class="a-card-h"><h2>New-device login alerts <span class="a-count" id="st-dcount"></span></h2><span class="a-sm a-muted">Owner and managers are notified by email + in-app</span></div><div id="st-dev"></div></div>',
    onReady: function (root) {
      draw(); A.$('#inv').onclick = function () { drawerEdit(null); };
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t || t.disabled) return;
        if (t.dataset.edit) drawerEdit(byId(t.dataset.edit));
        else if (t.dataset.r2fa) { var s = byId(t.dataset.r2fa); A.confirm('Reset two-factor authentication for <b>' + A.esc(s.name) + '</b>? They must re-enrol an authenticator at next login.', 'Reset 2FA', function () { s.tfa = false; save(); A.audit.log('staff.2fa_reset', 'staff:' + s.name, { tfa: true }, { tfa: false }); A.toast('2FA reset for ' + s.name, 'warn'); draw(); }, true); }
        else if (t.dataset.tog) { var u = byId(t.dataset.tog), dis = u.status !== 'disabled'; A.confirm((dis ? 'Disable <b>' + A.esc(u.name) + '</b>? Their sessions end immediately.' : 'Re-enable <b>' + A.esc(u.name) + '</b>?'), dis ? 'Disable' : 'Enable', function () { var b = u.status; u.status = dis ? 'disabled' : 'active'; save(); A.audit.log(dis ? 'staff.disable' : 'staff.enable', 'staff:' + u.name, { status: b }, { status: u.status }); A.toast(u.name + (dis ? ' disabled' : ' enabled'), dis ? 'warn' : 'ok'); draw(); }, dis); }
        else if (t.dataset.ok) { devices = devices.filter(function (d) { return d.id !== +t.dataset.ok; }); A.toast('Device trusted'); draw(); }
        else if (t.dataset.no) { var dv = devices.filter(function (d) { return d.id === +t.dataset.no; })[0]; devices = devices.filter(function (d) { return d !== dv; }); A.audit.log('staff.session_revoked', 'staff:' + dv.who, null, { device: dv.dev, ip: dv.ip }); A.toast('Session revoked and password reset forced for ' + dv.who, 'danger'); draw(); }
      });
    } });
})();
