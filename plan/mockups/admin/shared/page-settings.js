(function () {
  'use strict';
  var A = Admin, DEF = {
    store_name: 'ShopName', store_email: 'hello@shopname.com', store_phone: '09612-345678', store_address: 'House 12, Road 5, Dhanmondi, Dhaka 1205', bin: '001234567-0101', vat_rate: '15',
    online_payments_enabled: false, advance_payments_enabled: false, preorders_enabled: false, payment_timeout: '30',
    bkash_on: true, bkash_merchant: '01711000111', nagad_on: true, nagad_merchant: '01811000222', ssl_on: false, ssl_store_id: 'shopname001live',
    adv_high_threshold: '50000', adv_high_pct: '30', adv_risky_pct: '50',
    guest_otp_threshold: '3000', refund_threshold: '15000', return_window: '7', vel_phone: '3', vel_device: '4', vel_ip: '6', vel_action: 'hold',
    sms_provider: 'ssl', sms_sender: 'SHOPNAME', email_provider: 'ses', email_from: 'orders@shopname.com',
    session_timeout: '30', require_2fa: true, new_device_alerts: true,
    maintenance: false, maintenance_msg: 'We are updating the shop. Back in 30 minutes.', announce_on: true, announce_text: 'Free delivery in Dhaka over ৳1,500 · Cash on delivery everywhere', cookie_text: 'We use cookies to keep your cart and understand how the shop is used. You can accept or decline analytics cookies.'
  };
  var saved = Object.assign({}, DEF, A.store.get('admin.settings', {})), TABS = [['store', 'Store'], ['payments', 'Payments & features'], ['advance', 'Advance payment'], ['orders', 'Orders'], ['notifications', 'Notifications'], ['security', 'Security'], ['storefront', 'Store front']];
  var TPL = [['order_placed', 'Order placed', 'SMS + email + inbox'], ['order_shipped', 'Order shipped (with tracking)', 'SMS + email + push'], ['order_delivered', 'Order delivered', 'SMS + inbox'], ['otp_login', 'Login / guest-COD OTP', 'SMS'], ['refund_done', 'Refund processed', 'SMS + email'], ['cart_reminder', 'Abandoned cart reminder', 'Push + email']];
  function v(k) { return saved[k]; }
  function f(label, name, o) {
    o = o || {}; var val = v(name);
    var inp = o.type === 'select' ? '<select name="' + name + '">' + o.opts.map(function (x) { return '<option value="' + x[0] + '"' + (String(val) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'
      : o.type === 'textarea' ? '<textarea name="' + name + '" rows="' + (o.rows || 3) + '">' + A.esc(val) + '</textarea>'
      : '<input name="' + name + '" value="' + A.esc(val) + '"' + (o.mask ? ' type="password" autocomplete="off"' : '') + (o.num ? ' inputmode="numeric"' : '') + (o.dis ? ' disabled' : '') + '>';
    if (o.pre) inp = '<div class="a-input-grp"><span>' + o.pre + '</span>' + inp + '</div>'; if (o.post) inp = '<div class="a-input-grp">' + inp + '<span>' + o.post + '</span></div>';
    return '<div class="a-field"' + (o.perm ? ' data-perm="' + o.perm + '" data-perm-mode="disable"' : '') + '><label>' + label + '</label>' + inp + (o.hint ? '<div class="a-hint">' + o.hint + '</div>' : '') + '</div>';
  }
  function sw(label, name, hint, perm) {
    return '<div class="set-row"><div class="t"><b>' + label + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</div><label class="a-switch"' + (perm ? '' : '') + '><input type="checkbox" name="' + name + '"' + (v(name) ? ' checked' : '') + (perm ? ' data-perm="' + perm + '" data-perm-mode="disable"' : '') + '></label></div>';
  }
  function card(title, inner) { return '<div class="a-card set-sec"><div class="a-card-h"><h2>' + title + '</h2></div><div class="a-card-b">' + inner + '</div></div>'; }
  function gw(id, name, color, fields) {
    return '<div class="gw-card" id="gw-' + id + '"><h4><span class="gw-logo" style="background:' + color + '">' + name.slice(0, 2).toUpperCase() + '</span>' + name + '<span class="a-sp"></span><label class="a-switch"><input type="checkbox" name="' + id + '_on"' + (v(id + '_on') ? ' checked' : '') + '></label></h4>' + fields +
      '<div class="a-field"><label>API secret</label><div class="a-row"><span class="masked" data-sec>••••••••••••••••</span><button type="button" class="a-btn sm" data-replace>Replace</button><button type="button" class="a-btn sm" data-test>Test connection</button></div></div></div>';
  }
  var pane = {
    store: function () {
      return card('Store profile', '<div class="a-row" style="align-items:flex-start;margin-bottom:12px"><div class="logo-prev">S<span style="font-size:14px">N</span></div><div style="flex:1;min-width:200px"><div class="a-dropzone" id="logodz">' + A.icons.upload + 'Drop a logo (SVG/PNG, 512×512) or click to browse</div></div></div>' +
        '<div class="a-form-grid">' + f('Store name', 'store_name') + f('Contact email', 'store_email') + f('Contact phone', 'store_phone') + f('BIN (Business Identification No.)', 'bin', { hint: 'Printed on every invoice.' }) + '</div>' + f('Address', 'store_address', { type: 'textarea', rows: 2 })) +
        card('VAT', '<div class="a-form-grid">' + f('VAT rate', 'vat_rate', { num: true, post: '%' }) + '<div class="a-field"><label>Example</label><div id="vatex" class="a-kv" style="padding-top:6px"></div></div></div><div class="a-banner info" style="margin:0">' + A.icons.info + '<div class="a-sm"><b>VAT-inclusive pricing.</b> One store-wide rate. Customers see one price; the invoice shows the VAT portion = price × rate ÷ (100 + rate) and your BIN.</div></div>');
    },
    payments: function () {
      return '<div class="a-banner" id="launchban">' + A.icons.truck + '<div><b>Launch mode: COD only.</b> <span class="a-muted a-sm">Online payments, advance payment and pre-orders are off until you switch them on. Customers only see Cash on Delivery.</span></div></div>' +
        card('Feature flags', sw('Online payments', 'online_payments_enabled', 'bKash, Nagad and card/bank via SSLCommerz at checkout. Key: <code>online_payments_enabled</code>', 'settings.payments') +
          sw('Advance payment', 'advance_payments_enabled', 'COD orders pay delivery fee (and extra %) in advance. Needs online payments. Key: <code>advance_payments_enabled</code>', 'settings.payments') +
          sw('Pre-orders', 'preorders_enabled', 'Allows products with an expected date and advance %. Key: <code>preorders_enabled</code>', 'settings.payments')) +
        card('Gateways', '<p class="a-muted a-sm" id="gwnote" style="margin-bottom:10px"></p><div class="a-grid-3">' +
          gw('bkash', 'bKash', '#e2136e', f('Merchant number', 'bkash_merchant')) + gw('nagad', 'Nagad', '#f6921e', f('Merchant number', 'nagad_merchant')) + gw('ssl', 'SSLCommerz', '#1d6ee1', f('Store ID', 'ssl_store_id')) + '</div>') +
        card('Checkout rules', '<div class="a-form-grid">' + f('Payment timeout', 'payment_timeout', { num: true, post: 'min', hint: 'Unpaid online orders are cancelled and stock released after this.' }) + '<div class="a-field"><label>Method discounts</label><div class="a-hint">E.g. “5% off with bKash” is a payment-method coupon.</div><a class="a-btn sm" style="align-self:flex-start;margin-top:4px" href="coupons.html">Manage in Coupons ' + A.icons.chevron + '</a></div></div>');
    },
    advance: function () {
      return '<div class="a-banner" id="advban" hidden>' + A.icons.warn + '<div class="a-sm"><b>Advance payment is currently OFF</b> (feature flag). These values are saved but not applied at checkout.</div></div>' +
        card('When is advance payment required?', '<div class="a-muted a-sm" style="margin-bottom:12px">COD orders with a delivery fee always pay <b>the delivery fee</b> in advance. A percentage of the order is added on top if any trigger below matches.</div>' +
          '<div class="a-form-grid">' + f('High-price item: single item price above', 'adv_high_threshold', { num: true, pre: '৳' }) + f('…then advance %', 'adv_high_pct', { num: true, post: '%' }) + f('Risky customer: advance %', 'adv_risky_pct', { num: true, post: '%', hint: 'Applies to customers flagged risky in Customers.' }) +
          '<div class="a-field"><label>Product advance %</label><div class="a-hint">Set per product in the product editor (also used for dropship and pre-order items). Not configured here.</div></div></div>' +
          '<div class="a-banner info" style="margin:0">' + A.icons.info + '<div class="a-sm"><b>Several triggers → %s are added together</b>, capped at 100% (Q111). Example: risky customer (50%) buying a ৳60,000 item (30%) pays 80% + delivery fee.</div></div>');
    },
    orders: function () {
      return card('Order rules', '<div class="a-form-grid">' + f('Guest COD OTP required above', 'guest_otp_threshold', { num: true, pre: '৳', hint: 'Guests ordering COD above this must verify phone by OTP.' }) + f('Refund needs approval above', 'refund_threshold', { num: true, pre: '৳', hint: 'Approver needs <code>refund.approve_high</code>.' }) + f('Default return window', 'return_window', { num: true, post: 'days', hint: 'Categories/products can override.' }) + '</div>') +
        card('Velocity rule (fraud v1)', '<div class="a-muted a-sm" style="margin-bottom:10px">Flag when the same phone, device or IP places too many orders within one hour.</div><div class="a-form-grid">' + f('Same phone: orders / hour', 'vel_phone', { num: true }) + f('Same device: orders / hour', 'vel_device', { num: true }) + f('Same IP: orders / hour', 'vel_ip', { num: true }) +
          f('When triggered', 'vel_action', { type: 'select', opts: [['hold', 'Put order On hold for review'], ['flag', 'Flag only, keep Processing'], ['block', 'Block order']] }) + '</div>');
    },
    notifications: function () {
      return card('SMS provider', '<div class="a-form-grid">' + f('Provider', 'sms_provider', { type: 'select', opts: [['ssl', 'SSL Wireless'], ['bulksms', 'BulkSMSBD'], ['greenweb', 'Greenweb'], ['twilio', 'Twilio']], hint: 'Swappable — templates and sender stay the same.' }) + f('Sender ID', 'sms_sender') + '</div>' +
        '<div class="a-field"><label>API key</label><div class="a-row"><span class="masked" data-sec>sk_live_••••••••••••a91f</span><button type="button" class="a-btn sm" data-replace>Replace</button><button type="button" class="a-btn sm" data-test>Send test SMS</button></div></div>') +
        card('Email provider', '<div class="a-form-grid">' + f('Provider', 'email_provider', { type: 'select', opts: [['ses', 'Amazon SES'], ['smtp', 'Custom SMTP'], ['mailgun', 'Mailgun'], ['sendgrid', 'SendGrid']] }) + f('From address', 'email_from') + '</div>' +
        '<div class="a-field"><label>API key / SMTP password</label><div class="a-row"><span class="masked" data-sec>••••••••••••••••••••</span><button type="button" class="a-btn sm" data-replace>Replace</button><button type="button" class="a-btn sm" data-test>Send test email</button></div></div>') +
        card('Templates', '<ul class="tpl-list">' + TPL.map(function (t) { return '<li><div class="n"><b>' + t[1] + '</b><small>' + t[0] + '</small></div><span class="a-badge info">' + t[2] + '</span><button type="button" class="a-btn sm" data-tpl="' + t[0] + '">' + A.icons.edit + 'Edit</button></li>'; }).join('') + '</ul>');
    },
    security: function () {
      return card('Staff security', f('Staff session timeout', 'session_timeout', { type: 'select', opts: [['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours']], hint: 'Idle staff are signed out and see the “session expired” screen.' }) +
        sw('Require two-factor authentication', 'require_2fa', 'Authenticator-app code at every login for all staff.') + sw('New-device login alerts', 'new_device_alerts', 'Notify Owner and managers when someone signs in from an unknown device.')) +
        '<div class="a-banner info">' + A.icons.lock + '<div class="a-sm">Review sign-ins in <a href="staff.html">Staff</a> and every sensitive change in the <a href="audit.html">Audit log</a>.</div></div>';
    },
    storefront: function () {
      return card('Maintenance mode', sw('Take the storefront offline', 'maintenance', 'Visitors see the message below; staff can still use the admin and preview the shop.') + f('Maintenance message', 'maintenance_msg', { type: 'textarea', rows: 2 })) +
        card('Announcement bar', sw('Show announcement bar', 'announce_on', 'Appears above the header on every storefront page.') + f('Text', 'announce_text') + '<div class="ann-prev" id="annprev"></div>') +
        card('Cookie notice', f('Notice text', 'cookie_text', { type: 'textarea', rows: 3 }));
    }
  };
  function collect(root) {
    var o = {};
    A.$$('[name]', root).forEach(function (el) { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return o;
  }
  function dirtyKeys(root) { var c = collect(root); return Object.keys(c).filter(function (k) { return String(c[k]) !== String(saved[k]); }); }
  var activeTab = (location.hash || '#store').slice(1);
  if (!pane[activeTab]) activeTab = 'store';
  function sync(root) {
    var on = A.$('[name=online_payments_enabled]', root).checked, adv = A.$('[name=advance_payments_enabled]', root).checked, pre = A.$('[name=preorders_enabled]', root).checked;
    var ban = A.$('#launchban', root);
    ban.hidden = on && adv && pre;
    ban.querySelector('b').textContent = on ? 'Online payments are LIVE.' : 'Launch mode: COD only.';
    ban.querySelector('span').textContent = on ? 'Customers can pay with bKash / Nagad / card at checkout.' + (adv ? ' Advance payment is on.' : '') : 'Online payments, advance payment and pre-orders are off until you switch them on. Customers only see Cash on Delivery.';
    A.$$('.gw-card', root).forEach(function (g) { g.classList.toggle('off', !on); A.$$('input,button', g).forEach(function (x) { x.disabled = !on; }); });
    A.$('#gwnote', root).textContent = on ? 'Enable the gateways you have merchant accounts for. Secrets are write-only.' : 'Gateways are disabled while the “Online payments” flag is off. Switch it on above to configure them.';
    A.$('#advban', root).hidden = adv;
    var vr = parseFloat(A.$('[name=vat_rate]', root).value) || 0, ex = 1150, vat = ex * vr / (100 + vr);
    A.$('#vatex', root).innerHTML = '<dt>Price</dt><dd>' + A.fmt.bdt(ex) + '</dd><dt>VAT portion</dt><dd>' + A.fmt.bdt(vat, 2) + '</dd><dt>Excl. VAT</dt><dd>' + A.fmt.bdt(ex - vat, 2) + '</dd>';
    A.$('#annprev', root).textContent = A.$('[name=announce_text]', root).value || '(empty)'; A.$('#annprev', root).hidden = !A.$('[name=announce_on]', root).checked;
    var d = dirtyKeys(root).length; A.$('#dirty', root).textContent = d ? d + ' unsaved change' + (d > 1 ? 's' : '') : 'All changes saved';
    A.$('#savebtn', root).disabled = !d;
  }
  A.renderPage({ active: 'settings', title: 'Settings', crumbs: [['Admin', 'index.html'], ['System'], ['Settings']],
    body: '<div class="a-tabs" id="stabs" role="tablist">' + TABS.map(function (t) { return '<button class="a-tab" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === activeTab) + '">' + t[1] + '</button>'; }).join('') + '</div><form id="sform" novalidate>' +
      TABS.map(function (t) { return '<section data-pane="' + t[0] + '"' + (t[0] === activeTab ? '' : ' hidden') + '>' + pane[t[0]]() + '</section>'; }).join('') +
      '<div class="set-save"><span class="a-muted" id="dirty">All changes saved</span><span class="a-row"><button type="button" class="a-btn" id="discard">Discard</button><button class="a-btn primary" id="savebtn" disabled>Save settings</button></span></div></form>',
    onReady: function (root) {
      var form = A.$('#sform');
      A.tabs('#stabs', function (k) { A.$$('[data-pane]', form).forEach(function (p) { p.hidden = p.dataset.pane !== k; }); try { history.replaceState(null, '', '#' + k); } catch (e) { /* file:// */ } });
      form.addEventListener('input', function () { sync(form); }); form.addEventListener('change', function (e) {
        var t = e.target;
        if (t.checked && /^(online_payments_enabled|advance_payments_enabled|preorders_enabled)$/.test(t.name)) {
          var nm = t.name; t.checked = false; sync(form);
          A.confirm('Turn <b>' + nm + '</b> ON? This changes live checkout for all customers immediately' + (nm === 'advance_payments_enabled' && !A.$('[name=online_payments_enabled]', form).checked ? ', and advance payment also needs online payments' : '') + '.', 'Turn on', function () { t.checked = true; sync(form); });
        }
        sync(form);
      });
      form.onsubmit = function (e) {
        e.preventDefault(); var c = collect(form), keys = dirtyKeys(form);
        if (!keys.length) return;
        var rate = parseFloat(c.vat_rate); if (isNaN(rate) || rate < 0 || rate > 100) { A.toast('VAT rate must be between 0 and 100', 'danger'); return; }
        var b = {}, a = {}; keys.forEach(function (k) { b[k] = saved[k]; a[k] = c[k]; });
        saved = Object.assign({}, saved, c); A.store.set('admin.settings', saved);
        A.audit.log('settings.update', 'settings:' + (TABS.filter(function (t) { return t[0] === (A.$('#stabs [aria-selected=true]').dataset.tab); })[0] || [0, 'all'])[1], b, a);
        A.toast('Settings saved · audit entry added'); sync(form);
      };
      A.$('#discard').onclick = function () { A.$$('[name]', form).forEach(function (el) { if (el.type === 'checkbox') el.checked = !!saved[el.name]; else el.value = saved[el.name]; }); sync(form); A.toast('Changes discarded', 'info'); };
      form.addEventListener('click', function (e) {
        var t = e.target.closest('button,.a-dropzone'); if (!t) return;
        if (t.id === 'logodz' || t.classList.contains('a-dropzone')) A.toast('Logo uploaded (demo)', 'info');
        else if (t.hasAttribute('data-replace')) { var s = t.parentNode.querySelector('[data-sec]'); s.innerHTML = '<input type="password" placeholder="Paste new secret" style="height:28px;padding:0 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text)">'; t.remove(); }
        else if (t.hasAttribute('data-test')) A.toast('Test sent — connection OK (demo)', 'ok');
        else if (t.dataset.tpl) { var tp = TPL.filter(function (x) { return x[0] === t.dataset.tpl; })[0]; A.modal.open('<div class="a-field"><label>Message (English)</label><textarea rows="4">Hi {customer_name}, your order #{order_no} is confirmed. Total {total}. Track: {track_url}</textarea></div><div class="a-field"><label>Message (বাংলা)</label><textarea rows="4">প্রিয় {customer_name}, আপনার অর্ডার #{order_no} নিশ্চিত হয়েছে। মোট {total}।</textarea><div class="a-hint">Variables: {customer_name} {order_no} {total} {track_url}</div></div><div class="a-actions"><button class="a-btn" data-layer-close>Cancel</button><button class="a-btn primary" data-layer-close id="tplsave">Save template</button></div>', { title: tp[1], size: 'md' }); A.$('#tplsave').addEventListener('click', function () { A.audit.log('settings.template_update', 'template:' + tp[0], null, { edited: true }); A.toast('Template saved'); }); }
      });
      sync(form);
    } });
})();
