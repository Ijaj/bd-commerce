/* Catalog fake data (agent C). Shared by products / product-edit / categories / inventory / reviews pages. English-only admin. */
(function () {
  function rng(seed) { var s = seed | 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  var R = rng(20261023);
  function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
  function slug(s) { return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  /* ---------- categories (4 levels). node = [name, bn, children, colour, emoji] ---------- */
  var RAW = [
    ['Electronics', 'ইলেকট্রনিক্স', [
      ['Mobiles & Tablets', 'মোবাইল ও ট্যাবলেট', [
        ['Smartphones', 'স্মার্টফোন', [['Android phones', 'অ্যান্ড্রয়েড ফোন'], ['iPhones', 'আইফোন']]],
        ['Tablets', 'ট্যাবলেট', [['Android tablets', 'অ্যান্ড্রয়েড ট্যাবলেট']]]]],
      ['Audio & Accessories', 'অডিও ও এক্সেসরিজ', [
        ['Earbuds & headphones', 'ইয়ারবাড ও হেডফোন', [['True wireless earbuds', 'ওয়্যারলেস ইয়ারবাড'], ['Neckbands', 'নেকব্যান্ড']]],
        ['Chargers & cables', 'চার্জার ও ক্যাবল', [['Power banks', 'পাওয়ার ব্যাংক'], ['Cables', 'ক্যাবল']]]]],
      ['Computers', 'কম্পিউটার', [
        ['Laptops', 'ল্যাপটপ', [['Gaming laptops', 'গেমিং ল্যাপটপ'], ['Ultrabooks', 'আল্ট্রাবুক']]],
        ['Peripherals', 'পেরিফেরাল', [['Keyboards', 'কিবোর্ড'], ['Mouse', 'মাউস']]]]]], '#4338ca', '📱'],
    ['Fashion', 'ফ্যাশন', [
      ['Women', 'নারী', [
        ['Sarees', 'শাড়ি', [['Jamdani', 'জামদানি'], ['Cotton sarees', 'সুতি শাড়ি']]],
        ['Kurtis & tops', 'কুর্তি ও টপ', [['Printed kurtis', 'প্রিন্টেড কুর্তি']]]]],
      ['Men', 'পুরুষ', [
        ['Shirts', 'শার্ট', [['Casual shirts', 'ক্যাজুয়াল শার্ট'], ['Formal shirts', 'ফরমাল শার্ট']]],
        ['Panjabi', 'পাঞ্জাবি', [['Festive panjabi', 'উৎসবের পাঞ্জাবি']]]]],
      ['Footwear', 'জুতা', [
        ['Sneakers', 'স্নিকার্স', [['Running shoes', 'রানিং শু']]],
        ['Sandals', 'স্যান্ডেল', [['Leather sandals', 'চামড়ার স্যান্ডেল']]]]]], '#be123c', '👗'],
    ['Home & Living', 'হোম ও লিভিং', [
      ['Kitchen', 'রান্নাঘর', [
        ['Cookware', 'কুকওয়্যার', [['Non-stick pans', 'নন-স্টিক প্যান']]],
        ['Appliances', 'যন্ত্রপাতি', [['Rice cookers', 'রাইস কুকার']]]]],
      ['Decor', 'সাজসজ্জা', [['Wall art', 'ওয়াল আর্ট', [['Framed prints', 'ফ্রেমড প্রিন্ট']]]]]], '#0f766e', '🏠'],
    ['Beauty & Care', 'বিউটি ও কেয়ার', [
      ['Skincare', 'স্কিনকেয়ার', [
        ['Sun care', 'সান কেয়ার', [['Sunscreens', 'সানস্ক্রিন']]],
        ['Face care', 'ফেস কেয়ার', [['Serums', 'সিরাম']]]]],
      ['Hair care', 'হেয়ার কেয়ার', [['Oils & treatments', 'তেল ও ট্রিটমেন্ট', [['Hair oils', 'হেয়ার অয়েল']]]]]], '#a21caf', '🧴'],
    ['Baby & Kids', 'বেবি ও কিডস', [
      ['Toys', 'খেলনা', [['Educational', 'শিক্ষামূলক', [['Puzzles', 'পাজল'], ['Learning tablets', 'লার্নিং ট্যাবলেট']]]]],
      ['Baby essentials', 'বেবি এসেনশিয়াল', [
        ['Clothing', 'পোশাক', [['Baby clothing', 'বেবি ক্লোদিং']]],
        ['Feeding', 'ফিডিং', [['Feeding sets', 'ফিডিং সেট']]]]]], '#b45309', '🧸']
  ];
  /* attributes defined at a category (inherited by all descendants) */
  var S = function (n, v, f) { return { n: n, t: 'select', v: v, f: f !== false }; };
  var ATTR = {
    'Electronics': [S('Warranty', ['No warranty', '6 months', '1 year', '2 years'])],
    'Smartphones': [S('RAM', ['4GB', '6GB', '8GB', '12GB']), S('Storage', ['64GB', '128GB', '256GB', '512GB']), S('Network', ['4G', '5G'])],
    'Earbuds & headphones': [S('Connectivity', ['Bluetooth', 'Wired', '2.4GHz']), S('Battery life', ['Up to 8h', 'Up to 20h', '30h+'], false)],
    'Laptops': [S('Processor', ['Core i3', 'Core i5', 'Core i7', 'Ryzen 5', 'Ryzen 7']), S('Display size', ['14"', '15.6"', '16"'])],
    'Fashion': [S('Colour', ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Multi']), S('Material', ['Cotton', 'Silk', 'Polyester', 'Leather', 'Linen'])],
    'Sarees': [S('Fabric', ['Jamdani', 'Cotton', 'Silk', 'Muslin']), S('Occasion', ['Daily', 'Festive', 'Wedding'])],
    'Men': [S('Fit', ['Slim', 'Regular', 'Relaxed'])],
    'Footwear': [S('Size standard', ['EU', 'UK'], false)],
    'Kitchen': [S('Material', ['Aluminium', 'Stainless steel', 'Ceramic', 'Plastic'])],
    'Appliances': [S('Power', ['500W', '700W', '1000W+']), S('Capacity', ['1L', '1.8L', '2.8L'])],
    'Beauty & Care': [S('Skin / hair type', ['All', 'Dry', 'Oily', 'Sensitive'])],
    'Skincare': [S('SPF / concern', ['SPF 30', 'SPF 50', 'Brightening', 'Anti-ageing'], false)],
    'Baby & Kids': [S('Age group', ['0-1 yr', '1-3 yrs', '3-6 yrs', '6+ yrs'])]
  };
  var RETURN = { 'Laptops': 14, 'Skincare': 3, 'Baby essentials': 7 };

  var cats = [], byId = {}, nid = 1;
  function build(arr, parent, level) {
    arr.forEach(function (r, i) {
      var c = { id: 'c' + (nid++), name: r[0], bn: r[1], slug: slug(r[0]), level: level, parent: parent ? parent.id : null, children: [], sort: i + 1,
        color: r[3] || (parent ? parent.color : '#4338ca'), emoji: r[4] || (parent ? parent.emoji : '🛍️'), image: level === 1 || R() < .3,
        attrs: (ATTR[r[0]] || []).map(function (a) { return { n: a.n, t: a.t, v: a.v.slice(), f: a.f }; }), ret: RETURN[r[0]] || null, hidden: false };
      cats.push(c); byId[c.id] = c; if (parent) parent.children.push(c.id);
      if (r[2]) build(r[2], c, level + 1);
    });
  }
  build(RAW, null, 1);
  function byName(n) { for (var i = 0; i < cats.length; i++) if (cats[i].name === n) return cats[i]; return null; }
  function ancestors(id) { var o = [], c = byId[id]; while (c && c.parent) { c = byId[c.parent]; o.unshift(c); } return o; }
  function path(id) { var c = byId[id]; if (!c) return ''; return ancestors(id).map(function (a) { return a.name; }).concat(c.name).join(' › '); }
  function descendants(id) { var o = [], st = [id]; while (st.length) { var c = byId[st.pop()]; if (!c) continue; o.push(c.id); c.children.forEach(function (k) { st.push(k); }); } return o; }
  function inheritedAttrs(id) { var o = []; ancestors(id).forEach(function (a) { a.attrs.forEach(function (at) { o.push({ n: at.n, v: at.v, from: a.name }); }); }); return o; }
  function attrsFor(ids) { var seen = {}, o = []; ids.forEach(function (id) { var c = byId[id]; if (!c) return; ancestors(id).concat(c).forEach(function (a) { a.attrs.forEach(function (at) { var k = at.n + '|' + a.id; if (!seen[at.n]) { seen[at.n] = 1; o.push({ n: at.n, v: at.v, from: a.name }); } }); }); }); return o; }

  /* ---------- brands & suppliers ---------- */
  var brands = ['Samsung', 'Xiaomi', 'Apple', 'Lenovo', 'Anker', 'Realme', 'Ugreen', 'Asus', 'Logitech', 'Deshi Loom', 'Urban Nest', 'Apex', 'HomeChef', 'KitchenPro', 'Tangail Weavers', 'GlowLab', 'LittleOak'];
  var suppliers = [
    { id: 's1', name: 'Dhaka Mobile Hub', route: 'direct' },
    { id: 's2', name: 'Chattogram Fashion House', route: 'warehouse' },
    { id: 's3', name: 'Rahim Traders', route: 'direct' },
    { id: 's4', name: 'Sylhet Home Supply', route: 'warehouse' },
    { id: 's5', name: 'Beauty Source BD', route: 'direct' }
  ];

  /* ---------- products ---------- */
  var O = function (n, v) { return { name: n, values: v }; };
  var CLR = ['Black', 'White', 'Blue', 'Green', 'Red'], SZ = ['S', 'M', 'L', 'XL'];
  // [title, bn, leaf, brand, price, emoji, opts, supplierIdx, advance%, extraCat]
  var TPL = [
    ['Samsung Galaxy A55 5G', 'স্যামসাং গ্যালাক্সি এ৫৫ ৫জি', 'Android phones', 'Samsung', 52990, '📱', [O('Colour', ['Navy', 'Lilac']), O('Storage', ['128GB', '256GB'])], -1, 0],
    ['Xiaomi Redmi Note 13', 'শাওমি রেডমি নোট ১৩', 'Android phones', 'Xiaomi', 24990, '📱', [O('Colour', ['Black', 'Blue', 'Green']), O('Storage', ['128GB', '256GB'])], -1, 0],
    ['Apple iPhone 15', 'অ্যাপল আইফোন ১৫', 'iPhones', 'Apple', 118000, '📱', [O('Colour', ['Black', 'Pink', 'Blue']), O('Storage', ['128GB', '256GB'])], 0, 30],
    ['Lenovo Tab M10 3rd Gen', 'লেনোভো ট্যাব এম১০', 'Android tablets', 'Lenovo', 21500, '📲', [O('Colour', ['Grey'])], -1, 0],
    ['Anker Soundcore Life P3', 'অ্যাঙ্কার সাউন্ডকোর', 'True wireless earbuds', 'Anker', 7990, '🎧', [O('Colour', ['Black', 'White'])], -1, 0],
    ['Realme Buds Wireless 3', 'রিয়েলমি বাডস ওয়্যারলেস ৩', 'Neckbands', 'Realme', 2790, '🎧', [O('Colour', ['Black', 'Green'])], -1, 0],
    ['Xiaomi 20000mAh Power Bank', 'শাওমি পাওয়ার ব্যাংক', 'Power banks', 'Xiaomi', 3290, '🔋', [], -1, 0],
    ['Type-C Braided Cable', 'টাইপ-সি ব্রেইডেড ক্যাবল', 'Cables', 'Ugreen', 450, '🔌', [O('Colour', ['Black', 'Red']), O('Length', ['1m', '2m'])], -1, 0],
    ['Asus TUF Gaming F15', 'আসুস টাফ গেমিং এফ১৫', 'Gaming laptops', 'Asus', 94500, '💻', [O('RAM', ['16GB', '32GB'])], 0, 20],
    ['Lenovo IdeaPad Slim 3', 'লেনোভো আইডিয়াপ্যাড স্লিম ৩', 'Ultrabooks', 'Lenovo', 58900, '💻', [O('RAM', ['8GB', '16GB']), O('Colour', ['Grey', 'Blue'])], -1, 0],
    ['Logitech K380 Keyboard', 'লজিটেক কে৩৮০ কিবোর্ড', 'Keyboards', 'Logitech', 4290, '⌨️', [O('Colour', ['Grey', 'Rose'])], -1, 0],
    ['Logitech M221 Silent Mouse', 'লজিটেক এম২২১ মাউস', 'Mouse', 'Logitech', 1290, '🖱️', [O('Colour', ['Black', 'Blue', 'Red'])], -1, 0],
    ['Dhakai Jamdani Saree Classic', 'ঢাকাই জামদানি শাড়ি', 'Jamdani', 'Tangail Weavers', 12500, '🥻', [O('Colour', ['Red', 'Maroon', 'Teal'])], 1, 25],
    ['Block Print Cotton Saree', 'ব্লক প্রিন্ট সুতি শাড়ি', 'Cotton sarees', 'Deshi Loom', 2450, '🥻', [O('Colour', ['Indigo', 'Rust', 'Mustard'])], -1, 0],
    ['Printed Cotton Kurti', 'প্রিন্টেড সুতি কুর্তি', 'Printed kurtis', 'Deshi Loom', 1450, '👚', [O('Colour', ['Pink', 'Blue', 'Green']), O('Size', SZ)], -1, 0],
    ['Men\'s Casual Check Shirt', 'পুরুষদের ক্যাজুয়াল চেক শার্ট', 'Casual shirts', 'Urban Nest', 1650, '👔', [O('Colour', ['Blue', 'Green']), O('Size', ['M', 'L', 'XL', 'XXL'])], -1, 0],
    ['Formal Oxford Shirt', 'ফরমাল অক্সফোর্ড শার্ট', 'Formal shirts', 'Urban Nest', 1950, '👔', [O('Colour', ['White', 'Sky']), O('Size', ['M', 'L', 'XL'])], -1, 0],
    ['Festive Embroidered Panjabi', 'এমব্রয়ডারি উৎসবের পাঞ্জাবি', 'Festive panjabi', 'Deshi Loom', 3250, '🧥', [O('Colour', ['Cream', 'Black', 'Maroon']), O('Size', ['M', 'L', 'XL', 'XXL'])], 1, 20],
    ['Apex Cloudrun Running Shoes', 'অ্যাপেক্স রানিং শু', 'Running shoes', 'Apex', 3890, '👟', [O('Colour', ['Black', 'Grey']), O('Size', ['40', '41', '42', '43'])], -1, 0],
    ['Kolhapuri Leather Sandal', 'কোলাপুরি চামড়ার স্যান্ডেল', 'Leather sandals', 'Apex', 2190, '🩴', [O('Size', ['40', '41', '42', '43'])], -1, 0],
    ['Non-stick Frying Pan', 'নন-স্টিক ফ্রাইং প্যান', 'Non-stick pans', 'HomeChef', 1890, '🍳', [O('Size', ['24cm', '28cm'])], 3, 0],
    ['KitchenPro Rice Cooker 1.8L', 'কিচেনপ্রো রাইস কুকার', 'Rice cookers', 'KitchenPro', 5490, '🍚', [], 3, 0],
    ['Framed Wall Art Set of 3', 'ফ্রেমড ওয়াল আর্ট সেট', 'Framed prints', 'HomeChef', 2850, '🖼️', [O('Size', ['A3', 'A2'])], 3, 15],
    ['SPF 50 Sunscreen Gel', 'এসপিএফ ৫০ সানস্ক্রিন জেল', 'Sunscreens', 'GlowLab', 890, '🧴', [O('Size', ['50ml', '100ml'])], 4, 0],
    ['Argan Hair Oil 100ml', 'আরগান হেয়ার অয়েল', 'Hair oils', 'GlowLab', 650, '💧', [], 4, 0],
    ['Vitamin C Brightening Serum', 'ভিটামিন সি সিরাম', 'Serums', 'GlowLab', 1250, '🧪', [O('Size', ['30ml'])], 4, 0],
    ['Wooden Alphabet Puzzle', 'কাঠের বর্ণমালা পাজল', 'Puzzles', 'LittleOak', 790, '🧩', [], -1, 0],
    ['Kids Learning Tablet', 'কিডস লার্নিং ট্যাবলেট', 'Learning tablets', 'LittleOak', 3490, '📟', [O('Colour', ['Blue', 'Pink'])], -1, 0, 'Android tablets'],
    ['Baby Romper Set (3 pcs)', 'বেবি রম্পার সেট', 'Baby clothing', 'LittleOak', 990, '👶', [O('Size', ['0-3m', '3-6m', '6-12m']), O('Colour', ['Yellow', 'Mint'])], -1, 0],
    ['Silicone Feeding Set', 'সিলিকন ফিডিং সেট', 'Feeding sets', 'LittleOak', 750, '🍼', [O('Colour', ['Mint', 'Peach'])], -1, 0]
  ];
  function combos(opts) {
    if (!opts.length) return [[]];
    var out = [[]]; opts.forEach(function (o) { var n = []; out.forEach(function (c) { o.values.forEach(function (v) { n.push(c.concat([v])); }); }); out = n; }); return out;
  }
  var products = [];
  for (var i = 0; i < 36; i++) {
    var t = TPL[i % TPL.length], plus = i >= TPL.length, id = 101 + i;
    var leaf = byName(t[2]), sup = t[7] >= 0 ? suppliers[t[7]] : null;
    var status = i === 13 ? 'archived' : (i % 9 === 4 ? 'draft' : 'active');
    var dead = i % 7 === 3, lowOne = i % 5 === 2;
    var pre = (i === 8 || i === 30);
    var p = { id: id, title: t[0] + (plus ? ' Plus' : ''), bn: t[1], slug: slug(t[0] + (plus ? ' plus' : '')), sku: 'BD-' + (leaf.slug.slice(0, 3).toUpperCase()) + '-' + id,
      brand: t[3], emoji: t[5], color: byId[leaf.id].color, cats: [leaf.id].concat(t[10] ? [byName(t[10]).id] : []), primary: leaf.id,
      price: t[4] + (plus ? Math.round(t[4] * .1 / 10) * 10 : 0), fulfil: sup ? 'dropship' : 'stock', supplier: sup ? sup.id : null, supSku: sup ? 'SUP-' + (4000 + id) : '',
      cost: Math.round(t[4] * .78), route: sup ? sup.route : null, advance: t[8], preorder: pre, preDate: pre ? '2026-11-20' : '', status: status,
      sold: ri(0, 420), rating: Math.round((3.7 + R() * 1.2) * 10) / 10, ratingN: ri(3, 160), weight: +(0.2 + R() * 1.3).toFixed(2), delivery: null, ret: null,
      pin: i === 2 || i === 12, boost: (i === 2 || i === 12) ? 40 : 0, opts: t[6].map(function (o) { return { name: o.name, values: o.values.slice() }; }), created: '2026-0' + ri(5, 9) + '-' + ('0' + ri(1, 28)).slice(-2), variants: [] };
    p.old = (R() < .45) ? Math.round(p.price * (1.08 + R() * .2) / 10) * 10 : 0;
    if (status === 'draft') p.sold = 0;
    combos(p.opts).forEach(function (c, k) {
      var stock = dead ? 0 : (lowOne && k === 0 ? ri(0, 3) : ri(2, 60));
      p.variants.push({ sku: p.sku + (c.length ? '-' + c.map(function (x) { return x.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase(); }).join('') : ''), combo: c, price: p.price + (k % 3) * (p.price > 5000 ? 500 : 50) * (c.length ? 1 : 0), old: p.old, stock: stock,
        reserved: Math.min(stock, ri(0, 4)), thr: p.price > 20000 ? 3 : 5, weight: p.weight, active: !(k === 3 && R() < .3), img: 0 });
    });
    p.stock = p.variants.reduce(function (a, v) { return a + v.stock; }, 0);
    p.orders = p.sold > 0 ? p.sold : 0;
    p.low = p.stock > 0 && p.variants.some(function (v) { return v.stock <= v.thr && v.active; });
    p.desc = '<p><b>' + p.title + '</b> – quality product, 100% genuine. Delivered all over Bangladesh with Cash on Delivery.</p><ul><li>Official warranty / seller guarantee</li><li>Easy 7-day return for manufacturing defects</li></ul>';
    p.short = 'Genuine ' + p.title + ' with warranty. Cash on Delivery available.';
    p.shortBn = 'আসল ' + p.bn + ' – ক্যাশ অন ডেলিভারি।';
    products.push(p);
  }
  var prodById = {}; products.forEach(function (p) { prodById[p.id] = p; });
  function recount() { cats.forEach(function (c) { var ids = {}; descendants(c.id).forEach(function (d) { ids[d] = 1; }); c.count = products.filter(function (p) { return p.cats.some(function (x) { return ids[x]; }); }).length; }); }
  recount();

  /* ---------- reviews & Q&A ---------- */
  var TXT = ['Product is exactly as shown, packaging was good. Delivered in 2 days.', 'Quality is better than I expected for this price. Recommended!', 'Works fine but the colour is slightly different from the photos.', 'Battery / fit is great. Will buy again.', 'আমি অর্ডার করার ৩ দিনের মধ্যে পেয়েছি। প্রোডাক্ট ভালো।', 'Size runs a bit small, take one size up.', 'Seller was helpful over phone. Product genuine, warranty card included.', 'Not satisfied, stitching came loose after a week.', 'Very good finishing and fast delivery to Chattogram.', 'দাম অনুযায়ী মান ঠিক আছে, তবে প্যাকেজিং আরও ভালো হতে পারত।', 'Delivery guy called before arriving, no issues.', 'Excellent! Gifted it to my mother, she loved it.'];
  var NAMES = ['Nusrat J.', 'Rakib H.', 'Tania A.', 'Mahmud K.', 'Sadia R.', 'Imran S.', 'Farhana B.', 'Shuvo D.', 'Mim C.', 'Arif T.'];
  var reviews = [];
  for (var r = 0; r < 34; r++) {
    var pr = products[(r * 5 + 1) % 30];
    var stars = [5, 5, 4, 5, 3, 4, 2, 5, 1, 4][r % 10];
    reviews.push({ id: 'r' + (500 + r), pid: pr.id, user: NAMES[r % NAMES.length], rating: stars, text: TXT[(r * 7 + 3) % TXT.length], photos: (r % 4 === 1) ? ri(1, 3) : 0, verified: r % 9 !== 8, order: '#BD-' + (24000 + r * 13),
      date: '2026-10-' + ('0' + (22 - (r % 20))).slice(-2) + 'T1' + (r % 10) + ':20:00', status: (r % 11 === 7) ? 'hidden' : 'visible', reply: (r % 6 === 0) ? { by: 'Support team', text: 'Thank you for your feedback! Contact us anytime on 09612-345678.', at: '2026-10-20T10:00:00' } : null });
  }
  var QS = ['Is this original with warranty?', 'Do you have this in other colours?', 'Does it support bKash payment on delivery?', 'What is the delivery time to Rajshahi?', 'Can I return if size does not fit?', 'Is the product waterproof?', 'Which charger comes in the box?', 'Is cash on delivery available in Sylhet?', 'Is there a bigger size available?', 'আপনাদের কি এটা ঢাকার বাইরে ডেলিভারি হয়?'];
  var AS = ['Yes, it is 100% genuine and comes with 1 year official warranty.', 'Currently only the listed colours are in stock, new colours coming next month.', 'Launch phase is COD only; online payment options will come soon.', 'Usually 3-4 working days outside Dhaka.', 'Yes, within 7 days if unused with tags (see return policy).', 'It is splash resistant, not fully waterproof.', 'Standard 15W adapter and cable included.'];
  var qa = [];
  for (var q = 0; q < 14; q++) {
    var pq = products[(q * 3 + 2) % 30], ans = q % 3 !== 0;
    qa.push({ id: 'q' + (700 + q), pid: pq.id, user: NAMES[(q + 3) % NAMES.length], q: QS[q % QS.length], date: '2026-10-' + ('0' + (22 - q)).slice(-2) + 'T0' + (q % 9) + ':45:00', status: q === 5 ? 'hidden' : 'visible', answer: ans ? { by: 'Catalog team', text: AS[q % AS.length], at: '2026-10-' + ('0' + (22 - q)).slice(-2) + 'T14:00:00' } : null });
  }

  function thumb(p, size) { return '<span class="c-thumb' + (size ? ' ' + size : '') + '" style="--tc:' + p.color + '">' + p.emoji + '</span>'; }
  window.CatalogData = { cats: cats, byId: byId, byName: byName, ancestors: ancestors, descendants: descendants, path: path, inheritedAttrs: inheritedAttrs, attrsFor: attrsFor, recount: recount,
    roots: function () { return cats.filter(function (c) { return !c.parent; }); }, brands: brands, suppliers: suppliers, products: products, prodById: prodById, reviews: reviews, qa: qa, combos: combos, slug: slug, thumb: thumb,
    flags: function () { return { advance: !!(window.Admin && Admin.store.get('catalog.flag.advance', false)), preorder: !!(window.Admin && Admin.store.get('catalog.flag.preorder', false)) }; } };
})();
