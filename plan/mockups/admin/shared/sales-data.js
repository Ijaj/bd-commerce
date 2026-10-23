/* Sales-ops fake data (agent B). Shared by orders / order / returns / tickets pages. Deterministic. */
(function () {
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = rng(20261023);
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
  var NOW = new Date('2026-10-23T11:30:00+06:00');

  var SUPPLIERS = { S1: 'Dhaka Home Appliances Ltd', S2: 'Gadget Hub BD', S3: 'Fashion Source Chattogram' };
  var PRODUCTS = [
    { id: 'P101', name: 'Wireless Earbuds Pro', emoji: '🎧', price: 2850, kg: 0.2, src: 'stock' },
    { id: 'P102', name: 'Cotton Panjabi (M)', emoji: '👕', price: 1950, kg: 0.4, src: 'stock' },
    { id: 'P103', name: 'Non-stick Cookware Set', emoji: '🍳', price: 4500, kg: 3.2, src: 'stock' },
    { id: 'P104', name: 'Baby Diaper Pack (L)', emoji: '🍼', price: 1150, kg: 1.5, src: 'stock' },
    { id: 'P105', name: 'Smart Watch S2', emoji: '⌚', price: 5990, kg: 0.3, src: 'stock' },
    { id: 'P106', name: 'Jamdani Saree', emoji: '🥻', price: 8500, kg: 0.8, src: 'dropship', sup: 'S3' },
    { id: 'P107', name: 'Air Fryer 4L', emoji: '🍟', price: 7200, kg: 4.5, src: 'dropship', sup: 'S1' },
    { id: 'P108', name: 'Rice Cooker 1.8L', emoji: '🍚', price: 3400, kg: 3.0, src: 'dropship', sup: 'S1' },
    { id: 'P109', name: 'Backpack 25L', emoji: '🎒', price: 1650, kg: 0.7, src: 'stock' },
    { id: 'P110', name: 'Bluetooth Speaker', emoji: '🔊', price: 2200, kg: 0.6, src: 'dropship', sup: 'S2' },
    { id: 'P111', name: "Men's Sneakers", emoji: '👟', price: 3200, kg: 1.0, src: 'stock' },
    { id: 'P112', name: 'Electric Kettle 1.7L', emoji: '🫖', price: 1490, kg: 1.2, src: 'stock' },
    { id: 'P113', name: 'Yoga Mat 6mm', emoji: '🧘', price: 950, kg: 1.0, src: 'stock' },
    { id: 'P114', name: 'LED Desk Lamp', emoji: '💡', price: 1250, kg: 0.8, src: 'dropship', sup: 'S2' }
  ];
  var ZONES = {
    'Dhaka City': { base: 60, extra: 20, eta: '1-2 days', free: 5000 },
    'Dhaka Suburb': { base: 99, extra: 20, eta: '2-3 days', free: 7000 },
    'Outside Dhaka': { base: 130, extra: 25, eta: '3-5 days', free: 10000 }
  };
  var NAMES = ['Rafiq Ahmed', 'Nusrat Jahan', 'Tanvir Hasan', 'Sadia Islam', 'Mahmudul Karim', 'Farzana Akter', 'Imran Hossain', 'Shirin Sultana', 'Kamal Uddin', 'Rina Begum', 'Arif Rahman', 'Tasnim Chowdhury', 'Sohel Rana', 'Mim Khatun', 'Zahid Hasan', 'Anika Tabassum', 'Jubayer Alam', 'Lamia Parvin', 'Rubel Mia', 'Sumaiya Rahman', 'Nayeem Sarker', 'Moushumi Das', 'Habib Ullah', 'Tithi Roy'];
  var AREAS = [['Dhanmondi, Dhaka', 'Dhaka City'], ['Mirpur 10, Dhaka', 'Dhaka City'], ['Uttara Sector 7, Dhaka', 'Dhaka City'], ['Gulshan 2, Dhaka', 'Dhaka City'], ['Savar, Dhaka', 'Dhaka Suburb'], ['Narayanganj Sadar', 'Dhaka Suburb'], ['Gazipur Chowrasta', 'Dhaka Suburb'], ['Agrabad, Chattogram', 'Outside Dhaka'], ['Zindabazar, Sylhet', 'Outside Dhaka'], ['Sonadanga, Khulna', 'Outside Dhaka'], ['Boalia, Rajshahi', 'Outside Dhaka'], ['Cox\'s Bazar Sadar', 'Outside Dhaka']];
  var CUSTOMERS = NAMES.map(function (n, i) {
    var a = AREAS[i % AREAS.length];
    return { id: 'C' + (1001 + i), name: n, phone: '01' + pick(['7', '8', '9', '5', '3']) + ri(10, 99) + '-' + ri(100000, 999999), addr: 'House ' + ri(2, 90) + ', Road ' + ri(1, 14) + ', ' + a[0], zone: a[1], orders: ri(1, 14), delivered: 0, returned: 0, risky: false, guest: [] };
  });
  CUSTOMERS.forEach(function (c) { c.delivered = Math.max(0, c.orders - ri(0, 2)); c.returned = ri(0, Math.min(2, c.delivered)); });
  CUSTOMERS[0].phone = '01711-482913'; CUSTOMERS[0].orders = 9; CUSTOMERS[0].delivered = 6; CUSTOMERS[0].returned = 2; CUSTOMERS[0].risky = true;
  CUSTOMERS[6].phone = '01819-330274'; CUSTOMERS[6].orders = 5; CUSTOMERS[6].risky = false;
  CUSTOMERS[12].phone = '01955-120667';

  var STATUS_LABEL = { pending_payment: 'Pending payment', processing: 'Processing', on_hold: 'On hold', partially_shipped: 'Partially shipped', shipped: 'Shipped', delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled' };
  var STATUS_TONE = { pending_payment: 'warn', processing: 'info', on_hold: 'warn', partially_shipped: 'info', shipped: 'info', delivered: 'ok', completed: 'ok', cancelled: 'muted' };
  var SEQ = ['processing', 'processing', 'processing', 'shipped', 'delivered', 'completed', 'completed', 'delivered', 'processing', 'on_hold', 'partially_shipped', 'completed', 'shipped', 'cancelled', 'pending_payment', 'processing', 'delivered', 'completed'];
  var RISK_MSGS = ['3 orders from same phone in 1h', 'Same device used by 4 different phones in 24h', '5 orders from same IP in 24h'];
  var SOURCES = ['Web', 'Android', 'iOS'];

  function delivery(zone, kg, goods) {
    var z = ZONES[zone];
    if (z.free === 0 || (z.free && goods >= z.free)) return 0;
    return z.base + Math.max(0, Math.ceil(kg) - 1) * z.extra;
  }

  function buildOrder(i) {
    var c = CUSTOMERS[i % CUSTOMERS.length];
    var status = SEQ[i % SEQ.length];
    var n = ri(1, 3), items = [], used = {};
    for (var k = 0; k < n; k++) {
      var p = pick(PRODUCTS); if (used[p.id]) continue; used[p.id] = 1;
      items.push({ pid: p.id, name: p.name, emoji: p.emoji, sku: p.id + '-' + ri(1, 3), qty: ri(1, 2), price: p.price, kg: p.kg, src: p.src, sup: p.sup || null });
    }
    var date = new Date(NOW.getTime() - (i * 5.2 + R() * 3) * 3600e3);
    return makeOrder(10482 - i, c, items, status, date);
  }

  function makeOrder(num, c, items, status, date) {
    var sub = 0, kg = 0;
    items.forEach(function (it) { sub += it.qty * it.price; kg += it.qty * it.kg; });
    var discount = sub > 5000 ? Math.round(sub * 0.05) : 0;
    var coupon = R() < 0.25 ? 150 : 0;
    var points = R() < 0.15 ? 100 : 0;
    var wallet = R() < 0.1 ? 200 : 0;
    var goods = sub - discount - coupon - points - wallet;
    var del = delivery(c.zone, kg, goods);
    var total = goods + del;
    var pendingPay = status === 'pending_payment';
    var method = pendingPay ? 'bKash' : 'COD';
    var advance = pendingPay ? del : 0;
    var payStatus = status === 'cancelled' ? 'Voided' : pendingPay ? 'Awaiting advance' : (status === 'delivered' || status === 'completed') ? 'COD collected' : 'COD due';
    return {
      id: 'BD-' + num, num: num, date: date, cid: c.id, cname: c.name, phone: c.phone, addr: c.addr, zone: c.zone,
      items: items, status: status, sub: sub, discount: discount, coupon: coupon, couponCode: coupon ? 'WELCOME150' : '', points: points, wallet: wallet, delivery: del, total: total,
      vat: Math.round((goods) * 15 / 115), kg: Math.round(kg * 10) / 10, method: method, advance: advance, payStatus: payStatus,
      source: pick(SOURCES), courier: null, risk: null, tracking: null
    };
  }

  var ORDERS = [];
  for (var i = 0; i < 64; i++) ORDERS.push(buildOrder(i));
  // courier by status
  ORDERS.forEach(function (o) {
    if (['shipped', 'delivered', 'completed', 'partially_shipped'].indexOf(o.status) >= 0) o.courier = pick(['Pathao', 'Steadfast']);
  });
  // velocity-risk seeds: Rafiq Ahmed 3 orders in ~1h
  [0, 1, 2].forEach(function (k) {
    var o = ORDERS[k];
    var c = CUSTOMERS[0];
    o.cid = c.id; o.cname = c.name; o.phone = c.phone; o.addr = c.addr; o.zone = c.zone;
    o.status = k === 2 ? 'on_hold' : 'processing'; o.payStatus = 'COD due'; o.courier = null;
    o.date = new Date(NOW.getTime() - (k * 22 + 9) * 60e3);
    o.risk = { rule: 'phone_velocity', msg: RISK_MSGS[0], sev: 'danger' };
    o.delivery = delivery(c.zone, o.kg, o.sub - o.discount - o.coupon - o.points - o.wallet);
    o.total = o.sub - o.discount - o.coupon - o.points - o.wallet + o.delivery;
    o.vat = Math.round((o.total - o.delivery) * 15 / 115);
  });
  [7, 15, 21, 30, 44].forEach(function (k, j) {
    var o = ORDERS[k]; if (['processing', 'on_hold'].indexOf(o.status) < 0) o.status = 'processing';
    o.risk = { rule: j % 2 ? 'ip_velocity' : 'device_velocity', msg: RISK_MSGS[j % 2 ? 2 : 1], sev: 'warn' };
    o.payStatus = 'COD due'; o.courier = null;
  });
  // guest orders linked to a customer (auto-link after OTP)
  CUSTOMERS[3].guest = ['BD-10440', 'BD-10397'];
  CUSTOMERS[0].guest = ['BD-10301'];

  // shipments derived
  function shipmentsFor(o) {
    var stock = o.items.filter(function (i) { return i.src === 'stock'; });
    var drop = o.items.filter(function (i) { return i.src === 'dropship'; });
    var sh = [];
    var firstDelivery = o.delivery;
    function mk(label, kind, list, sup) {
      var w = 0, val = 0;
      list.forEach(function (i) { w += i.kg * i.qty; val += i.price * i.qty; });
      return { label: label, kind: kind, sup: sup || null, items: list.map(function (i) { return i.sku; }), kg: Math.round(w * 10) / 10 || 0.1, courier: o.courier || 'Pathao', tracking: '', status: 'not_booked', cod: 0 };
    }
    if (stock.length) sh.push(mk('Shipment ' + (sh.length + 1), 'stock', stock));
    var bySup = {};
    drop.forEach(function (i) { (bySup[i.sup] = bySup[i.sup] || []).push(i); });
    Object.keys(bySup).forEach(function (s) { sh.push(mk('Shipment ' + (sh.length + 1), 'dropship', bySup[s], s)); });
    // COD amount: whole delivery charge on first shipment; each shipment COD = its goods share (proportional) + delivery on first
    var goods = o.sub - o.discount - o.coupon - o.points - o.wallet;
    var allVal = 0; sh.forEach(function (s) { s.val = 0; o.items.forEach(function (i) { if (s.items.indexOf(i.sku) >= 0) s.val += i.price * i.qty; }); allVal += s.val; });
    var acc = 0;
    sh.forEach(function (s, idx) {
      var share = idx === sh.length - 1 ? goods - acc : Math.round(goods * s.val / allVal);
      acc += share; s.cod = share + (idx === 0 ? firstDelivery : 0);
      if (o.method !== 'COD') s.cod = Math.max(0, s.cod - (idx === 0 ? o.advance : 0));
    });
    var tn = function (c, k) { return (c === 'Pathao' ? 'PT' : 'SF') + (o.num * 7 + k * 131) + 'BD'; };
    var st = o.status;
    sh.forEach(function (s, k) {
      if (st === 'delivered' || st === 'completed') { s.status = 'delivered'; s.tracking = tn(s.courier, k); }
      else if (st === 'shipped') { s.status = 'in_transit'; s.tracking = tn(s.courier, k); }
      else if (st === 'partially_shipped') { if (k === 0) { s.status = 'in_transit'; s.tracking = tn(s.courier, k); } else { s.status = 'awaiting_supplier'; } }
    });
    if (st === 'processing' && o.num % 3 === 0 && sh.length) { sh[0].status = 'booked'; sh[0].tracking = tn(sh[0].courier, 0); }
    return sh;
  }

  /* ---------------- Returns ---------------- */
  var RET_THRESHOLD = 5000;
  var RET_STATUS = { requested: 'Requested', approved: 'Approved', picked_up: 'Picked up', inspected: 'Inspected', refunded: 'Refunded', rejected: 'Rejected' };
  var REASONS = [['Item arrived damaged', 'our_fault'], ['Wrong item delivered', 'our_fault'], ['Does not match description', 'our_fault'], ['Size does not fit', 'change_of_mind'], ['Changed my mind', 'change_of_mind'], ['Found cheaper elsewhere', 'change_of_mind'], ['Stopped working after 2 days', 'our_fault']];
  var RETURNS = [];
  var delivered = ORDERS.filter(function (o) { return o.status === 'delivered' || o.status === 'completed'; });
  var rs = ['requested', 'requested', 'requested', 'approved', 'approved', 'picked_up', 'picked_up', 'inspected', 'inspected', 'refunded', 'refunded', 'refunded', 'rejected', 'requested'];
  rs.forEach(function (st, k) {
    var o = delivered[k * 2 % delivered.length];
    var rsn = REASONS[k % REASONS.length];
    var it = o.items[0];
    var qty = 1;
    var amt = it.price * qty;
    if (k === 1 || k === 7) { it = o.items[0]; qty = it.qty; amt = it.price * qty; }
    var big = k === 2 || k === 7;
    if (big) { it = { pid: 'P107', name: 'Air Fryer 4L', emoji: '🍟', sku: 'P107-1', qty: 1, price: 7200, src: 'dropship', sup: 'S1' }; amt = 7200; }
    var days = [2, 3, 5, 1, 6, 4, 8, 3, 2, 5, 6, 3, 9, 1][k];
    var win = k === 5 ? 3 : 7;
    RETURNS.push({
      id: 'RT-' + (2051 - k), orderId: o.id, cid: o.cid, cname: o.cname, phone: o.phone, status: st, date: new Date(NOW.getTime() - (k * 9 + 5) * 3600e3),
      items: [{ name: it.name, emoji: it.emoji, qty: qty, price: it.price }], reason: rsn[0], fault: rsn[1], note: k % 3 === 0 ? 'The box was crushed and the product has scratches. Please arrange pickup.' : '',
      photos: rsn[1] === 'our_fault' ? ri(1, 3) : 0, daysSince: days, window: win, winSource: k === 5 ? 'Category override (Innerwear: 3 days)' : 'Store default (7 days)',
      amount: amt, shipFee: rsn[1] === 'our_fault' ? 0 : 120, refundTo: k % 2 ? 'wallet' : 'original', big: amt > RET_THRESHOLD,
      approved: !big || st === 'refunded',
      inspection: ['inspected', 'refunded'].indexOf(st) >= 0 ? (k % 4 === 0 ? 'Defective confirmed' : 'Unused, original packaging') : '',
      restore: { points: o.points, coupon: o.couponCode, wallet: o.wallet },
      reject: st === 'rejected' ? 'Outside the return window (9 days after delivery).' : ''
    });
  });

  /* ---------------- Tickets ---------------- */
  var STAFF = ['Nabila (Support)', 'Rakib (Support)', 'Sumon (Manager)'];
  var MACROS = [
    ['Order status update', 'Hi {name}, your order {order} is being processed and will be handed to the courier within 24 hours. You will receive an SMS with the tracking ID.'],
    ['Return instructions', 'Hi {name}, we are sorry about the trouble. Please keep the item in its original packaging. Our courier will pick it up after your return request is approved, and the refund follows after inspection.'],
    ['Request photo of damage', 'Hi {name}, could you please send a clear photo of the damaged item and the outer parcel? We will resolve this right away.'],
    ['Refund timeline', 'Hi {name}, refunds are issued within 2 working days after the returned item passes inspection, to your original payment method or your store wallet, as you choose.'],
    ['Delivery delay apology', 'Hi {name}, apologies for the delay. We have escalated your parcel with the courier and will update you within 24 hours.']
  ];
  var T_SUBJ = ['Order not delivered yet', 'Received wrong colour', 'Want to change delivery address', 'Refund not received', 'Product stopped working', 'Courier asked extra money', 'Need invoice with BIN', 'How to use the loyalty points?', 'Cancel my order please', 'Parcel marked delivered but not received', 'Size exchange possible?', 'Coupon not applying at checkout'];
  var TICKETS = [];
  T_SUBJ.forEach(function (s, k) {
    var o = ORDERS[(k * 5 + 3) % ORDERS.length], c = CUSTOMERS.filter(function (x) { return x.id === o.cid; })[0];
    var ch = ['web', 'app', 'phone'][k % 3 === 0 ? 2 : k % 2];
    var st = ['open', 'open', 'pending', 'solved', 'open', 'pending', 'solved', 'open', 'open', 'pending', 'open', 'solved'][k];
    var pr = ['normal', 'high', 'low', 'normal', 'urgent', 'high', 'low', 'low', 'high', 'urgent', 'normal', 'normal'][k];
    var t0 = new Date(NOW.getTime() - (k * 7 + 2) * 3600e3);
    var msgs = [{ from: 'customer', name: o.cname, text: s + '. Order ' + o.id + '. Please help.', at: t0 }];
    if (ch === 'phone') msgs[0] = { from: 'call', name: 'Nabila (Support)', text: 'Phone call logged (inbound, 3 min): customer reported "' + s + '". Outcome: needs follow-up.', at: t0 };
    if (st !== 'open') { msgs.push({ from: 'staff', name: 'Rakib (Support)', text: 'Hi ' + o.cname.split(' ')[0] + ', thanks for contacting us. We are checking this with the courier and will update you shortly.', at: new Date(t0.getTime() + 50 * 60e3) }); msgs.push({ from: 'note', name: 'Rakib (Support)', text: 'Courier hub confirmed parcel is at sorting centre. Follow up tomorrow.', at: new Date(t0.getTime() + 70 * 60e3) }); }
    if (st === 'solved') msgs.push({ from: 'customer', name: o.cname, text: 'Received it, thank you!', at: new Date(t0.getTime() + 5 * 3600e3) });
    TICKETS.push({ id: 'TK-' + (3312 - k), subject: s, channel: ch, status: st, priority: pr, assignee: k % 4 === 3 ? '' : STAFF[k % 3], orderId: o.id, cid: c.id, cname: c.name, phone: c.phone, created: t0, updated: msgs[msgs.length - 1].at, msgs: msgs });
  });

  window.SalesData = {
    NOW: NOW, SUPPLIERS: SUPPLIERS, PRODUCTS: PRODUCTS, ZONES: ZONES, CUSTOMERS: CUSTOMERS, ORDERS: ORDERS,
    STATUS_LABEL: STATUS_LABEL, STATUS_TONE: STATUS_TONE, RISK_MSGS: RISK_MSGS, RETURNS: RETURNS, RET_STATUS: RET_STATUS, RET_THRESHOLD: RET_THRESHOLD,
    TICKETS: TICKETS, MACROS: MACROS, STAFF: STAFF, shipmentsFor: shipmentsFor, delivery: delivery,
    order: function (id) { return ORDERS.filter(function (o) { return o.id === id; })[0]; },
    customer: function (id) { return CUSTOMERS.filter(function (c) { return c.id === id; })[0]; },
    payTone: function (p) { return p === 'COD collected' ? 'ok' : p === 'COD due' ? 'warn' : p === 'Voided' ? 'muted' : 'info'; }
  };
})();
