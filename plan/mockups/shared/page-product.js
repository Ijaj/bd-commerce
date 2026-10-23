/* Product page: product.html?p=<id> | ?p=preorder | ?p=oos | ?p=538 (up-coming, Q114)   (default product: id 10, a smartphone with flash price + 2 option types) */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, $$ = Shop.$$, X = Shop.X, XA = Shop.XA, LX = Shop.LX, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data, fmtK = Shop.fmtK;

  Shop.i18n({
    en: {
      in_stock: 'In stock', only_left: 'Only {n} left - order soon', out_stock: 'Out of stock', sold_out: 'Sold out', qty: 'Quantity', qty_dec: 'Decrease quantity', qty_inc: 'Increase quantity',
      reviews_n: '{n} reviews', qa_n: '{n} Q&A', sold_n: '{n} sold', brand: 'Brand', by_brand: 'Brand: {b}',
      flash_p: 'Flash price', flash_ends: 'Event price ends in', save: 'You save {amt}', vat_incl: 'Inclusive of VAT', pre_p: 'Pre-order price',
      add_cart: 'Add to cart', buy_now: 'Buy now', pre_btn: 'Pre-order', notify_me: 'Notify me', notify_t: 'Get notified when it is back in stock', notify_ph: 'Email or mobile number', notify_ok: "Thanks! We'll let you know when it is back in stock.", notify_send: 'Notify me',
      pre_exp: 'Expected delivery: {date}', pre_adv: 'Pay {pct}% advance now ({amt})', pre_rest: 'Pay the rest ({amt}) before dispatch. Advance is refundable if we cancel.',
      coupons: 'Collectable coupons', collect: 'Collect', collected: 'Collected', coupon_ok: 'Coupon added to your coupon wallet',
      delivery: 'Delivery', deliver_to: 'Deliver to', del_charge: 'Delivery charge', del_days: '{a}-{b} working days', del_free_note: 'Free delivery on orders above {amt}', del_free_now: 'Free delivery on this order',
      cod: 'Cash on delivery available', ret_n: '{n}-day easy return', genuine: '100% genuine product', pay_opts: 'bKash, Nagad, cards and COD',
      sold_by: 'Sold by', official: 'ShopName Official Store', pos: '98% positive seller rating', warranty: 'Warranty', no_warr: 'No brand warranty (consumable item)', see_zones: 'Charge = zone base + weight extra',
      tab_desc: 'Description', tab_spec: 'Specifications', tab_rev: 'Reviews', tab_qa: 'Questions & answers', tabs_lbl: 'Product details',
      d_high: 'Highlights', d_box: 'What is in the box', d_item: 'Item', d_qty: 'Qty', d_dim: 'Size and weight', d_p1: 'Built for everyday Bangladeshi life: tested for humid weather, backed by a local warranty and shipped from our Dhaka warehouse.',
      d_h1: 'Genuine product with seller warranty', d_h2: 'Quality checked before dispatch', d_h3: 'Easy returns if it is not as described', d_h4: 'Secure packaging for safe delivery',
      sp_brand: 'Brand', sp_model: 'Model', sp_sku: 'SKU', sp_weight: 'Weight', sp_cat: 'Category', sp_ret: 'Return window', sp_origin: 'Origin',
      rev_h: 'Customer reviews', based: 'Based on {n} reviews', verified: 'Verified purchase', with_photos: 'With photos', r_all: 'All', helpful: 'Helpful ({n})', staff_reply: 'ShopName staff replied', rev_policy: 'Only verified buyers who received this item can write a review. Photos are welcome.',
      days_ago: '{n} days ago', more_rev: 'Show more reviews', no_rev_f: 'No reviews match this filter.', star_f: '{n} star', rev_filter: 'Filter reviews', photos_lbl: 'Review photo',
      ask_t: 'Ask a question', ask_ph: 'Type your question about this product', ask_btn: 'Post question', q_pending: 'Waiting for an answer from the seller', q_lbl: 'Q', a_lbl: 'A', qa_h: 'Questions about this product', ask_posted: 'Question posted',
      related: 'You may also like', g_hint: 'Hover to zoom', g_video: 'Watch the video on YouTube', g_img: 'Image {n} of {m}', g_thumb: 'Show image {n}', opt_pick: 'Select {o}', color: 'Color',
      added_toast: 'Added to cart', share: 'Share', wish_btn: 'Wishlist',
      up_note: 'This product is coming soon. Add it to your wishlist to show interest.', up_add: 'Add to wishlist', up_in: 'Wishlisted', up_stock: 'Up-coming'
    },
    bn: {
      in_stock: 'স্টকে আছে', only_left: 'মাত্র {n}টি বাকি - এখনই অর্ডার করুন', out_stock: 'স্টক নেই', sold_out: 'শেষ', qty: 'পরিমাণ', qty_dec: 'পরিমাণ কমান', qty_inc: 'পরিমাণ বাড়ান',
      reviews_n: '{n}টি রিভিউ', qa_n: '{n}টি প্রশ্নোত্তর', sold_n: '{n} বিক্রি', brand: 'ব্র্যান্ড', by_brand: 'ব্র্যান্ড: {b}',
      flash_p: 'ফ্ল্যাশ প্রাইস', flash_ends: 'ইভেন্ট প্রাইস শেষ হতে বাকি', save: 'আপনার সাশ্রয় {amt}', vat_incl: 'ভ্যাটসহ', pre_p: 'প্রি-অর্ডার প্রাইস',
      add_cart: 'কার্টে যোগ করুন', buy_now: 'এখনই কিনুন', pre_btn: 'প্রি-অর্ডার', notify_me: 'আমাকে জানান', notify_t: 'স্টকে এলে জানতে চান', notify_ph: 'ইমেইল বা মোবাইল নম্বর', notify_ok: 'ধন্যবাদ! স্টকে এলে আমরা আপনাকে জানাব।', notify_send: 'আমাকে জানান',
      pre_exp: 'সম্ভাব্য ডেলিভারি: {date}', pre_adv: 'এখন {pct}% অগ্রিম দিন ({amt})', pre_rest: 'বাকি ({amt}) পাঠানোর আগে পরিশোধ করুন। আমরা বাতিল করলে অগ্রিম ফেরতযোগ্য।',
      coupons: 'সংগ্রহযোগ্য কুপন', collect: 'সংগ্রহ করুন', collected: 'সংগ্রহ করা হয়েছে', coupon_ok: 'কুপন আপনার কুপন ওয়ালেটে যোগ হয়েছে',
      delivery: 'ডেলিভারি', deliver_to: 'ডেলিভারি এলাকা', del_charge: 'ডেলিভারি চার্জ', del_days: '{a}-{b} কার্যদিবস', del_free_note: '{amt}-এর বেশি অর্ডারে ফ্রি ডেলিভারি', del_free_now: 'এই অর্ডারে ফ্রি ডেলিভারি',
      cod: 'ক্যাশ অন ডেলিভারি আছে', ret_n: '{n} দিনের সহজ রিটার্ন', genuine: '100% আসল পণ্য', pay_opts: 'বিকাশ, নগদ, কার্ড ও COD',
      sold_by: 'বিক্রেতা', official: 'ShopName অফিশিয়াল স্টোর', pos: '98% ইতিবাচক বিক্রেতা রেটিং', warranty: 'ওয়ারেন্টি', no_warr: 'ব্র্যান্ড ওয়ারেন্টি নেই (ভোগ্যপণ্য)', see_zones: 'চার্জ = জোন বেস + ওজন অতিরিক্ত',
      tab_desc: 'বিবরণ', tab_spec: 'স্পেসিফিকেশন', tab_rev: 'রিভিউ', tab_qa: 'প্রশ্ন ও উত্তর', tabs_lbl: 'পণ্যের বিস্তারিত',
      d_high: 'বিশেষ বৈশিষ্ট্য', d_box: 'বক্সে যা থাকছে', d_item: 'আইটেম', d_qty: 'পরিমাণ', d_dim: 'আকার ও ওজন', d_p1: 'প্রতিদিনের বাংলাদেশি জীবনের জন্য তৈরি: আর্দ্র আবহাওয়ায় পরীক্ষিত, স্থানীয় ওয়ারেন্টিসহ, ঢাকার গুদাম থেকে পাঠানো।',
      d_h1: 'বিক্রেতার ওয়ারেন্টিসহ আসল পণ্য', d_h2: 'পাঠানোর আগে মান যাচাই', d_h3: 'বর্ণনার সাথে না মিললে সহজ রিটার্ন', d_h4: 'নিরাপদ ডেলিভারির জন্য মজবুত প্যাকেজিং',
      sp_brand: 'ব্র্যান্ড', sp_model: 'মডেল', sp_sku: 'SKU', sp_weight: 'ওজন', sp_cat: 'ক্যাটাগরি', sp_ret: 'রিটার্ন সময়', sp_origin: 'উৎস',
      rev_h: 'গ্রাহক রিভিউ', based: '{n}টি রিভিউয়ের ভিত্তিতে', verified: 'যাচাইকৃত ক্রেতা', with_photos: 'ছবিসহ', r_all: 'সব', helpful: 'সহায়ক ({n})', staff_reply: 'ShopName স্টাফ উত্তর দিয়েছেন', rev_policy: 'শুধু যাচাইকৃত ক্রেতা, যারা পণ্যটি পেয়েছেন, রিভিউ লিখতে পারবেন। ছবি যোগ করা যাবে।',
      days_ago: '{n} দিন আগে', more_rev: 'আরও রিভিউ দেখুন', no_rev_f: 'এই ফিল্টারে কোনো রিভিউ নেই।', star_f: '{n} স্টার', rev_filter: 'রিভিউ ফিল্টার', photos_lbl: 'রিভিউ ছবি',
      ask_t: 'প্রশ্ন করুন', ask_ph: 'এই পণ্য সম্পর্কে আপনার প্রশ্ন লিখুন', ask_btn: 'প্রশ্ন পোস্ট করুন', q_pending: 'বিক্রেতার উত্তরের অপেক্ষায়', q_lbl: 'প্র', a_lbl: 'উ', qa_h: 'এই পণ্য নিয়ে প্রশ্ন', ask_posted: 'প্রশ্ন পোস্ট হয়েছে',
      related: 'আপনার পছন্দ হতে পারে', g_hint: 'জুম করতে হোভার করুন', g_video: 'YouTube-এ ভিডিও দেখুন', g_img: 'ছবি {n} / {m}', g_thumb: 'ছবি {n} দেখান', opt_pick: '{o} নির্বাচন করুন', color: 'রং',
      added_toast: 'কার্টে যোগ হয়েছে', share: 'শেয়ার', wish_btn: 'উইশলিস্ট',
      up_note: 'এই পণ্যটি শীঘ্রই আসছে। আগ্রহ জানাতে উইশলিস্টে যোগ করুন।', up_add: 'উইশলিস্টে যোগ করুন', up_in: 'উইশলিস্টে আছে', up_stock: 'আসছে শীঘ্রই'
    }
  });

  /* ---------------------------------------------------------------- product + state */
  var qp = Shop.qparam('p'), pid = qp === 'preorder' ? 9001 : qp === 'oos' ? 9002 : (qp != null && D.getProduct(qp) ? +qp : 10);
  var p = D.getProduct(pid), d = D.detail(pid), two = d.options.length === 2;
  var sel = { a: null, b: null }, qty = 1, gIdx = 0, zone = 0;
  (function () { var k = d.defaultKey().split('/'); if (two) { sel.a = k[0]; sel.b = k[1]; } else sel.b = k[0]; })();
  function key() { return d.keyOf(sel.a, sel.b); }
  function combo() { return d.combo(key()); }
  function colorVal() { return two ? d.options[0].vals.filter(function (v) { return v.id === sel.a; })[0] : null; }
  function maxQty() { var c = combo(); return p.preorder ? 5 : Math.min(10, c.stock); }
  function isOut() { return p.oos || combo().stock <= 0; }
  function sale() { var c = combo(); return c.old && c.old > c.price; }
  var recentList = Shop.recent.get().filter(function (x) { return x !== pid; });

  function row(k, label, val) { return '<tr><th scope="row" ' + X(k) + '</th><td>' + val + '</td></tr>'; }
  function dateStr(ms) { return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  /* ---------------------------------------------------------------- static sections */
  function stars(r) { var f = Math.round(r), s = ''; for (var i = 1; i <= 5; i++) s += '<span class="' + (i <= f ? 'star' : 'star off') + '" aria-hidden="true">★</span>'; return '<span class="stars" role="img" aria-label="' + r.toFixed(1) + ' / 5">' + s + '</span>'; }
  function descHTML() {
    return '<h3 ' + X('d_high') + '</h3><p ' + X('d_p1') + '</p><ul class="ticks"><li ' + X('d_h1') + '</li><li ' + X('d_h2') + '</li><li ' + X('d_h3') + '</li><li ' + X('d_h4') + '</li></ul>' +
      '<h3 ' + X('d_box') + '</h3><div class="tbl-w"><table class="tbl"><thead><tr><th scope="col" ' + X('d_item') + '</th><th scope="col" ' + X('d_qty') + '</th></tr></thead><tbody>' +
      '<tr><td>' + esc(p.title.split(' - ')[0]) + '</td><td>1</td></tr><tr><td>User manual</td><td>1</td></tr><tr><td>Warranty card</td><td>1</td></tr><tr><td>Original packaging</td><td>1</td></tr></tbody></table></div>';
  }
  function specHTML() {
    var node = D.catBySlug[p.cats[0]], pathTxt = D.path(node).map(function (n) { return '<span ' + LX(n.en, n.bn) + '</span>'; }).join(' &rsaquo; ');
    var rows = row('sp_brand', '', esc(p.brand)) + row('sp_model', '', 'SN-' + (1000 + p.id)) + row('sp_sku', '', 'SKU-' + (50000 + p.id * 7)) + row('sp_weight', '', p.weight + ' kg') +
      '<tr><th scope="row" ' + X('sp_cat') + '</th><td>' + pathTxt + '</td></tr>';
    Object.keys(p.attrs).forEach(function (k) {
      var def = D.attrs[k], o = def.opts.filter(function (x) { return x[0] === p.attrs[k]; })[0] || [p.attrs[k], p.attrs[k]];
      rows += '<tr><th scope="row" ' + LX(def.en, def.bn) + '</th><td ' + LX(o[0], o[1]) + '</td></tr>';
    });
    rows += '<tr><th scope="row" ' + X('sp_ret') + '</th><td data-i18n="ret_n" data-n="' + p.returnDays + '">' + t('ret_n', { n: p.returnDays }) + '</td></tr>';
    return '<div class="tbl-w"><table class="tbl tbl-kv"><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------------------------------------------------------------- gallery */
  function galleryHTML() {
    var imgs = d.gallery(colorVal()), n = imgs.length + 1;
    var slides = imgs.map(function (im, i) {
      return '<div class="gal-slide' + (i === gIdx ? ' on' : '') + '" role="group" aria-roledescription="slide" data-i18n-attr="aria-label=g_img" data-n="' + (i + 1) + '" data-m="' + n + '" aria-label="' + t('g_img', { n: i + 1, m: n }) + '">' +
        '<div class="ph" style="--h:' + im.h + '"><span style="display:inline-block;transform:rotate(' + im.rot + 'deg);font-size:' + (im.small ? '0.6' : '1') + 'em" aria-hidden="true">' + p.emoji + (im.extra ? '<small>' + im.extra + '</small>' : '') + '</span></div></div>';
    }).join('') + '<a class="gal-slide gal-video" href="' + d.video + '" target="_blank" rel="noopener" data-i18n-attr="aria-label=g_video" aria-label="' + t('g_video') + '"><div class="ph" style="--h:' + imgs[0].h + '"><span aria-hidden="true">' + p.emoji + '</span></div><span class="play" aria-hidden="true">' + icon('play', 26) + '</span><span class="vid-l">YouTube</span></a>';
    var thumbs = imgs.map(function (im, i) {
      return '<button type="button" class="gthumb' + (i === gIdx ? ' on' : '') + '" data-g="' + i + '" aria-pressed="' + (i === gIdx) + '" data-i18n-attr="aria-label=g_thumb" data-n="' + (i + 1) + '" aria-label="' + t('g_thumb', { n: i + 1 }) + '"><div class="ph" style="--h:' + im.h + '"><span aria-hidden="true">' + p.emoji + '</span></div></button>';
    }).join('') + '<a class="gthumb gthumb-v" href="' + d.video + '" target="_blank" rel="noopener" data-i18n-attr="aria-label=g_video" aria-label="' + t('g_video') + '"><div class="ph" style="--h:' + imgs[0].h + '"><span aria-hidden="true">' + p.emoji + '</span></div><span class="play" aria-hidden="true">' + icon('play', 16) + '</span></a>';
    var dots = '';
    for (var i = 0; i < n; i++) dots += '<span class="gdot' + (i === gIdx ? ' on' : '') + '"></span>';
    var bd = p.badges.map(function (b) { return '<span class="bdg bdg-' + b + '" ' + X(b) + '</span>'; }).join('');
    return '<div class="gal-main" id="gmain"><div class="gal-track" id="gtrack" tabindex="0" aria-roledescription="carousel" aria-label="' + esc(p.title) + '">' + slides + '</div>' +
      (bd ? '<div class="bdgs">' + bd + '</div>' : '') +
      '<button class="heart" type="button" data-id="' + p.id + '" aria-pressed="' + Shop.wish.has(p.id) + '" ' + XA('aria-label', 'add_wish') + '>' + icon('heart', 20) + '</button>' +
      '<span class="gal-hint">' + icon('zoom', 14) + ' <span ' + X('g_hint') + '</span></span><div class="gal-dots" aria-hidden="true">' + dots + '</div></div><div class="gal-thumbs">' + thumbs + '</div>';
  }
  function selectImg(i, scroll) {
    gIdx = i;
    var tr = $('#gtrack');
    $$('.gal-slide', tr).forEach(function (s, j) { s.classList.toggle('on', j === i); });
    $$('.gthumb[data-g]').forEach(function (b) { var on = +b.getAttribute('data-g') === i; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('.gdot').forEach(function (g, j) { g.classList.toggle('on', j === i); });
    if (scroll && tr.scrollWidth > tr.clientWidth + 2) tr.scrollTo({ left: i * tr.clientWidth, behavior: Shop.reduceMotion ? 'auto' : 'smooth' });
  }

  /* ---------------------------------------------------------------- dynamic buy box */
  function priceHTML() {
    var c = combo(), h = '';
    if (p.flash && !p.oos) h += '<div class="flashbar">' + icon('bolt', 18) + '<b ' + X('flash_p') + '</b><span class="fb-sp"></span>' + Shop.cdHTML() + '</div>';
    h += '<div class="pp-row"><span class="pp-now">' + fmt(c.price) + '</span>' + (sale() ? '<s class="pp-old">' + fmt(c.old) + '</s><span class="off">-' + c.off + '%</span>' : '') + '</div>';
    h += '<p class="pp-sub">' + (sale() ? '<span class="pp-save" data-i18n="save" data-amt="' + fmt(c.old - c.price) + '">' + t('save', { amt: fmt(c.old - c.price) }) + '</span> · ' : '') + (p.preorder ? '<span ' + X('pre_p') + '</span> · ' : '') + '<span ' + X('vat_incl') + '</span></p>';
    return h;
  }
  function optionsHTML() {
    var h = '';
    d.options.forEach(function (o, oi) {
      var which = o.key === 'o1' ? 'a' : 'b', cur = sel[which];
      var curVal = o.vals.filter(function (v) { return v.id === cur; })[0];
      h += '<div class="opt-g"><div class="opt-l"><span id="ol-' + o.key + '" ' + LX(o.name.en, o.name.bn) + '</span>: <b ' + LX(curVal.en, curVal.bn) + '</b></div><div class="opt-v" role="radiogroup" aria-labelledby="ol-' + o.key + '">';
      o.vals.forEach(function (v) {
        var dis;
        if (p.oos || p.upcoming) dis = false;
        else if (which === 'a') dis = !d.options[1].vals.some(function (b) { return d.combo(d.keyOf(v.id, b.id)).stock > 0; });
        else dis = d.combo(d.keyOf(sel.a, v.id)).stock <= 0;
        var on = v.id === cur;
        if (o.swatch) h += '<button type="button" class="sw-btn" role="radio" aria-checked="' + on + '" data-o="' + which + '" data-v="' + v.id + '" style="--c:' + v.hex + '"' + (dis ? ' disabled' : '') + ' title="' + esc(v.en) + '" aria-label="' + esc(Shop.L(v.en, v.bn) + (dis ? ' - ' + t('sold_out') : '')) + '"></button>';
        else h += '<button type="button" class="size-btn" role="radio" aria-checked="' + on + '" data-o="' + which + '" data-v="' + v.id + '"' + (dis ? ' disabled' : '') + '><span ' + LX(v.en, v.bn) + '</span>' + (dis ? '<span class="sr-only"> - ' + esc(t('sold_out')) + '</span>' : '') + '</button>';
      });
      h += '</div></div>';
    });
    return h;
  }
  function stockHTML() {
    var c = combo();
    if (p.upcoming) return '<p class="stock pre">' + icon('pkg', 16) + ' <span ' + X('up_stock') + '</span></p>';
    if (p.preorder) return '<p class="stock pre">' + icon('pkg', 16) + ' <span data-i18n="pre_exp" data-date="' + dateStr(d.preorderInfo.date) + '">' + t('pre_exp', { date: dateStr(d.preorderInfo.date) }) + '</span></p>';
    if (p.soon) return '<p class="stock pre">' + icon('pkg', 16) + ' <span ' + LX('Coming soon', 'শীঘ্রই আসছে') + '</span></p>';   // launch phase: pre-order is hidden, product is "coming soon"
    if (isOut()) return '<p class="stock out">' + icon('close', 16) + ' <span ' + X('out_stock') + '</span></p>';
    if (c.stock <= 5) return '<p class="stock low">' + icon('bolt', 16) + ' <span data-i18n="only_left" data-n="' + c.stock + '">' + t('only_left', { n: c.stock }) + '</span></p>';
    return '<p class="stock in">' + icon('check', 16) + ' <span ' + X('in_stock') + '</span></p>';
  }
  function qtyHTML() {
    var m = maxQty();
    return '<div class="qty-row"><span class="opt-l" id="ql" ' + X('qty') + '</span><div class="stepper" role="group" aria-labelledby="ql"><button type="button" data-act="qm" ' + XA('aria-label', 'qty_dec') + (qty <= 1 ? ' disabled' : '') + '>' + icon('minus', 16) + '</button>' +
      '<input id="qtyIn" name="qty" type="text" inputmode="numeric" value="' + qty + '" ' + XA('aria-label', 'qty') + '><button type="button" data-act="qp" ' + XA('aria-label', 'qty_inc') + (qty >= m ? ' disabled' : '') + '>' + icon('plus', 16) + '</button></div></div>';
  }
  function preHTML() {
    if (p.upcoming) return '<div class="prebox">' + icon('info', 18) + '<div><p ' + X('up_note') + '</p></div></div>';
    if (!p.preorder) return '';
    var c = combo(), adv = Math.round(c.price * qty * d.preorderInfo.pct / 100);
    return '<div class="prebox">' + icon('info', 18) + '<div><b data-i18n="pre_adv" data-pct="' + d.preorderInfo.pct + '" data-amt="' + fmt(adv) + '">' + t('pre_adv', { pct: d.preorderInfo.pct, amt: fmt(adv) }) + '</b><p data-i18n="pre_rest" data-amt="' + fmt(c.price * qty - adv) + '">' + t('pre_rest', { amt: fmt(c.price * qty - adv) }) + '</p></div></div>';
  }
  function ctaButtons(cls) {
    var h;
    if (p.upcoming) { var wl = Shop.wish.has(p.id); h = '<button class="btn btn-primary ' + cls + '" type="button" data-act="upwish" aria-pressed="' + wl + '">' + icon('heart', 18) + ' <span ' + X(wl ? 'up_in' : 'up_add') + '</span></button>'; }
    else if (isOut()) h = '<button class="btn btn-primary ' + cls + '" type="button" data-act="notify">' + icon('bell', 18) + ' <span ' + X('notify_me') + '</span></button>';
    else if (p.preorder) h = '<button class="btn btn-primary ' + cls + '" type="button" data-act="pre">' + icon('pkg', 18) + ' <span ' + X('pre_btn') + '</span></button>';
    else h = '<button class="btn btn-ghost ' + cls + '" type="button" data-act="add">' + icon('cart', 18) + ' <span ' + X('add_cart') + '</span></button><button class="btn btn-primary ' + cls + '" type="button" data-act="buy"><span ' + X('buy_now') + '</span></button>';
    return h;
  }
  function notifyHTML() {
    if (!isOut()) return '';
    var done = Shop.store.getJSON('shop.notify', []).indexOf(pid) >= 0;
    return '<form class="notify" id="notifyBox"><h3 ' + (p.soon ? LX('Get notified when it launches', 'চালু হলে জানতে চান') : X('notify_t')) + '</h3>' + (done ? '<p class="ok">' + icon('check', 16) + ' ' + esc(t('notify_ok')) + '</p>' :
      '<div class="nrow"><label class="sr-only" for="nfIn" ' + X('notify_ph') + '</label><input id="nfIn" name="notify" type="text" required ' + XA('placeholder', 'notify_ph') + '><button class="btn btn-primary" type="submit" ' + X('notify_send') + '</button></div>') + '</form>';
  }
  function sbarHTML() {
    var out = isOut();
    return (p.upcoming ? '' : '<button class="icon-btn sb-heart heart" type="button" data-id="' + p.id + '" aria-pressed="' + Shop.wish.has(p.id) + '" ' + XA('aria-label', 'add_wish') + '>' + icon('heart', 22) + '</button>') + ctaButtons('sb-btn');
  }
  function deliveryHTML() {
    var dz = D.districts[zone], c = combo(), r = D.delivery(dz[2], p.weight * qty, c.price * qty);
    return '<div class="dres">' + icon('truck', 20) + '<div><b>' + (r.free ? '<span ' + X('del_free_now') + '</span>' : '<span ' + X('del_charge') + '</span>: ' + fmt(r.charge)) + '</b>' +
      '<p>' + (r.extra && !r.free ? fmt(r.base) + ' + ' + fmt(r.extra) + ' (' + p.weight * qty + ' kg) · ' : '') + '<span data-i18n="del_days" data-a="' + r.days[0] + '" data-b="' + r.days[1] + '">' + t('del_days', { a: r.days[0], b: r.days[1] }) + '</span></p></div></div>' +
      '<p class="dnote">' + D.freeRule(dz[2]) + '</p>' + (Shop.isFull() ? advNote(r) : '');
  }
  // Full phase: advance-payment hints for cash on delivery (delivery fee in advance when not free; % advance for flagged items)
  function advNote(r) {
    var n = [], c = combo(), pc = Math.max(p.advancePercent || 0, c.price > Shop.config.advBigPrice ? Shop.config.advBigPct : 0);
    if (!r.free) n.push('<span ' + LX('Cash on delivery: the delivery charge is paid in advance (bKash / Nagad).', 'ক্যাশ অন ডেলিভারিতে ডেলিভারি চার্জ অগ্রিম দিতে হবে (বিকাশ / নগদ)।') + '</span>');
    if (pc) n.push('<span ' + LX(pc + '% advance payment is needed for this item on cash on delivery.', 'এই পণ্যে ক্যাশ অন ডেলিভারিতে ' + pc + '% অগ্রিম লাগবে।') + '</span>');
    return n.length ? '<p class="dnote adv-n">' + icon('info', 14) + ' ' + n.join(' ') + '</p>' : '';
  }

  var rendered = false;
  function update() {
    $('#pbox').innerHTML = priceHTML();
    $('#opts').innerHTML = optionsHTML();
    $('#stockline').innerHTML = stockHTML();
    $('#qtyline').innerHTML = isOut() || p.upcoming ? '' : qtyHTML();
    $('#prebox').innerHTML = preHTML();
    $('#ctas').innerHTML = ctaButtons('lg') + (isOut() || p.upcoming ? '' : '<button class="btn btn-ghost lg-icon heart" type="button" data-id="' + p.id + '" aria-pressed="' + Shop.wish.has(p.id) + '" ' + XA('aria-label', 'add_wish') + '>' + icon('heart', 20) + '</button>');
    $('#notifyline').innerHTML = notifyHTML();
    $('#sbarIn').innerHTML = sbarHTML();
    $('#dbody').innerHTML = deliveryHTML();
    Shop.applyI18n($('#pd'));
    Shop.applyI18n($('#sbarIn'));
    Shop.tick();
  }

  /* ---------------------------------------------------------------- reviews + Q&A */
  var revs = D.reviewsFor(pid), rf = { stars: 0, photos: false }, revShown = 5, questions = [];
  function distRows() {
    var dist = D.ratingDist(p.rating), h = '';
    for (var s = 5; s >= 1; s--) { var pc = Math.round(dist[s - 1] * 100); h += '<li><button type="button" class="bar-row" data-star="' + s + '" aria-pressed="' + (rf.stars === s) + '"><span class="bar-s">' + s + ' <span class="star" aria-hidden="true">★</span></span><span class="rbar"><i style="width:' + pc + '%"></i></span><span class="bar-n">' + pc + '%</span></button></li>'; }
    return h;
  }
  function filterChips() {
    var photosN = revs.filter(function (r) { return r.photos; }).length, h = '<button type="button" class="chipb" data-rf="all" aria-pressed="' + (!rf.stars && !rf.photos) + '" ' + X('r_all') + '</button>';
    h += '<button type="button" class="chipb" data-rf="photos" aria-pressed="' + rf.photos + '">' + icon('camera', 14) + ' <span ' + X('with_photos') + '</span> (' + photosN + ')</button>';
    for (var s = 5; s >= 1; s--) h += '<button type="button" class="chipb" data-rf="' + s + '" aria-pressed="' + (rf.stars === s) + '">' + s + ' <span class="star" aria-hidden="true">★</span></button>';
    return h;
  }
  function reviewHTML(r) {
    var photos = '';
    for (var i = 0; i < r.photos; i++) photos += '<div class="rv-ph" role="img" ' + XA('aria-label', 'photos_lbl') + '><div class="ph" style="--h:' + ((p.h + i * 40) % 360) + '"><span aria-hidden="true">' + p.emoji + '</span></div></div>';
    return '<li class="rv"><div class="rv-h"><span class="av" aria-hidden="true">' + esc(r.name.charAt(0)) + '</span><div><b>' + esc(r.name) + '</b><div class="rv-m">' + stars(r.stars) + '<span class="vbadge">' + icon('check', 13) + ' <span ' + X('verified') + '</span></span></div></div>' +
      '<span class="rv-d muted" data-i18n="days_ago" data-n="' + r.days + '">' + t('days_ago', { n: r.days }) + '</span></div>' +
      '<p class="rv-v muted" ' + LX(r.variant.en, r.variant.bn) + '</p><p class="rv-t">' + esc(r.text) + '</p>' + (photos ? '<div class="rv-phs">' + photos + '</div>' : '') +
      (r.reply ? '<div class="rv-reply"><b>' + icon('store', 14) + ' <span ' + X('staff_reply') + '</span></b><p ' + LX(r.reply.en, r.reply.bn) + '</p></div>' : '') +
      '<button class="helpful" type="button" data-h="' + r.id + '" aria-pressed="false">' + icon('thumb', 14) + ' <span data-i18n="helpful" data-n="' + r.helpful + '">' + t('helpful', { n: r.helpful }) + '</span></button></li>';
  }
  function visibleRevs() { return revs.filter(function (r) { return (!rf.stars || r.stars === rf.stars) && (!rf.photos || r.photos); }); }
  function renderRevs() {
    var list = visibleRevs();
    $('#rvlist').innerHTML = list.length ? list.slice(0, revShown).map(reviewHTML).join('') : '<li class="muted rv-none" ' + X('no_rev_f') + '</li>';
    $('#rvmore').hidden = list.length <= revShown;
    $('#rvchips').innerHTML = filterChips();
    $('#rvbars').innerHTML = distRows();
    Shop.applyI18n($('#reviews'));
  }
  function qaItem(q, pending) {
    return '<li class="qa"><p class="qa-q"><span class="qa-l">' + esc(t('q_lbl')) + '</span> ' + esc(q.q) + '</p>' +
      (pending ? '<p class="qa-a muted" ' + X('q_pending') + '</p>' : '<p class="qa-a"><span class="qa-l qa-la">' + esc(t('a_lbl')) + '</span> ' + esc(q.a) + '</p>') +
      '<p class="muted qa-d" data-i18n="days_ago" data-n="' + (q.days || 0) + '">' + t('days_ago', { n: q.days || 0 }) + '</p></li>';
  }

  /* ---------------------------------------------------------------- page */
  function body() {
    var ratingFull = p.rating.toFixed(1), node = D.catBySlug[p.cats[0]];
    var h = '<div class="wrap pd" id="pd">' + Shop.crumbs(Shop.catCrumbs(node, { text: p.title.length > 60 ? p.title.slice(0, 58) + '...' : p.title }));
    h += '<div class="pd-top"><div class="pd-gal" id="gal">' + galleryHTML() + '</div><div class="pd-info">' +
      '<h1 class="pd-title">' + esc(p.title) + '</h1>' +
      '<div class="pd-meta"><a class="pm-r" href="#reviews">' + stars(p.rating) + ' <b>' + ratingFull + '</b> <span data-i18n="reviews_n" data-n="' + p.reviews + '">' + t('reviews_n', { n: p.reviews }) + '</span></a><span aria-hidden="true">·</span><span ' + LX(fmtK(p.sold, 'en') + ' sold', fmtK(p.sold, 'bn') + ' বিক্রি') + '</span><span aria-hidden="true">·</span><a href="#qa" data-i18n="qa_n" data-n="' + (p.qa + 4) + '">' + t('qa_n', { n: p.qa + 4 }) + '</a><span aria-hidden="true">·</span><span data-i18n="by_brand" data-b="' + esc(p.brand) + '">' + t('by_brand', { b: p.brand }) + '</span></div>' +
      '<div class="pbox" id="pbox"></div><div id="opts"></div><div id="stockline"></div><div id="qtyline"></div><div id="prebox"></div>' +
      '<div class="pd-cta" id="ctas"></div><div id="notifyline"></div>' +
      '<section class="pd-box" aria-labelledby="cp-h"><h2 id="cp-h" class="pd-h" ' + X('coupons') + '</h2><ul class="coupons">' + D.coupons.map(function (c) {
        var got = Shop.collected.has(c.code);
        return '<li class="coupon' + (got ? ' got' : '') + '" data-code="' + c.code + '">' + icon('ticket', 22) + '<div class="cp-t"><b ' + LX(c.en, c.bn) + '</b><span class="muted" ' + LX(c.ten, c.tbn) + '</span><span class="cp-e" ' + LX(c.exp, c.ebn) + '</span></div>' +
          '<button class="btn btn-sm btn-ghost cp-btn" type="button" data-code="' + c.code + '"' + (got ? ' disabled' : '') + '>' + (got ? icon('check', 14) + ' <span ' + X('collected') + '</span>' : '<span ' + X('collect') + '</span>') + '</button></li>';
      }).join('') + '</ul></section>' +
      '<section class="pd-box" aria-labelledby="dl-h"><h2 id="dl-h" class="pd-h" ' + X('delivery') + '</h2><label class="dsel"><span ' + X('deliver_to') + '</span><select name="district" id="district">' +
      D.districts.map(function (x, i) { return '<option value="' + i + '" ' + LX(x[0], x[1]) + '</option>'; }).join('') + '</select></label><div id="dbody"></div>' +
      '<ul class="assure"><li>' + icon('cash', 18) + ' <span ' + X('cod') + '</span></li><li>' + icon('undo', 18) + ' <span data-i18n="ret_n" data-n="' + p.returnDays + '">' + t('ret_n', { n: p.returnDays }) + '</span></li><li>' + icon('shield', 18) + ' <span ' + X('genuine') + '</span></li></ul></section>' +
      '<section class="pd-box seller" aria-labelledby="sl-h"><h2 id="sl-h" class="pd-h" ' + X('sold_by') + '</h2><p>' + icon('store', 18) + ' <b ' + X('official') + '</b> · <span class="muted" ' + X('pos') + '</span></p><p>' + icon('shield', 18) + ' <b ' + X('warranty') + '</b>: ' +
      (d.warranty ? '<span ' + LX(d.warranty.en, d.warranty.bn) + '</span>' : '<span class="muted" ' + X('no_warr') + '</span>') + '</p></section>' +
      '</div></div>';

    h += '<nav class="ptabs" ' + XA('aria-label', 'tabs_lbl') + '><ul><li><a href="#desc" ' + X('tab_desc') + '</a></li><li><a href="#spec" ' + X('tab_spec') + '</a></li><li><a href="#reviews"><span ' + X('tab_rev') + '</span> (' + p.reviews + ')</a></li><li><a href="#qa" ' + X('tab_qa') + '</a></li></ul></nav>';
    h += '<section class="pd-sec rich" id="desc" aria-labelledby="desc-h"><div class="sec-head"><h2 id="desc-h" ' + X('tab_desc') + '</h2></div>' + descHTML() + '</section>';
    h += '<section class="pd-sec" id="spec" aria-labelledby="spec-h"><div class="sec-head"><h2 id="spec-h" ' + X('tab_spec') + '</h2></div>' + specHTML() + '</section>';
    h += '<section class="pd-sec" id="reviews" aria-labelledby="rev-h"><div class="sec-head"><h2 id="rev-h" ' + X('rev_h') + '</h2></div><div class="rv-sum"><div class="rv-big"><b>' + ratingFull + '</b>' + stars(p.rating) + '<span class="muted" data-i18n="based" data-n="' + p.reviews + '">' + t('based', { n: p.reviews }) + '</span></div>' +
      '<ul class="bars" id="rvbars"></ul></div><p class="policy">' + icon('shield', 16) + ' <span ' + X('rev_policy') + '</span></p>' +
      '<div class="chipbar" id="rvchips" role="group" ' + XA('aria-label', 'rev_filter') + '></div><ul class="rvs" id="rvlist"></ul><div class="more"><button class="btn btn-ghost" id="rvmore" type="button" ' + X('more_rev') + '</button></div></section>';
    h += '<section class="pd-sec" id="qa" aria-labelledby="qa-h"><div class="sec-head"><h2 id="qa-h" ' + X('qa_h') + '</h2></div><form class="askf" id="askf"><label class="sr-only" for="askIn" ' + X('ask_t') + '</label><textarea id="askIn" name="question" rows="2" required ' + XA('placeholder', 'ask_ph') + '></textarea><button class="btn btn-primary" type="submit" ' + X('ask_btn') + '</button></form>' +
      '<ul class="qas" id="qalist">' + D.qaFor(pid).map(function (q) { return qaItem(q, false); }).join('') + '</ul></section>';

    var rel = D.all().filter(function (x) { return x.cat === p.cat && x.id !== p.id && !x.oos; }).slice(0, 10);
    h += '<section class="band" aria-labelledby="rel-h"><div class="band-h"><h2 id="rel-h" ' + X('related') + '</h2></div><div class="hscroll">' + rel.map(function (x) { return Shop.card(x); }).join('') + '</div></section>';
    var rec = recentList.map(D.getProduct).filter(Boolean), pad = D.all().filter(function (x) { return x.id !== pid && x.cat !== p.cat && !x.oos; }).slice(5, 5 + Math.max(0, 8 - rec.length));
    h += '<section class="band recent" aria-labelledby="rv-h"><div class="band-h"><h2 id="rv-h" ' + X('recent') + '</h2></div><div class="hscroll rv">' + rec.concat(pad).slice(0, 10).map(function (x) { return Shop.card(x, { size: 'xs' }); }).join('') + '</div></section></div>';
    return h;
  }

  function addToCart(go) {
    if (p.upcoming) return;
    var c = combo(), q = Math.max(1, Math.min(qty, maxQty() || 1));
    Shop.cart.add(pid, key(), q);
    var line = Shop.cart.lines().filter(function (l) { return l.id === pid && l.variant === c.key; })[0];
    if (go) { location.href = go; return; }
    Shop.toast(t('added_toast'), { label: t('view_cart'), href: 'cart.html' });
    Shop.miniCart.show(line ? Object.assign({}, line, { qty: q }) : null);
  }

  Shop.renderPage(body(), {
    active: 'cats',
    sbar: '<div class="sbar-in" id="sbarIn"></div>',
    onReady: function (frame) {
      document.title = p.title + ' - ShopName';
      update(); renderRevs();
      $('#district').value = String(zone);
      Shop.recent.add(pid);
      var tr = $('#gtrack');

      frame.addEventListener('click', function (e) {
        var b, tg = e.target;
        if ((b = tg.closest('[data-o]'))) {
          var o = b.getAttribute('data-o'), v = b.getAttribute('data-v');
          if (o === 'a') {
            sel.a = v;
            if (!p.oos && d.combo(d.keyOf(sel.a, sel.b)).stock <= 0) {
              var ok = d.options[1].vals.filter(function (x) { return d.combo(d.keyOf(sel.a, x.id)).stock > 0; })[0]; if (ok) sel.b = ok.id;
            }
            gIdx = 0; $('#gal').innerHTML = galleryHTML(); Shop.applyI18n($('#gal')); bindGallery();
          } else sel.b = v;
          qty = Math.min(qty, Math.max(1, maxQty()));
          update();
        } else if ((b = tg.closest('[data-g]'))) { selectImg(+b.getAttribute('data-g'), true); }
        else if ((b = tg.closest('[data-act]'))) {
          var a = b.getAttribute('data-act');
          if (a === 'qm') { qty = Math.max(1, qty - 1); update(); $('[data-act=qm]:not([disabled]), #qtyIn').focus(); }
          else if (a === 'qp') { qty = Math.min(maxQty(), qty + 1); update(); var pl = $('[data-act=qp]:not([disabled])'); (pl || $('#qtyIn')).focus(); }
          else if (a === 'upwish') { var wn = Shop.wish.toggle(pid); Shop.toast(t(wn ? 'wish_added' : 'wish_removed')); update(); var ub = $('#ctas [data-act=upwish]'); if (ub) ub.focus({ preventScroll: true }); }
          else if (a === 'add') addToCart();
          else if (a === 'buy') addToCart('checkout.html');
          else if (a === 'pre') addToCart();
          else if (a === 'notify') { var nb = $('#notifyBox'); if (nb) { nb.scrollIntoView({ block: 'center', behavior: Shop.reduceMotion ? 'auto' : 'smooth' }); var ni = $('input', nb); if (ni) ni.focus({ preventScroll: true }); } }
        } else if ((b = tg.closest('.cp-btn'))) {
          Shop.collected.add(b.getAttribute('data-code'));
          b.disabled = true; b.innerHTML = icon('check', 14) + ' <span ' + X('collected') + '</span>'; b.closest('.coupon').classList.add('got');
          Shop.applyI18n(b); Shop.toast(t('coupon_ok'));
        } else if ((b = tg.closest('[data-rf]'))) {
          var f = b.getAttribute('data-rf'); rf = { stars: 0, photos: false };
          if (f === 'photos') rf.photos = true; else if (f !== 'all') rf.stars = +f;
          revShown = 5; renderRevs();
        } else if ((b = tg.closest('[data-star]'))) {
          var s = +b.getAttribute('data-star'); rf = { stars: rf.stars === s ? 0 : s, photos: false }; revShown = 5; renderRevs();
        } else if ((b = tg.closest('.helpful'))) {
          var on = b.getAttribute('aria-pressed') !== 'true', sp = $('span', b), r = revs[+b.getAttribute('data-h')];
          b.setAttribute('aria-pressed', String(on)); sp.setAttribute('data-n', r.helpful + (on ? 1 : 0)); sp.textContent = t('helpful', { n: r.helpful + (on ? 1 : 0) });
        } else if (tg.closest('#rvmore')) { revShown += 5; renderRevs(); }
      });
      frame.addEventListener('change', function (e) {
        if (e.target.id === 'district') { zone = +e.target.value; $('#dbody').innerHTML = deliveryHTML(); Shop.applyI18n($('#dbody')); }
        else if (e.target.id === 'qtyIn') { var n = parseInt(e.target.value, 10); qty = isNaN(n) ? 1 : Math.max(1, Math.min(maxQty() || 1, n)); update(); }
      });
      frame.addEventListener('submit', function (e) {
        if (e.target.id === 'askf') {
          var ta = $('#askIn'), q = ta.value.trim(); if (!q) return;
          $('#qalist').insertAdjacentHTML('afterbegin', qaItem({ q: q, days: 0 }, true)); Shop.applyI18n($('#qalist')); ta.value = ''; Shop.toast(t('ask_posted'));
        } else if (e.target.id === 'notifyBox') {
          var a = Shop.store.getJSON('shop.notify', []); if (a.indexOf(pid) < 0) a.push(pid); Shop.store.setJSON('shop.notify', a); update();
        }
      });
      // gallery: zoom (desktop hover) + scroll-snap swipe (mobile)
      function bindGallery() {
        var gm = $('#gmain'), track = $('#gtrack');
        gm.addEventListener('mousemove', function (e) {
          var r = gm.getBoundingClientRect(), on = $('.gal-slide.on .ph', gm); if (!on) return;
          on.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%'); on.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%');
        });
        var raf = 0;
        track.addEventListener('scroll', function () {
          if (track.scrollWidth <= track.clientWidth + 2) return;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(function () { var i = Math.round(track.scrollLeft / track.clientWidth); if (i !== gIdx) selectImg(i, false); });
        }, { passive: true });
        track.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') { selectImg(Math.min(gIdx + 1, 3), true); } else if (e.key === 'ArrowLeft') { selectImg(Math.max(gIdx - 1, 0), true); }
        });
      }
      bindGallery();
      Shop.on('lang', function () { update(); renderRevs(); });
      if (p.upcoming) Shop.on('wish', update);   // keep the wishlist button in step with the gallery heart
    }
  });
})();
