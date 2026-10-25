/* SR / B2B fake data shared by the SR portal and the 4 admin B2B pages. Deterministic. window.SRD
   Rules: R13 pending sale reserves stock; R15 SR enters price freely; R16 due ledger; R18 collections need staff confirm;
   Q119 SR-added shops usable at once, flagged new; Q120 commission = % of money collected in month (paid at sale + confirmed due collections). */
(function () {
  'use strict';
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = rng(261023);
  function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  var TODAY = '2026-10-23', MONTHS = ['2026-08', '2026-09', '2026-10'];
  function iso(daysAgo) { var d = new Date(2026, 9, 23 - daysAgo, 12); var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  function days(a, b) { var A = a.split('-'), B = b.split('-'); return Math.round((new Date(+B[0], B[1] - 1, +B[2]) - new Date(+A[0], A[1] - 1, +A[2])) / 86400000); }
  var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MFULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fd(s) { var p = s.split('-'); return (+p[2]) + ' ' + MN[p[1] - 1] + ' ' + p[0]; }
  function fm(ym) { var p = ym.split('-'); return MFULL[p[1] - 1] + ' ' + p[0]; }

  var products = [ /* sku, EN, BN, icon, B2B list price */
    { sku: 'TEA-500', en: 'Sylhet Premium Tea 500g', bn: 'সিলেট প্রিমিয়াম চা ৫০০ গ্রাম', ic: '🍵', list: 360 },
    { sku: 'TEA-1K', en: 'Sylhet Premium Tea 1kg', bn: 'সিলেট প্রিমিয়াম চা ১ কেজি', ic: '🍵', list: 690 },
    { sku: 'HNY-500', en: 'Sundarban Honey 500g', bn: 'সুন্দরবনের মধু ৫০০ গ্রাম', ic: '🍯', list: 540 },
    { sku: 'SPC-MIX', en: 'Mixed Spice Box (8 pcs)', bn: 'মিক্স মশলা বক্স (৮ পিস)', ic: '🌶️', list: 610 },
    { sku: 'GHE-1L', en: 'Pure Ghee 1L', bn: 'খাঁটি ঘি ১ লিটার', ic: '🧈', list: 1090 },
    { sku: 'CHT-250', en: 'Hill Tracts Turmeric 250g', bn: 'পার্বত্য হলুদ ২৫০ গ্রাম', ic: '🟡', list: 185 },
    { sku: 'GTE-100', en: 'Green Tea Leaves 100g', bn: 'গ্রিন টি পাতা ১০০ গ্রাম', ic: '🌿', list: 240 },
    { sku: 'MST-5L', en: 'Cold-pressed Mustard Oil 5L', bn: 'ঘানি ভাঙা সরিষার তেল ৫ লিটার', ic: '🫒', list: 1150 },
    { sku: 'RCE-5K', en: 'Miniket Rice 5kg', bn: 'মিনিকেট চাল ৫ কেজি', ic: '🍚', list: 395 },
    { sku: 'DAL-1K', en: 'Masoor Dal 1kg', bn: 'মসুর ডাল ১ কেজি', ic: '🫘', list: 135 }
  ];
  var PBY = {}; products.forEach(function (p) { PBY[p.sku] = p; });

  var settings = { defaultBp: 200, memoCompany: { name: 'ShopName Trading', addr: 'Plot 22, Tejgaon I/A, Dhaka-1208', phone: '01711-000111', bin: 'BIN 00123456-0101' } };

  /* SRs. commissionBp null = use default. */
  var srs = [
    { id: 'sr1', name: 'Mizanur Rahman', phone: '01712-345678', area: 'Mirpur / Dhanmondi, Dhaka', bp: 250 },
    { id: 'sr2', name: 'Jahid Hasan', phone: '01819-223344', area: 'Chattogram city', bp: null },
    { id: 'sr3', name: 'Sohel Rana', phone: '01915-667788', area: 'Old Dhaka / Jatrabari', bp: 200 },
    { id: 'sr4', name: 'Abul Kashem', phone: '01611-998877', area: 'Narayanganj / Gazipur', bp: 150 }
  ];
  var targets = {
    sr1: { '2026-08': 140000, '2026-09': 200000, '2026-10': 430000 },
    sr2: { '2026-08': 260000, '2026-09': 220000, '2026-10': 230000 },
    sr3: { '2026-08': 110000, '2026-09': 200000, '2026-10': 250000 },
    sr4: { '2026-08': 180000, '2026-09': 120000, '2026-10': 200000 }
  };
  var commStatus = { '2026-08': 'paid', '2026-09': 'approved', '2026-10': 'pending' };

  var shops = [
    { id: 'b01', name: 'Rahman General Store', owner: 'Abdur Rahman', phone: '01711-340112', addr: 'House 14, Road 3, Block C, Mirpur-10', area: 'Mirpur, Dhaka', sr: 'sr1', since: '2026-05-12', isNew: false },
    { id: 'b02', name: 'Bismillah Mudi Dokan', owner: 'Shafiqul Islam', phone: '01815-221903', addr: 'Krishi Market, Mohammadpur', area: 'Mohammadpur, Dhaka', sr: 'sr1', since: '2026-05-20', isNew: false },
    { id: 'b03', name: 'Nur Departmental Store', owner: 'Nurul Amin', phone: '01911-554433', addr: 'Shyamoli Square, Level 1, Shop 12', area: 'Shyamoli, Dhaka', sr: 'sr1', since: '2026-06-02', isNew: false },
    { id: 'b04', name: 'Karim Traders', owner: 'Abdul Karim', phone: '01617-889900', addr: 'Mirpur-1 Bazar, Shop 27', area: 'Mirpur, Dhaka', sr: 'sr1', since: '2026-10-19', isNew: true },
    { id: 'b05', name: 'Dhanmondi Daily Needs', owner: 'Tanvir Ahmed', phone: '01713-776655', addr: 'Road 8/A, Dhanmondi', area: 'Dhanmondi, Dhaka', sr: 'sr1', since: '2026-07-08', isNew: false },
    { id: 'b06', name: 'Hasina Super Shop', owner: 'Hasina Akter', phone: '01819-445566', addr: 'CDA Avenue, Agrabad C/A', area: 'Agrabad, Chattogram', sr: 'sr2', since: '2026-05-30', isNew: false },
    { id: 'b07', name: 'Pahartali Grocery', owner: 'Mohammad Ali', phone: '01555-123987', addr: 'Pahartali Bazar, Main Road', area: 'Pahartali, Chattogram', sr: 'sr2', since: '2026-06-15', isNew: false },
    { id: 'b08', name: 'Sea View Mart', owner: 'Shahidul Alam', phone: '01844-300211', addr: 'Zakir Hossain Road, Khulshi', area: 'Khulshi, Chattogram', sr: 'sr2', since: '2026-10-21', isNew: true },
    { id: 'b09', name: 'Haji Mohammad Store', owner: 'Haji Mohammad Yusuf', phone: '01914-662211', addr: '45 Nawab Katra, Chawkbazar', area: 'Chawkbazar, Old Dhaka', sr: 'sr3', since: '2026-05-18', isNew: false },
    { id: 'b10', name: 'Islamia Kitchen Market', owner: 'Mostafa Kamal', phone: '01716-554001', addr: 'Bangshal Road, Shop 9', area: 'Bangshal, Old Dhaka', sr: 'sr3', since: '2026-06-09', isNew: false },
    { id: 'b11', name: 'New Star Super Shop', owner: 'Rubel Hossain', phone: '01812-009876', addr: 'Jatrabari Crossing, 2nd floor', area: 'Jatrabari, Dhaka', sr: 'sr3', since: '2026-07-22', isNew: false },
    { id: 'b12', name: 'Mamun Enterprise', owner: 'Abdullah Al Mamun', phone: '01911-232425', addr: 'Chashara, Station Road', area: 'Chashara, Narayanganj', sr: 'sr4', since: '2026-06-01', isNew: false },
    { id: 'b13', name: 'Madina Store', owner: 'Delwar Hossain', phone: '01715-909090', addr: 'Siddhirganj Bazar, Shop 5', area: 'Siddhirganj, Narayanganj', sr: 'sr4', since: '2026-07-14', isNew: false },
    { id: 'b14', name: 'Gazipur Fresh Mart', owner: 'Lutfor Rahman', phone: '01618-707172', addr: 'Tongi Station Road', area: 'Tongi, Gazipur', sr: 'sr4', since: '2026-10-20', isNew: true }
  ];
  var SBY = {}; shops.forEach(function (s) { SBY[s.id] = s; });

  var sales = [], seq = 0;
  function line(sku, qty, price) { return { sku: sku, qty: qty, price: price }; }
  function total(s) { return s.items.reduce(function (a, i) { return a + i.qty * i.price; }, 0); }
  function listTotal(s) { return s.items.reduce(function (a, i) { return a + i.qty * PBY[i.sku].list; }, 0); }
  function add(o) { o.id = 'S' + (1000 + sales.length + 1); o.total = total(o); o.due = o.total - o.paid; sales.push(o); return o; }
  function randItems() {
    var n = ri(1, 4), used = {}, out = [];
    while (out.length < n) {
      var p = pick(products); if (used[p.sku]) continue; used[p.sku] = 1;
      var f = pick([1, 1, 1, .98, .96, .94, 1.02, .9]); var big = p.list > 500;
      out.push(line(p.sku, big ? pick([6, 10, 12, 20, 24]) : pick([12, 24, 30, 48, 60]), Math.round(p.list * f / 5) * 5));
    }
    return out;
  }
  /* history: per SR counts tuned so October lands at roughly 55-85% of target */
  var plan = { sr1: 30, sr2: 22, sr3: 20, sr4: 17 };
  Object.keys(plan).forEach(function (sid) {
    var mine = shops.filter(function (s) { return s.sr === sid && !s.isNew; });
    for (var k = 0; k < plan[sid]; k++) {
      var rr = R(), ago = rr < .45 ? ri(3, 22) : rr < .75 ? ri(23, 60) : ri(61, 84), sh = pick(mine); if (iso(ago) < sh.since) ago = ri(3, Math.max(3, days(sh.since, TODAY) - 1));
      var o = { sr: sid, shop: sh.id, date: iso(ago), items: randItems(), note: '' };
      var t = total(o); var fr = pick([0, 0, .25, .5, .5, 1, 1]);
      o.paid = Math.min(t, Math.round(t * fr / 100) * 100);
      var roll = R();
      if (roll < .06) { o.status = 'rejected'; o.rejectReason = pick(['Price too low for this quantity', 'Stock not available for 2 of the items', 'Shop has an old unpaid balance; collect first']); o.paid = 0; o.rejectedBy = 'Rafiq Hasan'; }
      else if (ago >= 4 || roll < .5) { o.status = 'delivered'; o.deliveredBy = pick(['SR', 'SR', 'Warehouse team']); o.deliveredOn = iso(Math.max(0, ago - 1)); }
      else o.status = 'approved';
      if (o.status !== 'rejected') { o.approvedBy = 'Rafiq Hasan'; o.approvedOn = o.date; }
      o.delivery = o.deliveredBy === 'Warehouse team' ? 'staff' : pick(['sr', 'sr', 'staff']);
      add(o);
    }
  });
  /* pending queue (hand-set so the approval demo has variety) */
  add({ sr: 'sr1', shop: 'b01', date: iso(0), status: 'submitted', delivery: 'sr', paid: 10000, note: 'Eid-style festival stock, shop wants fast delivery', items: [line('TEA-500', 48, 360), line('HNY-500', 24, 540), line('GHE-1L', 12, 1090)] });
  add({ sr: 'sr1', shop: 'b04', date: iso(0), status: 'submitted', delivery: 'staff', paid: 5000, note: 'New shop, first order', items: [line('MST-5L', 10, 1050), line('RCE-5K', 20, 360), line('DAL-1K', 24, 120)] });
  add({ sr: 'sr2', shop: 'b08', date: iso(0), status: 'submitted', delivery: 'staff', paid: 0, note: 'New shop near Khulshi; asked for 15 days credit', items: [line('TEA-1K', 20, 600), line('SPC-MIX', 12, 540), line('GTE-100', 30, 200)] });
  add({ sr: 'sr2', shop: 'b06', date: iso(1), status: 'submitted', delivery: 'sr', paid: 12000, note: '', items: [line('TEA-500', 60, 355), line('CHT-250', 48, 185)] });
  add({ sr: 'sr3', shop: 'b09', date: iso(1), status: 'submitted', delivery: 'sr', paid: 20000, note: 'Regular buyer, matched competitor price', items: [line('MST-5L', 24, 1080), line('GHE-1L', 12, 1040), line('RCE-5K', 40, 380)] });
  add({ sr: 'sr4', shop: 'b14', date: iso(1), status: 'submitted', delivery: 'sr', paid: 8000, note: 'New shop in Tongi', items: [line('HNY-500', 12, 480), line('GTE-100', 24, 240), line('CHT-250', 36, 175)] });
  add({ sr: 'sr3', shop: 'b11', date: iso(2), status: 'submitted', delivery: 'staff', paid: 0, note: '', items: [line('DAL-1K', 60, 135), line('RCE-5K', 30, 395)] });
  /* a recent rejected + a fresh approved so SR has varied statuses today */
  add({ sr: 'sr1', shop: 'b03', date: iso(2), status: 'rejected', delivery: 'sr', paid: 0, rejectReason: 'Price too low: Ghee below our floor. Re-submit at ৳1,040 or more.', rejectedBy: 'Rafiq Hasan', note: '', items: [line('GHE-1L', 12, 960), line('TEA-500', 24, 355)] });
  add({ sr: 'sr1', shop: 'b05', date: iso(1), status: 'approved', approvedBy: 'Rafiq Hasan', approvedOn: iso(1), delivery: 'sr', paid: 8000, note: '', items: [line('TEA-1K', 12, 690), line('SPC-MIX', 12, 610), line('GTE-100', 24, 240)] });

  /* memo numbers: SR-yymm-nnnn in date order for approved/delivered */
  sales.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1); });
  var mc = {};
  sales.forEach(function (s) {
    if (s.status === 'approved' || s.status === 'delivered') { var ym = s.date.slice(2, 4) + s.date.slice(5, 7); mc[ym] = (mc[ym] || 0) + 1; s.memo = 'SR-' + ym + '-' + ('000' + (mc[ym] + 140)).slice(-4); }
  });
  sales.reverse(); /* newest first */

  /* collections */
  var collections = [], cid = 0;
  function dueOf(shopId) { return sales.filter(function (s) { return s.shop === shopId && (s.status === 'approved' || s.status === 'delivered'); }).reduce(function (a, s) { return a + s.due; }, 0); }
  shops.forEach(function (sh) {
    var D = dueOf(sh.id); if (D <= 0) return;
    var old = sales.filter(function (s) { return s.shop === sh.id && s.due > 0 && s.memo; }).map(function (s) { return s.date; }).sort()[0];
    var gap = days(old, TODAY), left = Math.round(D * pick([.15, .25, .35]) / 500) * 500, n = ri(1, 2);
    for (var k = 0; k < n && left > 0 && gap > 8; k++) {
      var amt = Math.min(left, Math.max(500, Math.round(left / (n - k) / 500) * 500));
      collections.push({ id: 'C' + (++cid), shop: sh.id, sr: sh.sr, date: iso(ri(4, Math.max(5, gap - 3))), amount: amt, method: pick(['Cash', 'Cash', 'bKash', 'Nagad', 'Bank transfer']), note: '', status: 'confirmed', confirmedBy: 'Rafiq Hasan' });
      left -= amt;
    }
  });
  /* collection dates must not precede the first due sale; clamp */
  collections.forEach(function (c) { var f = sales.filter(function (s) { return s.shop === c.shop && s.due > 0 && s.memo; }).map(function (s) { return s.date; }).sort()[0]; if (c.date < f) c.date = f; });
  [['b01', 6000, 'bKash', 'bKash TrxID 8H2K1LQ9'], ['b09', 15000, 'Cash', 'Collected at shop, signed memo'], ['b06', 10000, 'Bank transfer', 'Islami Bank, ref 5521'], ['b12', 5000, 'Cash', '']].forEach(function (p, i) {
    var sh = SBY[p[0]]; collections.push({ id: 'C' + (++cid), shop: p[0], sr: sh.sr, date: iso(i % 2), amount: p[1], method: p[2], note: p[3], status: 'pending' });
  });
  collections.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

  function bpOf(sr) { return sr.bp == null ? settings.defaultBp : sr.bp; }
  function srById(id) { return srs.filter(function (s) { return s.id === id; })[0]; }
  function isLive(s) { return s.status === 'approved' || s.status === 'delivered'; }
  function shopDue(shopId) {
    var d = dueOf(shopId);
    return Math.max(0, d - collections.filter(function (c) { return c.shop === shopId && c.status === 'confirmed'; }).reduce(function (a, c) { return a + c.amount; }, 0));
  }
  function monthStats(srId, ym) {
    var live = sales.filter(function (s) { return s.sr === srId && isLive(s) && s.date.slice(0, 7) === ym; });
    var sold = live.reduce(function (a, s) { return a + s.total; }, 0), atSale = live.reduce(function (a, s) { return a + s.paid; }, 0);
    var dueCol = collections.filter(function (c) { return c.sr === srId && c.status === 'confirmed' && c.date.slice(0, 7) === ym; }).reduce(function (a, c) { return a + c.amount; }, 0);
    var sr = srById(srId), bp = bpOf(sr), base = atSale + dueCol;
    return { ym: ym, sold: sold, atSale: atSale, dueCol: dueCol, collected: base, bp: bp, commission: Math.round(base * bp / 10000), target: (targets[srId] || {})[ym] || 0, orders: live.length };
  }
  function srDue(srId) { return shops.filter(function (s) { return s.sr === srId; }).reduce(function (a, s) { return a + shopDue(s.id); }, 0); }
  /* ledger: sale_due rows (approved/delivered with due>0) and confirmed collections, oldest first, running balance. pending collections listed separately. */
  function ledger(shopId) {
    var rows = [];
    sales.forEach(function (s) { if (s.shop === shopId && isLive(s) && s.due > 0) rows.push({ date: s.date, type: 'Sale due', ref: s.memo, sale: s.id, amt: s.due, note: 'Total ' + s.total + ', paid ' + s.paid }); });
    collections.forEach(function (c) { if (c.shop === shopId) rows.push({ date: c.date, type: 'Collection', ref: c.method, amt: c.status === 'confirmed' ? -c.amount : 0, pending: c.status === 'pending' ? c.amount : 0, note: c.note, cid: c.id }); });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.amt > b.amt ? -1 : 1); });
    var bal = 0; rows.forEach(function (r) { bal += r.amt; r.bal = bal; });
    return rows;
  }
  /* FIFO aging of one shop's dues (confirmed collections cancel oldest first) */
  function aging(shopId) {
    var paid = collections.filter(function (c) { return c.shop === shopId && c.status === 'confirmed'; }).reduce(function (a, c) { return a + c.amount; }, 0);
    var b = { a: 0, b: 0, c: 0, oldest: null };
    sales.filter(function (s) { return s.shop === shopId && isLive(s) && s.due > 0; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; }).forEach(function (s) {
      var rem = s.due; if (paid > 0) { var t = Math.min(paid, rem); rem -= t; paid -= t; }
      if (rem <= 0) return; var age = days(s.date, TODAY); if (!b.oldest || age > b.oldest) b.oldest = age;
      if (age <= 30) b.a += rem; else if (age <= 60) b.b += rem; else b.c += rem;
    });
    b.total = b.a + b.b + b.c; return b;
  }
  function summary(s) { var it = s.items; return it.length === 1 ? PBY[it[0].sku].en + ' x ' + it[0].qty : it.length + ' items'; }

  window.SRD = {
    TODAY: TODAY, MONTHS: MONTHS, products: products, PBY: PBY, shops: shops, SBY: SBY, srs: srs, srById: srById, sales: sales, collections: collections, targets: targets, settings: settings, commStatus: commStatus,
    total: total, listTotal: listTotal, bpOf: bpOf, shopDue: shopDue, srDue: srDue, monthStats: monthStats, ledger: ledger, aging: aging, summary: summary, isLive: isLive,
    iso: iso, days: days, fd: fd, fm: fm, nextId: function () { return 'S' + (1000 + sales.length + 1 + Math.floor(Math.random() * 50)); }
  };
})();
