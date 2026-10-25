/* Admin core (agent A). Plain script, no modules. Exposes window.Admin. See ../README.md */
(function () {
  'use strict';
  var A = window.Admin = {};
  var listeners = {};

  /* ---------- tiny utils ---------- */
  A.$ = function (s, r) { return (r || document).querySelector(s); };
  A.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  A.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  A.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  A.on = function (e, fn) { (listeners[e] = listeners[e] || []).push(fn); };
  A.emit = function (e, d) { (listeners[e] || []).slice().forEach(function (f) { try { f(d); } catch (x) { console.error(x); } }); };

  /* ---------- formatting ---------- */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function D(d) { return d instanceof Date ? d : new Date(d == null ? Date.now() : d); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function lakh(n, dec) {
    var neg = n < 0; n = Math.abs(+n || 0);
    var s = dec ? n.toFixed(dec) : String(Math.round(n)), f = '';
    if (dec) { f = s.slice(s.indexOf('.')); s = s.slice(0, s.indexOf('.')); }
    var last = s.slice(-3), rest = s.slice(0, -3);
    if (rest) last = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last;
    return (neg ? '-' : '') + last + f;
  }
  A.fmt = {
    bdt: function (n, dec) { var s = lakh(n, dec); return (s.charAt(0) === '-' ? '-৳' + s.slice(1) : '৳' + s); },
    num: function (n) { return lakh(n); },
    date: function (d) { d = D(d); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); },
    time: function (d) { d = D(d); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    dt: function (d) { d = D(d); return A.fmt.date(d) + ', ' + A.fmt.time(d); },
    ago: function (d) {
      var s = Math.round((Date.now() - D(d).getTime()) / 1000);
      if (s < 0) return 'in the future';
      if (s < 60) return 'just now';
      var m = Math.round(s / 60); if (m < 60) return m + ' min ago';
      var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
      var dd = Math.round(h / 24); if (dd < 30) return dd + ' d ago';
      return A.fmt.date(d);
    }
  };

  /* ---------- icons ---------- */
  function ic(p) { return '<svg class="a-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + '</svg>'; }
  var truck = '<path d="M1 4h13v12H1z"/><path d="M14 8h4l4 4v4h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>';
  var IC = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    orders: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    returns: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    tickets: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    products: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    categories: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    inventory: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
    reviews: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    coupons: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2"/>',
    flash: '<path d="M13 2 3 14h8l-1 8 10-12h-8z"/>',
    event: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    loyalty: '<rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M19 12v9H5v-9"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    affiliate: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    campaign: '<path d="M3 11v2a1 1 0 0 0 1 1h3l8 5V5L7 10H4a1 1 0 0 0-1 1z"/><path d="M19 8a5 5 0 0 1 0 8"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3"/>',
    suppliers: '<path d="M3 21V9l6 4V9l6 4V5h6v16z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
    po: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    delivery: truck, truck: truck,
    reports: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
    staff: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5 17a4 4 0 0 1 8 0M15 9h4M15 13h4"/>',
    roles: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    audit: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h0"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    store: '<path d="M3 9 5 3h14l2 6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v9h14v-9"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h0"/>',
    device: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8"/><path d="M21 4v5h-5M3 20v-5h5"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'
  };
  A.icons = {};
  Object.keys(IC).forEach(function (k) { A.icons[k] = ic(IC[k]); });

  /* ---------- permissions & demo roles ---------- */
  A.permGroups = [
    ['Overview', [['dashboard.view', 'View dashboard']]],
    ['Sales', [['orders.view', 'View orders'], ['orders.edit', 'Edit orders (before hand-off)'], ['orders.cancel', 'Cancel orders'], ['orders.refund', 'Issue refunds'], ['refund.approve_high', 'Approve high-value refunds'], ['returns.view', 'View returns'], ['tickets.view', 'View & answer tickets']]],
    ['Catalog', [['products.view', 'View products'], ['products.create', 'Create products'], ['products.edit', 'Edit products'], ['products.delete', 'Delete / archive products'], ['categories.manage', 'Manage categories & attributes'], ['inventory.view', 'View inventory'], ['reviews.manage', 'Moderate reviews & Q&A']]],
    ['Marketing', [['promos.manage', 'Coupons, flash sales, events'], ['cms.manage', 'Home & feed (CMS)'], ['loyalty.manage', 'Loyalty, referral & wallet rules'], ['affiliates.manage', 'Affiliates & payouts'], ['campaigns.manage', 'Notifications & campaigns']]],
    ['People & partners', [['customers.view', 'View customers'], ['customers.flag', 'Flag risky customers'], ['customers.wallet_adjust', 'Adjust wallet / points'], ['suppliers.manage', 'Suppliers & POs'], ['sr.approve', 'Approve SR sales & confirm due collections'], ['sr.manage', 'Manage SRs, B2B shops & dues'], ['delivery.manage', 'Delivery & couriers'], ['reports.view', 'View reports']]],
    ['System', [['staff.manage', 'Manage staff'], ['roles.manage', 'Manage roles & permissions'], ['settings.manage', 'Edit settings'], ['settings.payments', 'Edit payment settings & feature flags'], ['audit.view', 'View audit log']]]
  ];
  A.allPerms = [];
  A.permGroups.forEach(function (g) { g[1].forEach(function (p) { A.allPerms.push(p[0]); }); });
  function expand(list) {
    var out = [];
    list.forEach(function (p) {
      if (p === '*') out = out.concat(A.allPerms);
      else if (/\.\*$/.test(p)) { var pre = p.slice(0, -1); A.allPerms.forEach(function (k) { if (k.indexOf(pre) === 0 && k !== 'refund.approve_high') out.push(k); }); }
      else out.push(p);
    });
    return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }
  var mgr = A.allPerms.filter(function (p) { return ['roles.manage', 'settings.payments', 'audit.view'].indexOf(p) < 0; });
  A.roles = [
    { id: 'owner', name: 'Owner', desc: 'Full access to everything', perms: expand(['*']) },
    { id: 'manager', name: 'Manager', desc: 'Everything except roles, payment settings and audit log', perms: mgr },
    { id: 'order', name: 'Order staff', desc: 'Process orders, returns view, tickets, couriers', perms: expand(['dashboard.view', 'orders.*', 'returns.view', 'tickets.view', 'customers.view', 'delivery.manage']) },
    { id: 'catalog', name: 'Catalog editor', desc: 'Products, categories, inventory, reviews', perms: expand(['dashboard.view', 'products.*', 'categories.manage', 'inventory.view', 'reviews.manage']) },
    { id: 'support', name: 'Support', desc: 'Tickets, read-only orders/returns/customers, reviews', perms: expand(['dashboard.view', 'tickets.view', 'orders.view', 'returns.view', 'customers.view', 'reviews.manage']) },
    { id: 'lead', name: 'Team lead (demo)', desc: 'Can manage staff and roles, but only grant what they hold', perms: expand(['dashboard.view', 'orders.*', 'returns.view', 'tickets.view', 'customers.view', 'delivery.manage', 'staff.manage', 'roles.manage', 'reports.view']) },
    { id: 'marketing', name: 'Marketing', desc: 'Promotions, home feed, loyalty, affiliates, campaigns, reports', perms: expand(['dashboard.view', 'promos.manage', 'cms.manage', 'loyalty.manage', 'affiliates.manage', 'campaigns.manage', 'reports.view']) }
  ];
  (function () {
    var ov = A.store.get('admin.roleEdits', {});
    A.roles.forEach(function (r) { if (r.id !== 'owner' && ov[r.id]) r.perms = ov[r.id]; });
    A.store.get('admin.customRoles', []).forEach(function (r) { r.custom = true; A.roles.push(r); });
  })();
  A.roleId = function () { var r = A.store.get('admin.role', 'owner'); return A.roles.some(function (x) { return x.id === r; }) ? r : 'owner'; };
  A.role = function () { var id = A.roleId(); return A.roles.filter(function (r) { return r.id === id; })[0]; };
  A.can = function (perm) { return !perm || A.role().perms.indexOf(perm) >= 0; };
  A.applyPerms = function (root) {
    A.$$('[data-perm]', root || document).forEach(function (el) {
      var ok = A.can(el.getAttribute('data-perm')), mode = el.getAttribute('data-perm-mode');
      if (mode === 'disable') {
        if (!ok) { el.setAttribute('disabled', ''); el.setAttribute('aria-disabled', 'true'); el.title = 'No permission'; el.setAttribute('data-perm-off', '1'); }
        else if (el.getAttribute('data-perm-off')) { el.removeAttribute('disabled'); el.removeAttribute('aria-disabled'); el.removeAttribute('title'); el.removeAttribute('data-perm-off'); }
      } else el.hidden = !ok;
    });
  };

  /* ---------- audit helper (used by settings/staff/roles etc.) ---------- */
  A.audit = {
    log: function (action, entity, before, after, extra) {
      var list = A.store.get('admin.audit', []);
      list.unshift({ id: 'u' + Date.now(), ts: Date.now(), actor: 'You (' + A.role().name + ')', action: action, entity: entity || '', before: before == null ? null : before, after: after == null ? null : after, ip: '103.145.22.18', extra: extra || '' });
      A.store.set('admin.audit', list.slice(0, 60));
    }
  };

  /* ---------- nav ---------- */
  var NAV = [
    ['Overview', [['dashboard', 'Dashboard', 'index.html', 'dashboard.view']]],
    ['Sales', [['orders', 'Orders', 'orders.html', 'orders.view'], ['returns', 'Returns & refunds', 'returns.html', 'returns.view'], ['tickets', 'Support tickets', 'tickets.html', 'tickets.view']]],
    ['Catalog', [['products', 'Products', 'products.html', 'products.view'], ['categories', 'Categories & attributes', 'categories.html', 'categories.manage'], ['inventory', 'Inventory', 'inventory.html', 'inventory.view'], ['reviews', 'Reviews & Q&A', 'reviews.html', 'reviews.manage']]],
    ['Marketing', [['coupons', 'Coupons & discounts', 'coupons.html', 'promos.manage', 'coupons'], ['flash', 'Flash sales', 'flash-sales.html', 'promos.manage'], ['events', 'Event pages', 'events.html', 'promos.manage', 'event'], ['homefeed', 'Home & feed', 'home-feed.html', 'cms.manage', 'home'], ['loyalty', 'Loyalty, referral & wallet', 'loyalty.html', 'loyalty.manage'], ['affiliates', 'Affiliates', 'affiliates.html', 'affiliates.manage', 'affiliate'], ['campaigns', 'Notifications & campaigns', 'campaigns.html', 'campaigns.manage', 'campaign']]],
    ['People & partners', [['customers', 'Customers', 'customers.html', 'customers.view'], ['suppliers', 'Suppliers & POs', 'suppliers.html', 'suppliers.manage'], ['sr-approvals', 'SR approvals', 'sr-approvals.html', 'sr.approve', 'check'], ['b2b-shops', 'B2B shops', 'b2b-shops.html', 'sr.manage', 'suppliers'], ['sr-team', 'SR team', 'sr-team.html', 'sr.manage', 'staff'], ['b2b-dues', 'B2B dues', 'b2b-dues.html', 'sr.manage', 'wallet'], ['delivery', 'Delivery & couriers', 'delivery.html', 'delivery.manage'], ['reports', 'Reports', 'reports.html', 'reports.view']]],
    ['System', [['staff', 'Staff', 'staff.html', 'staff.manage'], ['roles', 'Roles & permissions', 'roles.html', 'roles.manage'], ['settings', 'Settings', 'settings.html', 'settings.manage'], ['audit', 'Audit log', 'audit.html', 'audit.view']]]
  ];
  A.nav = NAV;
  function navHtml(active) {
    return NAV.map(function (g) {
      var allPerms = g[1].map(function (i) { return i[3]; });
      return '<div class="a-nav-g" data-groupperms="' + allPerms.join(',') + '"><div class="a-nav-h">' + g[0] + '</div>' + g[1].map(function (i) {
        var icon = A.icons[i[4] || i[0]] || A.icons.dashboard;
        return '<a class="a-nav-i' + (i[0] === active ? ' active' : '') + '" href="' + i[2] + '" data-perm="' + i[3] + '"' + (i[0] === active ? ' aria-current="page"' : '') + '>' + icon + '<span>' + i[1] + '</span></a>';
      }).join('') + '</div>';
    }).join('');
  }

  /* ---------- fake search / notifications ---------- */
  var SEARCH = [
    ['Order', '#BD-10482', 'Rahim Uddin · ৳12,450 · Processing', 'order.html?id=BD-10482'], ['Order', '#BD-10481', 'Nusrat Jahan · ৳3,290 · Shipped', 'order.html?id=BD-10481'],
    ['Order', '#BD-10470', 'Tanvir Hasan · ৳1,25,000 · On hold', 'order.html?id=BD-10470'], ['Product', 'Wireless Earbuds Pro X2', 'SKU EB-X2-BLK · 48 in stock', 'product-edit.html?id=1'],
    ['Product', 'Cotton Panjabi — Navy', 'SKU PJ-NV-M · 12 in stock', 'product-edit.html?id=2'], ['Product', 'Non-stick Fry Pan 28cm', 'SKU KT-FP-28 · 5 in stock', 'product-edit.html?id=3'],
    ['Customer', 'Rahim Uddin', '01711-223344 · 14 orders', 'customer.html?id=1'], ['Customer', 'Nusrat Jahan', '01819-556677 · 6 orders', 'customer.html?id=2'], ['Customer', 'Tanvir Hasan', '01933-889900 · 2 orders · risky', 'customer.html?id=3']
  ];
  var NOTIFS = [
    ['warn', 'Order #BD-10470 flagged: same phone, 3 orders in 1 h', 24, 'order.html?id=BD-10470'], ['danger', 'Refund ৳18,500 awaiting approval', 52, 'returns.html'],
    ['info', 'New support ticket from Nusrat Jahan', 95, 'tickets.html'], ['warn', 'Low stock: Wireless Earbuds Pro X2 (4 left)', 180, 'inventory.html'], ['info', 'PO-2031 confirmed by Dhaka Gadgets Ltd', 360, 'suppliers.html']
  ];

  /* ---------- theme ---------- */
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function setTheme(t) {
    try { localStorage.setItem('shop.theme', t); } catch (e) { /* ignore */ }
    document.documentElement.setAttribute('data-theme', t); document.documentElement.style.colorScheme = t;
    A.emit('theme', t);
  }
  A.setTheme = setTheme;

  /* ---------- overlays: modal / drawer / toast ---------- */
  var lastFocus = null;
  function layer(kind, html, o) {
    o = o || {};
    A.modal.close(true); A.drawer.close(true);
    lastFocus = document.activeElement;
    var wrap = document.createElement('div');
    wrap.className = 'a-layer a-layer-' + kind; wrap.setAttribute('data-layer', kind);
    var w = o.width || (o.size === 'sm' ? 400 : o.size === 'lg' ? 860 : 600);
    var panel = '<div class="a-' + kind + '" role="dialog" aria-modal="true" aria-label="' + A.esc(o.title || '') + '" style="--w:' + (typeof w === 'number' ? w + 'px' : w) + '" tabindex="-1">' +
      '<div class="a-' + kind + '-h"><h2>' + A.esc(o.title || '') + '</h2><button class="a-btn ghost icon sm" data-layer-close aria-label="Close">' + A.icons.x + '</button></div>' +
      '<div class="a-' + kind + '-b">' + html + '</div></div>';
    wrap.innerHTML = '<div class="a-scrim" data-layer-close></div>' + panel;
    wrap._onClose = o.onClose;
    document.body.appendChild(wrap);
    document.body.classList.add('a-noscroll');
    requestAnimationFrame(function () { wrap.classList.add('in'); });
    var p = wrap.querySelector('.a-' + kind);
    var f = p.querySelector('[autofocus],input:not([type=hidden]),select,textarea'); (f || p).focus();
    A.applyPerms(wrap);
    return p.querySelector('.a-' + kind + '-b');
  }
  function closeLayer(kind, quiet) {
    var w = A.$('.a-layer-' + kind); if (!w) return;
    w.remove();
    if (!A.$('.a-layer')) document.body.classList.remove('a-noscroll');
    if (w._onClose && !quiet) { try { w._onClose(); } catch (e) { console.error(e); } }
    if (!quiet && lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }
  A.modal = { open: function (h, o) { return layer('modal', h, o); }, close: function (q) { closeLayer('modal', q === true); } };
  A.drawer = { open: function (h, o) { return layer('drawer', h, o); }, close: function (q) { closeLayer('drawer', q === true); } };
  A.confirm = function (msg, okLabel, fn, danger) {
    var b = A.modal.open('<p>' + msg + '</p><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn ' + (danger ? 'danger' : 'primary') + '" data-ok>' + A.esc(okLabel || 'Confirm') + '</button></div>', { title: 'Please confirm', size: 'sm' });
    A.$('[data-ok]', b).onclick = function () { A.modal.close(); if (fn) fn(); };
  };
  A.toast = function (msg, type) {
    var host = A.$('#a-toasts');
    if (!host) { host = document.createElement('div'); host.id = 'a-toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    var t = document.createElement('div'); type = type || 'ok';
    t.className = 'a-toast ' + type;
    t.innerHTML = (type === 'danger' || type === 'warn' ? A.icons.warn : type === 'info' ? A.icons.info : A.icons.check) + '<span>' + A.esc(msg) + '</span>';
    host.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('in'); });
    setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 250); }, 3200);
  };
  A.tabs = function (root, fn) {
    var bar = typeof root === 'string' ? A.$(root) : root;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.a-tab'); if (!b || !bar.contains(b)) return;
      A.$$('.a-tab', bar).forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      if (fn) fn(b.getAttribute('data-tab') || b.textContent.trim(), b);
    });
  };

  /* ---------- charts (inline SVG strings) ---------- */
  var COL = ['var(--a-c1)', 'var(--a-c2)', 'var(--a-c3)', 'var(--a-c4)', 'var(--a-c5)', 'var(--a-c6)'];
  A.chart = { colors: COL, short: null };
  function nice(max) { var p = Math.pow(10, Math.floor(Math.log10(max || 1))), m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  function short(n) { return n >= 1e7 ? +(n / 1e7).toFixed(1) + 'Cr' : n >= 1e5 ? +(n / 1e5).toFixed(1) + 'L' : n >= 1e3 ? +(n / 1e3).toFixed(1) + 'k' : String(Math.round(n * 10) / 10); }
  A.chart.short = short;
  A.chart.line = function (pts, o) {
    o = o || {}; var w = o.w || 640, h = o.h || 220, L = o.axis === false ? 8 : 46, R = 12, T = 12, B = o.labels ? 24 : 8;
    var ys = pts.map(function (p) { return typeof p === 'object' ? p.y : p; });
    var cmp = o.compare || [];
    var max = nice(Math.max.apply(null, ys.concat(cmp, [1])) * 1.05), n = ys.length;
    var X = function (i) { return L + (n < 2 ? 0 : i * (w - L - R) / (n - 1)); }, Y = function (v) { return T + (h - T - B) * (1 - v / max); };
    var col = o.color || COL[0], s = '<svg class="a-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + A.esc(o.label || 'Line chart') + '" preserveAspectRatio="xMidYMid meet">';
    for (var g = 0; g <= 4; g++) {
      var v = max * g / 4, y = Y(v);
      s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y + '" y2="' + y + '" class="a-grid"/>';
      if (o.axis !== false) s += '<text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="a-axis">' + (o.axisFmt ? o.axisFmt(v) : o.fmt ? o.fmt(v) : short(v)) + '</text>';
    }
    if (o.labels) { var step = Math.max(1, Math.ceil(n / 7)); for (var i = 0; i < n; i += step) { var lb = o.labels[i]; if (lb != null) s += '<text x="' + X(i) + '" y="' + (h - 6) + '" text-anchor="middle" class="a-axis">' + A.esc(lb) + '</text>'; } }
    var path = function (arr) { return arr.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(''); };
    if (cmp.length) s += '<path d="' + path(cmp) + '" fill="none" style="stroke:var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>';
    if (o.area !== false) s += '<path d="' + path(ys) + 'L' + X(n - 1).toFixed(1) + ' ' + Y(0) + 'L' + X(0).toFixed(1) + ' ' + Y(0) + 'Z" style="fill:' + col + '" opacity=".13"/>';
    s += '<path d="' + path(ys) + '" fill="none" style="stroke:' + col + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';
    ys.forEach(function (v, i) { s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (n > 40 ? 3 : 4) + '" class="a-dot" style="--c:' + col + '"><title>' + A.esc((o.labels && o.labels[i] != null ? o.labels[i] + ': ' : '') + (o.fmt ? o.fmt(v) : A.fmt.num(v))) + '</title></circle>'; });
    return s + '</svg>';
  };
  A.chart.bars = function (items, o) {
    o = o || {}; var w = o.w || 480, vert = o.vertical || o.horizontal === false, fm = o.fmt || function (v) { return A.fmt.num(v); };
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    var s;
    if (!vert) {
      var rh = o.rowH || 30, LW = o.labelW || 120, RW = 70, h = o.h || items.length * rh + 4;
      s = '<svg class="a-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + A.esc(o.label || 'Bar chart') + '">';
      items.forEach(function (it, i) {
        var y = i * rh + 2, bw = Math.max(2, (w - LW - RW) * it.value / max), c = it.color || o.color || COL[i % COL.length];
        s += '<text x="0" y="' + (y + rh / 2 + 4) + '" class="a-axis a-lbl">' + A.esc(it.label) + '</text><rect x="' + LW + '" y="' + (y + 5) + '" width="' + (w - LW - RW) + '" height="' + (rh - 10) + '" rx="3" class="a-track"/>' +
          '<rect x="' + LW + '" y="' + (y + 5) + '" width="' + bw.toFixed(1) + '" height="' + (rh - 10) + '" rx="3" style="fill:' + c + '"><title>' + A.esc(it.label + ': ' + fm(it.value)) + '</title></rect>' +
          '<text x="' + w + '" y="' + (y + rh / 2 + 4) + '" text-anchor="end" class="a-axis a-val">' + A.esc(it.text || fm(it.value)) + '</text>';
      });
    } else {
      var h2 = o.h || 200, n = items.length, L = 8, B = 24, T = 14, bw2 = (w - L * 2) / n;
      s = '<svg class="a-chart" viewBox="0 0 ' + w + ' ' + h2 + '" role="img" aria-label="' + A.esc(o.label || 'Bar chart') + '">';
      s += '<line x1="0" x2="' + w + '" y1="' + (h2 - B) + '" y2="' + (h2 - B) + '" class="a-grid"/>';
      items.forEach(function (it, i) {
        var bh = (h2 - B - T) * it.value / max, x = L + i * bw2 + bw2 * .18, c = it.color || o.color || COL[0];
        s += '<rect x="' + x.toFixed(1) + '" y="' + (h2 - B - bh).toFixed(1) + '" width="' + (bw2 * .64).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="2" style="fill:' + c + '"><title>' + A.esc(it.label + ': ' + fm(it.value)) + '</title></rect><text x="' + (x + bw2 * .32).toFixed(1) + '" y="' + (h2 - 8) + '" text-anchor="middle" class="a-axis">' + A.esc(it.label) + '</text>';
      });
    }
    return s + '</svg>';
  };
  A.chart.donut = function (items, o) {
    o = o || {}; var size = o.size || 160, th = o.thickness || 26, r = (size - th) / 2, c = size / 2, circ = 2 * Math.PI * r;
    var tot = items.reduce(function (a, b) { return a + b.value; }, 0) || 1, acc = 0;
    var s = '<svg class="a-donut-svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + A.esc(o.label || 'Donut chart') + '"><circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" class="a-track-s" stroke-width="' + th + '"/>';
    items.forEach(function (it, i) {
      var len = circ * it.value / tot, col = it.color || COL[i % COL.length];
      s += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" style="stroke:' + col + '" stroke-width="' + th + '" stroke-dasharray="' + Math.max(0, len - 1.5).toFixed(2) + ' ' + (circ - Math.max(0, len - 1.5)).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 ' + c + ' ' + c + ')"><title>' + A.esc(it.label + ': ' + A.fmt.num(it.value)) + '</title></circle>';
      acc += len;
    });
    if (o.center) s += '<text x="' + c + '" y="' + (c - 2) + '" text-anchor="middle" class="a-dn-v">' + A.esc(o.center.value) + '</text><text x="' + c + '" y="' + (c + 15) + '" text-anchor="middle" class="a-axis">' + A.esc(o.center.label || '') + '</text>';
    s += '</svg>';
    if (o.legend === false) return s;
    return '<div class="a-donut">' + s + '<ul class="a-legend">' + items.map(function (it, i) { return '<li><i style="background:' + (it.color || COL[i % COL.length]) + '"></i><span>' + A.esc(it.label) + '</span><b>' + A.fmt.num(it.value) + '</b></li>'; }).join('') + '</ul></div>';
  };

  A.initRanges = function (root) { A.$$('.a-range input[type=range]', root || document).forEach(function (t) { t.dispatchEvent(new Event('input', { bubbles: true })); }); };

  /* ---------- renderPage ---------- */
  var lastCfg = null;
  function navFind(key) { var r = null; NAV.forEach(function (g) { g[1].forEach(function (i) { if (i[0] === key) r = i; }); }); return r; }
  A.renderPage = function (cfg) {
    lastCfg = cfg; cfg = cfg || {};
    var app = A.$('#app') || document.body, ni = navFind(cfg.active), role = A.role();
    var crumbs = (cfg.crumbs || []).map(function (c, i, a) { return (c[1] && i < a.length - 1) ? '<a href="' + c[1] + '">' + A.esc(c[0]) + '</a>' : '<span>' + A.esc(c[0]) + '</span>'; }).join('<i>/</i>');
    var denied = ni && !A.can(ni[3]);
    var body = denied
      ? '<div class="a-card"><div class="a-empty">' + A.icons.lock + '<h3>No access with the “' + A.esc(role.name) + '” role</h3><p>This page needs the <code>' + A.esc(ni[3]) + '</code> permission. Use “View as” in the top bar to switch role (demo).</p></div></div>'
      : (cfg.body || '');
    document.title = (cfg.title || 'Admin') + ' — ShopName Admin';
    app.innerHTML =
      '<div class="a-shell" id="a-shell"><aside class="a-side" id="a-side" aria-label="Main navigation"><nav>' + navHtml(cfg.active) + '</nav><div class="a-side-f">Demo build · mock data only</div></aside><div class="a-scrim-m" id="a-scrim-m"></div>' +
      '<div class="a-main"><header class="a-top">' +
      '<button class="a-btn ghost icon a-hb" id="a-hb" aria-label="Open menu">' + A.icons.menu + '</button>' +
      '<a class="a-logo" href="index.html"><span class="wm">Shop<b>Name</b></span><em>Admin</em></a>' +
      '<div class="a-gsearch"><span class="a-gs-i">' + A.icons.search + '</span><input id="a-gs" type="search" placeholder="Search orders, products, customers…" autocomplete="off" aria-label="Global search"><div class="a-gs-res" id="a-gs-res" hidden></div></div>' +
      '<div class="a-top-r">' +
      '<label class="a-viewas"><span>View as</span><select id="a-role" aria-label="View as role">' + A.roles.map(function (r) { return '<option value="' + r.id + '"' + (r.id === role.id ? ' selected' : '') + '>' + r.name + '</option>'; }).join('') + '</select></label>' +
      '<a class="a-btn ghost sm a-store" href="../home.html" target="_blank" rel="noopener">' + A.icons.store + '<span>View store</span></a>' +
      '<div class="a-dd" id="a-dd-bell"><button class="a-btn ghost icon" data-dd aria-label="Notifications" aria-haspopup="true">' + A.icons.bell + '<i class="a-dot-n">' + NOTIFS.length + '</i></button><div class="a-dd-menu a-notif"><div class="a-dd-h">Notifications <button class="a-link" id="a-markread">Mark all read</button></div>' +
      NOTIFS.map(function (n) { return '<a href="' + n[3] + '" class="a-n-i ' + n[0] + '">' + A.icons.warn + '<span>' + A.esc(n[1]) + '<small>' + A.fmt.ago(Date.now() - n[2] * 60000) + '</small></span></a>'; }).join('') + '</div></div>' +
      '<button class="a-btn ghost icon" id="a-theme" aria-label="Toggle dark mode">' + (isDark() ? A.icons.sun : A.icons.moon) + '</button>' +
      '<div class="a-dd" id="a-dd-user"><button class="a-btn ghost a-usr" data-dd aria-haspopup="true"><span class="a-avatar sm">SA</span><span class="a-usr-n">Sadia Akter<small>' + A.esc(role.name) + '</small></span></button><div class="a-dd-menu">' +
      '<a href="staff.html">' + A.icons.user + 'My profile</a><a href="#" data-act="2fa">' + A.icons.key + 'Two-factor auth</a><a href="login.html">' + A.icons.logout + 'Log out</a></div></div>' +
      '</div></header>' +
      '<main class="a-page" id="a-page"><div class="a-ph"><div class="a-ph-l">' + (crumbs ? '<div class="a-crumbs">' + crumbs + '</div>' : '') + '<h1>' + A.esc(cfg.title || '') + '</h1></div><div class="a-ph-r">' + (denied ? '' : (cfg.actions || '')) + '</div></div><div class="a-body" id="a-body">' + body + '</div></main></div></div>';
    var root = A.$('#a-body');
    A.applyPerms(app);
    A.$$('.a-nav-g', app).forEach(function (g) { var vis = A.$$('.a-nav-i', g).some(function (a) { return !a.hidden; }); g.hidden = !vis; });
    wireChrome(app);
    if (cfg.onReady && !denied) { try { cfg.onReady(root); } catch (e) { console.error(e); } }
    A.initRanges(root);
    A.applyPerms(root);
    return root;
  };

  function wireChrome(app) {
    var shell = A.$('#a-shell'); function side(o) { shell.classList.toggle('a-side-open', o); }
    A.$('#a-hb').onclick = function () { side(!shell.classList.contains('a-side-open')); };
    A.$('#a-scrim-m').onclick = function () { side(false); };
    A.$('#a-theme').onclick = function () { setTheme(isDark() ? 'light' : 'dark'); this.innerHTML = isDark() ? A.icons.sun : A.icons.moon; };
    A.$('#a-role').onchange = function () { A.store.set('admin.role', this.value); A.emit('role', this.value); A.toast('Now viewing as ' + A.role().name, 'info'); A.renderPage(lastCfg); };
    A.$$('[data-dd]', app).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var d = b.closest('.a-dd'), o = !d.classList.contains('open'); A.$$('.a-dd.open').forEach(function (x) { x.classList.remove('open'); }); d.classList.toggle('open', o); }; });
    var mr = A.$('#a-markread'); if (mr) mr.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var n = A.$('.a-dot-n'); if (n) n.remove(); A.$$('.a-n-i').forEach(function (x) { x.classList.add('read'); }); };
    var tf = A.$('[data-act="2fa"]', app); if (tf) tf.onclick = function (e) { e.preventDefault(); A.$$('.a-dd.open').forEach(function (x) { x.classList.remove('open'); }); A.modal.open('<p>Two-factor authentication is <span class="a-badge ok">enabled</span> (authenticator app). Last verified today.</p><div class="a-actions"><button class="a-btn" data-layer-close>Close</button><button class="a-btn danger" id="a-reset2fa">Reset my 2FA</button></div>', { title: 'Two-factor authentication', size: 'sm' }); var rb = A.$('#a-reset2fa'); if (rb) rb.onclick = function () { A.modal.close(); A.toast('2FA reset requested — re-enrol at next login', 'warn'); }; };
    var gs = A.$('#a-gs'), res = A.$('#a-gs-res');
    gs.oninput = function () {
      var q = gs.value.trim().toLowerCase(); if (!q) { res.hidden = true; return; }
      var m = SEARCH.filter(function (r) { return (r[1] + ' ' + r[2]).toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
      res.innerHTML = m.length ? m.map(function (r) { return '<a href="' + r[3] + '"><em>' + r[0] + '</em><span>' + A.esc(r[1]) + '<small>' + A.esc(r[2]) + '</small></span></a>'; }).join('') : '<div class="a-gs-none">No matches for “' + A.esc(q) + '”</div>';
      res.hidden = false;
    };
    gs.onfocus = gs.oninput;
    gs.onkeydown = function (e) { if (e.key === 'Escape') { res.hidden = true; gs.blur(); } };
    // sidebar scroll to active
    var act = A.$('.a-nav-i.active'); if (act && act.scrollIntoView) { try { act.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
  }

  /* ---------- global listeners (once) ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-layer-close]')) {
      var l = e.target.closest('.a-layer'); if (l) { closeLayer(l.getAttribute('data-layer')); return; }
    }
    if (!e.target.closest('.a-dd')) A.$$('.a-dd.open').forEach(function (x) { x.classList.remove('open'); });
    if (!e.target.closest('.a-gsearch')) { var r = A.$('#a-gs-res'); if (r) r.hidden = true; }
    var sh = A.$('#a-shell'); if (sh && e.target.closest('.a-nav-i')) sh.classList.remove('a-side-open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (A.$('.a-layer')) { var l = A.$$('.a-layer').pop(); closeLayer(l.getAttribute('data-layer')); } A.$$('.a-dd.open').forEach(function (x) { x.classList.remove('open'); }); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (t.type === 'range') { var w = t.closest('.a-range'); if (w) { var o = w.querySelector('output,.a-range-v'); if (o) o.textContent = t.value + (t.getAttribute('data-unit') || ''); } }
  });
  document.addEventListener('DOMContentLoaded', function () { A.$$('.a-range input[type=range]').forEach(function (t) { t.dispatchEvent(new Event('input', { bubbles: true })); }); });
})();
