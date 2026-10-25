/* Order success page: order-success.html?o=<order no> (falls back to your latest order, then to a demo order) */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, X = Shop.X, T = Shop.T, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data;

  Shop.i18n({
    en: {
      os_title: 'Order confirmed', os_h: 'Thank you, {name}!', os_h_g: 'Thank you for your order!', os_s: 'Your order {no} is confirmed. We sent the details by SMS to {phone}.',
      os_pay_pending_s: 'Your order {no} is waiting for payment.', os_sum: 'Order summary', os_pay: 'Payment', os_addr: 'Delivering to', os_eta: 'Estimated delivery', os_method: 'Method',
      os_paid_now: 'Paid now {amt}', os_due: '{amt} to pay on delivery', os_next: 'What happens next', os_n1: 'Order placed', os_n1s: 'We received your order. No call needed.', os_n2: 'We pack your items',
      os_n2s: 'Usually within 1 working day.', os_n3: 'Handed to courier', os_n3s: 'Pathao or Steadfast. You get the tracking ID by SMS.', os_n4: 'Delivered to you', os_n4s_cod: 'Keep the cash ready for the courier.', os_n4s: 'Check the parcel before you accept.',
      os_split: 'Your order will arrive in {n} parcels. One delivery charge only.', os_track: 'Track order', os_continue: 'Continue shopping', os_acc: 'Create an account to track your orders',
      os_acc_s: 'Use {phone} to sign up. After you verify this number by SMS, this order and future ones appear in your account.', os_acc_btn: 'Create account with this phone', os_acc_ok: 'Account ready. This order is now linked to your account.',
      os_rec: 'You may also like', os_inv: 'Download invoice', os_copy: 'Copy order number', os_copied: 'Order number copied', os_not: 'Order not found'
    },
    bn: {
      os_title: 'অর্ডার নিশ্চিত', os_h: 'ধন্যবাদ, {name}!', os_h_g: 'অর্ডারের জন্য ধন্যবাদ!', os_s: 'আপনার অর্ডার {no} নিশ্চিত হয়েছে। বিস্তারিত {phone} নম্বরে এসএমএস করা হয়েছে।',
      os_pay_pending_s: 'আপনার অর্ডার {no} পেমেন্টের অপেক্ষায় আছে।', os_sum: 'অর্ডার সারসংক্ষেপ', os_pay: 'পেমেন্ট', os_addr: 'ডেলিভারি ঠিকানা', os_eta: 'আনুমানিক ডেলিভারি', os_method: 'পদ্ধতি',
      os_paid_now: 'এখন পরিশোধ {amt}', os_due: 'ডেলিভারিতে পরিশোধ {amt}', os_next: 'এরপর কী হবে', os_n1: 'অর্ডার হয়েছে', os_n1s: 'আপনার অর্ডার পেয়েছি। ফোন করতে হবে না।', os_n2: 'আমরা প্যাক করব',
      os_n2s: 'সাধারণত 1 কর্মদিবসের মধ্যে।', os_n3: 'কুরিয়ারে হস্তান্তর', os_n3s: 'পাঠাও বা স্টেডফাস্ট। ট্র্যাকিং আইডি এসএমএসে পাবেন।', os_n4: 'আপনার কাছে পৌঁছাবে', os_n4s_cod: 'কুরিয়ারের জন্য নগদ টাকা তৈরি রাখুন।', os_n4s: 'গ্রহণের আগে পার্সেল দেখে নিন।',
      os_split: 'আপনার অর্ডার {n}টি পার্সেলে আসবে। ডেলিভারি চার্জ একবারই।', os_track: 'অর্ডার ট্র্যাক', os_continue: 'কেনাকাটা চালিয়ে যান', os_acc: 'অর্ডার ট্র্যাক করতে অ্যাকাউন্ট খুলুন',
      os_acc_s: '{phone} নম্বর দিয়ে সাইন আপ করুন। এসএমএসে নম্বর যাচাই করলে এই ও ভবিষ্যতের অর্ডার আপনার অ্যাকাউন্টে দেখা যাবে।', os_acc_btn: 'এই ফোন দিয়ে অ্যাকাউন্ট খুলুন', os_acc_ok: 'অ্যাকাউন্ট তৈরি। এই অর্ডার এখন আপনার অ্যাকাউন্টে যুক্ত।',
      os_rec: 'আপনার পছন্দ হতে পারে', os_inv: 'ইনভয়েস ডাউনলোড', os_copy: 'অর্ডার নম্বর কপি করুন', os_copied: 'অর্ডার নম্বর কপি হয়েছে', os_not: 'অর্ডার পাওয়া যায়নি'
    }
  });

  var ord = Shop.orders.get(Shop.qparam('o')) || Shop.orders.stored()[0] || Shop.orders.get('BD-100248');
  var contact = ord.contact || { name: ord.addr.name, phone: ord.addr.phone };

  function nextHTML() {
    var cod = ord.method === 'cod', steps = [['os_n1', 'os_n1s', true], ['os_n2', 'os_n2s'], ['os_n3', 'os_n3s'], ['os_n4', cod ? 'os_n4s_cod' : 'os_n4s']];
    return '<ol class="tl tl-v">' + steps.map(function (s, i) {
      return '<li class="' + (s[2] ? 'done' : i === 1 ? 'cur' : '') + '"><span class="tl-dot" aria-hidden="true">' + (s[2] ? icon('check', 14) : i + 1) + '</span><div><b ' + X(s[0]) + '</b><p class="muted" ' + X(s[1]) + '</p></div></li>';
    }).join('') + '</ol>';
  }
  function accHTML() {
    if (!ord.guest || Shop.user.get()) return '';
    return '<section class="card-box acc-cta" id="accCta"><div class="acc-i" aria-hidden="true">' + icon('user', 26) + '</div><div class="acc-t"><h2 ' + X('os_acc') + '</h2><p class="muted">' + T('os_acc_s', { phone: esc(contact.phone) }) + '</p></div>' +
      '<button class="btn btn-accent" type="button" id="mkAcc" ' + X('os_acc_btn') + '</button></section>';
  }
  var t0 = ord.totals;
  var items = ord.items.map(function (i) { return Shop.itemRow(i); }).join('');
  var a = ord.addr, dist = D.districts[a.di] || D.districts[0];
  var eta = Shop.dateX(Date.now() + t0.days[0] * Shop.DAY) + ' - ' + Shop.dateX(Date.now() + t0.days[1] * Shop.DAY);
  var split = ord.ships && ord.ships.length > 1;
  var pend = ord.status === 'pending';
  var rec = D.all().filter(function (p) { return !p.oos && ord.items.every(function (i) { return i.id !== p.id; }); }).slice(120, 130);

  var html = '<div class="wrap os-pg"><section class="os-hero"><div class="pay-ic ' + (pend ? '' : 'good') + '" aria-hidden="true">' + icon(pend ? 'info' : 'check', 36) + '</div>' +
    '<h1>' + (ord.guest ? '<span ' + X('os_h_g') + '</span>' : T('os_h', { name: esc(contact.name.split(' ')[0]) })) + '</h1>' +
    '<p class="muted">' + (pend ? T('os_pay_pending_s', { no: esc(ord.no) }) : T('os_s', { no: esc(ord.no), phone: esc(contact.phone) })) + '</p>' +
    '<p class="os-no"><span class="muted" ' + X('order_no') + '</span> <b>' + esc(ord.no) + '</b> <button class="btn-link" type="button" id="copyNo" ' + X('os_copy') + '</button></p>' +
    '<div class="os-act"><a class="btn btn-primary" href="track.html?o=' + esc(ord.no) + '&p=' + esc(contact.phone) + '" ' + X('os_track') + '</a><a class="btn btn-ghost" href="home.html" ' + X('os_continue') + '</a></div></section>' +
    accHTML() +
    '<div class="os-grid"><section class="card-box"><h2 class="sec-h3" ' + X('os_sum') + '</h2><div class="irows">' + items + '</div>' + (split ? '<p class="note-s muted">' + icon('pkg', 14) + ' ' + T('os_split', { n: ord.ships.length }) + '</p>' : '') + Shop.sumRows(t0) + '</section>' +
    '<div class="os-side"><section class="card-box"><h2 class="sec-h3" ' + X('os_pay') + '</h2><p class="os-pm">' + Shop.methodChip(ord.method) + ' <b ' + X('m_' + (ord.method)) + '</b></p>' +
    '<p>' + (t0.payNow > 0 ? '<span class="ok">' + T('os_paid_now', { amt: fmt(t0.payNow) }) + '</span> ' : '') + (t0.payDue > 0 ? '<span>' + T('os_due', { amt: fmt(t0.payDue) }) + '</span>' : '') + '</p></section>' +
    '<section class="card-box"><h2 class="sec-h3" ' + X('os_addr') + '</h2><p><b>' + esc(a.name) + '</b> · ' + esc(a.phone) + '</p><p class="muted">' + esc(a.line) + ', ' + esc(a.area) + ', <span ' + Shop.LX(dist[0], dist[1]) + '</span></p>' +
    '<h2 class="sec-h3 mt" ' + X('os_eta') + '</h2><p><b>' + eta + '</b></p></section>' +
    '<section class="card-box"><h2 class="sec-h3" ' + X('os_next') + '</h2>' + nextHTML() + '</section></div></div>' +
    '<section class="os-rec"><h2 class="sec-h2" ' + X('os_rec') + '</h2><div class="hscroll">' + rec.map(function (p) { return Shop.card(p); }).join('') + '</div></section></div>';

  Shop.renderPage(html, {
    active: 'account',
    onReady: function (frame) {
      document.title = t('os_title') + ' - ShopName';
      var cp = $('#copyNo', frame);
      if (cp) cp.addEventListener('click', function () { try { navigator.clipboard.writeText(ord.no); } catch (e) { /* ignore */ } Shop.toast(t('os_copied')); });
      var mk = $('#mkAcc', frame);
      if (mk) mk.addEventListener('click', function () {
        Shop.auth.modal(function (u) {
          ord.guest = false; ord.contact = { name: u.name, phone: u.phone || contact.phone }; Shop.orders.update(ord);
          var box = $('#accCta', frame); if (box) { box.innerHTML = '<div class="acc-i ok" aria-hidden="true">' + icon('check', 26) + '</div><div class="acc-t"><h2 ' + X('os_acc_ok') + '</h2></div>'; Shop.applyI18n(box); }
        }, 'signup');
      });
    }
  });
})();
