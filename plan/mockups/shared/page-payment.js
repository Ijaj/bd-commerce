/* Payment pending page: payment.html?o=<order no>&m=bkash|nagad|gw&s=pending|failed|success|expired
   Without ?o it renders a demo order so the page can be opened directly. 30:00 countdown from order.payBy, then auto-cancel. */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, $$ = Shop.$$, X = Shop.X, XA = Shop.XA, T = Shop.T, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data;

  Shop.i18n({
    en: {
      launch_h: 'Online payments not enabled at launch', launch_s: 'At launch every order is paid with cash on delivery. bKash, Nagad and card payments arrive in a later phase.', launch_back: 'Back to shop', launch_cart: 'Go to cart',
      pay_title: 'Payment', pay_h: 'Complete your payment', pay_s: 'Your order is reserved. Pay within the time below or it will be cancelled automatically.',
      pay_amount: 'Amount to pay', pay_left: 'Time left', pay_now: 'Pay now', pay_with: 'Paying with', pay_order: 'Order', pay_items: '{n} items', pay_rest: '{amt} will be paid on delivery.',
      pay_change: 'Change payment method', pay_cancel: 'Cancel order', pay_cancelled: 'Order cancelled', pay_secure: 'Secure payment. We never see your PIN or card details.',
      gw_demo: 'Mock gateway screen (demo only)', gw_acc: 'Your {m} account number', gw_acc_ph: '01XXXXXXXXX', gw_next: 'Continue', gw_pin: 'Enter your PIN', gw_pin_ph: '5-digit PIN (demo: any)', gw_confirm: 'Confirm payment',
      gw_card: 'Card number', gw_exp: 'Expiry (MM/YY)', gw_cvv: 'CVV', gw_name: 'Name on card', gw_close: 'Close', gw_fail: 'Simulate a failed payment', gw_merchant: 'Merchant: ShopName', gw_otp_s: 'Demo: any value works.',
      gw_err_acc: 'Enter a valid mobile number (01XXXXXXXXX).', gw_err_pin: 'Enter your PIN (at least 4 digits).', gw_err_card: 'Enter a valid card number (16 digits).',
      ok_h: 'Payment received', ok_s: 'Thank you! We got {amt} for order {no}.', ok_go: 'View order confirmation',
      bad_h: 'Payment failed', bad_s: 'Your money was not deducted. You can try again or choose another way to pay.', bad_retry: 'Try again', bad_other: 'Pay another way', bad_cod: 'Switch to cash on delivery',
      bad_cod_no: 'Cash on delivery needs an advance for this order, so it cannot be selected.', bad_cod_ok: 'Switched to cash on delivery', 
      exp_h: 'Payment time is over', exp_s: 'We cancelled order {no} because it was not paid within 30 minutes. Your cart items are not reserved any more.', exp_go: 'Back to shopping',
      st_label: 'Payment status', not_found: 'Order not found', not_found_s: 'This payment link does not match any order.'
    },
    bn: {
      launch_h: 'লঞ্চে অনলাইন পেমেন্ট চালু নেই', launch_s: 'লঞ্চের সময় সব অর্ডার ক্যাশ অন ডেলিভারিতে পরিশোধ করতে হবে। বিকাশ, নগদ ও কার্ড পেমেন্ট পরবর্তী ধাপে আসবে।', launch_back: 'শপে ফিরে যান', launch_cart: 'কার্টে যান',
      pay_title: 'পেমেন্ট', pay_h: 'পেমেন্ট সম্পন্ন করুন', pay_s: 'আপনার অর্ডার সংরক্ষিত আছে। নিচের সময়ের মধ্যে পরিশোধ করুন, নইলে অটো বাতিল হবে।',
      pay_amount: 'পরিশোধযোগ্য পরিমাণ', pay_left: 'বাকি সময়', pay_now: 'এখন পরিশোধ করুন', pay_with: 'পরিশোধ মাধ্যম', pay_order: 'অর্ডার', pay_items: '{n}টি আইটেম', pay_rest: '{amt} ডেলিভারিতে পরিশোধ করবেন।',
      pay_change: 'পেমেন্ট পদ্ধতি বদলান', pay_cancel: 'অর্ডার বাতিল করুন', pay_cancelled: 'অর্ডার বাতিল হয়েছে', pay_secure: 'নিরাপদ পেমেন্ট। আপনার পিন বা কার্ডের তথ্য আমরা দেখি না।',
      gw_demo: 'গেটওয়ে স্ক্রিনের মক (শুধু ডেমো)', gw_acc: 'আপনার {m} অ্যাকাউন্ট নম্বর', gw_acc_ph: '01XXXXXXXXX', gw_next: 'চালিয়ে যান', gw_pin: 'আপনার পিন দিন', gw_pin_ph: '5 সংখ্যার পিন (ডেমো: যেকোনো)', gw_confirm: 'পেমেন্ট নিশ্চিত করুন',
      gw_card: 'কার্ড নম্বর', gw_exp: 'মেয়াদ (MM/YY)', gw_cvv: 'CVV', gw_name: 'কার্ডে নাম', gw_close: 'বন্ধ করুন', gw_fail: 'ব্যর্থ পেমেন্ট সিমুলেট করুন', gw_merchant: 'মার্চেন্ট: ShopName', gw_otp_s: 'ডেমো: যেকোনো মান চলবে।',
      gw_err_acc: 'সঠিক মোবাইল নম্বর (01XXXXXXXXX) দিন।', gw_err_pin: 'পিন দিন (কমপক্ষে 4 সংখ্যা)।', gw_err_card: 'সঠিক কার্ড নম্বর (16 সংখ্যা) দিন।',
      ok_h: 'পেমেন্ট পাওয়া গেছে', ok_s: 'ধন্যবাদ! অর্ডার {no}-এর জন্য {amt} পেয়েছি।', ok_go: 'অর্ডার কনফার্মেশন দেখুন',
      bad_h: 'পেমেন্ট ব্যর্থ হয়েছে', bad_s: 'আপনার টাকা কাটা হয়নি। আবার চেষ্টা করুন বা অন্যভাবে পরিশোধ করুন।', bad_retry: 'আবার চেষ্টা করুন', bad_other: 'অন্যভাবে পরিশোধ', bad_cod: 'ক্যাশ অন ডেলিভারিতে বদলান',
      bad_cod_no: 'এই অর্ডারে ক্যাশ অন ডেলিভারির জন্য অগ্রিম লাগে, তাই বেছে নেওয়া যাবে না।', bad_cod_ok: 'ক্যাশ অন ডেলিভারিতে বদলানো হয়েছে',
      exp_h: 'পেমেন্টের সময় শেষ', exp_s: '30 মিনিটের মধ্যে পরিশোধ না হওয়ায় অর্ডার {no} বাতিল হয়েছে। কার্টের পণ্য আর সংরক্ষিত নেই।', exp_go: 'কেনাকাটায় ফিরুন',
      st_label: 'পেমেন্টের অবস্থা', not_found: 'অর্ডার পাওয়া যায়নি', not_found_s: 'এই পেমেন্ট লিংকের সাথে কোনো অর্ডার মেলেনি।'
    }
  });

  var no = Shop.qparam('o') || 'BD-100163', m = Shop.qparam('m') || 'bkash', st = Shop.qparam('s') || 'pending';
  if (['bkash', 'nagad', 'gw'].indexOf(m) < 0) m = 'bkash';
  var ord = Shop.orders.get(no);
  var timer = null;

  function amount() { return ord.totals.payNow > 0 ? ord.totals.payNow : ord.totals.total; }
  function leftMs() { return Math.max(0, (ord.payBy || (ord.ts + 30 * 60000)) - Date.now()); }
  function mmss(ms) { var s = Math.floor(ms / 1000); return Shop.pad(Math.floor(s / 60)) + ':' + Shop.pad(s % 60); }
  function go(state) { location.href = 'payment.html?o=' + no + '&m=' + m + '&s=' + state; }
  function head(icn, cls, key, sub) { return '<div class="pay-ic ' + cls + '" aria-hidden="true">' + icn + '</div><h1 ' + X(key) + '</h1>' + sub; }

  function pendingHTML() {
    var items = ord.items.reduce(function (s, i) { return s + i.qty; }, 0), due = ord.totals.payDue;
    return head(Shop.methodChip(m), '', 'pay_h', '<p class="muted" ' + X('pay_s') + '</p>') +
      '<div class="pay-amt"><span class="muted" ' + X('pay_amount') + '</span><b>' + fmt(amount()) + '</b>' + (due > 0 ? '<small class="muted">' + T('pay_rest', { amt: fmt(due) }) + '</small>' : '') + '</div>' +
      '<div class="pay-time" role="timer" aria-live="off"><span class="muted" ' + X('pay_left') + '</span><b id="payClock">' + mmss(leftMs()) + '</b><div class="prog" aria-hidden="true"><i id="payBar" style="width:' + Math.round(leftMs() / 18000) + '%"></i></div></div>' +
      '<dl class="pay-meta"><div><dt ' + X('pay_with') + '</dt><dd>' + Shop.methodChip(m) + ' <b ' + X('m_' + m) + '</b></dd></div><div><dt ' + X('pay_order') + '</dt><dd><b>' + esc(ord.no) + '</b> · ' + T('pay_items', { n: items }) + '</dd></div></dl>' +
      '<button class="btn btn-primary btn-block btn-lg" type="button" id="payNow">' + icon('shield', 18) + ' <span ' + X('pay_now') + '</span> · ' + fmt(amount()) + '</button>' +
      '<div class="pay-links"><a class="btn-link" href="payment.html?o=' + no + '&m=' + m + '&s=failed" id="payChange" ' + X('pay_change') + '</a><button class="btn-link danger" type="button" id="payCancel" ' + X('pay_cancel') + '</button></div>' +
      '<p class="muted pay-sec">' + icon('shield', 14) + ' <span ' + X('pay_secure') + '</span></p>';
  }
  function failedHTML() {
    var canCod = !(ord.totals.codAdv || ord.totals.hasPre) ;
    var other = ['bkash', 'nagad', 'gw'].map(function (x) { return '<label class="rcard"><input type="radio" name="pm2" value="' + x + '"' + (x === m ? ' checked' : '') + '><span class="rc-b rc-pm">' + Shop.methodChip(x) + '<span class="rc-x"><span class="rc-t"><b ' + X('m_' + x) + '</b></span></span></span></label>'; }).join('');
    return head(icon('close', 34), 'bad', 'bad_h', '<p class="muted" ' + X('bad_s') + '</p>') +
      '<div class="pay-amt"><span class="muted" ' + X('pay_amount') + '</span><b>' + fmt(amount()) + '</b></div>' +
      '<button class="btn btn-primary btn-block btn-lg" type="button" id="retry" ' + X('bad_retry') + '</button>' +
      '<h2 class="sec-h3" ' + X('bad_other') + '</h2><div class="rcards rcards-pm" role="radiogroup" ' + XA('aria-label', 'bad_other') + '>' + other + '</div>' +
      '<button class="btn btn-ghost btn-block" type="button" id="switchCod"' + (canCod ? '' : ' disabled') + '>' + icon('cash', 16) + ' <span ' + X('bad_cod') + '</span></button>' +
      (canCod ? '' : '<p class="muted note-s">' + icon('info', 14) + ' <span ' + X('bad_cod_no') + '</span></p>') +
      '<div class="pay-links"><button class="btn-link danger" type="button" id="payCancel" ' + X('pay_cancel') + '</button></div>';
  }
  function successHTML() {
    return head(icon('check', 34), 'good', 'ok_h', '<p class="muted">' + T('ok_s', { amt: fmt(amount()), no: ord.no }) + '</p>') +
      '<a class="btn btn-primary btn-block btn-lg" href="order-success.html?o=' + ord.no + '" ' + X('ok_go') + '</a>';
  }
  function expiredHTML() {
    return head(icon('info', 34), 'bad', 'exp_h', '<p class="muted">' + T('exp_s', { no: ord.no }) + '</p>') + '<a class="btn btn-primary btn-block" href="home.html" ' + X('exp_go') + '</a>';
  }

  /* fake gateway */
  function gateway() {
    var isGw = m === 'gw', mname = t('m_' + m);
    var body = isGw ?
      '<div class="fld"><label for="gwCard" ' + X('gw_card') + '</label><input class="inp" id="gwCard" inputmode="numeric" maxlength="19" placeholder="4242 4242 4242 4242" aria-describedby="gwCard-e"><p class="fld-e" id="gwCard-e" role="alert" hidden></p></div>' +
      '<div class="two"><div class="fld"><label for="gwExp" ' + X('gw_exp') + '</label><input class="inp" id="gwExp" placeholder="12/28" maxlength="5"></div><div class="fld"><label for="gwCvv" ' + X('gw_cvv') + '</label><input class="inp" id="gwCvv" inputmode="numeric" maxlength="4" placeholder="123"></div></div>' +
      '<div class="fld"><label for="gwName" ' + X('gw_name') + '</label><input class="inp" id="gwName" autocomplete="cc-name"></div>' +
      '<button class="btn btn-primary btn-block" type="button" id="gwPay" ' + X('gw_confirm') + '</button>' :
      '<div id="gwS1"><div class="fld"><label for="gwAcc" data-i18n="gw_acc" data-m="' + esc(mname) + '">' + esc(t('gw_acc', { m: mname })) + '</label><input class="inp" id="gwAcc" type="tel" inputmode="tel" maxlength="14" ' + XA('placeholder', 'gw_acc_ph') + ' aria-describedby="gwAcc-e"><p class="fld-e" id="gwAcc-e" role="alert" hidden></p></div>' +
      '<button class="btn btn-primary btn-block" type="button" id="gwNext" ' + X('gw_next') + '</button></div>' +
      '<div id="gwS2" hidden><div class="fld"><label for="gwPin" ' + X('gw_pin') + '</label><input class="inp" id="gwPin" type="password" inputmode="numeric" maxlength="6" ' + XA('placeholder', 'gw_pin_ph') + ' aria-describedby="gwPin-e"><p class="fld-e" id="gwPin-e" role="alert" hidden></p></div>' +
      '<button class="btn btn-primary btn-block" type="button" id="gwPay" ' + X('gw_confirm') + '</button></div>';
    var inner = '<div class="sheet-h gw-h"><h2 id="gwOvl-h">' + Shop.methodChip(m) + ' <span ' + X('m_' + m) + '</span></h2><button class="icon-btn" type="button" data-close ' + XA('aria-label', 'gw_close') + '>' + icon('close', 20) + '</button></div>' +
      '<div class="sheet-b gw-b"><p class="gw-mock">' + icon('info', 14) + ' <span ' + X('gw_demo') + '</span></p><div class="gw-sum"><span class="muted" ' + X('gw_merchant') + '</span><b>' + fmt(amount()) + '</b></div>' + body +
      '<button class="btn-link danger gw-fail" type="button" id="gwFail" ' + X('gw_fail') + '</button></div>';
    var n = Shop.ovlModal('gwOvl', inner, 'modal-sm');
    var q = function (s) { return $(s, n); };
    function pay() { // success: order goes straight to placed (then processing in admin)
      ord.status = 'placed'; ord.payStatus = ord.totals.payDue > 0 ? 'partial' : 'paid'; ord.paidTs = Date.now();
      Shop.orders.update(ord); go('success');
    }
    var nx = q('#gwNext');
    if (nx) nx.addEventListener('click', function () {
      if (!Shop.validPhone(q('#gwAcc').value.replace(/[\s-]/g, ''))) { Shop.fieldErr('gwAcc', 'gw_err_acc'); q('#gwAcc').focus(); return; }
      Shop.fieldErr('gwAcc'); q('#gwS1').hidden = true; q('#gwS2').hidden = false; q('#gwPin').focus();
    });
    q('#gwPay').addEventListener('click', function () {
      if (isGw) { if (q('#gwCard').value.replace(/\D/g, '').length < 16) { Shop.fieldErr('gwCard', 'gw_err_card'); q('#gwCard').focus(); return; } }
      else if (q('#gwPin').value.length < 4) { Shop.fieldErr('gwPin', 'gw_err_pin'); q('#gwPin').focus(); return; }
      pay();
    });
    q('#gwFail').addEventListener('click', function () { ord.payStatus = 'pending'; Shop.orders.update(ord); go('failed'); });
    Shop.ovl.open(n, 'input');
  }

  function cancelOrder(expired) {
    ord.status = 'cancelled'; ord.payStatus = 'pending'; ord.cancelTs = Date.now(); ord.cancelReason = expired ? 'timeout' : 'customer';
    Shop.orders.update(ord);
  }

  function render(frame) {
    var box = $('#payCard', frame), state = st;
    if (!Shop.isFull()) {   // launch phase: COD only
      box.innerHTML = head(icon('info', 34), '', 'launch_h', '<p class="muted" ' + X('launch_s') + '</p>') + '<div class="pay-links"><a class="btn btn-primary" href="home.html" ' + X('launch_back') + '</a><a class="btn btn-ghost" href="cart.html" ' + X('launch_cart') + '</a></div>';
      Shop.applyI18n(box); document.title = t('pay_title') + ' - ShopName'; return;
    }
    if (!ord) { box.innerHTML = head(icon('info', 34), 'bad', 'not_found', '<p class="muted" ' + X('not_found_s') + '</p>') + '<a class="btn btn-primary" href="home.html" ' + X('exp_go') + '</a>'; Shop.applyI18n(box); return; }
    if (state === 'pending' && ord.status === 'cancelled') state = 'expired';
    if (state === 'pending' && leftMs() <= 0) { cancelOrder(true); state = 'expired'; }
    box.innerHTML = state === 'failed' ? failedHTML() : state === 'success' ? successHTML() : state === 'expired' ? expiredHTML() : pendingHTML();
    Shop.applyI18n(box);
    document.title = t('pay_title') + ' - ShopName';
    clearInterval(timer);
    if (state === 'pending') {
      timer = setInterval(function () {
        var ms = leftMs(), c = $('#payClock'), b = $('#payBar');
        if (!c) return;
        c.textContent = mmss(ms); if (b) b.style.width = Math.round(ms / 18000) + '%';
        if (ms <= 0) { cancelOrder(true); st = 'expired'; render(frame); }
      }, 1000);
    }
  }

  Shop.renderPage('<div class="wrap pay-pg"><div class="pay-card" id="payCard" aria-live="polite"></div></div>', {
    active: 'cart',
    onReady: function (frame) {
      render(frame);
      frame.addEventListener('click', function (e) {
        if (e.target.closest('#payNow')) gateway();
        else if (e.target.closest('#retry')) { m = ($('input[name=pm2]:checked', frame) || { value: m }).value; go('pending'); }
        else if (e.target.closest('#payCancel')) { cancelOrder(false); st = 'expired'; Shop.toast(t('pay_cancelled')); render(frame); }
        else if (e.target.closest('#switchCod')) {
          ord.method = 'cod'; ord.payStatus = 'cod'; ord.status = 'placed'; ord.totals.payNow = 0; ord.totals.payDue = ord.totals.total; Shop.orders.update(ord);
          Shop.toast(t('bad_cod_ok')); setTimeout(function () { location.href = 'order-success.html?o=' + ord.no; }, 500);
        }
      });
      frame.addEventListener('change', function (e) { if (e.target.name === 'pm2') m = e.target.value; });
    }
  });
})();
