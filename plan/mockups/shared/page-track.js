/* Order tracking: track.html (guest lookup: order no + phone) or track.html?o=<no>&p=<phone>. Logged-in users can open ?o=<no> directly.
   Demo orders: BD-100219 (split shipments), BD-100248 (placed, can cancel), BD-100174 (delivered), phone 01711000000. */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, X = Shop.X, XA = Shop.XA, T = Shop.T, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data;

  Shop.i18n({
    en: {
      tk_title: 'Track order', tk_h: 'Track your order', tk_s: 'Enter your order number and the phone number you used.', tk_no: 'Order number', tk_no_ph: 'e.g. BD-100219', tk_phone: 'Phone number', tk_phone_ph: '01XXXXXXXXX',
      tk_go: 'Track order', tk_err_no: 'Enter your order number (like BD-100219).', tk_err_nf: 'We could not find an order with these details. Check the number and phone.', tk_hint: 'Demo: try BD-100219 with 01711000000.',
      tk_login: 'Have an account? Log in to see all your orders.', tk_res: 'Order {no}', tk_items: 'Items', tk_addr: 'Delivery address', tk_total: 'Order total', tk_support: 'Need help with this order?', tk_ticket: 'Contact support',
      tk_split: 'This order ships in {n} parcels. One delivery charge only.', tk_back: 'Track another order', tk_my: 'My orders', tk_cancel_late: 'Packed orders cannot be cancelled.',
      tk_cod_note: 'Pay {amt} in cash to the courier. The full delivery charge is collected with the first parcel.'
    },
    bn: {
      tk_title: 'অর্ডার ট্র্যাক', tk_h: 'আপনার অর্ডার ট্র্যাক করুন', tk_s: 'অর্ডার নম্বর ও ব্যবহৃত ফোন নম্বর দিন।', tk_no: 'অর্ডার নম্বর', tk_no_ph: 'যেমন BD-100219', tk_phone: 'ফোন নম্বর', tk_phone_ph: '01XXXXXXXXX',
      tk_go: 'ট্র্যাক করুন', tk_err_no: 'অর্ডার নম্বর দিন (যেমন BD-100219)।', tk_err_nf: 'এই তথ্যে কোনো অর্ডার পাইনি। নম্বর ও ফোন দেখে নিন।', tk_hint: 'ডেমো: BD-100219 ও 01711000000 দিয়ে দেখুন।',
      tk_login: 'অ্যাকাউন্ট আছে? লগইন করে সব অর্ডার দেখুন।', tk_res: 'অর্ডার {no}', tk_items: 'আইটেম', tk_addr: 'ডেলিভারি ঠিকানা', tk_total: 'অর্ডার মোট', tk_support: 'এই অর্ডার নিয়ে সাহায্য লাগবে?', tk_ticket: 'সাপোর্টে যোগাযোগ',
      tk_split: 'এই অর্ডার {n}টি পার্সেলে যাবে। ডেলিভারি চার্জ একবারই।', tk_back: 'অন্য অর্ডার ট্র্যাক', tk_my: 'আমার অর্ডার', tk_cancel_late: 'প্যাক হয়ে গেলে অর্ডার বাতিল করা যায় না।',
      tk_cod_note: 'কুরিয়ারকে {amt} নগদ দিন। পুরো ডেলিভারি চার্জ প্রথম পার্সেলের সময় নেওয়া হয়।'
    }
  });

  function phoneOf(o) { return (o.contact && o.contact.phone) || (o.addr && o.addr.phone) || ''; }
  function same(a, b) { return String(a).replace(/\D/g, '').slice(-10) === String(b).replace(/\D/g, '').slice(-10); }

  function form(no, ph) {
    return '<form class="trk-f card-box" id="trkF" novalidate><h1 ' + X('tk_h') + '</h1><p class="muted" ' + X('tk_s') + '</p>' +
      Shop.field({ id: 'tkNo', label: 'tk_no', ph: 'tk_no_ph', val: no, ac: 'off' }) + Shop.field({ id: 'tkPh', label: 'tk_phone', ph: 'tk_phone_ph', val: ph, type: 'tel', im: 'tel', ac: 'tel', max: 14 }) +
      '<button class="btn btn-primary btn-block" type="submit">' + icon('search', 16) + ' <span ' + X('tk_go') + '</span></button><p class="muted note-s">' + icon('info', 14) + ' <span ' + X('tk_hint') + '</span></p>' +
      (Shop.user.get() ? '' : '<p class="note-s"><button class="btn-link" type="button" id="tkLogin" ' + X('tk_login') + '</button></p>') + '</form>';
  }

  function resultHTML(o) {
    var c = o.totals, ships = Shop.shipsOf(o), phone = phoneOf(o);
    var items = o.items.map(function (i) { return Shop.itemRow(i); }).join('');
    var acts = '';
    if (Shop.canCancel(o)) acts += '<button class="btn btn-ghost" type="button" id="tkCancel">' + icon('close', 16) + ' <span ' + X('cn_btn') + '</span></button>';
    else if (o.status === 'packed') acts += '<p class="muted note-s">' + icon('info', 14) + ' <span ' + X('tk_cancel_late') + '</span></p>';
    acts += '<button class="btn btn-ghost" type="button" id="tkInv">' + icon('pkg', 16) + ' <span ' + X('inv_btn') + '</span></button>';
    if (Shop.canReturn(o)) acts += '<a class="btn btn-primary" href="account.html#returns/' + esc(o.no) + '">' + icon('undo', 16) + ' <span ' + X('ret_btn') + '</span></a>';
    var a = o.addr, dist = D.districts[a.di] || D.districts[0];
    var pm = '<span ' + X('m_' + o.method) + '</span> · <b class="pay-st pay-' + o.payStatus + '" ' + X(Shop.payLabel(o)) + '</b>';
    return '<div class="trk-res"><header class="trk-h"><div><h1>' + T('tk_res', { no: esc(o.no) }) + '</h1><p class="muted"><span ' + X('ord_date') + '</span> ' + Shop.dateX(o.ts, true) + '</p></div>' + Shop.statusPill(o.status) + '</header>' +
      '<section class="card-box">' + Shop.orderTimeline(o) + (ships.length > 1 ? '<p class="note-s muted">' + icon('pkg', 14) + ' ' + T('tk_split', { n: ships.length }) + '</p>' : '') + '</section>' +
      '<div class="trk-grid"><div><section class="card-box"><h2 class="sec-h3" ' + X('sh_title') + '</h2>' + Shop.shipmentsHTML(o) + '</section></div>' +
      '<div class="trk-side"><section class="card-box"><h2 class="sec-h3" ' + X('pm_status') + '</h2><p>' + pm + '</p>' +
      (o.method === 'cod' && c.payDue > 0 && o.status !== 'cancelled' ? '<p class="muted note-s">' + T('tk_cod_note', { amt: fmt(c.payDue) }) + '</p>' : '') + '</section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('tk_addr') + '</h2><p><b>' + esc(a.name) + '</b> · ' + esc(a.phone) + '</p><p class="muted">' + esc(a.line) + ', ' + esc(a.area) + ', <span ' + Shop.LX(dist[0], dist[1]) + '</span></p></section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('tk_total') + '</h2>' + Shop.sumRows(c) + '</section>' +
      '<div class="trk-act">' + acts + '</div>' +
      '<p class="muted note-s"><span ' + X('tk_support') + '</span> <a class="link" href="account.html#tickets"><span ' + X('tk_ticket') + '</span>' + icon('chevR', 14) + '</a></p></div></div>' +
      '<p class="trk-back"><button class="btn-link" type="button" id="tkAgain" ' + X('tk_back') + '</button> <a class="link" href="account.html#orders" ' + X('tk_my') + '</a></p></div>';
  }

  var host;
  function show(o) {
    host.innerHTML = resultHTML(o); Shop.applyI18n(host);
    document.title = t('tk_res', { no: o.no }) + ' - ShopName';
    var c = $('#tkCancel', host); if (c) c.addEventListener('click', function () { Shop.cancelModal(o, function () { show(Shop.orders.get(o.no)); }); });
    $('#tkInv', host).addEventListener('click', function () { Shop.downloadInvoice(o); });
    $('#tkAgain', host).addEventListener('click', function () { history.replaceState(null, '', 'track.html'); showForm('', ''); });
  }
  function showForm(no, ph) {
    host.innerHTML = '<div class="trk-box">' + form(no, ph) + '</div>'; Shop.applyI18n(host); document.title = t('tk_title') + ' - ShopName';
    var f = $('#trkF', host);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var nv = $('#tkNo').value.trim().toUpperCase(), pv = $('#tkPh').value, bad = false;
      if (!/^BD-?\d{4,}$/.test(nv)) { Shop.fieldErr('tkNo', 'tk_err_no'); bad = true; } else { nv = nv.replace(/^BD-?/, 'BD-'); Shop.fieldErr('tkNo'); }
      if (!Shop.validPhone(pv.replace(/[\s-]/g, ''))) { Shop.fieldErr('tkPh', 'au_err_phone'); bad = true; } else Shop.fieldErr('tkPh');
      if (bad) return;
      var o = Shop.orders.get(nv);
      if (!o || !same(phoneOf(o), pv)) { Shop.fieldErr('tkNo', 'tk_err_nf'); return; }
      history.replaceState(null, '', 'track.html?o=' + o.no + '&p=' + pv); show(o);
    });
    var lg = $('#tkLogin', host); if (lg) lg.addEventListener('click', function () { Shop.auth.modal(function () { location.href = 'account.html#orders'; }); });
  }

  Shop.renderPage('<div class="wrap trk-pg"><div id="trkHost"></div></div>', {
    active: 'account',
    onReady: function () {
      host = $('#trkHost');
      var no = (Shop.qparam('o') || '').toUpperCase(), ph = Shop.qparam('p') || '', o = no ? Shop.orders.get(no) : null;
      if (o && (Shop.user.get() || same(phoneOf(o), ph))) show(o); else showForm(no, ph);
    }
  });
})();
