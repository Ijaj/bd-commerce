#!/usr/bin/env node
// Builds docs/developer-manual.html and docs/owner-manual.html (EN + BN in one file each).
// Prose lives in docs/src/{dev,owner}.{en,bn}.html. The DB reference in the developer manual
// is generated from apps/api/prisma/schema.prisma so it cannot drift from the code.
// Run: node docs/build-manuals.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const css = read('manual-style.css');
const schema = readFileSync(join(here, '../apps/api/prisma/schema.prisma'), 'utf8');

/* ---------- schema parser ---------- */
const lines = schema.split('\n');
const models = [];
const enums = [];
let cur = null;
let pending = [];
for (const raw of lines) {
  const line = raw.trim();
  let m = /^model (\w+) \{/.exec(line);
  if (m) {
    cur = { name: m[1], doc: pending.join(' '), table: null, fields: [], attrs: [] };
    models.push(cur);
    pending = [];
    continue;
  }
  m = /^enum (\w+) \{/.exec(line);
  if (m) {
    cur = { name: m[1], isEnum: true, values: [], table: null };
    enums.push(cur);
    pending = [];
    continue;
  }
  if (line === '}') { cur = null; pending = []; continue; }
  if (!cur) { pending = []; continue; }
  if (line.startsWith('///')) { pending.push(line.replace(/^\/\/\/\s?/, '')); continue; }
  if (!line || line.startsWith('//')) continue;
  if (cur.isEnum) {
    const mm = /^@@map\("(\w+)"\)/.exec(line);
    if (mm) cur.table = mm[1];
    else if (!line.startsWith('@@')) cur.values.push(line.split(/\s+/)[0]);
    continue;
  }
  if (line.startsWith('@@')) {
    const mm = /^@@map\("(\w+)"\)/.exec(line);
    if (mm) cur.table = mm[1];
    else cur.attrs.push(line);
    pending = [];
    continue;
  }
  const parts = line.split(/\s+/);
  const fname = parts[0];
  const ftype = parts[1];
  const rest = line.slice(line.indexOf(ftype) + ftype.length);
  cur.fields.push({ name: fname, type: ftype, rest, doc: pending.join(' ') });
  pending = [];
}
const modelNames = new Set(models.map((x) => x.name));
const enumNames = new Set(enums.map((x) => x.name));
const snake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- domain grouping + descriptions ---------- */
const domains = [
  ['access', ['Staff', 'StaffSession', 'StaffKnownDevice', 'StaffBackupCode', 'Permission', 'Role', 'RolePermission', 'StaffRole', 'Setting']],
  ['catalog', ['Seller', 'Media', 'Brand', 'Category', 'CategoryAttribute', 'AttributeOption', 'Product', 'ProductCategory', 'ProductAttributeValue', 'ProductOption', 'ProductOptionValue', 'ProductImage', 'Variant']],
  ['inventory', ['Inventory', 'StockMovement']],
  ['customers', ['Customer', 'CustomerSession', 'OtpCode', 'Wishlist', 'CustomerAddress', 'CarouselSlide']],
  ['geo', ['Division', 'District', 'Upazila', 'Area', 'DeliveryZone', 'ZoneLocation']],
  ['orders', ['Cart', 'CartItem', 'Order', 'OrderItem', 'OrderStatusHistory', 'Payment', 'Invoice']],
  ['fulfilment', ['Courier', 'Shipment', 'ShipmentItem', 'CourierBooking', 'CourierStatusEvent']],
  ['returns', ['Return', 'ReturnItem', 'ReturnMedia', 'Refund', 'RefundItem']],
  ['b2b', ['SrProfile', 'B2bShop', 'SrSale', 'SrSaleItem', 'B2bLedger', 'SrTarget', 'SrCommission', 'SrCommissionAdjustment']],
  ['purchasing', ['Supplier', 'VariantSupplier', 'PurchaseOrder', 'PurchaseOrderItem', 'PoReceipt', 'PoReceiptItem', 'SupplierLedger']],
  ['promo', ['Coupon', 'CouponTarget', 'CouponZone', 'CouponTier', 'CouponCustomer', 'CouponCode', 'CouponWallet', 'CouponRedemption', 'FlashSale', 'FlashSaleItem', 'SaleBatch', 'SaleBatchItem']],
  ['affiliates', ['Affiliate', 'AffiliateClick', 'AffiliateCommission', 'AffiliatePayout']],
];
const domainText = {
  access: ['Staff, access & settings', 'স্টাফ, অ্যাক্সেস ও সেটিংস',
    'Who can sign in to the admin panel, what they may do, and store-wide configuration. Sessions store only a hash of the token. The TOTP secret is encrypted (AES-256-GCM).',
    'কে অ্যাডমিন প্যানেলে ঢুকতে পারবে, কী করতে পারবে, এবং পুরো স্টোরের কনফিগারেশন। সেশনে শুধু টোকেনের হ্যাশ থাকে। TOTP সিক্রেট এনক্রিপ্টেড (AES-256-GCM)।'],
  catalog: ['Catalog', 'ক্যাটালগ',
    'Products are sold as variants. A product with no options still has exactly one variant (SKU). Price, cost, sale price and SKU live on the variant, never on the product.',
    'পণ্য বিক্রি হয় ভ্যারিয়েন্ট হিসেবে। অপশনহীন পণ্যেরও ঠিক একটি ভ্যারিয়েন্ট (SKU) থাকে। দাম, কস্ট, সেল প্রাইস ও SKU ভ্যারিয়েন্টে থাকে, পণ্যে নয়।'],
  inventory: ['Inventory', 'ইনভেন্টরি',
    'Stock is a number per variant plus an append-only movement log. Only InventoryService.move() changes stock, so the log always explains the number.',
    'স্টক হলো প্রতি ভ্যারিয়েন্টের একটি সংখ্যা এবং শুধু-যোগ-করা মুভমেন্ট লগ। শুধু InventoryService.move() স্টক বদলায়, তাই লগ সবসময় সংখ্যাটির ব্যাখ্যা দেয়।'],
  customers: ['Customers & storefront content', 'কাস্টমার ও স্টোরফ্রন্ট কনটেন্ট',
    'Shop customer accounts (separate from staff), OTP codes, wishlists, saved addresses and home-page carousel slides.',
    'শপের কাস্টমার অ্যাকাউন্ট (স্টাফ থেকে আলাদা), OTP কোড, উইশলিস্ট, সেভ করা ঠিকানা এবং হোম পেজ ক্যারোসেল।'],
  geo: ['Geography & delivery zones', 'ভূগোল ও ডেলিভারি জোন',
    'Bangladesh divisions, districts, upazilas (541, incl. 47 Dhaka thanas) and areas, plus delivery zones that price shipping by location and weight.',
    'বাংলাদেশের বিভাগ, জেলা, উপজেলা (৫৪১টি, ঢাকার ৪৭ থানাসহ) ও এলাকা, এবং অবস্থান ও ওজন অনুযায়ী ডেলিভারি চার্জ ঠিক করা জোন।'],
  orders: ['Carts & orders', 'কার্ট ও অর্ডার',
    'An order freezes everything at placement: prices, titles, address text, discounts. Later edits to products or coupons never change old orders.',
    'অর্ডার দেওয়ার মুহূর্তে সবকিছু ফ্রিজ হয়: দাম, টাইটেল, ঠিকানার টেক্সট, ডিসকাউন্ট। পরে পণ্য বা কুপন বদলালে পুরনো অর্ডার বদলায় না।'],
  fulfilment: ['Shipments & couriers', 'শিপমেন্ট ও কুরিয়ার',
    'One order can split into several shipments. A shipment is booked with a courier; every request, response and status webhook is stored.',
    'একটি অর্ডার একাধিক শিপমেন্টে ভাগ হতে পারে। শিপমেন্ট কুরিয়ারে বুক হয়; প্রতিটি রিকোয়েস্ট, রেসপন্স ও স্ট্যাটাস ওয়েবহুক সংরক্ষিত থাকে।'],
  returns: ['Returns & refunds', 'রিটার্ন ও রিফান্ড',
    'Return request → approve → pickup → receive → inspect → close. Refunds are separate rows and may need a second approver above a threshold.',
    'রিটার্ন রিকোয়েস্ট → অনুমোদন → পিকআপ → রিসিভ → ইন্সপেকশন → ক্লোজ। রিফান্ড আলাদা রো; নির্দিষ্ট অঙ্কের ওপরে দ্বিতীয় অনুমোদনকারী লাগতে পারে।'],
  b2b: ['Sales Representatives (SR) & B2B shops', 'সেলস রিপ্রেজেন্টেটিভ (SR) ও B2B দোকান',
    'Field reps sell to buyer shops on credit. The B2B ledger is the source of truth for dues; b2b_shops.due_balance_p is only a cache.',
    'ফিল্ড SR বাকিতে দোকানে বিক্রি করে। বাকির আসল হিসাব B2B লেজারে; b2b_shops.due_balance_p শুধু ক্যাশ।'],
  affiliates: ['Affiliates', 'অ্যাফিলিয়েট',
    'Customers who join the affiliate program, link clicks (last click wins), commissions approved after delivery + return window, and monthly payouts.',
    'যে গ্রাহকরা অ্যাফিলিয়েট প্রোগ্রামে যোগ দেন, লিংক ক্লিক (শেষ ক্লিক গণ্য), ডেলিভারি + রিটার্ন সময়ের পরে অনুমোদিত কমিশন, এবং মাসিক পেআউট।'],
  purchasing: ['Suppliers & purchasing', 'সাপ্লায়ার ও ক্রয়',
    'Purchase orders, receiving (good vs rejected qty, weighted-average cost) and a per-supplier payable ledger.',
    'পারচেজ অর্ডার, মাল গ্রহণ (ভালো বনাম রিজেক্ট পরিমাণ, ওয়েটেড-অ্যাভারেজ কস্ট) এবং প্রতি সাপ্লায়ারের দেনার লেজার।'],
  promo: ['Promotions', 'প্রমোশন',
    'Coupons (code or automatic), flash sales with capped stock, and the bulk-sale tool that writes variant sale prices with undo.',
    'কুপন (কোড বা অটোমেটিক), সীমিত স্টকের ফ্ল্যাশ সেল, এবং বাল্ক-সেল টুল যা ভ্যারিয়েন্টের সেল প্রাইস লিখে ও আনডু করা যায়।'],
};
const modelText = {
  Staff: ['Admin/portal user: login, 2FA state, status', 'অ্যাডমিন/পোর্টাল ব্যবহারকারী: লগইন, 2FA অবস্থা, স্ট্যাটাস'],
  StaffSession: ['One login session (token hash, IP, idle/absolute expiry)', 'একটি লগইন সেশন (টোকেন হ্যাশ, IP, মেয়াদ)'],
  StaffKnownDevice: ['Devices seen per staff; new device triggers an email alert', 'স্টাফের পরিচিত ডিভাইস; নতুন ডিভাইসে ইমেইল সতর্কতা'],
  StaffBackupCode: ['Hashed one-time 2FA backup codes', 'হ্যাশ করা এককালীন 2FA ব্যাকআপ কোড'],
  Permission: ['Permission catalog (key, group); synced from code at boot', 'পারমিশন তালিকা; বুটের সময় কোড থেকে সিঙ্ক হয়'],
  Role: ['Named bundle of permissions; Owner is a system role', 'পারমিশনের নামকরা সেট; Owner সিস্টেম রোল'],
  RolePermission: ['Join: role ↔ permission', 'জোড়া: রোল ↔ পারমিশন'],
  StaffRole: ['Join: staff ↔ role', 'জোড়া: স্টাফ ↔ রোল'],
  Setting: ['Settings overrides as JSON (a missing row = code default)', 'সেটিংস ওভাররাইড JSON হিসেবে (রো না থাকলে কোডের ডিফল্ট)'],
  Seller: ['Seller record (one row today; multi-vendor later)', 'সেলার রেকর্ড (এখন একটি রো; ভবিষ্যতে মাল্টি-ভেন্ডর)'],
  Media: ['Uploaded image metadata; the file itself is in S3 (Garage)', 'আপলোড করা ছবির মেটাডেটা; ফাইল S3 (Garage)-তে'],
  Brand: ['Brand with EN/BN names and logo', 'ব্র্যান্ড (EN/BN নাম ও লোগো)'],
  Category: ['Category tree (max 4 levels, materialized path)', 'ক্যাটেগরি ট্রি (সর্বোচ্চ ৪ লেভেল, materialized path)'],
  CategoryAttribute: ['Attribute defined on a category (filterable spec fields)', 'ক্যাটেগরিতে সংজ্ঞায়িত অ্যাট্রিবিউট (ফিল্টারযোগ্য স্পেক)'],
  AttributeOption: ['Allowed values for select/multiselect attributes', 'select/multiselect অ্যাট্রিবিউটের অনুমোদিত মান'],
  Product: ['Product shell: titles, descriptions, status, flags, SEO', 'পণ্যের মূল তথ্য: টাইটেল, বিবরণ, স্ট্যাটাস, ফ্ল্যাগ, SEO'],
  ProductCategory: ['Join: product ↔ extra categories', 'জোড়া: পণ্য ↔ অতিরিক্ত ক্যাটেগরি'],
  ProductAttributeValue: ['A product’s value for a category attribute', 'ক্যাটেগরি অ্যাট্রিবিউটের জন্য পণ্যের মান'],
  ProductOption: ['Variant axis (e.g. Size, Colour); max 2 per product', 'ভ্যারিয়েন্টের অক্ষ (যেমন সাইজ, রং); পণ্যপ্রতি সর্বোচ্চ ২'],
  ProductOptionValue: ['Value of an option (e.g. “Red”, swatch colour)', 'অপশনের মান (যেমন “লাল”, সোয়াচ রং)'],
  ProductImage: ['Ordered gallery image, optionally tied to a variant', 'ক্রমানুসারে গ্যালারি ছবি, ঐচ্ছিকভাবে ভ্যারিয়েন্টের সাথে'],
  Variant: ['Sellable unit: SKU, price, compare-at, sale, cost, weight', 'বিক্রয়যোগ্য ইউনিট: SKU, দাম, আগের দাম, সেল, কস্ট, ওজন'],
  Inventory: ['Current on-hand and reserved qty per variant', 'প্রতি ভ্যারিয়েন্টের বর্তমান হাতে ও রিজার্ভ পরিমাণ'],
  StockMovement: ['Append-only stock log (DB trigger blocks update/delete)', 'শুধু-যোগ-করা স্টক লগ (ট্রিগার আপডেট/ডিলিট আটকায়)'],
  Customer: ['Shop customer (phone/email + Argon2id password)', 'শপের কাস্টমার (ফোন/ইমেইল + Argon2id পাসওয়ার্ড)'],
  CustomerSession: ['Customer login session', 'কাস্টমার লগইন সেশন'],
  OtpCode: ['SMS OTPs (hashed, attempts, expiry) for signup/reset/guest COD', 'SMS OTP (হ্যাশ, চেষ্টা, মেয়াদ) — সাইনআপ/রিসেট/গেস্ট COD'],
  Wishlist: ['Customer ↔ product saved items', 'কাস্টমারের সেভ করা পণ্য'],
  CarouselSlide: ['Home page slide (images, link, schedule, language)', 'হোম পেজ স্লাইড (ছবি, লিংক, সময়সূচি, ভাষা)'],
  Division: ['Bangladesh division (seeded)', 'বাংলাদেশের বিভাগ (সিড করা)'],
  District: ['District (seeded)', 'জেলা (সিড করা)'],
  Upazila: ['Upazila / Dhaka thana (seeded)', 'উপজেলা / ঢাকার থানা (সিড করা)'],
  Area: ['Finer area under an upazila (optional)', 'উপজেলার অধীনে ছোট এলাকা (ঐচ্ছিক)'],
  DeliveryZone: ['Shipping price rule: base, extra per kg, ETA, free-above', 'ডেলিভারি চার্জের নিয়ম: বেস, প্রতি কেজি অতিরিক্ত, ETA, ফ্রি-সীমা'],
  ZoneLocation: ['Maps a district/upazila/area to a zone (each location in one zone)', 'জেলা/উপজেলা/এলাকাকে জোনে বসায় (প্রতিটি একটি জোনে)'],
  CustomerAddress: ['Saved shipping address', 'সেভ করা ডেলিভারি ঠিকানা'],
  Cart: ['Cart for a customer or anonymous visitor cookie', 'কাস্টমার বা বেনামী ভিজিটর কুকির কার্ট'],
  CartItem: ['Cart line (variant, qty, price when added)', 'কার্ট লাইন (ভ্যারিয়েন্ট, পরিমাণ, যোগ করার সময়ের দাম)'],
  Order: ['Order header: ship-to snapshot, totals, status, risk, call state', 'অর্ডার হেডার: ঠিকানার স্ন্যাপশট, মোট, স্ট্যাটাস, ঝুঁকি, কল অবস্থা'],
  OrderItem: ['Order line with frozen title/price/discount and cancelled/returned qty', 'ফ্রিজ করা টাইটেল/দাম/ডিসকাউন্টসহ লাইন; বাতিল/ফেরত পরিমাণ'],
  OrderStatusHistory: ['Every status change: who, when, note', 'প্রতিটি স্ট্যাটাস বদল: কে, কখন, নোট'],
  Payment: ['Payment attempts/records (COD only today)', 'পেমেন্ট চেষ্টা/রেকর্ড (এখন শুধু COD)'],
  Invoice: ['Issued invoice with frozen print snapshot (VAT-inclusive)', 'ইস্যু করা ইনভয়েস, ফ্রিজ করা প্রিন্ট স্ন্যাপশটসহ (ভ্যাট অন্তর্ভুক্ত)'],
  Courier: ['Courier adapter registry (steadfast, pathao, fake)', 'কুরিয়ার অ্যাডাপ্টার তালিকা (steadfast, pathao, fake)'],
  Shipment: ['A parcel: items, source (warehouse/supplier), COD amount, courier', 'একটি পার্সেল: আইটেম, উৎস, COD অঙ্ক, কুরিয়ার'],
  ShipmentItem: ['Order line qty inside a shipment', 'শিপমেন্টের ভেতরে অর্ডার লাইনের পরিমাণ'],
  CourierBooking: ['Each booking attempt with raw request/response JSON', 'প্রতিটি বুকিং চেষ্টা, কাঁচা রিকোয়েস্ট/রেসপন্স JSON সহ'],
  CourierStatusEvent: ['Courier status updates (raw + mapped)', 'কুরিয়ারের স্ট্যাটাস আপডেট (কাঁচা + ম্যাপ করা)'],
  Return: ['Return request and its workflow state', 'রিটার্ন রিকোয়েস্ট ও ওয়ার্কফ্লো অবস্থা'],
  ReturnItem: ['Returned lines: qty, reason, condition, restock?', 'ফেরত লাইন: পরিমাণ, কারণ, অবস্থা, রিস্টক?'],
  ReturnMedia: ['Customer photos attached to a return', 'রিটার্নে কাস্টমারের ছবি'],
  Refund: ['Refund record: amount, method, approval state', 'রিফান্ড রেকর্ড: অঙ্ক, মাধ্যম, অনুমোদন অবস্থা'],
  RefundItem: ['Per-line refund amounts', 'লাইনভিত্তিক রিফান্ড অঙ্ক'],
  SrProfile: ['Extra SR data on a staff row (area, commission override)', 'স্টাফের SR তথ্য (এলাকা, কমিশন ওভাররাইড)'],
  B2bShop: ['Buyer shop with cached due balance', 'ক্রেতা দোকান ও ক্যাশ করা বাকি'],
  SrSale: ['SR credit sale (memo) with approval/delivery/reversal state', 'SR বাকি বিক্রি (মেমো), অনুমোদন/ডেলিভারি/রিভার্সাল সহ'],
  SrSaleItem: ['Memo line (SR-entered unit price)', 'মেমো লাইন (SR-এর দেওয়া একক দাম)'],
  B2bLedger: ['Append-only shop ledger: dues, collections, adjustments, reversals', 'শুধু-যোগ লেজার: বাকি, আদায়, অ্যাডজাস্টমেন্ট, রিভার্সাল'],
  SrTarget: ['Monthly sales target per SR', 'প্রতি SR-এর মাসিক টার্গেট'],
  SrCommission: ['Monthly commission per SR (pending → approved → paid)', 'প্রতি SR-এর মাসিক কমিশন'],
  SrCommissionAdjustment: ['Commission clawbacks/bonuses', 'কমিশন কর্তন/বোনাস'],
  Affiliate: ['Affiliate profile on a customer: code, rate override, status, encrypted payout details', 'গ্রাহকের অ্যাফিলিয়েট প্রোফাইল: কোড, রেট, স্ট্যাটাস, এনক্রিপ্টেড পেআউট তথ্য'],
  AffiliateClick: ['One tracked ?ref= link visit per visitor', 'ভিজিটর প্রতি একটি ট্র্যাক করা ?ref= লিংক ভিজিট'],
  AffiliateCommission: ['One commission per attributed order: pending → approved/reversed → paid', 'অ্যাট্রিবিউটেড অর্ডার প্রতি একটি কমিশন: pending → approved/reversed → paid'],
  AffiliatePayout: ['Monthly payout recorded by staff, covers approved commissions', 'স্টাফের রেকর্ড করা মাসিক পেআউট, অনুমোদিত কমিশন কভার করে'],
  Supplier: ['Supplier master data and ship mode', 'সাপ্লায়ার তথ্য ও শিপ মোড'],
  VariantSupplier: ['Which suppliers provide a variant, last cost, lead time', 'কোন সাপ্লায়ার কোন ভ্যারিয়েন্ট দেয়, শেষ কস্ট, লিড টাইম'],
  PurchaseOrder: ['PO header and lifecycle', 'পিও হেডার ও লাইফসাইকেল'],
  PurchaseOrderItem: ['PO line: ordered/received/rejected qty and unit cost', 'পিও লাইন: অর্ডার/গৃহীত/রিজেক্ট পরিমাণ ও একক কস্ট'],
  PoReceipt: ['One receiving event (append-only)', 'একটি মাল গ্রহণ ইভেন্ট (শুধু-যোগ)'],
  PoReceiptItem: ['Receiving line with cost before/after (audit)', 'গ্রহণ লাইন, আগে/পরের কস্টসহ (অডিট)'],
  SupplierLedger: ['Append-only payable ledger (receipt, payment, adjustment, reversal)', 'শুধু-যোগ দেনার লেজার (রসিদ, পেমেন্ট, অ্যাডজাস্টমেন্ট, রিভার্সাল)'],
  Coupon: ['Coupon/auto discount rule: type, limits, stacking, targeting', 'কুপন/অটো ডিসকাউন্ট নিয়ম: ধরন, সীমা, স্ট্যাকিং, টার্গেট'],
  CouponTarget: ['Include/exclude products, categories or brands', 'পণ্য/ক্যাটেগরি/ব্র্যান্ড অন্তর্ভুক্ত বা বাদ'],
  CouponZone: ['Restrict coupon to delivery zones', 'কুপন নির্দিষ্ট জোনে সীমাবদ্ধ'],
  CouponTier: ['Spend tiers for tiered coupons', 'টায়ারড কুপনের খরচের ধাপ'],
  CouponCustomer: ['Specific customers allowed to use a coupon', 'যেসব কাস্টমার কুপন ব্যবহার করতে পারবে'],
  CouponCode: ['Individual codes of a bulk coupon', 'বাল্ক কুপনের আলাদা কোড'],
  CouponWallet: ['Coupons a customer collected', 'কাস্টমারের সংগ্রহ করা কুপন'],
  CouponRedemption: ['One use of a coupon on an order (applied/reversed)', 'অর্ডারে কুপনের একবার ব্যবহার (applied/reversed)'],
  FlashSale: ['Time-boxed sale window', 'সময়সীমার সেল'],
  FlashSaleItem: ['Variant in a flash sale: price, qty cap, sold, per-customer cap', 'ফ্ল্যাশ সেলের ভ্যারিয়েন্ট: দাম, সীমা, বিক্রি, কাস্টমারপ্রতি সীমা'],
  SaleBatch: ['One bulk-sale run (config JSON, undo timestamp)', 'একটি বাল্ক-সেল রান (config JSON, আনডু সময়)'],
  SaleBatchItem: ['Variants changed by a batch with previous sale price for undo', 'ব্যাচে বদলানো ভ্যারিয়েন্ট, আনডুর জন্য আগের সেল প্রাইস'],
};

/* ---------- DB reference generator ---------- */
function describeField(f) {
  const base = f.type.replace(/[?\[\]]/g, '');
  const rel = modelNames.has(base);
  if (rel) return null;
  const optional = f.type.endsWith('?');
  const list = f.type.endsWith('[]');
  const mapM = /@map\("(\w+)"\)/.exec(f.rest);
  const col = mapM ? mapM[1] : snake(f.name);
  const dbM = /@db\.(\w+)/.exec(f.rest);
  const def = /@default\(((?:[^()]|\([^()]*\))*)\)/.exec(f.rest);
  const pills = [];
  if (/@id\b/.test(f.rest)) pills.push('<span class="pill pk">PK</span>');
  if (/@unique\b/.test(f.rest)) pills.push('<span class="pill uq">unique</span>');
  if (optional) pills.push('<span class="pill opt">nullable</span>');
  if (list) pills.push('<span class="pill">array</span>');
  const type = esc(base + (dbM ? ` (${dbM[1]})` : '')) + (enumNames.has(base) ? ' <span class="pill">enum</span>' : '');
  const money = /P$/.test(f.name) && base === 'Int' ? ' <span class="pill" title="paisa: 100 = ৳1">paisa</span>' : '';
  return `<tr><td><code>${col}</code></td><td>${type}${money}</td><td>${pills.join(' ')}</td><td>${esc(def ? def[1] : '')}</td><td>${esc(f.doc)}</td></tr>`;
}
function modelBlock(m, li) {
  const rows = m.fields.map(describeField).filter(Boolean).join('\n');
  const links = m.fields
    .filter((f) => modelNames.has(f.type.replace(/[?\[\]]/g, '')) && /@relation/.test(f.rest) && !f.type.endsWith('[]'))
    .map((f) => {
      const tgt = models.find((x) => x.name === f.type.replace(/[?\[\]]/g, ''));
      const fk = /fields:\s*\[([^\]]+)\]/.exec(f.rest);
      const onDel = /onDelete:\s*(\w+)/.exec(f.rest);
      return `<code>${esc(fk ? fk[1].split(',').map((s) => snake(s.trim())).join(', ') : f.name)}</code> → <code>${tgt.table}</code>${onDel ? ` <span class="pill">ON DELETE ${onDel[1]}</span>` : ''}`;
    });
  const children = m.fields
    .filter((f) => f.type.endsWith('[]') && modelNames.has(f.type.replace(/[\[\]]/g, '')))
    .map((f) => models.find((x) => x.name === f.type.replace(/[\[\]]/g, '')).table);
  const uniq = [...new Set(children)];
  const idx = m.attrs.map((a) => `<code>${esc(a)}</code>`).join(' ');
  const tx = modelText[m.name];
  const L = li === 'en' ? 'Foreign keys' : 'ফরেন কী';
  const C = li === 'en' ? 'Referenced by' : 'যেসব টেবিল এটিকে ধরে';
  const I = li === 'en' ? 'Keys / indexes' : 'কী / ইনডেক্স';
  const H = li === 'en' ? ['Column', 'Type', 'Flags', 'Default', 'Note (from schema comments)'] : ['কলাম', 'টাইপ', 'ফ্ল্যাগ', 'ডিফল্ট', 'নোট (স্কিমা কমেন্ট, ইংরেজি)'];
  return `<details id="t-${m.table}"><summary>${m.name}<span class="tn">${m.table}</span> — <span class="muted" style="font-weight:400">${esc(tx ? tx[li === 'en' ? 0 : 1] : '')}</span></summary><div class="body">
<div class="table-wrap"><table><thead><tr>${H.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
${links.length ? `<p><strong>${L}:</strong> ${links.join(' · ')}</p>` : ''}
${uniq.length ? `<p><strong>${C}:</strong> ${uniq.map((t) => `<code>${t}</code>`).join(' ')}</p>` : ''}
${idx ? `<p><strong>${I}:</strong> ${idx}</p>` : ''}
</div></details>`;
}
function dbReference(li) {
  const byName = new Map(models.map((m) => [m.name, m]));
  let out = '';
  const used = new Set();
  for (const [key, names] of domains) {
    const t = domainText[key];
    out += `<h3 id="db-${key}">${esc(t[li === 'en' ? 0 : 1])}</h3><p>${esc(t[li === 'en' ? 2 : 3])}</p>`;
    for (const n of names) {
      const m = byName.get(n);
      if (!m) throw new Error('model not in schema: ' + n);
      used.add(n);
      out += modelBlock(m, li);
    }
  }
  const missing = models.filter((m) => !used.has(m.name)).map((m) => m.name);
  if (missing.length) throw new Error('models without a domain: ' + missing.join(', '));
  const enumRows = enums
    .map((e) => `<tr><td><code>${e.table || e.name}</code></td><td>${e.values.map((v) => `<code>${v}</code>`).join(' ')}</td></tr>`)
    .join('');
  out += `<h3 id="db-enums">${li === 'en' ? 'Enums' : 'এনাম (Enum)'}</h3><div class="table-wrap"><table><thead><tr><th>${li === 'en' ? 'Postgres type' : 'Postgres টাইপ'}</th><th>${li === 'en' ? 'Values' : 'মান'}</th></tr></thead><tbody>${enumRows}</tbody></table></div>`;
  return out;
}
function dbToc(li) {
  return domains.map(([k]) => `<a class="h3" href="#${li}-db-${k}">${esc(domainText[k][li === 'en' ? 0 : 1])}</a>`).join('') +
    `<a class="h3" href="#${li}-db-enums">${li === 'en' ? 'Enums' : 'এনাম'}</a>`;
}

/* ---------- permission catalog (parsed from permissions.ts) ---------- */
function permsTable(li) {
  const src = readFileSync(join(here, '../apps/api/src/auth/permissions.ts'), 'utf8');
  const re = /'([a-z_]+\.[a-z_]+)':\s*\{\s*group:\s*'([^']+)',\s*description:\s*'([^']+)'/g;
  const rows = [...src.matchAll(re)];
  if (rows.length < 30) throw new Error('permission parse failed: ' + rows.length);
  const H = li === 'en' ? ['Key', 'Group', 'Allows'] : ['কী', 'গ্রুপ', 'কী করতে দেয় (ইংরেজি)'];
  return `<div class="table-wrap"><table><thead><tr>${H.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr><td><code>${r[1]}</code></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`)
    .join('')}</tbody></table></div><p class="muted">${rows.length} ${li === 'en' ? 'permissions' : 'টি পারমিশন'}.</p>`;
}

/* ---------- page assembly ---------- */
function prefixIds(html, li) {
  return html
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${li}-${id}"`)
    .replace(/href="#([^"]+)"/g, (_, id) => `href="#${li}-${id}"`);
}
function tocFrom(html, li, extra) {
  // h2 -> top entry, h3 -> sub entry, built from the (already prefixed) body
  let out = '';
  const re = /<h([23]) id="([^"]+)"[^>]*>(.*?)<\/h\1>/gs;
  for (const m of html.matchAll(re)) {
    const text = m[3].replace(/<[^>]+>/g, '');
    out += `<a${m[1] === '3' ? ' class="h3"' : ''} href="#${m[2]}">${text}</a>`;
    if (extra && m[2] === `${li}-db`) out += extra;
  }
  return out;
}
function page({ kind, titleEn, titleBn }) {
  const blocks = ['en', 'bn'].map((li) => {
    let body = read(`src/${kind}.${li}.html`);
    if (body.includes('<!--DB-->')) body = body.replace('<!--DB-->', dbReference(li));
    if (body.includes('<!--PERMS-->')) body = body.replace('<!--PERMS-->', permsTable(li));
    body = prefixIds(body, li);
    const toc = tocFrom(body, li);
    return { li, body, toc };
  });
  const date = new Date().toISOString().slice(0, 10);
  const nav = blocks
    .map((b) => `<div data-l="${b.li}">${b.toc}</div>`)
    .join('');
  const main = blocks.map((b) => `<div data-l="${b.li}">${b.body}</div>`).join('\n');
  return `<!doctype html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titleEn} / ${titleBn}</title>
<style>
${css}
[data-l] { display: none; }
html[data-lang='en'] [data-l='en'], html[data-lang='bn'] [data-l='bn'] { display: block; }
nav.toc .langs { display: flex; gap: 6px; margin: 4px 0 14px; }
nav.toc .langs button { flex: 1; background: transparent; color: var(--side-text); border: 1px solid rgba(255,255,255,.25); border-radius: 6px; padding: 5px 8px; cursor: pointer; font: inherit; font-size: 13px; }
html[data-lang='en'] nav.toc .langs [data-set='en'], html[data-lang='bn'] nav.toc .langs [data-set='bn'] { background: var(--primary); color: #fff; border-color: transparent; }
@media print { html[data-lang='en'] [data-l='bn'], html[data-lang='bn'] [data-l='en'] { display: none !important; } }
</style>
</head>
<body>
<div class="layout">
<nav class="toc" aria-label="Contents">
  <div class="brand">bd-commerce</div>
  <div class="sub">${kind === 'dev' ? 'Developer manual · ডেভেলপার ম্যানুয়াল' : 'Owner manual · মালিকের ম্যানুয়াল'}</div>
  <div class="langs"><button data-set="en">English</button><button data-set="bn">বাংলা</button></div>
  ${nav}
  <div class="switch"><button class="theme" id="themeBtn" type="button">Light / Dark</button></div>
  <div class="sub" style="margin-top:14px">Built ${date}</div>
</nav>
<main>
${main}
</main>
</div>
<script>
(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var lang = get('bdc-manual-lang') || ((navigator.language || '').toLowerCase().indexOf('bn') === 0 ? 'bn' : 'en');
  function apply(l) { root.setAttribute('data-lang', l); root.lang = l; set('bdc-manual-lang', l); }
  apply(lang);
  document.querySelectorAll('[data-set]').forEach(function (b) {
    b.addEventListener('click', function () { apply(b.getAttribute('data-set')); window.scrollTo(0, 0); });
  });
  var th = get('bdc-manual-theme');
  if (th) root.setAttribute('data-theme', th);
  document.getElementById('themeBtn').addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    var n = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', n); set('bdc-manual-theme', n);
  });
})();
</script>
</body>
</html>`;
}

writeFileSync(
  join(here, 'developer-manual.html'),
  page({ kind: 'dev', titleEn: 'bd-commerce Developer Manual', titleBn: 'বিডি-কমার্স ডেভেলপার ম্যানুয়াল' }),
);
writeFileSync(
  join(here, 'owner-manual.html'),
  page({ kind: 'owner', titleEn: 'bd-commerce Owner Manual', titleBn: 'বিডি-কমার্স মালিকের ম্যানুয়াল' }),
);
console.log(`models: ${models.length}, enums: ${enums.length}`);
