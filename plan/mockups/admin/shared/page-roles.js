(function () {
  'use strict';
  var A = Admin, sel = 'order', edits = {}; // edits: working copy of the selected role's perms
  function roles() { return A.roles; }
  function cur() { return roles().filter(function (r) { return r.id === sel; })[0] || roles()[0]; }
  function staffCount(id) { var st = A.store.get('admin.staff', null); var base = { owner: 1, manager: 1, order: 2, catalog: 2, support: 2, marketing: 1 }; if (st) return st.filter(function (s) { return s.roles.indexOf(id) >= 0; }).length; return base[id] || 0; }
  function list() {
    return '<div class="role-list">' + roles().map(function (r) {
      return '<button class="role-item" data-role="' + r.id + '" aria-selected="' + (r.id === sel) + '"><span><b>' + A.esc(r.name) + (r.custom ? ' <span class="a-badge muted">custom</span>' : '') + '</b><small>' + r.perms.length + ' permissions</small></span><span class="n">' + staffCount(r.id) + ' staff</span></button>';
    }).join('') + '</div>';
  }
  function matrix(r, working) {
    var locked = r.id === 'owner';
    return '<table class="perm-matrix">' + A.permGroups.map(function (g) {
      var enabled = g[1].filter(function (p) { return !locked && A.can(p[0]); });
      return '<tr><th colspan="3"><div class="perm-grp-h"><span>' + g[0] + '</span>' + (locked || !enabled.length ? '' : '<button class="a-link" data-grp="' + g[0] + '">Toggle all</button>') + '</div></th></tr>' + g[1].map(function (p) {
        var can = A.can(p[0]), dis = locked || !can, on = working.indexOf(p[0]) >= 0;
        return '<tr class="perm-row' + (dis ? ' locked' : '') + '" data-g="' + g[0] + '"' + (!can && !locked ? ' title="You don’t have this permission, so you can’t grant it"' : '') + '><td class="c"><input type="checkbox" data-perm-k="' + p[0] + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + ' id="pk-' + p[0] + '"></td><td><label for="pk-' + p[0] + '">' + p[1] + (!can && !locked ? ' ' + A.icons.lock.replace('width="18" height="18"', 'width="13" height="13"') : '') + '</label></td><td class="k">' + p[0] + '</td></tr>';
      }).join('');
    }).join('') + '</table>';
  }
  function editor() {
    var r = cur(), working = edits[r.id] || (edits[r.id] = r.perms.slice()), locked = r.id === 'owner';
    return '<div class="a-card"><div class="a-card-h"><h2>' + A.esc(r.name) + '</h2>' + (locked ? '<span class="a-badge danger">System role · locked</span>' : '') +
      (r.custom ? '<button class="a-btn sm danger" id="delrole">' + A.icons.trash + 'Delete role</button>' : '') + '</div><div class="a-card-b">' +
      '<p class="a-muted" style="margin-bottom:10px">' + A.esc(r.desc || '') + '</p>' +
      '<div class="a-banner info" style="margin-bottom:12px">' + A.icons.info + '<div class="a-sm"><b>Rule:</b> you can’t grant a permission you don’t have. You are viewing as <b>' + A.esc(A.role().name) + '</b>; permissions you lack are greyed out. “Manage roles &amp; permissions” is itself a grantable permission. Try <b>View as → Team lead (demo)</b>.</div></div>' +
      '<div class="a-card" style="box-shadow:none"><div class="a-table-wrap" style="max-height:none">' + matrix(r, working) + '</div></div>' +
      '<div class="a-actions"><span class="a-muted a-sm" style="margin-right:auto" id="rcount">' + working.length + ' of ' + A.allPerms.length + ' permissions</span><button class="a-btn" id="rreset"' + (locked ? ' disabled' : '') + '>Discard changes</button><button class="a-btn primary" id="rsave"' + (locked ? ' disabled' : '') + '>Save role</button></div></div></div>';
  }
  function overview() {
    var rs = roles();
    return '<div class="a-card"><div class="a-table-wrap" style="max-height:70vh"><table class="a-table"><thead><tr><th>Permission</th>' + rs.map(function (r) { return '<th style="text-align:center">' + A.esc(r.name) + '</th>'; }).join('') + '</tr></thead><tbody>' + A.permGroups.map(function (g) {
      return '<tr><td colspan="' + (rs.length + 1) + '" style="background:var(--surface-2);font-weight:800;color:var(--primary);text-transform:uppercase;font-size:11.5px;letter-spacing:.05em">' + g[0] + '</td></tr>' + g[1].map(function (p) {
        return '<tr><td>' + p[1] + '<span class="sub"><code>' + p[0] + '</code></span></td>' + rs.map(function (r) { return '<td style="text-align:center">' + (r.perms.indexOf(p[0]) >= 0 ? '<span style="color:var(--success)">' + A.icons.check + '</span>' : '<span class="a-muted">·</span>') + '</td>'; }).join('') + '</tr>';
      }).join('');
    }).join('') + '</tbody></table></div></div>';
  }
  var view = 'edit';
  function draw() {
    var host = A.$('#rl');
    host.innerHTML = view === 'edit' ? '<div class="a-split"><div class="a-card"><div class="a-card-h"><h2>Roles <span class="a-count">' + roles().length + '</span></h2><button class="a-btn sm" id="newrole" data-perm="roles.manage">' + A.icons.plus + 'New</button></div>' + list() + '</div><div id="ed">' + editor() + '</div></div>' : overview();
    A.applyPerms(host); if (view === 'edit') wire();
  }
  function redrawEditor() { A.$('#ed').innerHTML = editor(); A.$$('.role-item').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.role === sel); }); wire(); }
  function wire() {
    A.$$('.role-item').forEach(function (b) { b.onclick = function () { sel = b.dataset.role; redrawEditor(); }; });
    var nr = A.$('#newrole'); if (nr) nr.onclick = newRole;
    var ed = A.$('#ed'); if (!ed) return; var r = cur();
    A.$$('input[data-perm-k]', ed).forEach(function (c) {
      c.onchange = function () {
        var w = edits[r.id], k = c.dataset.permK, i = w.indexOf(k);
        if (c.checked && i < 0) w.push(k); else if (!c.checked && i >= 0) w.splice(i, 1);
        A.$('#rcount').textContent = w.length + ' of ' + A.allPerms.length + ' permissions';
      };
    });
    A.$$('[data-grp]', ed).forEach(function (b) {
      b.onclick = function () {
        var rows = A.$$('tr[data-g="' + b.dataset.grp + '"] input:not(:disabled)', ed), all = rows.every(function (c) { return c.checked; });
        rows.forEach(function (c) { c.checked = !all; c.dispatchEvent(new Event('change')); });
      };
    });
    var rr = A.$('#rreset'); if (rr) rr.onclick = function () { delete edits[r.id]; redrawEditor(); A.toast('Changes discarded', 'info'); };
    var rs = A.$('#rsave'); if (rs) rs.onclick = function () {
      var before = r.perms.slice(), after = edits[r.id].slice(), add = after.filter(function (x) { return before.indexOf(x) < 0; }), rem = before.filter(function (x) { return after.indexOf(x) < 0; });
      // enforce rule on the data too: can't add what you lack, can't remove what you lack
      if (add.concat(rem).some(function (k) { return !A.can(k); })) { A.toast('You can’t change permissions you don’t have', 'danger'); return; }
      if (!add.length && !rem.length) { A.toast('No changes to save', 'info'); return; }
      r.perms = after; delete edits[r.id];
      if (r.custom) { A.store.set('admin.customRoles', A.roles.filter(function (x) { return x.custom; })); } else { var ov = A.store.get('admin.roleEdits', {}); ov[r.id] = after; A.store.set('admin.roleEdits', ov); }
      A.audit.log('roles.update', 'role:' + r.name, { removed: rem.length ? rem : undefined }, { added: add.length ? add : undefined }, '');
      A.toast('Role “' + r.name + '” saved (+' + add.length + ' / −' + rem.length + ')'); draw();
    };
    var dr = A.$('#delrole'); if (dr) dr.onclick = function () {
      A.confirm('Delete role <b>' + A.esc(r.name) + '</b>? Staff holding only this role lose access.', 'Delete role', function () {
        A.roles.splice(A.roles.indexOf(r), 1); A.store.set('admin.customRoles', A.roles.filter(function (x) { return x.custom; })); A.audit.log('roles.delete', 'role:' + r.name, { permissions: r.perms.length }, null); sel = 'order'; A.toast('Role deleted', 'warn'); draw();
      }, true);
    };
  }
  function newRole() {
    var b = A.modal.open('<form id="nrf" novalidate><div class="a-field"><label for="nrn">Role name</label><input id="nrn" autofocus placeholder="e.g. Warehouse lead"><div class="a-err" hidden></div></div><div class="a-field"><label for="nrd">Description</label><textarea id="nrd" placeholder="What is this role for?"></textarea></div><div class="a-hint">The new role starts with no permissions; you can only add ones you hold.</div><div class="a-actions"><button type="button" class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary">Create role</button></div></form>', { title: 'New role', size: 'sm' });
    A.$('#nrf', b).onsubmit = function (e) {
      e.preventDefault(); var n = A.$('#nrn', b).value.trim(), f = A.$('#nrn', b).closest('.a-field'), er = f.querySelector('.a-err');
      if (!n) { f.classList.add('err'); er.hidden = false; er.textContent = 'Give the role a name.'; return; }
      var r = { id: 'c' + Date.now(), name: n, desc: A.$('#nrd', b).value.trim() || 'Custom role', perms: ['dashboard.view'].filter(A.can), custom: true };
      A.roles.push(r); A.store.set('admin.customRoles', A.roles.filter(function (x) { return x.custom; })); A.audit.log('roles.create', 'role:' + n, null, { permissions: r.perms }); sel = r.id; A.modal.close(); A.toast('Role “' + n + '” created'); draw();
    };
  }
  A.renderPage({ active: 'roles', title: 'Roles & permissions', crumbs: [['Admin', 'index.html'], ['System'], ['Roles & permissions']],
    actions: '<div class="a-tabs" id="rtabs" style="margin:0;border:0"><button class="a-tab" data-tab="edit" aria-selected="true">Edit roles</button><button class="a-tab" data-tab="matrix" aria-selected="false">Matrix overview</button></div>',
    body: '<div id="rl"></div>', onReady: function () { draw(); A.tabs('#rtabs', function (k) { view = k; draw(); }); } });
})();
