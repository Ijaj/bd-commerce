/* ShopName mockups - order-ui.js  (order status timeline, shipments, cancel + invoice; used by track.html and account.html)
   Load after flow.js.
     Shop.orderTimeline(ord)            status timeline HTML (done / current / cancelled / returned / payment pending)
     Shop.shipmentsHTML(ord)            each shipment with courier + tracking link + its items
     Shop.canCancel(ord) / Shop.canReturn(ord)
     Shop.cancelModal(ord, onDone)      confirm + reason sheet; paid orders refund to original method or wallet
     Shop.downloadInvoice(ord)          mock invoice (text blob) */
(function () {
  'use strict';
  var Shop = window.Shop, X = Shop.X, T = Shop.T, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data, $ = Shop.$;

  Shop.i18n({
    en: {
      tl_pending_s: 'Pay within 30 minutes to keep this order.', tl_cancelled_s: 'This order was cancelled.', tl_returned_s: 'Return completed and refunded.',
      sh_title: 'Shipments', sh_n: 'Parcel {a} of {b}', sh_none: 'Courier is assigned when your parcel is packed.', sh_track: 'Track on {c}', sh_eta: 'Expected {d}',
      sh_courier: 'Courier', sh_tid: 'Tracking ID', sh_delivered_on: 'Delivered', cn_btn: 'Cancel order', cn_h: 'Cancel this order?', cn_s: 'You can cancel until the order is packed. Paid amounts are refunded.',
      cn_reason: 'Reason', cn_r1: 'Ordered by mistake', cn_r2: 'Found a better price', cn_r3: 'Want to change address or items', cn_r4: 'Delivery takes too long', cn_r5: 'Other',
      cn_refund: 'Refund to', cn_ref_orig: 'Original payment method', cn_ref_wallet: 'Store wallet (instant)', cn_keep: 'Keep order', cn_do: 'Yes, cancel order', cn_done: 'Order cancelled',
      cn_late: 'This order is already packed, so it cannot be cancelled. You can request a return after delivery.', inv_btn: 'Download invoice', inv_done: 'Invoice downloaded (demo)',
      ret_btn: 'Request return', ret_days: 'Return window: {n} days after delivery', pm_status: 'Payment', ord_date: 'Placed on'
    },
    bn: {
      tl_pending_s: 'অর্ডার রাখতে 30 মিনিটের মধ্যে পরিশোধ করুন।', tl_cancelled_s: 'এই অর্ডার বাতিল হয়েছে।', tl_returned_s: 'রিটার্ন সম্পন্ন ও রিফান্ড হয়েছে।',
      sh_title: 'শিপমেন্ট', sh_n: 'পার্সেল {a} / {b}', sh_none: 'প্যাক হলে কুরিয়ার নির্ধারণ করা হবে।', sh_track: '{c}-এ ট্র্যাক করুন', sh_eta: 'প্রত্যাশিত {d}',
      sh_courier: 'কুরিয়ার', sh_tid: 'ট্র্যাকিং আইডি', sh_delivered_on: 'ডেলিভারি হয়েছে', cn_btn: 'অর্ডার বাতিল', cn_h: 'অর্ডারটি বাতিল করবেন?', cn_s: 'প্যাক হওয়ার আগ পর্যন্ত বাতিল করা যায়। পরিশোধিত টাকা ফেরত দেওয়া হবে।',
      cn_reason: 'কারণ', cn_r1: 'ভুল করে অর্ডার করেছি', cn_r2: 'কম দাম পেয়েছি', cn_r3: 'ঠিকানা বা আইটেম বদলাতে চাই', cn_r4: 'ডেলিভারিতে বেশি সময় লাগছে', cn_r5: 'অন্য কারণ',
      cn_refund: 'রিফান্ড যাবে', cn_ref_orig: 'মূল পেমেন্ট পদ্ধতিতে', cn_ref_wallet: 'স্টোর ওয়ালেটে (তাৎক্ষণিক)', cn_keep: 'অর্ডার রাখুন', cn_do: 'হ্যাঁ, বাতিল করুন', cn_done: 'অর্ডার বাতিল হয়েছে',
      cn_late: 'অর্ডারটি প্যাক হয়ে গেছে, তাই বাতিল করা যাবে না। ডেলিভারির পর রিটার্নের অনুরোধ করতে পারবেন।', inv_btn: 'ইনভয়েস ডাউনলোড', inv_done: 'ইনভয়েস ডাউনলোড হয়েছে (ডেমো)',
      ret_btn: 'রিটার্নের অনুরোধ', ret_days: 'রিটার্ন সময়: ডেলিভারির পর {n} দিন', pm_status: 'পেমেন্ট', ord_date: 'অর্ডারের তারিখ'
    }
  });

  var ORDER = Shop.ORDER_STEPS;
  Shop.canCancel = function (o) { return o.status === 'placed' || o.status === 'processing' || o.status === 'pending'; };
  Shop.canReturn = function (o) { return o.status === 'delivered' && o.deliveredTs && (Date.now() - o.deliveredTs) <= 7 * Shop.DAY && !o.returnReq; };
  Shop.shipsOf = function (o) {
    if (o.ships && o.ships.length) return o.ships;
    var st = o.status === 'cancelled' || o.status === 'pending' ? 'processing' : o.status === 'returned' ? 'delivered' : o.status === 'placed' ? 'processing' : o.status;
    return [{ id: 'S1', courier: '', track: '', status: st, idx: o.items.map(function (x, i) { return i; }), eta: o.ts + 3 * Shop.DAY, ts: 0 }];
  };
  function stepTs(o, step) {
    var ships = Shop.shipsOf(o).filter(function (s) { return s.ts; });
    if (step === 'placed') return o.ts;
    if (step === 'processing') return o.ts + 20 * 60000;
    if (step === 'packed') return o.ts + 20 * 3600000;
    if (step === 'shipped') return ships.length ? Math.min.apply(null, ships.map(function (s) { return s.ts; })) : o.ts + 2 * Shop.DAY;
    if (step === 'delivered') return o.deliveredTs || o.ts + 4 * Shop.DAY;
    if (step === 'cancelled') return o.cancelTs || o.ts + 2 * 3600000;
    if (step === 'returned') return (o.deliveredTs || o.ts) + 6 * Shop.DAY;
    return o.ts;
  }
  Shop.orderTimeline = function (o) {
    var steps, cur;
    if (o.status === 'cancelled') { steps = ['placed', 'cancelled']; cur = 1; }
    else if (o.status === 'returned') { steps = ORDER.concat('returned'); cur = steps.length - 1; }
    else if (o.status === 'pending') { steps = ['pending'].concat(ORDER); cur = 0; }
    else { steps = ORDER.slice(); cur = ORDER.indexOf(o.status); }
    var li = steps.map(function (s, i) {
      var cls = i < cur ? 'done' : i === cur ? 'cur' : '', bad = s === 'cancelled' || s === 'returned', warn = s === 'pending';
      if (o.status === 'delivered' && i === cur) cls = 'done';
      var sub = '';
      if (cls && s !== 'pending') sub = '<small class="muted">' + Shop.dateX(stepTs(o, s), true) + '</small>';
      else if (s === 'pending') sub = '<small class="muted" ' + X('tl_pending_s') + '</small>';
      return '<li class="' + cls + (bad ? ' bad' : '') + (warn ? ' warn' : '') + '"' + (i === cur ? ' aria-current="step"' : '') + '><span class="tl-dot" aria-hidden="true">' + (bad ? icon('close', 14) : cls === 'done' ? icon('check', 14) : warn ? icon('info', 14) : i + 1) + '</span><div><b ' + X('st_' + s) + '</b>' + sub + '</div></li>';
    }).join('');
    return '<ol class="tl tl-h" aria-label="' + esc(t('status')) + '">' + li + '</ol>';
  };
  Shop.shipmentsHTML = function (o) {
    var ships = Shop.shipsOf(o);
    return '<div class="ships">' + ships.map(function (s, n) {
      var st = o.status === 'cancelled' ? 'cancelled' : s.status;
      var track = s.track ? '<div class="sh-t"><span class="muted" ' + X('sh_courier') + '</span><b>' + esc(s.courier) + '</b><span class="muted" ' + X('sh_tid') + '</span><b class="mono">' + esc(s.track) + '</b>' +
        '<a class="btn btn-ghost btn-sm" href="' + Shop.trackUrl(s.courier, s.track) + '" target="_blank" rel="noopener noreferrer">' + T('sh_track', { c: s.courier }) + ' ' + icon('chevR', 14) + '</a></div>'
        : '<p class="muted sh-none">' + icon('truck', 15) + ' <span ' + X('sh_none') + '</span></p>';
      var its = s.idx.map(function (i) { return o.items[i] ? Shop.itemRow(o.items[i]) : ''; }).join('');
      return '<article class="ship"><header class="ship-h"><b>' + (ships.length > 1 ? T('sh_n', { a: n + 1, b: ships.length }) : '<span ' + X('sh_title') + '</span>') + '</b>' + Shop.statusPill(st) +
        (st !== 'delivered' && st !== 'cancelled' ? '<span class="muted"><span ' + X('eta') + '</span> ' + Shop.dateX(s.eta) + '</span>' : '') + '</header>' + track + '<div class="irows">' + its + '</div></article>';
    }).join('') + '</div>';
  };

  Shop.cancelModal = function (o, onDone) {
    var paid = o.payStatus === 'paid' || o.payStatus === 'partial';
    var opts = [1, 2, 3, 4, 5].map(function (n) { return '<label class="radl"><input type="radio" name="cnr" value="' + n + '"' + (n === 1 ? ' checked' : '') + '><span ' + X('cn_r' + n) + '</span></label>'; }).join('');
    var refund = paid ? '<fieldset class="radset"><legend ' + X('cn_refund') + '</legend><label class="radl"><input type="radio" name="cnf" value="orig" checked><span ' + X('cn_ref_orig') + '</span></label><label class="radl"><input type="radio" name="cnf" value="wallet"><span ' + X('cn_ref_wallet') + '</span></label></fieldset>' : '';
    var n = Shop.ovlModal('cnOvl', Shop.modalHead('cnOvl', 'cn_h') + '<div class="sheet-b"><p class="muted" ' + X('cn_s') + '</p><fieldset class="radset"><legend ' + X('cn_reason') + '</legend>' + opts + '</fieldset>' + refund + '</div>' +
      '<div class="sheet-f"><button class="btn btn-ghost" type="button" data-close ' + X('cn_keep') + '</button><button class="btn btn-primary" type="button" id="cnGo" ' + X('cn_do') + '</button></div>', 'modal-sm');
    $('#cnGo', n).addEventListener('click', function () {
      var wal = paid && ($('input[name=cnf]:checked', n) || {}).value === 'wallet';
      o.status = 'cancelled'; o.cancelTs = Date.now(); o.cancelReason = ($('input[name=cnr]:checked', n) || {}).value;
      if (paid) { o.payStatus = 'refunded'; o.refundTo = wal ? 'wallet' : 'orig'; }
      if (wal) { var w = Shop.wallet.get(), amt = o.totals.payNow || o.totals.total; w.bal += amt; w.tx.unshift({ ts: Date.now(), en: 'Refund for order ' + o.no, bn: 'অর্ডার ' + o.no + ' এর রিফান্ড', amt: amt }); Shop.wallet.save(w); }
      Shop.orders.update(o); Shop.ovl.close(n); Shop.toast(t('cn_done')); if (onDone) onDone(o);
    });
    Shop.ovl.open(n, '#cnGo');
  };

  Shop.downloadInvoice = function (o) {
    var L = ['ShopName - Tax invoice', 'Order: ' + o.no, 'Date: ' + new Date(o.ts).toDateString(), 'Customer: ' + o.addr.name + ' (' + o.addr.phone + ')', '-----------------------------'];
    o.items.forEach(function (i) { var p = D.getProduct(i.id); L.push(i.qty + ' x ' + p.title + '  ' + fmt(i.price * i.qty)); });
    var c = o.totals;
    L.push('-----------------------------', 'Subtotal: ' + fmt(c.sub));
    if (c.cdisc) L.push('Coupon: -' + fmt(c.cdisc)); if (c.pm) L.push('Payment offer: -' + fmt(c.pm));
    L.push('Delivery: ' + (c.charge ? fmt(c.charge) : 'Free'));
    if (c.pts) L.push('Points: -' + fmt(c.pts)); if (c.wallet) L.push('Wallet: -' + fmt(c.wallet));
    L.push('TOTAL: ' + fmt(c.total), 'VAT included (' + Shop.config.vat + '%): ' + fmt(c.vat), '(Demo document)');
    try {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/plain' })); a.download = 'invoice-' + o.no + '.txt';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { /* ignore */ }
    Shop.toast(t('inv_done'));
  };
})();
