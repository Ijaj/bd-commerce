/* Agent E fake data (customers, suppliers, products). Deterministic. window.PD */
(function () {
  'use strict';
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = rng(20261023);
  function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  var NOW = new Date(2026, 9, 23, 15, 0, 0);
  function daysAgo(n) { return new Date(NOW.getTime() - n * 86400000); }
  var FIRST = ['Rahim', 'Karim', 'Nusrat', 'Sadia', 'Tanvir', 'Mahmud', 'Farhana', 'Rafiq', 'Shirin', 'Imran', 'Jannat', 'Arif', 'Mitu', 'Sabbir', 'Tasnim', 'Hasan', 'Rumana', 'Faisal', 'Sumaiya', 'Nayeem', 'Ayesha', 'Zahid', 'Lamia', 'Shakil', 'Mou', 'Kabir', 'Popy', 'Anik', 'Rima', 'Joy'];
  var LAST = ['Ahmed', 'Hossain', 'Islam', 'Chowdhury', 'Khan', 'Akter', 'Begum', 'Rahman', 'Uddin', 'Sarkar', 'Mia', 'Talukder', 'Siddique', 'Paul', 'Das', 'Mondal'];
  var CITY = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Gazipur', 'Cumilla', 'Barishal', 'Rangpur', 'Narayanganj', 'Mymensingh'];
  var OPS = ['017', '018', '019', '016', '015', '013', '014'];
  var customers = [];
  for (var i = 0; i < 64; i++) {
    var fn = pick(FIRST), ln = pick(LAST), joinedAgo = ri(2, 560);
    var orders = joinedAgo < 20 ? ri(0, 2) : ri(0, joinedAgo > 200 ? 28 : 9);
    var spent = orders * ri(1200, 9800);
    if (R() < .07) { spent += ri(60000, 150000); orders += ri(5, 9); }
    var returns = orders ? Math.min(orders, Math.round(orders * (R() < .2 ? R() * .6 : R() * .12))) : 0;
    var risky = (returns / Math.max(orders, 1) > .3 && orders >= 3) || R() < .05;
    var lastAgo = orders ? Math.min(joinedAgo, ri(1, 220)) : null;
    var c = {
      id: 'C' + (1001 + i), name: fn + ' ' + ln, phone: pick(OPS) + String(ri(10000000, 99999999)),
      email: R() < .85 ? (fn + '.' + ln + ri(1, 99)).toLowerCase() + '@' + pick(['gmail.com', 'gmail.com', 'yahoo.com', 'outlook.com']) : '',
      city: pick(CITY), orders: orders, spent: spent, returns: returns,
      wallet: R() < .3 ? ri(1, 30) * 50 : 0, points: orders ? ri(0, Math.round(spent / 100)) : 0,
      risky: risky, riskReason: risky ? pick(['Refused 2 COD deliveries in a row', 'Same phone used on 3 different names', 'High return ratio (staff review)', 'Fake-address complaint from courier']) : '',
      joined: daysAgo(joinedAgo), lastOrder: lastAgo == null ? null : daysAgo(lastAgo), verified: R() < .92, guest: R() < .12
    };
    c.segment = c.spent >= 80000 ? 'VIP' : joinedAgo <= 30 ? 'New' : (c.lastOrder == null || (NOW - c.lastOrder) / 86400000 > 90) ? 'Dormant' : 'Regular';
    customers.push(c);
  }
  /* make the first few predictable for demos */
  customers[0].name = 'Rahim Uddin'; customers[0].email = 'rahim.uddin@gmail.com'; customers[0].risky = false; customers[0].riskReason = ''; customers[0].orders = Math.max(customers[0].orders, 12); customers[0].spent = Math.max(customers[0].spent, 86400); customers[0].segment = 'VIP'; customers[0].verified = true;
  customers[1].name = 'Nusrat Jahan'; customers[1].email = 'nusrat.jahan@gmail.com'; customers[1].risky = true; customers[1].riskReason = 'Refused 2 COD deliveries in a row'; customers[1].orders = Math.max(customers[1].orders, 6); customers[1].returns = Math.max(customers[1].returns, 3);

  var suppliers = [
    ['S01', 'Dhaka Electro Hub', 'Mizanur Rahman', 'warehouse', 'Shop 214, Bashundhara City, Panthapath, Dhaka', 94, 2.1, 'active'],
    ['S02', 'Fashion Palace BD', 'Salma Khatun', 'direct', 'House 12, Road 4, Mirpur-10, Dhaka', 88, 4.5, 'active'],
    ['S03', 'Rupsha Home & Living', 'Kamal Hossain', 'direct', 'Khalishpur Industrial Area, Khulna', 81, 6.8, 'active'],
    ['S04', 'Chattala Gadgets', 'Jasim Uddin', 'warehouse', 'GEC More, Nasirabad, Chattogram', 97, 1.2, 'active'],
    ['S05', 'Sylhet Tea & Spice', 'Rubel Ahmed', 'direct', 'Zindabazar, Sylhet', 91, 3.0, 'active'],
    ['S06', 'Beauty Bazar Wholesale', 'Nasima Begum', 'warehouse', 'Mohakhali DOHS, Dhaka', 76, 9.4, 'active'],
    ['S07', 'Tangail Saree House', 'Abdul Latif', 'direct', 'Pathrail, Tangail Sadar', 85, 5.2, 'paused'],
    ['S08', 'Kids Corner Importers', 'Farzana Yasmin', 'warehouse', 'Islampur, Old Dhaka', 90, 3.7, 'active']
  ].map(function (s, i) {
    return {
      id: s[0], name: s[1], contact: s[2], phone: '01' + ri(3, 9) + String(ri(10000000, 99999999)), email: s[1].toLowerCase().replace(/[^a-z]/g, '').slice(0, 14) + '@example.com',
      route: s[3], pickup: s[4], onTime: s[5], cancel: s[6], status: s[7], products: ri(6, 48), openOrders: s[7] === 'paused' ? 0 : ri(1, 9),
      portal: [{ name: s[2], email: s[2].split(' ')[0].toLowerCase() + '@' + s[1].toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) + '.com', last: i === 6 ? '12 days ago' : ri(1, 5) + ' h ago', role: 'Owner' }].concat(R() < .5 ? [{ name: 'Packing staff', email: 'pack@' + s[1].toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) + '.com', last: 'yesterday', role: 'Fulfilment' }] : []),
      lead: ri(1, 4), terms: pick(['Net 15', 'Net 30', 'Advance 50%', 'COD on pickup'])
    };
  });
  var PN = [['Wireless Earbuds Pro', 'Electronics', 1800], ['Smart Watch Fit 2', 'Electronics', 2400], ['Power Bank 20000mAh', 'Electronics', 1450], ['USB-C Fast Charger 65W', 'Electronics', 980], ['Cotton Panjabi (Eid Edition)', 'Fashion', 1100], ['Women Kurti Set', 'Fashion', 1250], ['Denim Jeans Slim', 'Fashion', 1350], ['Non-stick Cookware 5pc', 'Home', 2900], ['Bed Sheet King Size', 'Home', 1150], ['Electric Kettle 1.8L', 'Home', 1300], ['Sylhet Premium Tea 500g', 'Grocery', 420], ['Pure Mustard Oil 5L', 'Grocery', 980], ['Face Serum Vitamin C', 'Beauty', 640], ['Hair Dryer 2000W', 'Beauty', 1500], ['Baby Stroller Lite', 'Kids', 5200], ['Kids Learning Tablet', 'Kids', 2100], ['Tangail Cotton Saree', 'Fashion', 1800], ['Bluetooth Speaker Mini', 'Electronics', 1100], ['Yoga Mat 8mm', 'Sports', 620], ['Football Size 5', 'Sports', 540]];
  var products = PN.map(function (p, i) {
    var s = suppliers[(i * 3 + (i > 9 ? 1 : 0)) % suppliers.length];
    return { sku: 'SKU-' + (2001 + i), name: p[0], cat: p[1], cost: p[2], price: Math.round(p[2] * (1.28 + R() * .25) / 10) * 10, stock: ri(0, 140), supplier: s.id, lowAt: 10 };
  });
  products.forEach(function (p) { var s = suppliers.filter(function (x) { return x.id === p.supplier; })[0]; });

  window.PD = {
    rng: rng, NOW: NOW, daysAgo: daysAgo, customers: customers, suppliers: suppliers, products: products,
    fd: function (d) { if (!d) return '—'; d = new Date(d); return window.Admin ? Admin.fmt.date(d) : d.toDateString(); },
    supplier: function (id) { return suppliers.filter(function (s) { return s.id === id; })[0]; }
  };
})();
