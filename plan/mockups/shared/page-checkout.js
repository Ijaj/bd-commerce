/* Checkout page (checkout.html). Reads the SELECTED cart lines (Shop.checkoutLines), shop.applied coupons, shop.user (logged in or guest).
   Place order: online method (or COD with an advance) -> payment.html?o=<no>&m=<method>, otherwise order-success.html?o=<no>. */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, $$ = Shop.$$, X = Shop.X, XA = Shop.XA, T = Shop.T, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data, C = Shop.config;

  Shop.i18n({
    en: {
      co_title: 'Checkout', stp_cart: 'Cart', stp_details: 'Details', stp_pay: 'Payment', stp_done: 'Done',
      co_s1: 'Contact', co_s2: 'Delivery address', co_s3: 'Delivery', co_s4: 'Payment method', co_s5: 'Discounts and rewards', co_s6: 'Order notes',
      co_login_hint: 'Have an account?', co_login_cta: 'Log in for faster checkout', co_guest_note: 'No account needed. If you verify this phone number later, we will link this order to your account.',
      co_as: 'Ordering as', co_verified: 'Verified', co_not_you: 'Not you? Log out', co_name: 'Full name', co_name_ph: 'Your name', co_phone: 'Mobile number', co_phone_ph: '01XXXXXXXXX',
      ad_saved: 'Saved addresses', ad_new: 'Add a new address', ad_recv: 'Receiver name', ad_district: 'District', ad_pick: 'Select district', ad_area: 'Area / thana', ad_area_ph: 'e.g. Dhanmondi',
      ad_line: 'Full address', ad_line_ph: 'House, road, landmark', ad_label: 'Address label', ad_home: 'Home', ad_office: 'Office', ad_save: 'Save this address for next time', ad_add_btn: 'Use this address',
      ad_default: 'Default', ad_err_district: 'Select a district.', ad_err_area: 'Enter your area or thana.', ad_err_line: 'Enter your full address.', ad_cancel: 'Cancel',
      dl_zone: 'Delivery zone', dl_est: 'Estimated delivery', dl_days: '{a} to {b} working days', dl_charge: 'Delivery charge', dl_one: 'One delivery charge for the whole order, even if it arrives in several parcels.',
      dl_cod_first: 'On cash on delivery, the full delivery charge is collected with the first parcel.', dl_free: 'Free delivery on this order', dl_parcel: 'Parcel {n}', dl_items: 'Items: {n}', dl_by: 'Estimated by',
      dl_kg: 'Total weight {w} kg', dl_pick_first: 'Select an address to see the exact charge. Showing the Inside Dhaka rate for now.',
      pm_cod_s: 'Pay in cash when you receive the parcel', pm_bkash_s: 'Pay with your bKash account', pm_nagad_s: 'Pay with your Nagad account', pm_gw_s: 'Visa, Mastercard, other mobile banking and net banking',
      pm_off: '{p}% off, up to {m}', pm_cashback: 'Puja offer: 10% cashback to your wallet', pm_secure: 'You will be taken to a secure payment page. Pay within 30 minutes or the order is cancelled.',
      cod_adv_t: 'Advance payment needed', cod_adv_s: 'This cash on delivery order needs {adv} paid now. It is deducted from your total.', cod_adv_via: 'Pay the advance with',
      adv_why_fee: 'Delivery charge {amt}: paid in advance because delivery is not free for this order.', adv_why_pct: '{pct}% advance on selected items: {amt}', adv_why_any: 'Advance on selected items: {amt}',
      adv_why_risky: 'Your account needs a {pct}% advance on the order.',
      dl_free_rule: 'Free delivery above {amt} in this zone.', dl_free_more: 'Add {amt} more to get free delivery (free above {rule} in this zone).', dl_free_never: 'Free delivery is not available in this zone.', dl_launch_cod: 'At launch the delivery charge is collected on delivery.',
      demo_drop: 'Add a dropship item (20% advance)', demo_risky: 'Risky customer flag', demo_phase_note: 'Phase: {ph}',
      cod_otp: 'Guest orders above {amt} on cash on delivery are confirmed with an SMS code.', pre_t: 'Pre-order items', pre_s: 'Pay {pct}% ({adv}) now. The remaining {due} is paid on delivery.',
      dc_coupon: 'Coupon code', dc_wallet_cp: 'From my coupon wallet', dc_none_cp: 'No coupons in your wallet.', dc_sw: 'Store wallet', dc_sw_bal: 'Balance {bal}. Spend only, no cash out.', dc_use_wallet: 'Use wallet balance',
      dc_pts: 'Loyalty points', dc_pts_s: 'You have {n} points (1 point = ৳1).', dc_pts_rule: 'Redeem at least {min} points, up to {pct}% of the order ({max}).', dc_pts_use: 'Redeem {n} points', dc_pts_low: 'Not enough points or order too small to redeem.',
      dc_aff: 'Affiliate or referral code', dc_aff_ph: 'Optional code', dc_aff_ok: 'Code {c} applied. Thanks for supporting a creator!', dc_aff_bad: 'Enter a valid code (at least 4 letters or numbers).',
      dc_login: 'Log in to use your wallet, points and saved coupons.', dc_login_btn: 'Log in', note_ph: 'Anything the courier or seller should know? (optional)',
      sum_h2: 'Order summary', sum_edit: 'Edit cart', terms: 'I agree to the Terms of Sale and Return Policy', terms_err: 'Please accept the terms to place your order.',
      place: 'Place order', place_pay: 'Place order and pay', total_pay: 'Total to pay', no_sel: 'No items selected', no_sel_s: 'Go back to your cart and select items to check out.', back_cart: 'Back to cart',
      otp_h: 'Confirm your order', otp_s: 'Guest cash on delivery orders above {amt} are confirmed with a code sent to your phone.', placing: 'Placing your order...',
      err_name: 'Enter your name.', err_phone: 'Enter a valid mobile number (01XXXXXXXXX).', err_addr: 'Please choose or add a delivery address.', err_fix: 'Please fix the highlighted fields.',
      demo_h: 'Demo controls', demo_big: 'Add a 50,000+ item (10% advance)', demo_pre: 'Add a pre-order item', demo_user: 'Switch guest / logged in',
      split_title: 'Ships in separate parcels', logged_demo: 'Logged in (demo)', stock_head: 'Parcels'
    },
    bn: {
      co_title: 'চেকআউট', stp_cart: 'কার্ট', stp_details: 'তথ্য', stp_pay: 'পেমেন্ট', stp_done: 'সম্পন্ন',
      co_s1: 'যোগাযোগ', co_s2: 'ডেলিভারি ঠিকানা', co_s3: 'ডেলিভারি', co_s4: 'পেমেন্ট পদ্ধতি', co_s5: 'ছাড় ও রিওয়ার্ড', co_s6: 'অর্ডার নোট',
      co_login_hint: 'অ্যাকাউন্ট আছে?', co_login_cta: 'দ্রুত চেকআউটে লগইন করুন', co_guest_note: 'অ্যাকাউন্ট লাগবে না। পরে এই নম্বর যাচাই করলে অর্ডারটি আপনার অ্যাকাউন্টে যুক্ত হবে।',
      co_as: 'অর্ডার করছেন', co_verified: 'যাচাইকৃত', co_not_you: 'আপনি নন? লগআউট', co_name: 'পূর্ণ নাম', co_name_ph: 'আপনার নাম', co_phone: 'মোবাইল নম্বর', co_phone_ph: '01XXXXXXXXX',
      ad_saved: 'সংরক্ষিত ঠিকানা', ad_new: 'নতুন ঠিকানা যোগ করুন', ad_recv: 'প্রাপকের নাম', ad_district: 'জেলা', ad_pick: 'জেলা বেছে নিন', ad_area: 'এলাকা / থানা', ad_area_ph: 'যেমন ধানমন্ডি',
      ad_line: 'পূর্ণ ঠিকানা', ad_line_ph: 'বাড়ি, রোড, ল্যান্ডমার্ক', ad_label: 'ঠিকানার ধরন', ad_home: 'বাসা', ad_office: 'অফিস', ad_save: 'পরবর্তীর জন্য ঠিকানাটি সংরক্ষণ করুন', ad_add_btn: 'এই ঠিকানা ব্যবহার করুন',
      ad_default: 'ডিফল্ট', ad_err_district: 'জেলা বেছে নিন।', ad_err_area: 'এলাকা বা থানা লিখুন।', ad_err_line: 'পূর্ণ ঠিকানা লিখুন।', ad_cancel: 'বাতিল',
      dl_zone: 'ডেলিভারি জোন', dl_est: 'আনুমানিক ডেলিভারি', dl_days: '{a} থেকে {b} কর্মদিবস', dl_charge: 'ডেলিভারি চার্জ', dl_one: 'কয়েকটি পার্সেলে এলেও পুরো অর্ডারে ডেলিভারি চার্জ একবারই।',
      dl_cod_first: 'ক্যাশ অন ডেলিভারিতে পুরো ডেলিভারি চার্জ প্রথম পার্সেলের সময় নেওয়া হয়।', dl_free: 'এই অর্ডারে ডেলিভারি ফ্রি', dl_parcel: 'পার্সেল {n}', dl_items: 'আইটেম: {n}', dl_by: 'আনুমানিক',
      dl_kg: 'মোট ওজন {w} কেজি', dl_pick_first: 'সঠিক চার্জ দেখতে ঠিকানা বেছে নিন। আপাতত ঢাকা সিটির রেট দেখানো হচ্ছে।',
      pm_cod_s: 'পার্সেল হাতে পেয়ে নগদ পরিশোধ করুন', pm_bkash_s: 'আপনার বিকাশ অ্যাকাউন্ট দিয়ে পরিশোধ', pm_nagad_s: 'আপনার নগদ অ্যাকাউন্ট দিয়ে পরিশোধ', pm_gw_s: 'ভিসা, মাস্টারকার্ড, অন্যান্য মোবাইল ব্যাংকিং ও নেট ব্যাংকিং',
      pm_off: '{p}% ছাড়, সর্বোচ্চ {m}', pm_cashback: 'পূজা অফার: ওয়ালেটে 10% ক্যাশব্যাক', pm_secure: 'নিরাপদ পেমেন্ট পেজে নিয়ে যাওয়া হবে। 30 মিনিটের মধ্যে পরিশোধ না করলে অর্ডার বাতিল হবে।',
      cod_adv_t: 'অগ্রিম পরিশোধ লাগবে', cod_adv_s: 'এই ক্যাশ অন ডেলিভারি অর্ডারে এখন {adv} দিতে হবে। এটি মোট থেকে বাদ যাবে।', cod_adv_via: 'অগ্রিম পরিশোধের মাধ্যম',
      adv_why_fee: 'ডেলিভারি চার্জ {amt}: এই অর্ডারে ডেলিভারি ফ্রি নয়, তাই অগ্রিম দিতে হবে।', adv_why_pct: 'নির্বাচিত আইটেমে {pct}% অগ্রিম: {amt}', adv_why_any: 'নির্বাচিত আইটেমে অগ্রিম: {amt}',
      adv_why_risky: 'আপনার অ্যাকাউন্টে অর্ডারের {pct}% অগ্রিম লাগবে।',
      dl_free_rule: 'এই জোনে {amt}-এর বেশি কিনলে ডেলিভারি ফ্রি।', dl_free_more: 'ফ্রি ডেলিভারির জন্য আরও {amt} যোগ করুন (এই জোনে {rule}-এর বেশি কিনলে ফ্রি)।', dl_free_never: 'এই জোনে ফ্রি ডেলিভারি নেই।', dl_launch_cod: 'লঞ্চের সময় ডেলিভারি চার্জ ডেলিভারির সময় নেওয়া হবে।',
      demo_drop: 'ড্রপশিপ আইটেম যোগ করুন (20% অগ্রিম)', demo_risky: 'ঝুঁকিপূর্ণ গ্রাহক ফ্ল্যাগ', demo_phase_note: 'ফেজ: {ph}',
      cod_otp: 'গেস্ট ক্যাশ অন ডেলিভারি অর্ডার {amt}-এর বেশি হলে এসএমএস কোডে নিশ্চিত করা হয়।', pre_t: 'প্রি-অর্ডার আইটেম', pre_s: 'এখন {pct}% ({adv}) দিন। বাকি {due} ডেলিভারিতে দিন।',
      dc_coupon: 'কুপন কোড', dc_wallet_cp: 'আমার কুপন ওয়ালেট থেকে', dc_none_cp: 'ওয়ালেটে কোনো কুপন নেই।', dc_sw: 'স্টোর ওয়ালেট', dc_sw_bal: 'ব্যালেন্স {bal}। শুধু খরচ করা যায়, তোলা যায় না।', dc_use_wallet: 'ওয়ালেট ব্যালেন্স ব্যবহার করুন',
      dc_pts: 'লয়্যালটি পয়েন্ট', dc_pts_s: 'আপনার {n} পয়েন্ট আছে (1 পয়েন্ট = ৳1)।', dc_pts_rule: 'কমপক্ষে {min} পয়েন্ট, অর্ডারের {pct}% পর্যন্ত ({max}) ভাঙানো যায়।', dc_pts_use: '{n} পয়েন্ট ব্যবহার', dc_pts_low: 'পয়েন্ট কম বা অর্ডার ছোট হওয়ায় ভাঙানো যাচ্ছে না।',
      dc_aff: 'অ্যাফিলিয়েট বা রেফারেল কোড', dc_aff_ph: 'ঐচ্ছিক কোড', dc_aff_ok: 'কোড {c} প্রয়োগ হয়েছে। ক্রিয়েটরকে সমর্থনের জন্য ধন্যবাদ!', dc_aff_bad: 'সঠিক কোড দিন (কমপক্ষে 4 অক্ষর বা সংখ্যা)।',
      dc_login: 'ওয়ালেট, পয়েন্ট ও সংরক্ষিত কুপন ব্যবহারে লগইন করুন।', dc_login_btn: 'লগইন', note_ph: 'কুরিয়ার বা বিক্রেতার জন্য কিছু জানানোর আছে? (ঐচ্ছিক)',
      sum_h2: 'অর্ডার সারসংক্ষেপ', sum_edit: 'কার্ট এডিট', terms: 'আমি বিক্রয়ের শর্তাবলী ও রিটার্ন নীতিতে সম্মত', terms_err: 'অর্ডার করতে শর্তে সম্মত হন।',
      place: 'অর্ডার করুন', place_pay: 'অর্ডার করে পেমেন্ট করুন', total_pay: 'মোট পরিশোধযোগ্য', no_sel: 'কোনো আইটেম সিলেক্ট করা নেই', no_sel_s: 'কার্টে ফিরে গিয়ে চেকআউটের জন্য আইটেম সিলেক্ট করুন।', back_cart: 'কার্টে ফিরুন',
      otp_h: 'অর্ডার নিশ্চিত করুন', otp_s: 'গেস্ট ক্যাশ অন ডেলিভারি অর্ডার {amt}-এর বেশি হলে ফোনে পাঠানো কোডে নিশ্চিত করা হয়।', placing: 'অর্ডার দেওয়া হচ্ছে...',
      err_name: 'আপনার নাম লিখুন।', err_phone: 'সঠিক মোবাইল নম্বর (01XXXXXXXXX) দিন।', err_addr: 'ডেলিভারি ঠিকানা বেছে নিন বা যোগ করুন।', err_fix: 'চিহ্নিত ঘরগুলো ঠিক করুন।',
      demo_h: 'ডেমো কন্ট্রোল', demo_big: '50,000+ টাকার আইটেম যোগ করুন (10% অগ্রিম)', demo_pre: 'প্রি-অর্ডার আইটেম যোগ করুন', demo_user: 'গেস্ট / লগইন বদলান',
      split_title: 'আলাদা পার্সেলে আসবে', logged_demo: 'লগইন (ডেমো)', stock_head: 'পার্সেল'
    }
  });

  var S = { addrId: null, method: 'cod', advVia: 'bkash', wallet: false, points: 0, aff: '', terms: false, adding: false, newDi: '', placing: false };
  function user() { return Shop.user.get(); }
  function lines() { return Shop.checkoutLines(); }
  function addrs() { return user() ? Shop.addr.get() : []; }
  function curAddr() { var a = addrs().filter(function (x) { return x.id === S.addrId; })[0]; return a || null; }
  function zone() {
    var a = curAddr(); if (a) return Shop.zoneOf(a.di);
    return S.newDi !== '' ? Shop.zoneOf(+S.newDi) : 'dhaka';
  }
  function calc() {
    var u = user(), w = u ? Shop.wallet.get() : { bal: 0 };
    return Shop.calc({ lines: lines(), zone: zone(), coupons: Shop.applied.get(), method: S.method, wallet: S.wallet && !!u, walletBal: w.bal, points: u ? S.points : 0, user: !!u, risky: Shop.risky.get() });
  }
  function dateRange(c) {
    var d1 = new Date(Date.now() + c.days[0] * Shop.DAY), d2 = new Date(Date.now() + c.days[1] * Shop.DAY);
    var en = d1.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d1.getMonth()] + ' - ' + d2.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d2.getMonth()];
    var bn = d1.getDate() + ' ' + ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'][d1.getMonth()] + ' - ' + d2.getDate() + ' ' + ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'][d2.getMonth()];
    return '<b ' + Shop.LX(en, bn) + '</b>';
  }

  function sec(n, key, id, body) {
    return '<section class="cks" id="' + id + '" aria-labelledby="' + id + '-h"><h2 class="cks-h" id="' + id + '-h"><span class="cks-n" aria-hidden="true">' + n + '</span><span ' + X(key) + '</span></h2><div class="cks-b">' + body + '</div></section>';
  }
  function steps() {
    var s = [['stp_cart', 'cart.html'], ['stp_details', ''], ['stp_pay', ''], ['stp_done', '']];
    return '<ol class="stepsx" aria-label="' + esc(t('co_title')) + '">' + s.map(function (x, i) {
      var cur = i === 1, done = i < 1;
      return '<li' + (cur ? ' aria-current="step"' : '') + (done ? ' class="done"' : '') + '>' + (x[1] ? '<a href="' + x[1] + '">' : '') + '<span class="sx-n">' + (done ? icon('check', 14) : i + 1) + '</span><span class="sx-t" ' + X(x[0]) + '</span>' + (x[1] ? '</a>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  /* ---- 1 contact */
  function contactHTML() {
    var u = user();
    if (u) return '<div class="ct-user"><span class="ct-av" aria-hidden="true">' + esc(u.name.charAt(0)) + '</span><div><b>' + esc(u.name) + '</b><p class="muted">' + esc(u.phone || u.email) + (u.verified ? ' <span class="ok vf">' + icon('check', 14) + ' <span ' + X('co_verified') + '</span></span>' : '') + '</p></div>' +
      '<button class="btn-link" type="button" id="coLogout" ' + X('co_not_you') + '</button></div>';
    return '<p class="ct-hint"><span class="muted" ' + X('co_login_hint') + '</span> <button class="btn-link" type="button" id="coLogin" ' + X('co_login_cta') + '</button></p>' +
      '<div class="two"><div class="fld"><label for="ctName" ' + X('co_name') + '</label><input class="inp" id="ctName" autocomplete="name" ' + XA('placeholder', 'co_name_ph') + ' aria-describedby="ctName-e"><p class="fld-e" id="ctName-e" role="alert" hidden></p></div>' +
      '<div class="fld"><label for="ctPhone" ' + X('co_phone') + '</label><input class="inp" id="ctPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="14" ' + XA('placeholder', 'co_phone_ph') + ' aria-describedby="ctPhone-e"><p class="fld-e" id="ctPhone-e" role="alert" hidden></p></div></div>' +
      '<p class="muted note-s">' + icon('info', 14) + ' <span ' + X('co_guest_note') + '</span></p>';
  }

  /* ---- 2 address */
  function addrListHTML() {
    var list = addrs();
    if (!list.length) return '';
    return '<h3 class="sec-h3" ' + X('ad_saved') + '</h3><div class="rcards" role="radiogroup" ' + XA('aria-label', 'ad_saved') + '>' + list.map(function (a) {
      return '<label class="rcard"><input type="radio" name="addr" value="' + a.id + '"' + (S.addrId === a.id ? ' checked' : '') + '><span class="rc-b"><span class="rc-t"><b>' + esc(a.name) + '</b><span class="tagx">' + icon(a.label === 'office' ? 'store' : 'home', 13) + ' <span ' + X(a.label === 'office' ? 'ad_office' : 'ad_home') + '</span></span>' +
        (a.def ? '<span class="tagx tagx-acc" ' + X('ad_default') + '</span>' : '') + '</span><span class="rc-s">' + esc(a.line) + '</span><span class="rc-s muted">' + esc(a.phone) + ' · <span ' + Shop.LX(D.districts[a.di][0], D.districts[a.di][1]) + '</span></span></span></label>';
    }).join('') + '<label class="rcard rcard-add"><input type="radio" name="addr" value="new"' + (S.addrId === null ? ' checked' : '') + '><span class="rc-b"><span class="rc-t">' + icon('plus', 16) + ' <b ' + X('ad_new') + '</b></span></span></label></div>';
  }
  function addrFormHTML() {
    var dopts = '<option value="" ' + X('ad_pick') + '</option>' + D.districts.map(function (d, i) { return '<option value="' + i + '" ' + Shop.LX(d[0], d[1]) + '</option>'; }).join('');
    return '<div class="addr-form" id="addrForm"><div class="two">' +
      '<div class="fld"><label for="adName" ' + X('ad_recv') + '</label><input class="inp" id="adName" autocomplete="name" aria-describedby="adName-e"><p class="fld-e" id="adName-e" role="alert" hidden></p></div>' +
      '<div class="fld"><label for="adPhone" ' + X('co_phone') + '</label><input class="inp" id="adPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="14" ' + XA('placeholder', 'co_phone_ph') + ' aria-describedby="adPhone-e"><p class="fld-e" id="adPhone-e" role="alert" hidden></p></div>' +
      '<div class="fld"><label for="adDist" ' + X('ad_district') + '</label><select class="inp" id="adDist" autocomplete="address-level1" aria-describedby="adDist-e">' + dopts + '</select><p class="fld-e" id="adDist-e" role="alert" hidden></p></div>' +
      '<div class="fld"><label for="adArea" ' + X('ad_area') + '</label><input class="inp" id="adArea" autocomplete="address-level2" ' + XA('placeholder', 'ad_area_ph') + ' aria-describedby="adArea-e"><p class="fld-e" id="adArea-e" role="alert" hidden></p></div></div>' +
      '<div class="fld"><label for="adLine" ' + X('ad_line') + '</label><textarea class="inp" id="adLine" rows="2" autocomplete="street-address" ' + XA('placeholder', 'ad_line_ph') + ' aria-describedby="adLine-e"></textarea><p class="fld-e" id="adLine-e" role="alert" hidden></p></div>' +
      '<fieldset class="lblset"><legend ' + X('ad_label') + '</legend><label class="chipr"><input type="radio" name="adLbl" value="home" checked><span>' + icon('home', 15) + ' <span ' + X('ad_home') + '</span></span></label>' +
      '<label class="chipr"><input type="radio" name="adLbl" value="office"><span>' + icon('store', 15) + ' <span ' + X('ad_office') + '</span></span></label></fieldset>' +
      '<label class="chk" id="adSaveW"><input type="checkbox" id="adSave" checked><span ' + X('ad_save') + '</span></label></div>';
  }
  function addressHTML() {
    return '<div id="addrList">' + addrListHTML() + '</div>' + addrFormHTML();
  }
  function syncAddrForm() {
    var f = $('#addrForm'); if (!f) return;
    f.hidden = S.addrId !== null; $('#adSaveW').hidden = !user();
  }

  /* ---- 3 delivery */
  function deliveryHTML() {
    var c = calc(), ps = Shop.parcels(lines()), z = c.zone;
    var h = '<div class="dl-top"><div><span class="muted" ' + X('dl_zone') + '</span><b ' + Shop.LX(z.en, z.bn) + '</b></div>' +
      '<div><span class="muted" ' + X('dl_est') + '</span>' + dateRange(c) + ' <small class="muted">(' + T('dl_days', { a: c.days[0], b: c.days[1] }) + ')</small></div>' +
      '<div><span class="muted" ' + X('dl_charge') + '</span><b>' + (c.delFree ? '<span class="ok">' + t('s_free') + '</span>' : fmt(c.charge)) + '</b> <small class="muted">' + T('dl_kg', { w: c.kg }) + '</small></div></div>';
    var fr = c.freeNever ? '<span ' + X('dl_free_never') + '</span>' : c.delFree ? '<span class="ok" ' + X('dl_free') + '</span>' : T('dl_free_more', { amt: fmt(c.freeLeft), rule: fmt(c.freeAbove) });
    h += '<p class="note-s muted">' + icon('truck', 14) + ' ' + fr + '</p>';
    if (!curAddr() && S.newDi === '') h += '<p class="note-s muted">' + icon('info', 14) + ' <span ' + X('dl_pick_first') + '</span></p>';
    h += '<div class="parcels">' + ps.map(function (p, i) {
      return '<div class="parcel"><div class="parcel-h"><b>' + (ps.length > 1 ? T('dl_parcel', { n: i + 1 }) : '<span ' + X('stock_head') + '</span>') + '</b><span class="tagx">' + icon(p.kind === 'drop' ? 'truck' : 'pkg', 13) + ' <span ' + X(p.kind === 'drop' ? 'pc_drop' : 'pc_stocked') + '</span></span><span class="muted">' + T('dl_items', { n: p.lines.reduce(function (s, l) { return s + l.qty; }, 0) }) + '</span></div>' +
        '<div class="parcel-i">' + p.lines.map(function (l) { return '<span class="pth" title="' + esc(l.p.title) + '"><span class="ph" style="--h:' + l.c.h + '"><span>' + l.p.emoji + '</span></span>' + (l.qty > 1 ? '<i>×' + l.qty + '</i>' : '') + '</span>'; }).join('') + '</div></div>';
    }).join('') + '</div>';
    h += '<p class="note-box">' + icon('pkg', 18) + ' <span>' + (ps.length > 1 ? '<b>' + T('pc_note', { n: ps.length }) + '</b> ' : '') + '<span ' + X('dl_one') + '</span>' + (S.method === 'cod' && ps.length > 1 && !Shop.isFull() ? ' <span ' + X('dl_cod_first') + '</span>' : '') + (!Shop.isFull() && !c.delFree ? ' <span ' + X('dl_launch_cod') + '</span>' : '') + '</span></p>';
    return h;
  }

  /* ---- 4 payment */
  function paymentHTML() {
    var c = calc(), meths = Shop.methods(), o = '<div class="rcards rcards-pm" role="radiogroup" ' + XA('aria-label', 'co_s4') + '>';
    meths.forEach(function (m) {
      var pm = Shop.PM[m], badge = pm ? '<span class="tagx tagx-sale">' + T('pm_off', { p: pm.pct, m: fmt(pm.max) }) + '</span>' : '';
      o += '<label class="rcard"><input type="radio" name="pm" value="' + m + '"' + (S.method === m ? ' checked' : '') + '><span class="rc-b rc-pm">' + Shop.methodChip(m) + '<span class="rc-x"><span class="rc-t"><b ' + X('m_' + m) + '</b>' + badge + '</span><span class="rc-s muted" ' + X('pm_' + m + '_s') + '</span>' +
        (m === 'bkash' && Shop.isFull() ? '<span class="rc-s ok">' + icon('bolt', 13) + ' <span ' + X('pm_cashback') + '</span></span>' : '') + '</span></span></label>';
    });
    o += '</div>';
    if (S.method === 'cod') {
      if (c.codAdv > 0) {
        var why = [];
        if (c.advFee) why.push(T('adv_why_fee', { amt: fmt(c.advFee) }));
        if (c.advItems) why.push(c.advPct ? T('adv_why_pct', { pct: c.advPct, amt: fmt(c.advItems) }) : T('adv_why_any', { amt: fmt(c.advItems) }));
        if (c.advRisky) why.push(T('adv_why_risky', { pct: C.riskyPct }));
        o += '<div class="alert alert-warn" role="note"><b>' + icon('info', 16) + ' <span ' + X('cod_adv_t') + '</span></b><p>' + T('cod_adv_s', { adv: fmt(c.payNow) }) + '</p><ul class="adv-why">' + why.map(function (w) { return '<li>' + w + '</li>'; }).join('') + '</ul>' +
          '<div class="alert-r"><span class="muted" ' + X('cod_adv_via') + '</span><label class="chipr"><input type="radio" name="advVia" value="bkash"' + (S.advVia === 'bkash' ? ' checked' : '') + '><span ' + X('m_bkash') + '</span></label>' +
          '<label class="chipr"><input type="radio" name="advVia" value="nagad"' + (S.advVia === 'nagad' ? ' checked' : '') + '><span ' + X('m_nagad') + '</span></label>' +
          '<label class="chipr"><input type="radio" name="advVia" value="gw"' + (S.advVia === 'gw' ? ' checked' : '') + '><span ' + X('m_gw') + '</span></label></div></div>';
      }
      if (c.needOtp || (!user() && c.total > 0)) o += '<p class="note-s muted">' + icon('shield', 14) + ' ' + T('cod_otp', { amt: fmt(C.otpGuestCod) }) + '</p>';
    } else o += '<p class="note-s muted">' + icon('shield', 14) + ' <span ' + X('pm_secure') + '</span></p>';
    if (c.hasPre) o += '<div class="alert" role="note"><b>' + icon('tag', 16) + ' <span ' + X('pre_t') + '</span></b><p>' + T('pre_s', { pct: C.preorderPct, adv: fmt(c.preAdv), due: fmt(c.preDue) }) + '</p></div>';
    return o;
  }

  /* ---- 5 discounts */
  function discountHTML() {
    var u = user(), sub = lines().reduce(function (s, l) { return s + l.total; }, 0), applied = Shop.applied.get();
    var chips = applied.map(function (code) { var d = Shop.coupon.def(code); return '<li class="cp-chip">' + icon('ticket', 15) + ' <b>' + code + '</b> <span class="muted" ' + Shop.LX(d.en, d.bn) + '</span><button type="button" class="icon-btn" data-cp-rm="' + code + '" ' + XA('aria-label', 'cp_remove') + '>' + icon('close', 14) + '</button></li>'; }).join('');
    var wal = Shop.collected.get().filter(function (c) { return Shop.coupon.def(c) && applied.indexOf(c) < 0; });
    var picks = wal.length ? wal.map(function (code) {
      var ev = Shop.coupon.eval(code, sub), ok = ev.ok && Shop.coupon.canStack(code, applied.concat(code)), d = Shop.coupon.def(code);
      return '<button class="chipl' + (ok ? '' : ' is-dis') + '" type="button" data-pick="' + code + '"' + (ok ? '' : ' disabled') + '>' + icon('ticket', 14) + ' <b>' + code + '</b> <em ' + Shop.LX(d.en, d.bn) + '</em></button>';
    }).join('') : '<span class="muted" ' + X('dc_none_cp') + '</span>';
    var h = '<div class="dc"><h3 class="sec-h3" ' + X('dc_coupon') + '</h3><form class="cp-form" id="cpForm" novalidate><label class="sr-only" for="cpIn" ' + X('dc_coupon') + '</label><input class="inp" id="cpIn" ' + XA('placeholder', 'cp_code_ph') + ' autocomplete="off" autocapitalize="characters"><button class="btn btn-ghost" type="submit" ' + X('cp_apply') + '</button></form>' +
      '<p class="fld-e" id="cpErr" role="alert" hidden></p>' + (chips ? '<ul class="cp-chips">' + chips + '</ul>' : '') +
      '<p class="muted dc-sub" ' + X('dc_wallet_cp') + '</p><div class="cp-picks">' + picks + '</div></div>';
    if (!u) return h + '<div class="alert" role="note"><p>' + icon('user', 16) + ' <span ' + X('dc_login') + '</span> <button class="btn-link" type="button" id="dcLogin" ' + X('dc_login_btn') + '</button></p></div>' + affHTML();
    var w = Shop.wallet.get(), pt = Shop.points.get(), c = calc();
    var allowed = Math.min(pt.bal, c.pointsMax), can = allowed >= C.pointsMin;
    h += '<div class="dc"><h3 class="sec-h3" ' + X('dc_sw') + '</h3><label class="switch"><input type="checkbox" id="walletOn"' + (S.wallet ? ' checked' : '') + (w.bal <= 0 ? ' disabled' : '') + '><span class="sw-t"></span><span class="sw-l"><b ' + X('dc_use_wallet') + '</b><small class="muted">' + T('dc_sw_bal', { bal: fmt(w.bal) }) + '</small></span></label></div>';
    h += '<div class="dc"><h3 class="sec-h3" ' + X('dc_pts') + '</h3><p class="muted">' + T('dc_pts_s', { n: pt.bal.toLocaleString('en-US') }) + ' ' + T('dc_pts_rule', { min: C.pointsMin, pct: C.pointsMaxPct, max: fmt(c.pointsMax) }) + '</p>' +
      (can ? '<div class="pts"><input type="range" id="ptsRange" min="0" max="' + allowed + '" step="10" value="' + Math.min(S.points, allowed) + '" ' + XA('aria-label', 'dc_pts') + '><output id="ptsOut" for="ptsRange">' + T('dc_pts_use', { n: Math.min(S.points, allowed) }) + '</output></div>' : '<p class="muted"><em ' + X('dc_pts_low') + '</em></p>') + '</div>';
    return h + affHTML();
  }
  function affHTML() {
    return '<div class="dc"><h3 class="sec-h3" ' + X('dc_aff') + '</h3><form class="cp-form" id="affForm" novalidate><label class="sr-only" for="affIn" ' + X('dc_aff') + '</label><input class="inp" id="affIn" value="' + esc(S.aff) + '" ' + XA('placeholder', 'dc_aff_ph') + ' autocomplete="off"><button class="btn btn-ghost" type="submit" ' + X('cp_apply') + '</button></form>' +
      '<p class="fld-e" id="affErr" role="alert" hidden ' + X('dc_aff_bad') + '</p>' + (S.aff ? '<p class="ok aff-ok">' + icon('check', 15) + ' ' + T('dc_aff_ok', { c: S.aff }) + '</p>' : '') + '</div>';
  }

  /* ---- summary */
  function summaryHTML() {
    var ls = lines(), c = calc(), ps = Shop.parcels(ls);
    var items = ls.map(function (l) { return Shop.itemRow({ id: l.id, variant: l.variant, qty: l.qty, price: l.price }); }).join('');
    var pay = c.payNow > 0 ? '<div class="sum-split"><div><span ' + X('s_paynow') + '</span><b>' + fmt(c.payNow) + '</b>' + (Shop.payBreak(c) ? '<small class="muted pb">(' + Shop.payBreak(c) + ')</small>' : '') + '</div><div><span ' + X('s_paydue') + '</span><b>' + fmt(c.payDue) + '</b></div></div>' : '';
    return '<div class="sumbox sum-co"><h2 class="sumbox-h"><span ' + X('sum_h2') + '</span> <a class="link" href="cart.html" ' + X('sum_edit') + '</a></h2><div class="irows">' + items + '</div>' +
      (ps.length > 1 ? '<p class="note-s muted">' + icon('pkg', 14) + ' ' + T('pc_note', { n: ps.length }) + '</p>' : '') +
      Shop.sumRows(c) + pay +
      '<label class="chk terms"><input type="checkbox" id="terms"' + (S.terms ? ' checked' : '') + '><span ' + X('terms') + '</span></label><p class="fld-e" id="terms-e" role="alert" hidden ' + X('terms_err') + '</p>' +
      '<button class="btn btn-primary btn-block btn-lg" type="button" id="placeBtn"' + (S.placing ? ' disabled' : '') + '>' + icon('shield', 18) + ' <span ' + X(S.method === 'cod' && !c.codAdv && !c.hasPre ? 'place' : 'place_pay') + '</span></button></div>';
  }
  function bar(c) {
    var b = $('#coBar'); if (!b) return;
    b.innerHTML = '<div class="sb-tot"><small class="muted" ' + X('total_pay') + '</small><b>' + fmt(c.total) + '</b></div><button class="btn btn-primary" type="button" id="placeBtn2" ' + X('place') + '</button>';
    Shop.applyI18n(b);
  }

  function renderPart(id, html) { var n = $('#' + id); if (!n) return; n.innerHTML = html; Shop.applyI18n(n); }
  function refresh(parts) {
    parts = parts || 'cdpsh';
    if (parts.indexOf('c') >= 0) { var cn = $('#ctBody'); if (cn) { cn.innerHTML = contactHTML(); Shop.applyI18n(cn); } }
    if (parts.indexOf('d') >= 0) renderPart('dlBody', deliveryHTML());
    if (parts.indexOf('p') >= 0) renderPart('pmBody', paymentHTML());
    if (parts.indexOf('s') >= 0) renderPart('dcBody', discountHTML());
    if (parts.indexOf('h') >= 0) { renderPart('sumHost', summaryHTML()); bar(calc()); }
  }
  function renderAll() {
    var main = $('#coMain');
    if (!lines().length) {
      main.innerHTML = '<section class="empty"><div class="empty-i" aria-hidden="true">🧺</div><h1 ' + X('no_sel') + '</h1><p ' + X('no_sel_s') + '</p><a class="btn btn-primary" href="cart.html" ' + X('back_cart') + '</a></section>';
      Shop.applyI18n(main); $('#coBar').innerHTML = ''; return;
    }
    if (!S.addrId && addrs().length) { var d = addrs().filter(function (a) { return a.def; })[0] || addrs()[0]; S.addrId = d.id; }
    main.innerHTML = '<header class="pg-h"><h1 ' + X('co_title') + '</h1>' + steps() + '</header>' +
      '<div class="co-grid"><div class="co-l">' + sec(1, 'co_s1', 'sCt', '<div id="ctBody"></div>') + sec(2, 'co_s2', 'sAd', '<div id="adBody">' + addressHTML() + '</div>') + sec(3, 'co_s3', 'sDl', '<div id="dlBody"></div>') +
      sec(4, 'co_s4', 'sPm', '<div id="pmBody"></div>') + sec(5, 'co_s5', 'sDc', '<div id="dcBody"></div>') +
      sec(6, 'co_s6', 'sNt', '<label class="sr-only" for="note" ' + X('co_s6') + '</label><textarea class="inp" id="note" rows="2" ' + XA('placeholder', 'note_ph') + '></textarea>') +
      '<div class="demo-box" id="demoBox"></div></div>' +
      '<aside class="co-r"><div id="sumHost"></div></aside></div>';
    demoBox(); Shop.applyI18n(main); syncAddrForm(); refresh();
  }
  // demo controls: advance / pre-order triggers exist only in the Full phase
  function demoBox() {
    var full = Shop.isFull(), b = '<b ' + X('demo_h') + '</b>';
    if (full) {
      b += '<button class="btn btn-ghost btn-sm" type="button" data-demo="big" ' + X('demo_big') + '</button><button class="btn btn-ghost btn-sm" type="button" data-demo="drop" ' + X('demo_drop') + '</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-demo="risky" aria-pressed="' + Shop.risky.get() + '" ' + X('demo_risky') + '</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-demo="pre" ' + X('demo_pre') + '</button>';
    }
    b += '<button class="btn btn-ghost btn-sm" type="button" data-demo="user" ' + X('demo_user') + '</button>';
    $('#demoBox').innerHTML = b;
  }

  /* ---- placing */
  function showErr(id, key) { Shop.fieldErr(id, key); }
  function validate() {
    var bad = null, u = user();
    function fail(id, key) { showErr(id, key); if (!bad) bad = id; }
    if (!u) {
      var nm = $('#ctName').value.trim(), ph = $('#ctPhone').value.replace(/[\s-]/g, '');
      if (nm.length < 2) fail('ctName', 'err_name'); else showErr('ctName');
      if (!Shop.validPhone(ph)) fail('ctPhone', 'err_phone'); else showErr('ctPhone');
    }
    if (S.addrId === null) {
      if ($('#adName').value.trim().length < 2) fail('adName', 'err_name'); else showErr('adName');
      if (!Shop.validPhone($('#adPhone').value.replace(/[\s-]/g, ''))) fail('adPhone', 'err_phone'); else showErr('adPhone');
      if ($('#adDist').value === '') fail('adDist', 'ad_err_district'); else showErr('adDist');
      if ($('#adArea').value.trim().length < 2) fail('adArea', 'ad_err_area'); else showErr('adArea');
      if ($('#adLine').value.trim().length < 5) fail('adLine', 'ad_err_line'); else showErr('adLine');
    }
    var te = $('#terms-e'); te.hidden = $('#terms').checked;
    if (!$('#terms').checked && !bad) bad = 'terms';
    if (bad) { var n = $('#' + bad); if (n) { n.scrollIntoView({ block: 'center', behavior: Shop.reduceMotion ? 'auto' : 'smooth' }); n.focus({ preventScroll: true }); } Shop.toast(t('err_fix')); }
    return !bad;
  }
  function buildAddr() {
    var a = curAddr();
    if (a) return { name: a.name, phone: a.phone, di: a.di, area: a.area, line: a.line, label: a.label };
    var o = { name: $('#adName').value.trim(), phone: $('#adPhone').value.replace(/[\s-]/g, ''), di: +$('#adDist').value, area: $('#adArea').value.trim(), line: $('#adLine').value.trim(), label: ($('input[name=adLbl]:checked') || {}).value || 'home' };
    if (user() && $('#adSave').checked) { var list = Shop.addr.get(); list.push({ id: 'a' + Date.now(), label: o.label, name: o.name, phone: o.phone, di: o.di, area: o.area, line: o.line, def: false }); Shop.addr.save(list); }
    return o;
  }
  function place() {
    if (S.placing || !validate()) return;
    var c = calc(), u = user();
    if (c.needOtp) { openOtp(c); return; }
    finish(c);
  }
  function openOtp(c) {
    var phone = ($('#ctPhone') || {}).value || '';
    var inner = Shop.modalHead('otpOvl', 'otp_h') + '<div class="sheet-b"><p class="muted">' + T('otp_s', { amt: fmt(C.otpGuestCod) }) + '</p>' + Shop.otp.html('coOtp', phone) + '</div>';
    var n = Shop.ovlModal('otpOvl', inner, 'modal-sm');
    var w = Shop.otp.bind($('#coOtp', n), { onOk: function () { Shop.ovl.close(n); finish(calc()); } });
    Shop.ovl.open(n, '.otp-b'); setTimeout(w.focus, 60);
  }
  function finish(c) {
    S.placing = true; refresh('h');
    var u = user(), ls = lines(), a = buildAddr(), online = S.method !== 'cod' || c.payNow > 0, via = S.method !== 'cod' ? S.method : S.advVia;
    var ps = Shop.parcels(ls), idxMap = {}; ls.forEach(function (l, i) { idxMap[Shop.lineKey(l)] = i; });
    var ord = {
      no: Shop.orders.nextNo(), ts: Date.now(), status: online ? 'pending' : 'placed', method: S.method, via: online ? via : '', payStatus: online ? 'pending' : 'cod', payBy: Date.now() + 30 * 60000,
      items: ls.map(function (l) { return { id: l.id, variant: l.variant, qty: l.qty, price: l.price }; }), addr: a, totals: c, coupons: Shop.applied.get(), aff: S.aff,
      ships: ps.map(function (p, i) { return { id: 'S' + (i + 1), courier: '', track: '', status: 'processing', idx: p.lines.map(function (l) { return idxMap[Shop.lineKey(l)]; }), eta: Date.now() + c.days[1] * Shop.DAY, ts: 0, kind: p.kind }; }),
      guest: !u, contact: u ? { name: u.name, phone: u.phone } : { name: $('#ctName').value.trim(), phone: $('#ctPhone').value.replace(/[\s-]/g, '') },
      note: ($('#note') || {}).value || ''
    };
    Shop.orders.add(ord);
    // spend wallet / points, clear what was ordered
    if (u && c.wallet) { var w = Shop.wallet.get(); w.bal -= c.wallet; w.tx.unshift({ ts: Date.now(), en: 'Used on order ' + ord.no, bn: 'অর্ডার ' + ord.no + '-এ ব্যবহার', amt: -c.wallet }); Shop.wallet.save(w); }
    if (u && c.pts) { var p = Shop.points.get(); p.bal -= c.pts; p.tx.unshift({ ts: Date.now(), en: 'Redeemed on order ' + ord.no, bn: 'অর্ডার ' + ord.no + '-এ ব্যবহার', amt: -c.pts }); Shop.points.save(p); }
    ls.forEach(function (l) { Shop.cart.remove(l.id, l.variant); });
    Shop.applied.set([]);
    Shop.toast(t('placing'));
    setTimeout(function () { location.href = online ? 'payment.html?o=' + ord.no + '&m=' + via : 'order-success.html?o=' + ord.no; }, 350);
  }

  function onClick(e) {
    var b;
    if (e.target.closest('#placeBtn, #placeBtn2')) { place(); return; }
    if (e.target.closest('#coLogin, #dcLogin')) { Shop.auth.modal(function () { S.addrId = null; renderAll(); }); return; }
    if (e.target.closest('#coLogout')) { Shop.user.clear(); store_reset(); renderAll(); return; }
    if ((b = e.target.closest('[data-cp-rm]'))) { Shop.removeCoupon(b.getAttribute('data-cp-rm')); return; }
    if ((b = e.target.closest('[data-pick]'))) { var r = Shop.applyCoupon(b.getAttribute('data-pick'), lines().reduce(function (s, l) { return s + l.total; }, 0)); if (r.ok) Shop.toast(t('cp_ok', { name: r.code })); return; }
    if ((b = e.target.closest('[data-demo]'))) {
      var k = b.getAttribute('data-demo');
      if (k === 'user') { if (user()) Shop.user.clear(); else Shop.user.demo(); store_reset(); renderAll(); }
      else if (k === 'risky') { Shop.risky.set(!Shop.risky.get()); b.setAttribute('aria-pressed', String(Shop.risky.get())); refresh('psh'); }
      else if (k === 'drop') { var dp = D.all().filter(function (p) { return !p.oos && !p.preorder && p.advancePercent === 20 && p.price < 20000; })[0]; if (dp) Shop.cart.add(dp.id, D.detail(dp.id).defaultKey(), 1); renderAll(); }
      else if (k === 'pre') { Shop.cart.add(9001, D.detail(9001).defaultKey(), 1); renderAll(); }
      else { var big = D.all().filter(function (p) { return !p.oos && !p.preorder && p.price > Shop.config.advBigPrice && p.price < 80000 && !p.advancePercent; })[0]; if (big) Shop.cart.add(big.id, D.detail(big.id).defaultKey(), 1); renderAll(); }
    }
  }
  function store_reset() { S.addrId = null; S.wallet = false; S.points = 0; }
  function onChange(e) {
    var n = e.target, nm = n.name;
    if (nm === 'addr') { S.addrId = n.value === 'new' ? null : n.value; syncAddrForm(); refresh('dph'); }
    else if (nm === 'pm') { S.method = n.value; refresh('dpsh'); }
    else if (nm === 'advVia') { S.advVia = n.value; }
    else if (n.id === 'adDist') { S.newDi = n.value; refresh('dph'); }
    else if (n.id === 'walletOn') { S.wallet = n.checked; refresh('sh'); }
    else if (n.id === 'terms') { S.terms = n.checked; $('#terms-e').hidden = true; }
  }
  function onInput(e) {
    var n = e.target;
    if (n.id === 'ctName' || n.id === 'ctPhone') { // copy contact into receiver fields until the user edits them
      var tgt = $(n.id === 'ctName' ? '#adName' : '#adPhone'); if (tgt && !tgt.getAttribute('data-touched')) tgt.value = n.value;
    } else if (n.id === 'adName' || n.id === 'adPhone') n.setAttribute('data-touched', '1');
    else if (n.id === 'ptsRange') {
      var v = +n.value; if (v > 0 && v < C.pointsMin) v = v < C.pointsMin / 2 ? 0 : C.pointsMin;
      S.points = v; n.value = v; $('#ptsOut').innerHTML = T('dc_pts_use', { n: v });
      clearTimeout(onInput.tm); onInput.tm = setTimeout(function () { refresh('h'); }, 80);
    }
  }

  Shop.renderPage('<div class="wrap co-pg"><div id="coMain"></div></div>', {
    active: 'cart',
    sbar: '<div class="sbar-in" id="coBar"></div>',
    onReady: function (frame) {
      document.title = t('co_title') + ' - ShopName';
      renderAll();
      frame.addEventListener('click', onClick);
      frame.addEventListener('change', onChange);
      frame.addEventListener('input', onInput);
      frame.addEventListener('submit', function (e) {
        var id = e.target.id;
        if (id === 'cpForm') {
          var inp = $('#cpIn'), err = $('#cpErr'), r = Shop.applyCoupon(inp.value, lines().reduce(function (s, l) { return s + l.total; }, 0));
          if (r.ok) { Shop.toast(t('cp_ok', { name: r.code })); return; }
          err.hidden = false; err.setAttribute('data-i18n', r.err); err.textContent = t(r.err, r.vars); inp.setAttribute('aria-invalid', 'true');
        } else if (id === 'affForm') {
          var v = $('#affIn').value.trim().toUpperCase();
          if (/^[A-Z0-9-]{4,}$/.test(v)) { S.aff = v; } else { S.aff = ''; $('#affErr').hidden = false; return; }
          refresh('s');
        }
      });
      Shop.on('applied', function () { refresh('sh'); });
      Shop.on('user', function () { /* handled by callers */ });
      Shop.on('lang', function () { refresh('dpsh'); });
    }
  });
})();
