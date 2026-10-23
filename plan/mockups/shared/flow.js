/* ShopName mockups - flow.js  (batch 2b: shared logic for cart / checkout / payment / orders / account / event)
   Load AFTER core.js and BEFORE the page script.
   Provides (all on window.Shop):
     Shop.T(key, vars)            i18n span with {vars} that survive language switches (data-attrs)
     Shop.dateX(ts)               bilingual date span
     Shop.user.get/set/clear/demo  fake session (localStorage 'shop.user'); ?user=1 logs in the demo user
     Shop.coupon.defs / eval(code, subtotal) / all()   coupon rules (flat | pct | free, min, max, stack)
     Shop.sel.isOn/set/lines()    cart selection (localStorage 'shop.unsel' = unticked line keys); Shop.applied = applied coupon codes ('shop.applied')
     Shop.calc(opts)              the one price breakdown used everywhere (cart estimate, checkout, order)
     Shop.parcels(lines)          stocked vs dropship split (one delivery charge regardless)
     Shop.orders.all/get/add/update, Shop.ORDER_STEPS, Shop.wallet, Shop.points, Shop.addr, Shop.notifs
     Shop.otp.html(id) / Shop.otp.bind(root, {onOk, phone})   6-box OTP with resend timer (demo code 123456)
     Shop.field(...) small form helpers; Shop.ovlModal(html, cls) builds a .ovl sheet appended to #frame
   Business rules honoured: see plan/10-decisions-log.md (one delivery charge per order, COD advance rule, VAT-inclusive prices,
   points redeem with min + max %, wallet spend-only, per-coupon stacking). */
(function () {
  'use strict';
  var Shop = window.Shop, D = Shop.data, store = Shop.store, esc = Shop.esc, t = Shop.t, fmt = Shop.formatBDT, icon = Shop.icon;

  Shop.i18n({
    en: {
      st_placed: 'Placed', st_processing: 'Processing', st_packed: 'Packed', st_shipped: 'Handed to courier', st_delivered: 'Delivered',
      st_cancelled: 'Cancelled', st_pending: 'Payment pending', st_returned: 'Returned', st_failed: 'Payment failed',
      m_cod: 'Cash on delivery', m_bkash: 'bKash', m_nagad: 'Nagad', m_gw: 'Card / Mobile banking (gateway)',
      s_discount: 'Discount', s_coupon: 'Coupon discount', s_pm: 'Payment offer', s_wallet: 'Store wallet', s_points: 'Loyalty points',
      s_delivery: 'Delivery', s_total: 'Total', s_vat: 'VAT included ({r}%)', s_free: 'Free', s_est: 'estimated',
      pb_del: 'delivery {amt}', pb_adv_pct: '{pct}% advance {amt}', pb_adv: 'advance {amt}', pb_pre: 'pre-order advance {amt}',
      s_paynow: 'Pay now', s_paydue: 'Pay on delivery', s_items: 'Items', s_adv: 'Advance',
      pc_stocked: 'Ships from our warehouse', pc_drop: 'Ships from partner seller', pc_note: 'May arrive in {n} parcels. One delivery charge only.',
      cp_invalid: 'This coupon code is not valid.', cp_min: 'Add {amt} more to use this coupon.', cp_exp: 'This coupon has expired.',
      cp_stack: 'This coupon cannot be combined with another coupon.', cp_dup: 'Already applied.', cp_ok: 'Coupon applied: {name}',
      cp_apply: 'Apply', cp_code_ph: 'Enter coupon code', cp_saves: 'Saves {amt}',
      otp_title: 'Enter the 6-digit code', otp_sent: 'We sent a code by SMS to {phone}.', otp_demo: 'Demo mode: use code 123456.',
      otp_resend: 'Resend code', otp_in: 'Resend in {s}s', otp_bad: 'That code is not right. Try again.', otp_verify: 'Verify', otp_box: 'Digit {n}',
      kg: 'kg', optional: 'optional', required_f: 'Required', back: 'Back', cancel: 'Cancel', save: 'Save', edit: 'Edit', del_btn: 'Delete', done: 'Done',
      home: 'Home', unit_pcs: 'pcs', var_lbl: 'Variant', order_no: 'Order no.', status: 'Status', date: 'Date', pay_status: 'Payment',
      pay_paid: 'Paid', pay_cod: 'Cash on delivery', pay_pending: 'Awaiting payment', pay_partial: 'Advance paid, rest on delivery', pay_failed: 'Failed', pay_refunded: 'Refunded',
      track_link: 'Track', login_req: 'Log in', courier: 'Courier', tracking_id: 'Tracking ID', eta: 'Expected', shipment_n: 'Parcel {n}'
    },
    bn: {
      st_placed: 'অর্ডার হয়েছে', st_processing: 'প্রসেসিং', st_packed: 'প্যাক হয়েছে', st_shipped: 'কুরিয়ারে হস্তান্তর', st_delivered: 'ডেলিভার হয়েছে',
      st_cancelled: 'বাতিল', st_pending: 'পেমেন্ট বাকি', st_returned: 'ফেরত', st_failed: 'পেমেন্ট ব্যর্থ',
      m_cod: 'ক্যাশ অন ডেলিভারি', m_bkash: 'বিকাশ', m_nagad: 'নগদ', m_gw: 'কার্ড / মোবাইল ব্যাংকিং (গেটওয়ে)',
      s_discount: 'ছাড়', s_coupon: 'কুপন ছাড়', s_pm: 'পেমেন্ট অফার', s_wallet: 'স্টোর ওয়ালেট', s_points: 'লয়্যালটি পয়েন্ট',
      s_delivery: 'ডেলিভারি', s_total: 'মোট', s_vat: 'ভ্যাট অন্তর্ভুক্ত ({r}%)', s_free: 'ফ্রি', s_est: 'আনুমানিক',
      pb_del: 'ডেলিভারি {amt}', pb_adv_pct: '{pct}% অগ্রিম {amt}', pb_adv: 'অগ্রিম {amt}', pb_pre: 'প্রি-অর্ডার অগ্রিম {amt}',
      s_paynow: 'এখন পরিশোধ', s_paydue: 'ডেলিভারিতে পরিশোধ', s_items: 'আইটেম', s_adv: 'অগ্রিম',
      pc_stocked: 'আমাদের গুদাম থেকে আসবে', pc_drop: 'পার্টনার বিক্রেতা থেকে আসবে', pc_note: '{n}টি পার্সেলে আসতে পারে। ডেলিভারি চার্জ একবারই।',
      cp_invalid: 'এই কুপন কোডটি সঠিক নয়।', cp_min: 'এই কুপন ব্যবহারে আরও {amt} যোগ করুন।', cp_exp: 'এই কুপনের মেয়াদ শেষ।',
      cp_stack: 'এই কুপন অন্য কুপনের সাথে ব্যবহার করা যায় না।', cp_dup: 'আগেই প্রয়োগ করা হয়েছে।', cp_ok: 'কুপন প্রয়োগ হয়েছে: {name}',
      cp_apply: 'প্রয়োগ করুন', cp_code_ph: 'কুপন কোড লিখুন', cp_saves: '{amt} সাশ্রয়',
      otp_title: '6 সংখ্যার কোড লিখুন', otp_sent: '{phone} নম্বরে এসএমএসে কোড পাঠানো হয়েছে।', otp_demo: 'ডেমো: কোড 123456 ব্যবহার করুন।',
      otp_resend: 'আবার কোড পাঠান', otp_in: '{s} সেকেন্ড পরে আবার পাঠান', otp_bad: 'কোডটি সঠিক নয়। আবার চেষ্টা করুন।', otp_verify: 'যাচাই করুন', otp_box: 'সংখ্যা {n}',
      kg: 'কেজি', optional: 'ঐচ্ছিক', required_f: 'আবশ্যক', back: 'পেছনে', cancel: 'বাতিল', save: 'সংরক্ষণ', edit: 'সম্পাদনা', del_btn: 'মুছুন', done: 'সম্পন্ন',
      home: 'হোম', unit_pcs: 'পিস', var_lbl: 'ভ্যারিয়েন্ট', order_no: 'অর্ডার নম্বর', status: 'অবস্থা', date: 'তারিখ', pay_status: 'পেমেন্ট',
      pay_paid: 'পরিশোধিত', pay_cod: 'ক্যাশ অন ডেলিভারি', pay_pending: 'পেমেন্টের অপেক্ষায়', pay_partial: 'অগ্রিম দেওয়া, বাকি ডেলিভারিতে', pay_failed: 'ব্যর্থ', pay_refunded: 'রিফান্ড হয়েছে',
      track_link: 'ট্র্যাক', login_req: 'লগইন', courier: 'কুরিয়ার', tracking_id: 'ট্র্যাকিং আইডি', eta: 'প্রত্যাশিত', shipment_n: 'পার্সেল {n}'
    }
  });

  Shop.i18n({
    en: {
      ad_recv: 'Receiver name', ad_district: 'District', ad_pick: 'Select district', ad_area: 'Area / thana', ad_area_ph: 'e.g. Dhanmondi', ad_line: 'Full address', ad_label: 'Address label', ad_home: 'Home', ad_office: 'Office',
      ad_err_district: 'Select a district.', ad_err_area: 'Enter your area or thana.', ad_err_line: 'Enter your full address.', ad_cancel: 'Cancel', co_phone: 'Mobile number', co_phone_ph: '01XXXXXXXXX',
      err_name: 'Enter your name.', err_phone: 'Enter a valid mobile number (01XXXXXXXXX).', tk_addr: 'Delivery address', tk_total: 'Order total', start: 'Start shopping'
    },
    bn: {
      ad_recv: 'প্রাপকের নাম', ad_district: 'জেলা', ad_pick: 'জেলা বেছে নিন', ad_area: 'এলাকা / থানা', ad_area_ph: 'যেমন ধানমন্ডি', ad_line: 'পূর্ণ ঠিকানা', ad_label: 'ঠিকানার ধরন', ad_home: 'বাসা', ad_office: 'অফিস',
      ad_err_district: 'জেলা বেছে নিন।', ad_err_area: 'এলাকা বা থানা লিখুন।', ad_err_line: 'পূর্ণ ঠিকানা লিখুন।', ad_cancel: 'বাতিল', co_phone: 'মোবাইল নম্বর', co_phone_ph: '01XXXXXXXXX',
      err_name: 'আপনার নাম লিখুন।', err_phone: 'সঠিক মোবাইল নম্বর (01XXXXXXXXX) দিন।', tk_addr: 'ডেলিভারি ঠিকানা', tk_total: 'অর্ডার মোট', start: 'কেনাকাটা শুরু করুন'
    }
  });

  /* ---------------------------------------------------------------- tiny helpers */
  Shop.T = function (k, v) {
    var a = '', n; for (n in v) a += ' data-' + n + '="' + esc(v[n]) + '"';
    return '<span data-i18n="' + k + '"' + a + '>' + esc(t(k, v)) + '</span>';
  };
  var MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MON_BN = ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
  Shop.dateX = function (ts, withTime) {
    var d = new Date(ts), tm = withTime ? ', ' + Shop.pad(d.getHours()) + ':' + Shop.pad(d.getMinutes()) : '';
    return '<span ' + Shop.LX(d.getDate() + ' ' + MON_EN[d.getMonth()] + ' ' + d.getFullYear() + tm, d.getDate() + ' ' + MON_BN[d.getMonth()] + ' ' + d.getFullYear() + tm) + '</span>';
  };
  Shop.DAY = 86400000;
  var METHODS = { cod: 'm_cod', bkash: 'm_bkash', nagad: 'm_nagad', gw: 'm_gw' };
  Shop.METHODS = METHODS;
  Shop.methodChip = function (m) { return '<span class="mchip mchip-' + m + '" aria-hidden="true">' + ({ cod: icon('cash', 16), bkash: 'bK', nagad: 'N', gw: icon('shield', 16) })[m] + '</span>'; };
  // payment-method-specific discount (checkout shows a badge, calc applies it)
  Shop.PM = { bkash: { pct: 5, max: 300 }, nagad: { pct: 3, max: 200 } };   // Full phase only (launch is COD only)
  Shop.methods = function () { return Shop.isFull() ? ['cod', 'bkash', 'nagad', 'gw'] : ['cod']; };
  Shop.config = { vat: 15, otpGuestCod: 3000, pointsMin: 500, pointsMaxPct: 20, preorderPct: 20,
    advBigPrice: 50000, advBigPct: 10, riskyPct: 25 };
  /* ADVANCE PAYMENT (Q106-Q108, Full phase, COD orders only; paid via bKash / Nagad / gateway):
       pay now = delivery fee (0 when delivery is free) + advance % of the triggering item(s)
       triggers: (a) product.advancePercent (dropship 20%, a few others)  (b) risky-customer flag (demo toggle) -> riskyPct of EVERY item (= order subtotal)
                 (c) any single product unit price > advBigPrice -> advBigPct of that item
       Q111: when several triggers hit the same item their %s are ADDED (capped at 100% of the item).
     Launch phase: no advance at all, delivery fee is collected on delivery. */
  Shop.risky = { get: function () { return store.get('shop.risky') === '1'; }, set: function (on) { if (on) store.set('shop.risky', '1'); else store.del('shop.risky'); Shop.emit('risky', on); } };

  /* ---------------------------------------------------------------- session */
  var DEMO_USER = { name: 'Rahim Uddin', phone: '01711000000', email: 'rahim@example.com', verified: true, joined: Date.now() - 200 * 86400000, demo: true };
  Shop.user = {
    get: function () { return store.getJSON('shop.user', null); },
    set: function (u) { store.setJSON('shop.user', u); Shop.emit('user', u); },
    clear: function () { store.del('shop.user'); Shop.emit('user', null); },
    demo: function () { Shop.user.set(DEMO_USER); return DEMO_USER; }
  };
  Shop.isDemo = function () { var u = Shop.user.get(); return !!(u && u.demo); };
  if (/[?&]user=1(&|$)/.test(location.search) && !Shop.user.get()) Shop.user.demo();
  if (/[?&]user=0(&|$)/.test(location.search)) Shop.user.clear();
  // header "Login" label -> account name when logged in; keep in sync
  function headerUser() {
    var u = Shop.user.get();
    Shop.$$('.act a[href="account.html"] .lbl').forEach(function (n) {
      if (u) { n.removeAttribute('data-i18n'); n.textContent = u.name.split(' ')[0]; } else { n.setAttribute('data-i18n', 'login'); n.textContent = t('login'); }
    });
  }
  Shop.headerUser = headerUser;
  Shop.on('lang', headerUser);

  /* ---------------------------------------------------------------- coupons */
  // rules per code. exp: 'expired' marks past coupons. stack:false = cannot be combined with any other coupon.
  var CR = {
    WELCOME100: { type: 'flat', val: 100, min: 1000, stack: true },
    EID10: { type: 'pct', val: 10, max: 500, min: 0, stack: false },
    FREEDEL: { type: 'free', min: 2000, stack: true },
    PUJA200: { type: 'flat', val: 200, min: 2500, stack: true },
    PUJA15: { type: 'pct', val: 15, max: 1000, min: 4000, stack: false },
    SUMMER50: { type: 'flat', val: 50, min: 500, stack: true, expired: true }
  };
  // presentation for the extra codes (core.js has the first three)
  D.coupons.push(
    { code: 'PUJA200', en: '৳200 off', bn: '৳200 ছাড়', ten: 'On orders above ৳2,500', tbn: '৳2,500-এর বেশি অর্ডারে', exp: 'Expires in 9 days', ebn: '9 দিনে শেষ' },
    { code: 'PUJA15', en: '15% off', bn: '15% ছাড়', ten: 'Max ৳1,000, orders above ৳4,000, not combinable', tbn: 'সর্বোচ্চ ৳1,000, ৳4,000-এর বেশি অর্ডারে, অন্য কুপনের সাথে নয়', exp: 'Expires in 9 days', ebn: '9 দিনে শেষ' }
  );
  var EXPIRED_DEF = { code: 'SUMMER50', en: '৳50 off', bn: '৳50 ছাড়', ten: 'On orders above ৳500', tbn: '৳500-এর বেশি অর্ডারে', exp: 'Expired', ebn: 'মেয়াদ শেষ' };
  Shop.coupon = {
    rules: CR, expiredDef: EXPIRED_DEF,
    def: function (code) { for (var i = 0; i < D.coupons.length; i++) if (D.coupons[i].code === code) return D.coupons[i]; return code === 'SUMMER50' ? EXPIRED_DEF : null; },
    // returns { ok, err, vars, disc, free }
    eval: function (code, sub) {
      code = String(code || '').toUpperCase();
      var r = CR[code];
      if (!r) return { ok: false, err: 'cp_invalid' };
      if (r.expired) return { ok: false, err: 'cp_exp' };
      if (sub < r.min) return { ok: false, err: 'cp_min', vars: { amt: fmt(r.min - sub) } };
      if (r.type === 'free') return { ok: true, disc: 0, free: true };
      var d = r.type === 'flat' ? r.val : Math.min(r.max || 1e9, Math.round(sub * r.val / 100));
      return { ok: true, disc: d, free: false };
    },
    // can `code` join `applied`?
    canStack: function (code, applied) {
      var others = applied.filter(function (c) { return c !== code; });
      if (!others.length) return true;
      return CR[code].stack && others.every(function (c) { return CR[c] && CR[c].stack; });
    }
  };
  Shop.applied = {
    get: function () { var a = store.getJSON('shop.applied', []); return Array.isArray(a) ? a : []; },
    set: function (a) { store.setJSON('shop.applied', a); Shop.emit('applied', a); }
  };
  // try to apply a code; returns {ok, err, vars}
  Shop.applyCoupon = function (raw, sub) {
    var code = String(raw || '').trim().toUpperCase(), a = Shop.applied.get();
    if (!code) return { ok: false, err: 'cp_invalid' };
    if (a.indexOf(code) >= 0) return { ok: false, err: 'cp_dup' };
    var r = Shop.coupon.eval(code, sub);
    if (!r.ok) return r;
    if (!Shop.coupon.canStack(code, a.concat(code))) return { ok: false, err: 'cp_stack' };
    a.push(code); Shop.applied.set(a);
    return { ok: true, code: code };
  };
  Shop.removeCoupon = function (code) { Shop.applied.set(Shop.applied.get().filter(function (c) { return c !== code; })); };

  /* ---------------------------------------------------------------- cart selection */
  function lkey(l) { return l.id + '|' + l.variant; }
  Shop.lineKey = lkey;
  Shop.sel = {
    unsel: function () { var a = store.getJSON('shop.unsel', []); return Array.isArray(a) ? a : []; },
    isOn: function (l) { return Shop.sel.unsel().indexOf(lkey(l)) < 0; },
    set: function (l, on) {
      var u = Shop.sel.unsel().filter(function (k) { return k !== lkey(l); });
      if (!on) u.push(lkey(l));
      store.setJSON('shop.unsel', u); Shop.emit('sel', u);
    },
    setAll: function (on) { store.setJSON('shop.unsel', on ? [] : Shop.cart.lines().map(lkey)); Shop.emit('sel'); },
    lines: function () { return Shop.cart.lines().filter(Shop.sel.isOn); }
  };

  Shop.checkoutLines = function () { return Shop.sel.lines().filter(function (l) { return l.c.stock > 0; }); };

  /* ---------------------------------------------------------------- shipments + calc */
  // stocked vs dropship, deterministic per product. Both groups still pay ONE delivery charge.
  Shop.isDrop = function (p) { return p.id % 3 === 0; };
  Shop.parcels = function (lines) {
    var s = lines.filter(function (l) { return !Shop.isDrop(l.p); }), d = lines.filter(function (l) { return Shop.isDrop(l.p); }), out = [];
    if (s.length) out.push({ kind: 'stocked', lines: s });
    if (d.length) out.push({ kind: 'drop', lines: d });
    return out;
  };
  /* opts: { lines, zone, coupons[], method, wallet(bool), walletBal, points(n), user(bool), risky(bool: risky-customer flag; defaults to Shop.risky.get()) }
     returns all numbers used by summaries. grand = goods + delivery; total = what the customer pays in all (after wallet/points). */
  Shop.calc = function (o) {
    var lines = o.lines || [], sub = 0, kg = 0, allFree = lines.length > 0, preAdv = 0, preDue = 0, i, c = Shop.config;
    lines.forEach(function (l) {
      sub += l.total;
      if (l.p.badges.indexOf('free_del') < 0) { allFree = false; kg += l.p.weight * l.qty; }
      if (l.p.preorder) { var adv = Math.round(l.total * c.preorderPct / 100); preAdv += adv; preDue += l.total - adv; }
    });
    if (o.risky == null) o.risky = Shop.risky.get();
    var dl = D.delivery(o.zone || 'dhaka', Math.max(1, kg), sub), std = dl.base + dl.extra;
    var charge = (allFree || dl.free) ? 0 : std, cdisc = 0, freeCp = false, codes = o.coupons || [];
    codes.forEach(function (code) { var r = Shop.coupon.eval(code, sub); if (r.ok) { cdisc += r.disc; if (r.free) freeCp = true; } });
    cdisc = Math.min(cdisc, sub);
    if (freeCp) charge = 0;
    var pmr = Shop.isFull() ? Shop.PM[o.method] : null, pm = pmr ? Math.min(pmr.max, Math.round((sub - cdisc) * pmr.pct / 100)) : 0;
    var goods = sub - cdisc - pm, grand = goods + charge;
    var pointsMax = Math.floor(goods * c.pointsMaxPct / 100), pts = Math.max(0, Math.min(o.points || 0, pointsMax));
    var afterPts = grand - pts, wal = o.wallet ? Math.max(0, Math.min(o.walletBal || 0, afterPts)) : 0, total = afterPts - wal;
    var full = Shop.isFull(), advFee = 0, advItems = 0, advPcts = [], payNow, payDue, risky = full && !!o.risky;
    if (full && o.method === 'cod') {
      advFee = charge;   // non-free delivery on a COD order = delivery fee paid in advance
      lines.forEach(function (l) {
        if (l.p.preorder) return;   // pre-order lines have their own advance (preAdv)
        var pc = Math.min(100, (l.p.advancePercent || 0) + (l.price > c.advBigPrice ? c.advBigPct : 0) + (risky ? c.riskyPct : 0));
        if (pc > 0) { advItems += Math.round(l.total * pc / 100); if (advPcts.indexOf(pc) < 0) advPcts.push(pc); }
      });
    }
    var codAdv = advFee + advItems;
    if (o.method === 'cod') payNow = Math.min(total, codAdv + preAdv);
    else payNow = Math.max(0, total - preDue);
    payNow = Math.min(payNow, total);
    payDue = total - payNow;
    var kgOut = Math.max(1, Math.round(kg * 10) / 10);
    return {
      sub: sub, cdisc: cdisc, pm: pm, pmPct: pmr ? pmr.pct : 0, charge: charge, stdCharge: std, delFree: charge === 0 && lines.length > 0, days: dl.days, zone: dl.zone, kg: kgOut,
      goods: goods, grand: grand, pts: pts, pointsMax: pointsMax, wallet: wal, total: total, vat: Math.round(grand * c.vat / (100 + c.vat)),
      codAdv: codAdv, preAdv: preAdv, preDue: preDue, payNow: payNow, payDue: payDue, freeAbove: dl.freeAbove, freeNever: dl.freeAbove == null, freeLeft: dl.freeAbove == null ? 0 : Math.max(0, dl.freeAbove - sub),
      method: o.method, advFee: advFee, advItems: advItems, advPct: advPcts.length === 1 ? advPcts[0] : 0, advRisky: risky,
      needOtp: o.method === 'cod' && !o.user && total > c.otpGuestCod, hasPre: preAdv > 0
    };
  };
  // zone key of a district index
  Shop.zoneOf = function (di) { return D.districts[di] ? D.districts[di][2] : 'dhaka'; };

  /* ---------------------------------------------------------------- addresses, wallet, points, notifications (seeded for the demo user) */
  Shop.addr = {
    get: function () {
      var a = store.getJSON('shop.addr', null);
      if (!a) { a = Shop.isDemo() ? [
        { id: 'a1', label: 'home', name: 'Rahim Uddin', phone: '01711000000', di: 0, area: 'Dhanmondi', line: 'House 12, Road 5, Dhanmondi, Dhaka', def: true },
        { id: 'a2', label: 'office', name: 'Rahim Uddin', phone: '01711000000', di: 4, area: 'Agrabad', line: 'Suite 4B, Agrabad Commercial Area, Chattogram', def: false }
      ] : []; if (a.length) store.setJSON('shop.addr', a); }
      return a;
    },
    save: function (a) { store.setJSON('shop.addr', a); Shop.emit('addr', a); }
  };
  Shop.wallet = {
    get: function () {
      var w = store.getJSON('shop.wallet', null);
      if (!w && !Shop.isDemo()) return { bal: 0, tx: [] };
      if (!w) { w = { bal: 1250, tx: [
        { ts: Date.now() - 2 * Shop.DAY, en: 'Refund for order BD-100120', bn: 'অর্ডার BD-100120 এর রিফান্ড', amt: 850 },
        { ts: Date.now() - 20 * Shop.DAY, en: 'Used on order BD-100098', bn: 'অর্ডার BD-100098-এ ব্যবহার', amt: -300 },
        { ts: Date.now() - 41 * Shop.DAY, en: 'Cashback (Eid offer)', bn: 'ক্যাশব্যাক (ঈদ অফার)', amt: 400 },
        { ts: Date.now() - 80 * Shop.DAY, en: 'Return refund to wallet', bn: 'রিটার্ন রিফান্ড ওয়ালেটে', amt: 300 }
      ] }; }
      return w;
    },
    save: function (w) { store.setJSON('shop.wallet', w); Shop.emit('wallet', w); }
  };
  Shop.points = {
    get: function () {
      var p = store.getJSON('shop.points', null);
      if (!p && !Shop.isDemo()) return { bal: 0, expiring: 0, expDays: 0, tx: [] };
      if (!p) { p = { bal: 1840, expiring: 300, expDays: 24, tx: [
        { ts: Date.now() - 3 * Shop.DAY, en: 'Earned: order BD-100174', bn: 'অর্জন: অর্ডার BD-100174', amt: 120 },
        { ts: Date.now() - 18 * Shop.DAY, en: 'Redeemed on order BD-100098', bn: 'অর্ডার BD-100098-এ ব্যবহার', amt: -500 },
        { ts: Date.now() - 44 * Shop.DAY, en: 'Earned: order BD-100031', bn: 'অর্জন: অর্ডার BD-100031', amt: 260 },
        { ts: Date.now() - 90 * Shop.DAY, en: 'Welcome bonus', bn: 'ওয়েলকাম বোনাস', amt: 500 }
      ] }; }
      return p;
    },
    save: function (p) { store.setJSON('shop.points', p); Shop.emit('points', p); }
  };

  /* ---------------------------------------------------------------- orders */
  Shop.ORDER_STEPS = ['placed', 'processing', 'packed', 'shipped', 'delivered'];
  var CARRIER = { Pathao: 'https://pathao.com/courier/track/', Steadfast: 'https://steadfast.com.bd/t/' };
  Shop.trackUrl = function (courier, id) { return (CARRIER[courier] || '#') + encodeURIComponent(id); };
  function mkItems(spec) {
    return spec.map(function (s) {
      var d = D.detail(s[0]), c = d.combo(s[1] === undefined ? d.defaultKey() : s[1]);
      return { id: s[0], variant: c.key, qty: s[2] || 1, price: c.price };
    });
  }
  function mkOrder(no, daysAgo, status, method, payStatus, itemsSpec, o) {
    var items = mkItems(itemsSpec), lines = items.map(function (i) { var p = D.getProduct(i.id); return { id: i.id, variant: i.variant, qty: i.qty, p: p, price: i.price, total: i.price * i.qty }; });
    var addr = Shop.addr.get()[0] || { name: 'Rahim Uddin', phone: '01711000000', di: 0, area: 'Dhanmondi', line: 'House 12, Road 5, Dhanmondi, Dhaka' };
    var ca = Shop.calc({ lines: lines, zone: Shop.zoneOf(addr.di), method: method, coupons: [], user: true });
    var ord = { no: no, ts: Date.now() - daysAgo * Shop.DAY - 3 * 3600000, status: status, method: method, payStatus: payStatus, items: items, addr: addr, totals: ca, ships: [], demo: true, note: '' };
    if (o) for (var k in o) ord[k] = o[k];
    return ord;
  }
  var demoCache = null;
  function demoOrders() {
    if (demoCache) return demoCache;
    var a = [];
    a.push(mkOrder('BD-100248', 0, 'placed', 'cod', 'cod', [[12, undefined, 1], [47, undefined, 2]]));
    a.push(mkOrder('BD-100231', 1, 'processing', 'bkash', 'paid', [[210, undefined, 1]]));
    var o3 = mkOrder('BD-100219', 4, 'shipped', 'nagad', 'paid', [[35, undefined, 1], [77, undefined, 1], [150, undefined, 2]]);
    o3.ships = [
      { id: 'S1', courier: 'Pathao', track: 'PTH-8841233', status: 'shipped', idx: [0, 2], eta: Date.now() + 1 * Shop.DAY, ts: Date.now() - 1 * Shop.DAY },
      { id: 'S2', courier: '', track: '', status: 'processing', idx: [1], eta: Date.now() + 3 * Shop.DAY, ts: 0 }
    ]; a.push(o3);
    var o4 = mkOrder('BD-100174', 5, 'delivered', 'cod', 'paid', [[104, undefined, 1]]);
    o4.ships = [{ id: 'S1', courier: 'Steadfast', track: 'SF-3321908', status: 'delivered', idx: [0], eta: Date.now() - 3 * Shop.DAY, ts: Date.now() - 3 * Shop.DAY }];
    o4.deliveredTs = Date.now() - 3 * Shop.DAY; a.push(o4);
    var o5 = mkOrder('BD-100163', 0, 'pending', 'gw', 'pending', [[321, undefined, 1]]);
    o5.ts = Date.now() - 12 * 60000; a.push(o5);
    a.push(mkOrder('BD-100120', 12, 'cancelled', 'bkash', 'refunded', [[63, undefined, 1]]));
    var o7 = mkOrder('BD-100098', 24, 'returned', 'cod', 'refunded', [[188, undefined, 1]]);
    o7.ships = [{ id: 'S1', courier: 'Pathao', track: 'PTH-7712004', status: 'delivered', idx: [0], eta: Date.now() - 22 * Shop.DAY, ts: Date.now() - 22 * Shop.DAY }];
    o7.deliveredTs = Date.now() - 22 * Shop.DAY; a.push(o7);
    return (demoCache = a);
  }
  Shop.orders = {
    stored: function () { var a = store.getJSON('shop.orders', []); return Array.isArray(a) ? a : []; },
    all: function () { return Shop.orders.stored().concat(Shop.isDemo() ? demoOrders() : []); },
    get: function (no) {
      no = String(no || '').trim().toUpperCase();
      var hit = null; Shop.orders.stored().concat(demoOrders()).forEach(function (o) { if (!hit && o.no === no) hit = o; });
      return hit;
    },
    add: function (o) { var a = Shop.orders.stored(); a.unshift(o); store.setJSON('shop.orders', a); Shop.emit('orders'); },
    update: function (o) {
      var a = Shop.orders.stored(), hit = false;
      a = a.map(function (x) { if (x.no === o.no) { hit = true; return o; } return x; });
      if (hit) store.setJSON('shop.orders', a); else { // demo order modified: keep a stored override
        a.unshift(o); store.setJSON('shop.orders', a);
      }
      Shop.emit('orders');
    },
    nextNo: function () { var n = +store.get('shop.ordseq') || 100249; store.set('shop.ordseq', String(n + 1)); return 'BD-' + n; }
  };
  // overrides: a stored copy of a demo order wins in get() / all()
  var origAll = Shop.orders.all, origGet = Shop.orders.get;
  Shop.orders.all = function () {
    var seen = {}, out = [];
    origAll().forEach(function (o) { if (!seen[o.no]) { seen[o.no] = 1; out.push(o); } });
    return out.sort(function (a, b) { return b.ts - a.ts; });
  };
  Shop.orders.get = origGet;
  // position in the 5-step timeline (-1 for cancelled etc.)
  Shop.stepOf = function (o) { var i = Shop.ORDER_STEPS.indexOf(o.status); return i; };
  Shop.statusClass = function (s) { return ({ delivered: 'ok', cancelled: 'bad', returned: 'bad', pending: 'warn', failed: 'bad' })[s] || 'info'; };
  Shop.statusPill = function (s) { return '<span class="pill pill-' + Shop.statusClass(s) + '" ' + Shop.X('st_' + s) + '</span>'; };
  Shop.payLabel = function (o) {
    var k = o.payStatus === 'paid' ? 'pay_paid' : o.payStatus === 'pending' ? 'pay_pending' : o.payStatus === 'refunded' ? 'pay_refunded' : o.payStatus === 'failed' ? 'pay_failed' : (o.totals && o.totals.payNow > 0 && o.totals.payDue > 0 ? 'pay_partial' : 'pay_cod');
    return k;
  };
  // item thumbnail + title row used in several places
  Shop.itemRow = function (i, extra) {
    var p = D.getProduct(i.id), d = D.detail(i.id), c = d.combo(i.variant);
    return '<div class="irow"><a class="irow-img" href="' + Shop.url.product(p.id) + '" tabindex="-1" aria-hidden="true"><div class="ph" style="--h:' + c.h + '"><span>' + p.emoji + '</span></div></a>' +
      '<div class="irow-t"><a href="' + Shop.url.product(p.id) + '" class="irow-n">' + esc(p.title) + '</a>' + (c.label && c.label.en ? '<span class="muted irow-v" ' + Shop.LX(c.label.en, c.label.bn) + '</span>' : '') +
      '<span class="muted irow-q">' + i.qty + ' × ' + fmt(i.price) + '</span>' + (extra || '') + '</div><b class="irow-p">' + fmt(i.price * i.qty) + '</b></div>';
  };
  // "delivery ৳60 + 20% advance ৳300" style breakdown of the amount payable now (COD orders, Full phase); '' when nothing to explain
  Shop.payBreak = function (c) {
    if (c.method !== 'cod' || !(c.payNow > 0)) return '';
    var p = [];
    if (c.advFee) p.push(t('pb_del', { amt: fmt(c.advFee) }));
    if (c.advItems) p.push(c.advPct ? t('pb_adv_pct', { pct: c.advPct, amt: fmt(c.advItems) }) : t('pb_adv', { amt: fmt(c.advItems) }));
    if (c.preAdv) p.push(t('pb_pre', { amt: fmt(c.preAdv) }));
    return p.join(' + ');
  };
  // totals block (summary rows) for a calc result; opts: {est:true}
  Shop.sumRows = function (c, o) {
    o = o || {};
    var r = '<dl class="sum">' +
      '<div><dt>' + t('subtotal') + '</dt><dd>' + fmt(c.sub) + '</dd></div>';
    if (c.cdisc) r += '<div class="sum-g"><dt>' + t('s_coupon') + '</dt><dd>-' + fmt(c.cdisc) + '</dd></div>';
    if (c.pm) r += '<div class="sum-g"><dt>' + t('s_pm') + ' (' + c.pmPct + '%)</dt><dd>-' + fmt(c.pm) + '</dd></div>';
    r += '<div><dt>' + t('s_delivery') + (o.est ? ' <small class="muted">(' + t('s_est') + ')</small>' : '') + '</dt><dd>' + (c.delFree ? '<span class="ok">' + t('s_free') + '</span>' : fmt(c.charge)) + '</dd></div>';
    if (c.pts) r += '<div class="sum-g"><dt>' + t('s_points') + '</dt><dd>-' + fmt(c.pts) + '</dd></div>';
    if (c.wallet) r += '<div class="sum-g"><dt>' + t('s_wallet') + '</dt><dd>-' + fmt(c.wallet) + '</dd></div>';
    r += '<div class="sum-t"><dt>' + t('s_total') + '</dt><dd>' + fmt(c.total) + '</dd></div>' +
      '<div class="sum-vat"><dt>' + t('s_vat', { r: Shop.config.vat }) + '</dt><dd>' + fmt(c.vat) + '</dd></div>';
    return r + '</dl>';
  };

  /* ---------------------------------------------------------------- overlays built by pages */
  // returns the .ovl node (appended to #frame once); inner = HTML of the sheet content
  Shop.ovlModal = function (id, inner, cls) {
    var old = document.getElementById(id); if (old) old.parentNode.removeChild(old);
    var n = Shop.el('<div class="ovl" id="' + id + '"><div class="sheet-back" data-close></div><div class="sheet modal ' + (cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '-h">' + inner + '</div></div>');
    document.getElementById('frame').appendChild(n); Shop.applyI18n(n);
    return n;
  };
  Shop.modalHead = function (id, titleKey) {
    return '<div class="sheet-h"><h2 id="' + id + '-h" ' + Shop.X(titleKey) + '</h2><button class="icon-btn" type="button" data-close ' + Shop.XA('aria-label', 'close') + '>' + icon('close', 20) + '</button></div>';
  };
  // form field helper: Shop.field({id, label(key), type, ph(key), val, ac, req, hint(key), inputmode})
  Shop.field = function (f) {
    return '<div class="fld"><label for="' + f.id + '" ' + Shop.X(f.label) + (f.opt ? ' <em class="muted">(' + esc(t('optional')) + ')</em>' : '') + '</label>' +
      '<input class="inp" id="' + f.id + '" name="' + (f.name || f.id) + '" type="' + (f.type || 'text') + '"' + (f.ph ? ' ' + Shop.XA('placeholder', f.ph) : '') + (f.val ? ' value="' + esc(f.val) + '"' : '') +
      (f.ac ? ' autocomplete="' + f.ac + '"' : '') + (f.im ? ' inputmode="' + f.im + '"' : '') + (f.max ? ' maxlength="' + f.max + '"' : '') + ' aria-describedby="' + f.id + '-e">' +
      '<p class="fld-e" id="' + f.id + '-e" role="alert" hidden></p></div>';
  };
  Shop.fieldErr = function (id, key, vars) {
    var inp = document.getElementById(id), e = document.getElementById(id + '-e');
    if (!inp || !e) return;
    if (key) { e.hidden = false; e.setAttribute('data-i18n', key); e.textContent = t(key, vars); inp.setAttribute('aria-invalid', 'true'); }
    else { e.hidden = true; e.removeAttribute('data-i18n'); inp.removeAttribute('aria-invalid'); }
  };
  Shop.validPhone = function (v) { return /^01[3-9]\d{8}$/.test(String(v).replace(/[\s-]/g, '')); };

  /* ---------------------------------------------------------------- OTP widget */
  Shop.otp = {
    html: function (id, phone) {
      var boxes = '';
      for (var i = 1; i <= 6; i++) boxes += '<input class="otp-b" type="text" inputmode="numeric" maxlength="1" autocomplete="' + (i === 1 ? 'one-time-code' : 'off') + '" data-i18n-attr="aria-label=otp_box" data-n="' + i + '" aria-label="' + esc(t('otp_box', { n: i })) + '">';
      return '<div class="otp" id="' + id + '"><p class="otp-s">' + Shop.T('otp_sent', { phone: phone || '' }) + '</p>' +
        '<div class="otp-row" role="group" ' + Shop.XA('aria-label', 'otp_title') + '>' + boxes + '</div>' +
        '<p class="fld-e otp-e" role="alert" hidden ' + Shop.X('otp_bad') + '</p>' +
        '<p class="muted otp-demo" ' + Shop.X('otp_demo') + '</p>' +
        '<div class="otp-act"><button class="btn btn-primary otp-ok" type="button" ' + Shop.X('otp_verify') + '</button>' +
        '<button class="btn-link otp-re" type="button" disabled></button></div></div>';
    },
    // opts: {onOk}; returns {focus, reset}
    bind: function (root, opts) {
      var boxes = Shop.$$('.otp-b', root), err = Shop.$('.otp-e', root), re = Shop.$('.otp-re', root), left = 0, timer = null;
      function code() { return boxes.map(function (b) { return b.value; }).join(''); }
      function tickRe() {
        if (left > 0) { re.disabled = true; re.removeAttribute('data-i18n'); re.textContent = t('otp_in', { s: left }); }
        else { re.disabled = false; re.setAttribute('data-i18n', 'otp_resend'); re.textContent = t('otp_resend'); }
      }
      function start() { clearInterval(timer); left = 30; tickRe(); timer = setInterval(function () { left--; tickRe(); if (left <= 0) clearInterval(timer); }, 1000); }
      function verify() {
        if (code() === '123456') { err.hidden = true; clearInterval(timer); if (opts.onOk) opts.onOk(); }
        else { err.hidden = false; boxes.forEach(function (b) { b.setAttribute('aria-invalid', 'true'); }); boxes[0].focus(); }
      }
      boxes.forEach(function (b, i) {
        b.addEventListener('input', function () {
          b.value = b.value.replace(/\D/g, '').slice(-1); b.removeAttribute('aria-invalid'); err.hidden = true;
          if (b.value && i < 5) boxes[i + 1].focus();
          if (code().length === 6) verify();
        });
        b.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ''; }
          else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
          else if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
        });
        b.addEventListener('paste', function (e) {
          var txt = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '').slice(0, 6);
          if (!txt) return; e.preventDefault();
          txt.split('').forEach(function (ch, k) { boxes[k].value = ch; }); boxes[Math.min(txt.length, 5)].focus();
          if (txt.length === 6) verify();
        });
      });
      Shop.$('.otp-ok', root).addEventListener('click', verify);
      re.addEventListener('click', function () { if (left <= 0) { boxes.forEach(function (b) { b.value = ''; }); boxes[0].focus(); start(); Shop.toast(t('otp_sent', { phone: '' }).replace(/ \S*$/, '')); } });
      Shop.on('lang', tickRe);
      start();
      return { focus: function () { boxes[0].focus(); }, reset: function () { boxes.forEach(function (b) { b.value = ''; }); err.hidden = true; start(); } };
    }
  };

  /* ---------------------------------------------------------------- page chrome helpers */
  Shop.pageHead = function (titleKey, subKey) {
    return '<header class="pg-h"><h1 ' + Shop.X(titleKey) + '</h1>' + (subKey ? '<p class="muted" ' + Shop.X(subKey) + '</p>' : '') + '</header>';
  };
  // wraps renderPage and syncs the header login label
  var origRender = Shop.renderPage;
  Shop.renderPage = function (body, o) {
    var inner = o && o.onReady;
    o = o || {};
    o.onReady = function (frame) { headerUser(); if (inner) inner(frame); };
    return origRender(body, o);
  };
  Shop.on('user', headerUser);
})();
