/* Account area: account.html#<route>. Routes: dashboard | orders | order/<no> | return/<no> | wishlist | coupons | wallet | points | addresses | notifications | tickets | referral | profile | logout.
   Not logged in -> login/sign-up card (except the wishlist, which lives in localStorage). ?user=1 logs in the demo user, ?user=0 logs out.
   Mobile: the bare URL (no hash) shows the list menu; every section has a Back row. */
(function () {
  'use strict';
  var Shop = window.Shop, $ = Shop.$, $$ = Shop.$$, X = Shop.X, XA = Shop.XA, T = Shop.T, icon = Shop.icon, t = Shop.t, esc = Shop.esc, fmt = Shop.formatBDT, D = Shop.data, store = Shop.store;

  Shop.i18n({
    en: {
      ac_title: 'My account', ac_menu: 'Account menu', ac_back: 'Account', ac_hello: 'Hello, {name}', ac_since: 'Member since {y}', ac_login_h: 'Log in to your account', ac_login_s: 'See your orders, wallet, coupons and more.', ac_track_guest: 'Track an order without logging in',
      n_dashboard: 'Dashboard', n_orders: 'My orders', n_wishlist: 'Wishlist', n_coupons: 'Coupon wallet', n_wallet: 'Store wallet', n_points: 'Loyalty points', n_addresses: 'Addresses', n_notifications: 'Notifications',
      n_tickets: 'Support tickets', n_referral: 'Refer and earn', n_profile: 'Profile and security', n_logout: 'Log out',
      d_orders: 'Your orders', d_wallet: 'Store wallet', d_points: 'Points', d_coupons: 'Coupons', d_recent: 'Recent orders', d_all: 'View all', d_none: 'No orders yet. Your first order will show up here.',
      o_all: 'All', o_pay: 'To pay', o_proc: 'Processing', o_ship: 'Shipped', o_deliv: 'Delivered', o_ret: 'Returns', o_cancel: 'Cancelled', o_empty: 'No orders here', o_empty_s: 'When you order something it will appear in this tab.',
      o_view: 'View details', o_track: 'Track', o_paynow: 'Pay now', o_items: '{n} items', o_total: 'Total', o_more: '+{n} more', o_back: 'My orders', o_ret_req: 'Return requested', o_reorder: 'Buy again', o_ret_state: 'Return {state}',
      r_h: 'Request a return', r_not: 'This order cannot be returned (return window is over or the order was not delivered).', r_s1: '1. Select items', r_s2: '2. Why are you returning?', r_s3: '3. Add photos', r_s4: '4. Refund method', r_qty: 'Qty to return',
      r_reason: 'Reason', r_pick: 'Select a reason', r_wrong: 'Received the wrong item', r_dmg: 'Item arrived damaged', r_desc: 'Not as described', r_qual: 'Quality problem', r_size: 'Size or fit issue', r_mind: 'Changed my mind',
      r_note: 'Comments (optional)', r_note_ph: 'Tell us more so we can help faster', r_photos: 'Photos', r_photos_s: 'Add up to 4 clear photos. Required for damaged, wrong or not-as-described items.', r_add_photo: 'Add photo', r_rm_photo: 'Remove photo',
      r_ours: 'Our fault: we pay the return shipping and arrange a free pickup.', r_yours: 'Change of mind or fit: return shipping {fee} is deducted from your refund.', r_window: 'Return window: {n} days after delivery.',
      r_refund_to: 'Refund to', r_orig: 'Original payment method', r_orig_s: 'Back to {m} in 3 to 7 working days after we receive the item', r_wallet: 'Store wallet', r_wallet_s: 'Instant after we receive the item. Spend only.',
      r_est: 'Estimated refund', r_submit: 'Submit return request', r_err_items: 'Select at least one item.', r_err_reason: 'Select a reason.', r_err_photo: 'Please add at least one photo for this reason.',
      r_done_h: 'Return requested', r_done_s: 'We will arrange a pickup within 2 working days. Keep the item unused in its original packaging.', r_st1: 'Requested', r_st2: 'Pickup scheduled', r_st3: 'Item received', r_st4: 'Refunded',
      w_empty: 'Your wishlist is empty', w_empty_s: 'Tap the heart on any product to save it here.', w_add: 'Add to cart', w_n: '{n} saved items', w_added: 'Added to cart', w_login: 'Log in to keep your wishlist on all your devices.',
      cp_h_av: 'Available', cp_h_ex: 'Expired', cp_h_col: 'Collect more', cp_collect: 'Collect', cp_collected: 'Collected', cp_use: 'Use at checkout', cp_copy: 'Copy code', cp_copied: 'Code copied', cp_empty: 'No coupons collected yet.', cp_cart: 'Go to cart',
      wl_h: 'Store wallet', wl_bal: 'Available balance', wl_note: 'Wallet money can only be spent on ShopName orders. It cannot be withdrawn.', wl_tx: 'Transactions', wl_use: 'Use at checkout',
      pt_h: 'Loyalty points', pt_bal: 'Points balance', pt_worth: 'Worth {amt}', pt_rule: 'Redeem at least {min} points per order, up to {pct}% of the order value. 1 point = ৳1.', pt_earn: 'Earn 1 point for every ৳100 you spend. Same rate on every order.',
      pt_exp: '{n} points expire in {d} days. Use them before they are gone.', pt_hist: 'History',
      ad_h: 'My addresses', ad_add: 'Add new address', ad_edit: 'Edit address', ad_def: 'Default', ad_setdef: 'Set as default', ad_del: 'Delete', ad_none: 'No saved addresses', ad_none_s: 'Add one to check out faster.', ad_saved: 'Address saved', ad_deleted: 'Address deleted',
      nt_h: 'Notifications', nt_all_read: 'Mark all as read', nt_prefs: 'How should we notify you?', nt_inapp: 'In-app inbox', nt_sms: 'SMS', nt_email: 'Email', nt_push: 'Web push', nt_inapp_s: 'Always on', nt_sms_s: 'Order and delivery updates', nt_email_s: 'Receipts and offers', nt_push_s: 'Instant alerts in your browser', nt_none: 'You are all caught up.',
      tk_h: 'Support tickets', tk_new: 'New ticket', tk_none: 'No tickets yet', tk_none_s: 'Need help? Create a ticket and we will reply within 24 hours.', tk_subject: 'What do you need help with?', tk_order: 'Related order (optional)', tk_none_order: 'Not about an order', tk_msg: 'Message',
      tk_msg_ph: 'Describe the problem', tk_attach: 'Attach a screenshot (optional)', tk_send: 'Submit ticket', tk_s1: 'Order or delivery', tk_s2: 'Payment or refund', tk_s3: 'Return or exchange', tk_s4: 'Account or login', tk_s5: 'Something else',
      tk_open: 'Open', tk_replied: 'Replied', tk_closed: 'Closed', tk_err_msg: 'Please describe the problem (at least 10 characters).', tk_sent: 'Ticket submitted. We will reply within 24 hours.', tk_you: 'You', tk_agent: 'ShopName support', tk_ticket: 'Ticket',
      rf_h: 'Refer and earn', rf_s: 'Share your code. Your friend gets a ৳100 coupon when they sign up, and you get ৳100 in your wallet after their first delivered order.', rf_code: 'Your referral code', rf_copy: 'Copy', rf_copied: 'Copied', rf_link: 'Your invite link',
      rf_share: 'Share', rf_inv: 'Invited', rf_join: 'Joined', rf_earn: 'Earned', rf_how: 'How it works', rf_h1: 'Share your code', rf_h2: 'Friend signs up and gets a coupon', rf_h3: 'You earn after their first delivered order', rf_list: 'Your friends',
      rf_st_joined: 'Joined', rf_st_ordered: 'First order delivered', rf_st_inv: 'Invited',
      pf_h: 'Profile and security', pf_details: 'Personal details', pf_name: 'Full name', pf_email: 'Email', pf_phone: 'Mobile number', pf_verified: 'Verified', pf_unverified: 'Not verified', pf_verify: 'Verify by SMS', pf_save: 'Save changes', pf_saved: 'Profile updated',
      pf_pw: 'Change password', pf_cur: 'Current password', pf_new: 'New password', pf_new2: 'Confirm new password', pf_pw_save: 'Update password', pf_pw_ok: 'Password updated', pf_linked: 'Linked accounts', pf_connect: 'Connect', pf_disconnect: 'Disconnect', pf_conn: 'Connected',
      pf_ph_ok: 'Phone verified. Your guest orders with this number are now linked to your account.', pf_err_cur: 'Enter your current password.',
      lo_done: 'You have been logged out.', lo_login: 'Log in again', mark: 'Mark as read'
    },
    bn: {
      ac_title: 'আমার অ্যাকাউন্ট', ac_menu: 'অ্যাকাউন্ট মেনু', ac_back: 'অ্যাকাউন্ট', ac_hello: 'হ্যালো, {name}', ac_since: '{y} সাল থেকে সদস্য', ac_login_h: 'আপনার অ্যাকাউন্টে লগইন করুন', ac_login_s: 'অর্ডার, ওয়ালেট, কুপন ও আরও অনেক কিছু দেখুন।', ac_track_guest: 'লগইন ছাড়াই অর্ডার ট্র্যাক করুন',
      n_dashboard: 'ড্যাশবোর্ড', n_orders: 'আমার অর্ডার', n_wishlist: 'উইশলিস্ট', n_coupons: 'কুপন ওয়ালেট', n_wallet: 'স্টোর ওয়ালেট', n_points: 'লয়্যালটি পয়েন্ট', n_addresses: 'ঠিকানা', n_notifications: 'নোটিফিকেশন',
      n_tickets: 'সাপোর্ট টিকেট', n_referral: 'রেফার করুন, আয় করুন', n_profile: 'প্রোফাইল ও নিরাপত্তা', n_logout: 'লগআউট',
      d_orders: 'আপনার অর্ডার', d_wallet: 'স্টোর ওয়ালেট', d_points: 'পয়েন্ট', d_coupons: 'কুপন', d_recent: 'সাম্প্রতিক অর্ডার', d_all: 'সব দেখুন', d_none: 'এখনও কোনো অর্ডার নেই। প্রথম অর্ডার এখানে দেখা যাবে।',
      o_all: 'সব', o_pay: 'পরিশোধ বাকি', o_proc: 'প্রসেসিং', o_ship: 'শিপড', o_deliv: 'ডেলিভার্ড', o_ret: 'রিটার্ন', o_cancel: 'বাতিল', o_empty: 'এখানে কোনো অর্ডার নেই', o_empty_s: 'অর্ডার করলে এই ট্যাবে দেখা যাবে।',
      o_view: 'বিস্তারিত দেখুন', o_track: 'ট্র্যাক', o_paynow: 'এখন পরিশোধ', o_items: '{n}টি আইটেম', o_total: 'মোট', o_more: '+{n}টি আরও', o_back: 'আমার অর্ডার', o_ret_req: 'রিটার্নের অনুরোধ', o_reorder: 'আবার কিনুন', o_ret_state: 'রিটার্ন {state}',
      r_h: 'রিটার্নের অনুরোধ', r_not: 'এই অর্ডার রিটার্ন করা যাবে না (সময় শেষ বা ডেলিভারি হয়নি)।', r_s1: '1. আইটেম বেছে নিন', r_s2: '2. কেন ফেরত দিচ্ছেন?', r_s3: '3. ছবি যোগ করুন', r_s4: '4. রিফান্ড পদ্ধতি', r_qty: 'ফেরতের পরিমাণ',
      r_reason: 'কারণ', r_pick: 'কারণ বেছে নিন', r_wrong: 'ভুল পণ্য পেয়েছি', r_dmg: 'পণ্য ক্ষতিগ্রস্ত এসেছে', r_desc: 'বর্ণনার সাথে মেলেনি', r_qual: 'মানের সমস্যা', r_size: 'সাইজ বা ফিটিং সমস্যা', r_mind: 'মত বদলেছে',
      r_note: 'মন্তব্য (ঐচ্ছিক)', r_note_ph: 'আরও জানান, যাতে দ্রুত সাহায্য করতে পারি', r_photos: 'ছবি', r_photos_s: 'সর্বোচ্চ 4টি পরিষ্কার ছবি দিন। ক্ষতিগ্রস্ত, ভুল বা বর্ণনার সাথে না মেলা পণ্যে বাধ্যতামূলক।', r_add_photo: 'ছবি যোগ', r_rm_photo: 'ছবি সরান',
      r_ours: 'আমাদের ভুল: রিটার্ন শিপিং আমরা দেব এবং বিনামূল্যে পিকআপ করব।', r_yours: 'মত বদল বা ফিটিং: রিটার্ন শিপিং {fee} রিফান্ড থেকে কাটা হবে।', r_window: 'রিটার্ন সময়: ডেলিভারির পর {n} দিন।',
      r_refund_to: 'রিফান্ড যাবে', r_orig: 'মূল পেমেন্ট পদ্ধতিতে', r_orig_s: 'পণ্য পাওয়ার 3 থেকে 7 কর্মদিবসের মধ্যে {m}-এ ফেরত', r_wallet: 'স্টোর ওয়ালেট', r_wallet_s: 'পণ্য পাওয়ার পরই তাৎক্ষণিক। শুধু খরচ করা যায়।',
      r_est: 'আনুমানিক রিফান্ড', r_submit: 'রিটার্নের অনুরোধ পাঠান', r_err_items: 'অন্তত একটি আইটেম বেছে নিন।', r_err_reason: 'কারণ বেছে নিন।', r_err_photo: 'এই কারণে অন্তত একটি ছবি দিন।',
      r_done_h: 'রিটার্নের অনুরোধ হয়েছে', r_done_s: '2 কর্মদিবসের মধ্যে পিকআপের ব্যবস্থা করব। পণ্য অব্যবহৃত ও মূল প্যাকেজিংয়ে রাখুন।', r_st1: 'অনুরোধ হয়েছে', r_st2: 'পিকআপ নির্ধারিত', r_st3: 'পণ্য পাওয়া গেছে', r_st4: 'রিফান্ড হয়েছে',
      w_empty: 'আপনার উইশলিস্ট খালি', w_empty_s: 'যেকোনো পণ্যের হার্টে ট্যাপ করলে এখানে সেভ হবে।', w_add: 'কার্টে যোগ', w_n: '{n}টি সেভ করা আইটেম', w_added: 'কার্টে যোগ হয়েছে', w_login: 'সব ডিভাইসে উইশলিস্ট পেতে লগইন করুন।',
      cp_h_av: 'ব্যবহারযোগ্য', cp_h_ex: 'মেয়াদোত্তীর্ণ', cp_h_col: 'আরও সংগ্রহ করুন', cp_collect: 'সংগ্রহ', cp_collected: 'সংগৃহীত', cp_use: 'চেকআউটে ব্যবহার করুন', cp_copy: 'কোড কপি', cp_copied: 'কোড কপি হয়েছে', cp_empty: 'এখনও কোনো কুপন সংগ্রহ করেননি।', cp_cart: 'কার্টে যান',
      wl_h: 'স্টোর ওয়ালেট', wl_bal: 'ব্যবহারযোগ্য ব্যালেন্স', wl_note: 'ওয়ালেটের টাকা শুধু ShopName অর্ডারে খরচ করা যায়। তোলা যায় না।', wl_tx: 'লেনদেন', wl_use: 'চেকআউটে ব্যবহার করুন',
      pt_h: 'লয়্যালটি পয়েন্ট', pt_bal: 'পয়েন্ট ব্যালেন্স', pt_worth: 'মূল্য {amt}', pt_rule: 'প্রতি অর্ডারে কমপক্ষে {min} পয়েন্ট, অর্ডার মূল্যের {pct}% পর্যন্ত ভাঙানো যায়। 1 পয়েন্ট = ৳1।', pt_earn: 'প্রতি ৳100 খরচে 1 পয়েন্ট পাবেন। সব অর্ডারে একই হার।',
      pt_exp: '{n} পয়েন্টের মেয়াদ {d} দিনে শেষ। শেষ হওয়ার আগে ব্যবহার করুন।', pt_hist: 'ইতিহাস',
      ad_h: 'আমার ঠিকানা', ad_add: 'নতুন ঠিকানা যোগ করুন', ad_edit: 'ঠিকানা সম্পাদনা', ad_def: 'ডিফল্ট', ad_setdef: 'ডিফল্ট করুন', ad_del: 'মুছুন', ad_none: 'কোনো সংরক্ষিত ঠিকানা নেই', ad_none_s: 'দ্রুত চেকআউটের জন্য একটি যোগ করুন।', ad_saved: 'ঠিকানা সংরক্ষিত', ad_deleted: 'ঠিকানা মোছা হয়েছে',
      nt_h: 'নোটিফিকেশন', nt_all_read: 'সব পঠিত করুন', nt_prefs: 'কীভাবে জানাব?', nt_inapp: 'অ্যাপ ইনবক্স', nt_sms: 'এসএমএস', nt_email: 'ইমেইল', nt_push: 'ওয়েব পুশ', nt_inapp_s: 'সবসময় চালু', nt_sms_s: 'অর্ডার ও ডেলিভারি আপডেট', nt_email_s: 'রসিদ ও অফার', nt_push_s: 'ব্রাউজারে তাৎক্ষণিক অ্যালার্ট', nt_none: 'সব দেখা হয়ে গেছে।',
      tk_h: 'সাপোর্ট টিকেট', tk_new: 'নতুন টিকেট', tk_none: 'এখনও কোনো টিকেট নেই', tk_none_s: 'সাহায্য লাগবে? টিকেট খুলুন, 24 ঘণ্টায় উত্তর দেব।', tk_subject: 'কী নিয়ে সাহায্য লাগবে?', tk_order: 'সম্পর্কিত অর্ডার (ঐচ্ছিক)', tk_none_order: 'অর্ডার সম্পর্কিত নয়', tk_msg: 'বার্তা',
      tk_msg_ph: 'সমস্যাটি লিখুন', tk_attach: 'স্ক্রিনশট যোগ করুন (ঐচ্ছিক)', tk_send: 'টিকেট পাঠান', tk_s1: 'অর্ডার বা ডেলিভারি', tk_s2: 'পেমেন্ট বা রিফান্ড', tk_s3: 'রিটার্ন বা বদল', tk_s4: 'অ্যাকাউন্ট বা লগইন', tk_s5: 'অন্য কিছু',
      tk_open: 'খোলা', tk_replied: 'উত্তর দেওয়া হয়েছে', tk_closed: 'বন্ধ', tk_err_msg: 'সমস্যাটি লিখুন (কমপক্ষে 10 অক্ষর)।', tk_sent: 'টিকেট জমা হয়েছে। 24 ঘণ্টায় উত্তর দেব।', tk_you: 'আপনি', tk_agent: 'ShopName সাপোর্ট', tk_ticket: 'টিকেট',
      rf_h: 'রেফার করুন, আয় করুন', rf_s: 'আপনার কোড শেয়ার করুন। বন্ধু সাইন আপ করলে ৳100 কুপন পাবে, তার প্রথম ডেলিভার্ড অর্ডারের পর আপনি ওয়ালেটে ৳100 পাবেন।', rf_code: 'আপনার রেফারেল কোড', rf_copy: 'কপি', rf_copied: 'কপি হয়েছে', rf_link: 'আপনার আমন্ত্রণ লিংক',
      rf_share: 'শেয়ার', rf_inv: 'আমন্ত্রিত', rf_join: 'যোগ দিয়েছে', rf_earn: 'আয়', rf_how: 'কীভাবে কাজ করে', rf_h1: 'কোড শেয়ার করুন', rf_h2: 'বন্ধু সাইন আপ করে কুপন পায়', rf_h3: 'তার প্রথম ডেলিভার্ড অর্ডারের পর আপনি পান', rf_list: 'আপনার বন্ধুরা',
      rf_st_joined: 'যোগ দিয়েছে', rf_st_ordered: 'প্রথম অর্ডার ডেলিভার্ড', rf_st_inv: 'আমন্ত্রিত',
      pf_h: 'প্রোফাইল ও নিরাপত্তা', pf_details: 'ব্যক্তিগত তথ্য', pf_name: 'পূর্ণ নাম', pf_email: 'ইমেইল', pf_phone: 'মোবাইল নম্বর', pf_verified: 'যাচাইকৃত', pf_unverified: 'যাচাই হয়নি', pf_verify: 'এসএমএসে যাচাই করুন', pf_save: 'পরিবর্তন সংরক্ষণ', pf_saved: 'প্রোফাইল আপডেট হয়েছে',
      pf_pw: 'পাসওয়ার্ড বদলান', pf_cur: 'বর্তমান পাসওয়ার্ড', pf_new: 'নতুন পাসওয়ার্ড', pf_new2: 'নতুন পাসওয়ার্ড নিশ্চিত করুন', pf_pw_save: 'পাসওয়ার্ড আপডেট', pf_pw_ok: 'পাসওয়ার্ড আপডেট হয়েছে', pf_linked: 'যুক্ত অ্যাকাউন্ট', pf_connect: 'যুক্ত করুন', pf_disconnect: 'বিচ্ছিন্ন করুন', pf_conn: 'যুক্ত আছে',
      pf_ph_ok: 'ফোন যাচাই হয়েছে। এই নম্বরের গেস্ট অর্ডারগুলো এখন আপনার অ্যাকাউন্টে যুক্ত।', pf_err_cur: 'বর্তমান পাসওয়ার্ড দিন।',
      lo_done: 'আপনি লগআউট হয়েছেন।', lo_login: 'আবার লগইন করুন', mark: 'পঠিত করুন'
    }
  });

  var NAV = [['dashboard', 'grid'], ['orders', 'pkg'], ['wishlist', 'heart'], ['coupons', 'ticket'], ['wallet', 'cash'], ['points', 'bolt'], ['addresses', 'pin'], ['notifications', 'bell'], ['tickets', 'msg'], ['referral', 'share'], ['profile', 'shield'], ['logout', 'chevR']];
  var tab = 'all';
  var host;

  function user() { return Shop.user.get(); }
  function route() {
    var h = (location.hash || '').replace(/^#/, ''), p = h.split('/');
    if (p[0] === 'returns') p[0] = 'return';
    return { name: p[0] || '', arg: p[1] || '', raw: h };
  }
  function go(r) { location.hash = r; }
  function sectionHead(key, extra) { return '<header class="ac-h"><a class="ac-back" href="account.html" ' + XA('aria-label', 'ac_back') + '>' + icon('chevL', 20) + '</a><h1 ' + X(key) + '</h1>' + (extra || '') + '</header>'; }

  /* ---------------- helpers */
  var TABS = [['all', 'o_all', null], ['pay', 'o_pay', ['pending']], ['proc', 'o_proc', ['placed', 'processing', 'packed']], ['ship', 'o_ship', ['shipped']], ['deliv', 'o_deliv', ['delivered']], ['ret', 'o_ret', ['returned']], ['cancel', 'o_cancel', ['cancelled']]];
  function inTab(o, id) {
    var tb = TABS.filter(function (x) { return x[0] === id; })[0];
    if (!tb || !tb[2]) return true;
    if (id === 'ret') return o.status === 'returned' || !!o.returnReq;
    if (id === 'deliv') return o.status === 'delivered' && !o.returnReq;
    return tb[2].indexOf(o.status) >= 0;
  }
  function thumbs(o, max) {
    max = max || 4;
    var h = o.items.slice(0, max).map(function (i) { var p = D.getProduct(i.id), c = D.detail(i.id).combo(i.variant); return '<span class="pth" title="' + esc(p.title) + '"><span class="ph" style="--h:' + c.h + '"><span>' + p.emoji + '</span></span></span>'; }).join('');
    if (o.items.length > max) h += '<span class="pth pth-more">' + T('o_more', { n: o.items.length - max }) + '</span>';
    return '<div class="pths">' + h + '</div>';
  }
  function payHref(o) { return 'payment.html?o=' + o.no + '&m=' + (o.via || (o.method === 'cod' ? 'bkash' : o.method)); }
  function orderCard(o) {
    var acts = '<a class="btn btn-ghost btn-sm" href="#order/' + o.no + '" ' + X('o_view') + '</a>';
    if (o.status === 'pending') acts = '<a class="btn btn-primary btn-sm" href="' + payHref(o) + '" ' + X('o_paynow') + '</a>' + acts;
    else if (['shipped', 'delivered', 'packed'].indexOf(o.status) >= 0) acts += '<a class="btn btn-ghost btn-sm" href="track.html?o=' + o.no + '" ' + X('o_track') + '</a>';
    if (Shop.canReturn(o)) acts += '<a class="btn btn-ghost btn-sm" href="#return/' + o.no + '" ' + X('ret_btn') + '</a>';
    var n = o.items.reduce(function (s, i) { return s + i.qty; }, 0);
    return '<article class="ocard"><header class="ocard-h"><div><b>' + esc(o.no) + '</b> <span class="muted">· ' + Shop.dateX(o.ts) + '</span></div><span>' + Shop.statusPill(o.status) + (o.returnReq ? ' <span class="pill pill-info" ' + X('o_ret_req') + '</span>' : '') + '</span></header>' +
      '<div class="ocard-b">' + thumbs(o) + '<div class="ocard-s"><span class="muted">' + T('o_items', { n: n }) + '</span><span class="muted" ' + X('o_total') + '</span><b>' + fmt(o.totals.total) + '</b><span class="muted" ' + X(Shop.payLabel(o)) + '</span></div></div><footer class="ocard-f">' + acts + '</footer></article>';
  }
  function empty(emoji, hk, sk, cta) {
    return '<section class="empty"><div class="empty-i" aria-hidden="true">' + emoji + '</div><h2 ' + X(hk) + '</h2><p ' + X(sk) + '</p>' + (cta || '') + '</section>';
  }
  function tile(k, big, sub, href, ic) { return '<a class="stat" href="' + href + '"><span class="stat-i" aria-hidden="true">' + icon(ic, 20) + '</span><span class="stat-l muted" ' + X(k) + '</span><b class="stat-v">' + big + '</b>' + (sub || '') + '</a>'; }

  /* ---------------- sections */
  function dashboard() {
    var u = user(), all = Shop.orders.all(), cnt = function (id) { return all.filter(function (o) { return inTab(o, id); }).length; };
    var st = [['o_pay', 'pay', 'tag'], ['o_proc', 'proc', 'pkg'], ['o_ship', 'ship', 'truck'], ['o_deliv', 'deliv', 'check'], ['o_ret', 'ret', 'undo']].map(function (x) {
      return '<a class="stat stat-s" href="#orders" data-tab="' + x[1] + '"><span class="stat-i" aria-hidden="true">' + icon(x[2], 18) + '</span><b class="stat-v">' + cnt(x[1]) + '</b><span class="stat-l muted" ' + X(x[0]) + '</span></a>';
    }).join('');
    var w = Shop.wallet.get(), p = Shop.points.get(), cc = Shop.collected.get().filter(function (c) { return Shop.coupon.def(c) && !(Shop.coupon.rules[c] || {}).expired; }).length;
    return '<section class="dash-hello card-box"><span class="ct-av ct-av-lg" aria-hidden="true">' + esc(u.name.charAt(0)) + '</span><div><h1>' + T('ac_hello', { name: esc(u.name.split(' ')[0]) }) + '</h1><p class="muted">' + T('ac_since', { y: new Date(u.joined || Date.now()).getFullYear() }) + '</p></div></section>' +
      '<h2 class="sec-h3 mt" ' + X('d_orders') + '</h2><div class="stats stats-5">' + st + '</div>' +
      '<div class="stats stats-3">' + tile('d_wallet', fmt(w.bal), '', '#wallet', 'cash') + tile('d_points', p.bal.toLocaleString('en-US'), '<small class="muted">' + T('pt_worth', { amt: fmt(p.bal) }) + '</small>', '#points', 'bolt') + tile('d_coupons', cc, '', '#coupons', 'ticket') + '</div>' +
      '<div class="sec-row"><h2 class="sec-h3" ' + X('d_recent') + '</h2><a class="link" href="#orders"><span ' + X('d_all') + '</span>' + icon('chevR', 14) + '</a></div>' +
      (all.length ? '<div class="olist">' + all.slice(0, 3).map(orderCard).join('') + '</div>' : '<p class="muted" ' + X('d_none') + '</p>');
  }
  function orders() {
    var all = Shop.orders.all();
    var tabs = '<div class="tabs" role="tablist" ' + XA('aria-label', 'n_orders') + '>' + TABS.map(function (x) {
      var n = all.filter(function (o) { return inTab(o, x[0]); }).length;
      return '<button type="button" role="tab" aria-selected="' + (tab === x[0]) + '" data-tab="' + x[0] + '"><span ' + X(x[1]) + '</span> <em>' + n + '</em></button>';
    }).join('') + '</div>';
    var list = all.filter(function (o) { return inTab(o, tab); });
    return sectionHead('n_orders') + tabs + '<div role="tabpanel" class="olist">' + (list.length ? list.map(orderCard).join('') : empty('📦', 'o_empty', 'o_empty_s')) + '</div>';
  }
  function orderDetail(no) {
    var o = Shop.orders.get(no);
    if (!o) return sectionHead('n_orders') + empty('🔎', 'o_empty', 'o_empty_s');
    var a = o.addr, dist = D.districts[a.di] || D.districts[0], acts = '';
    if (o.status === 'pending') acts += '<a class="btn btn-primary" href="' + payHref(o) + '">' + icon('shield', 16) + ' <span ' + X('o_paynow') + '</span></a>';
    if (Shop.canCancel(o)) acts += '<button class="btn btn-ghost" type="button" data-act="cancel">' + icon('close', 16) + ' <span ' + X('cn_btn') + '</span></button>';
    if (Shop.canReturn(o)) acts += '<a class="btn btn-primary" href="#return/' + o.no + '">' + icon('undo', 16) + ' <span ' + X('ret_btn') + '</span></a>';
    acts += '<button class="btn btn-ghost" type="button" data-act="invoice">' + icon('pkg', 16) + ' <span ' + X('inv_btn') + '</span></button>';
    var rd = o.status === 'delivered' && !o.returnReq ? '<p class="muted note-s">' + icon('info', 14) + ' ' + T('ret_days', { n: 7 }) + '</p>' : '';
    return '<header class="ac-h"><a class="ac-back" href="#orders" ' + XA('aria-label', 'o_back') + '>' + icon('chevL', 20) + '</a><div class="grow"><h1>' + esc(o.no) + '</h1><p class="muted"><span ' + X('ord_date') + '</span> ' + Shop.dateX(o.ts, true) + '</p></div>' + Shop.statusPill(o.status) + (o.returnReq ? ' <span class="pill pill-info" ' + X('o_ret_req') + '</span>' : '') + '</header>' +
      '<section class="card-box">' + Shop.orderTimeline(o) + '</section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('sh_title') + '</h2>' + Shop.shipmentsHTML(o) + '</section>' +
      '<div class="two-col"><section class="card-box"><h2 class="sec-h3" ' + X('tk_addr') + '</h2><p><b>' + esc(a.name) + '</b> · ' + esc(a.phone) + '</p><p class="muted">' + esc(a.line) + ', ' + esc(a.area) + ', <span ' + Shop.LX(dist[0], dist[1]) + '</span></p>' +
      '<h2 class="sec-h3 mt" ' + X('pm_status') + '</h2><p><span ' + X('m_' + o.method) + '</span> · <b ' + X(Shop.payLabel(o)) + '</b></p></section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('tk_total') + '</h2>' + Shop.sumRows(o.totals) + '</section></div>' + rd + '<div class="trk-act">' + acts + '</div>';
  }

  /* return request flow */
  var RET = { items: {}, reason: '', note: '', photos: [], refund: 'orig' };
  var REASONS = [['wrong', 'r_wrong', 1], ['dmg', 'r_dmg', 1], ['desc', 'r_desc', 1], ['qual', 'r_qual', 1], ['size', 'r_size', 0], ['mind', 'r_mind', 0]];
  function retView(no) {
    var o = Shop.orders.get(no);
    if (!o || !Shop.canReturn(o)) {
      if (o && o.returnReq) return retDone(o);
      return sectionHead('r_h') + empty('↩️', 'r_h', 'r_not', '<a class="btn btn-primary" href="#orders" ' + X('o_back') + '</a>');
    }
    var items = o.items.map(function (i, n) {
      var on = !!RET.items[n], max = i.qty;
      return '<label class="retitem' + (on ? ' on' : '') + '"><input type="checkbox" data-ri="' + n + '"' + (on ? ' checked' : '') + '>' + Shop.itemRow(i).replace('irow-p', 'irow-p') +
        (max > 1 ? '<select class="inp inp-s" data-rq="' + n + '" ' + XA('aria-label', 'r_qty') + '>' + Array.apply(null, Array(max)).map(function (_, k) { return '<option value="' + (k + 1) + '"' + (RET.items[n] === k + 1 ? ' selected' : '') + '>' + (k + 1) + '</option>'; }).join('') + '</select>' : '') + '</label>';
    }).join('');
    var rs = REASONS.filter(function (r) { return r[0] === RET.reason; })[0], ours = rs && rs[2];
    var fee = o.totals.stdCharge || 80;
    var refundSum = o.items.reduce(function (s, i, n) { return s + (RET.items[n] ? i.price * RET.items[n] : 0); }, 0);
    var net = Math.max(0, refundSum - (rs && !ours ? fee : 0));
    var needPhoto = rs && rs[2];
    var pm = t('m_' + (o.via || o.method));
    return '<header class="ac-h"><a class="ac-back" href="#order/' + o.no + '">' + icon('chevL', 20) + '</a><div class="grow"><h1 ' + X('r_h') + '</h1><p class="muted">' + esc(o.no) + ' · ' + T('r_window', { n: 7 }) + '</p></div></header>' +
      '<form id="retForm" class="ret" novalidate>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('r_s1') + '</h2><div class="retitems">' + items + '</div><p class="fld-e" id="re-items" role="alert" hidden ' + X('r_err_items') + '</p></section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('r_s2') + '</h2><div class="fld"><label for="reReason" ' + X('r_reason') + '</label><select class="inp" id="reReason"><option value="" ' + X('r_pick') + '</option>' +
      REASONS.map(function (r) { return '<option value="' + r[0] + '"' + (RET.reason === r[0] ? ' selected' : '') + ' ' + X(r[1]) + '</option>'; }).join('') + '</select><p class="fld-e" id="re-reason" role="alert" hidden ' + X('r_err_reason') + '</p></div>' +
      (rs ? '<p class="alert ' + (ours ? 'alert-ok' : 'alert-warn') + '" role="note">' + icon(ours ? 'check' : 'info', 16) + ' ' + (ours ? '<span ' + X('r_ours') + '</span>' : T('r_yours', { fee: fmt(fee) })) + '</p>' : '') +
      '<div class="fld"><label for="reNote" ' + X('r_note') + '</label><textarea class="inp" id="reNote" rows="2" ' + XA('placeholder', 'r_note_ph') + '>' + esc(RET.note) + '</textarea></div></section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('r_s3') + (needPhoto ? ' *' : '') + '</h2><p class="muted" ' + X('r_photos_s') + '</p><div class="photos">' +
      RET.photos.map(function (u, i) { return '<div class="photo"><img src="' + u + '" alt=""><button type="button" class="icon-btn" data-rmph="' + i + '" ' + XA('aria-label', 'r_rm_photo') + '>' + icon('close', 14) + '</button></div>'; }).join('') +
      (RET.photos.length < 4 ? '<label class="photo photo-add">' + icon('camera', 22) + '<span ' + X('r_add_photo') + '</span><input type="file" accept="image/*" id="rePh" class="sr-only"></label>' : '') + '</div><p class="fld-e" id="re-photo" role="alert" hidden ' + X('r_err_photo') + '</p></section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('r_s4') + '</h2><div class="rcards" role="radiogroup" ' + XA('aria-label', 'r_refund_to') + '>' +
      '<label class="rcard"><input type="radio" name="reRef" value="orig"' + (RET.refund === 'orig' ? ' checked' : '') + '><span class="rc-b"><span class="rc-t"><b ' + X('r_orig') + '</b></span><span class="rc-s muted">' + T('r_orig_s', { m: pm }) + '</span></span></label>' +
      '<label class="rcard"><input type="radio" name="reRef" value="wallet"' + (RET.refund === 'wallet' ? ' checked' : '') + '><span class="rc-b"><span class="rc-t"><b ' + X('r_wallet') + '</b></span><span class="rc-s muted" ' + X('r_wallet_s') + '</span></span></label></div></section>' +
      '<section class="card-box ret-sum"><div><span class="muted" ' + X('r_est') + '</span><b class="ret-amt">' + fmt(net) + '</b></div><button class="btn btn-primary btn-lg" type="submit" ' + X('r_submit') + '</button></section></form>';
  }
  function retDone(o) {
    var r = o.returnReq, steps = ['r_st1', 'r_st2', 'r_st3', 'r_st4'];
    return '<header class="ac-h"><a class="ac-back" href="#order/' + o.no + '">' + icon('chevL', 20) + '</a><h1 ' + X('r_done_h') + '</h1></header><section class="card-box"><div class="au-done"><div class="au-ok" aria-hidden="true">' + icon('check', 34) + '</div><p class="muted" ' + X('r_done_s') + '</p></div>' +
      '<ol class="tl tl-h">' + steps.map(function (s, i) { return '<li class="' + (i === 0 ? 'cur' : '') + '"' + (i === 0 ? ' aria-current="step"' : '') + '><span class="tl-dot" aria-hidden="true">' + (i === 0 ? icon('check', 14) : i + 1) + '</span><div><b ' + X(s) + '</b></div></li>'; }).join('') + '</ol>' +
      '<p class="muted note-s">' + icon('info', 14) + ' <span ' + X(r.refund === 'wallet' ? 'r_wallet' : 'r_orig') + '</span> · ' + fmt(r.amount) + '</p><a class="btn btn-ghost" href="#orders" ' + X('o_back') + '</a></section>';
  }

  function wishlist() {
    var ids = Shop.wish.get(), ps = ids.map(Shop.data.getProduct).filter(Boolean);
    var g = ps.length ? '<div class="grid wl-grid">' + ps.map(function (p) {
      var oos = p.oos;
      if (p.upcoming) return '<div class="wl-i">' + Shop.card(p) + '<button class="btn btn-ghost btn-block btn-sm" type="button" disabled>' + icon('info', 15) + ' <span ' + X('upcoming') + '</span></button></div>';
      return '<div class="wl-i">' + Shop.card(p) + '<button class="btn btn-ghost btn-block btn-sm" type="button" data-wadd="' + p.id + '"' + (oos ? ' disabled' : '') + '>' + icon('cart', 15) + ' <span ' + X('w_add') + '</span></button></div>';
    }).join('') + '</div>' : empty('💝', 'w_empty', 'w_empty_s', '<a class="btn btn-primary" href="home.html" ' + X('start') + '</a>');
    return sectionHead('n_wishlist', ps.length ? '<span class="muted">' + T('w_n', { n: ps.length }) + '</span>' : '') + (user() ? '' : '<p class="alert" role="note">' + icon('user', 16) + ' <span ' + X('w_login') + '</span> <a class="link" href="account.html#dashboard" ' + X('login') + '</a></p>') + g;
  }
  function couponCard(def, state) {
    var col = state === 'av', rules = Shop.coupon.rules[def.code] || {};
    return '<article class="tkt' + (state === 'ex' ? ' is-ex' : '') + '"><div class="tkt-v"><b ' + Shop.LX(def.en, def.bn) + '</b></div><div class="tkt-b"><b class="mono">' + def.code + '</b><small class="muted" ' + Shop.LX(def.ten, def.tbn) + '</small><small class="' + (state === 'ex' ? 'bad' : 'muted') + '" ' + Shop.LX(def.exp, def.ebn) + '</small>' +
      (rules.stack === false ? '<small class="muted">' + icon('info', 12) + ' <span ' + Shop.LX('Cannot combine with other coupons', 'অন্য কুপনের সাথে ব্যবহার করা যাবে না') + '</span></small>' : '') + '</div>' +
      '<div class="tkt-a">' + (state === 'av' ? '<a class="btn btn-primary btn-sm" href="cart.html" ' + X('cp_use') + '</a><button class="btn-link" type="button" data-copy="' + def.code + '" ' + X('cp_copy') + '</button>' :
        state === 'col' ? '<button class="btn btn-ghost btn-sm" type="button" data-collect="' + def.code + '" ' + X('cp_collect') + '</button>' : '') + '</div></article>';
  }
  function coupons() {
    var col = Shop.collected.get(), av = D.coupons.filter(function (c) { return col.indexOf(c.code) >= 0; }), more = D.coupons.filter(function (c) { return col.indexOf(c.code) < 0; });
    return sectionHead('n_coupons') + '<h2 class="sec-h3" ' + X('cp_h_av') + '</h2><div class="tkts">' + (av.length ? av.map(function (c) { return couponCard(c, 'av'); }).join('') : '<p class="muted" ' + X('cp_empty') + '</p>') + '</div>' +
      (more.length ? '<h2 class="sec-h3 mt" ' + X('cp_h_col') + '</h2><div class="tkts">' + more.map(function (c) { return couponCard(c, 'col'); }).join('') + '</div>' : '') +
      '<h2 class="sec-h3 mt" ' + X('cp_h_ex') + '</h2><div class="tkts">' + couponCard(Shop.coupon.expiredDef, 'ex') + '</div>';
  }
  function txList(tx, unit) {
    return '<ul class="txs">' + tx.map(function (x) { return '<li><div><b ' + Shop.LX(x.en, x.bn) + '</b><small class="muted">' + Shop.dateX(x.ts) + '</small></div><b class="' + (x.amt > 0 ? 'ok' : '') + '">' + (x.amt > 0 ? '+' : '-') + (unit === 'pt' ? Math.abs(x.amt).toLocaleString('en-US') : fmt(Math.abs(x.amt))) + '</b></li>'; }).join('') + '</ul>';
  }
  function wallet() {
    var w = Shop.wallet.get();
    return sectionHead('n_wallet') + '<section class="card-box bigbal"><span class="muted" ' + X('wl_bal') + '</span><b>' + fmt(w.bal) + '</b><p class="muted">' + icon('info', 14) + ' <span ' + X('wl_note') + '</span></p><a class="btn btn-primary" href="cart.html" ' + X('wl_use') + '</a></section>' +
      '<h2 class="sec-h3 mt" ' + X('wl_tx') + '</h2>' + txList(w.tx);
  }
  function points() {
    var p = Shop.points.get(), c = Shop.config;
    return sectionHead('n_points') + '<section class="card-box bigbal"><span class="muted" ' + X('pt_bal') + '</span><b>' + p.bal.toLocaleString('en-US') + '</b><small class="muted">' + T('pt_worth', { amt: fmt(p.bal) }) + '</small>' +
      '<p class="alert alert-warn" role="note">' + icon('info', 16) + ' ' + T('pt_exp', { n: p.expiring, d: p.expDays }) + '</p><p class="muted">' + icon('bolt', 14) + ' <span ' + X('pt_earn') + '</span></p><p class="muted">' + icon('info', 14) + ' ' + T('pt_rule', { min: c.pointsMin, pct: c.pointsMaxPct }) + '</p></section>' +
      '<h2 class="sec-h3 mt" ' + X('pt_hist') + '</h2>' + txList(p.tx, 'pt');
  }

  function addrCard(a) {
    var d = D.districts[a.di];
    return '<article class="acard' + (a.def ? ' is-def' : '') + '"><header><span class="tagx">' + icon(a.label === 'office' ? 'store' : 'home', 13) + ' <span ' + X(a.label === 'office' ? 'ad_office' : 'ad_home') + '</span></span>' + (a.def ? '<span class="tagx tagx-acc" ' + X('ad_def') + '</span>' : '') + '</header>' +
      '<p><b>' + esc(a.name) + '</b> · ' + esc(a.phone) + '</p><p class="muted">' + esc(a.line) + ', ' + esc(a.area) + ', <span ' + Shop.LX(d[0], d[1]) + '</span></p>' +
      '<footer><button class="btn-link" type="button" data-aedit="' + a.id + '" ' + X('edit') + '</button>' + (a.def ? '' : '<button class="btn-link" type="button" data-adef="' + a.id + '" ' + X('ad_setdef') + '</button>') + '<button class="btn-link danger" type="button" data-adel="' + a.id + '" ' + X('ad_del') + '</button></footer></article>';
  }
  function addresses() {
    var l = Shop.addr.get();
    return sectionHead('n_addresses', '<button class="btn btn-primary btn-sm" type="button" data-aedit="new">' + icon('plus', 15) + ' <span ' + X('ad_add') + '</span></button>') +
      (l.length ? '<div class="acards">' + l.map(addrCard).join('') + '</div>' : empty('📍', 'ad_none', 'ad_none_s'));
  }
  function addrModal(id) {
    var l = Shop.addr.get(), a = l.filter(function (x) { return x.id === id; })[0] || { label: 'home', name: user().name, phone: user().phone || '', di: '', area: '', line: '' };
    var dopts = '<option value="" ' + X('ad_pick') + '</option>' + D.districts.map(function (d, i) { return '<option value="' + i + '"' + (a.di === i ? ' selected' : '') + ' ' + Shop.LX(d[0], d[1]) + '</option>'; }).join('');
    var inner = Shop.modalHead('adOvl', id === 'new' ? 'ad_add' : 'ad_edit') + '<form id="adForm" novalidate><div class="sheet-b"><div class="two">' +
      Shop.field({ id: 'amName', label: 'ad_recv', val: a.name, ac: 'name' }) + Shop.field({ id: 'amPhone', label: 'co_phone', val: a.phone, ac: 'tel', im: 'tel', type: 'tel', max: 14, ph: 'co_phone_ph' }) +
      '<div class="fld"><label for="amDist" ' + X('ad_district') + '</label><select class="inp" id="amDist" aria-describedby="amDist-e">' + dopts + '</select><p class="fld-e" id="amDist-e" role="alert" hidden></p></div>' + Shop.field({ id: 'amArea', label: 'ad_area', val: a.area, ph: 'ad_area_ph' }) + '</div>' +
      '<div class="fld"><label for="amLine" ' + X('ad_line') + '</label><textarea class="inp" id="amLine" rows="2" aria-describedby="amLine-e">' + esc(a.line) + '</textarea><p class="fld-e" id="amLine-e" role="alert" hidden></p></div>' +
      '<fieldset class="lblset"><legend ' + X('ad_label') + '</legend><label class="chipr"><input type="radio" name="amLbl" value="home"' + (a.label !== 'office' ? ' checked' : '') + '><span>' + icon('home', 15) + ' <span ' + X('ad_home') + '</span></span></label><label class="chipr"><input type="radio" name="amLbl" value="office"' + (a.label === 'office' ? ' checked' : '') + '><span>' + icon('store', 15) + ' <span ' + X('ad_office') + '</span></span></label></fieldset></div>' +
      '<div class="sheet-f"><button class="btn btn-ghost" type="button" data-close ' + X('ad_cancel') + '</button><button class="btn btn-primary" type="submit" ' + X('save') + '</button></div></form>';
    var n = Shop.ovlModal('adOvl', inner, 'modal-md');
    $('#adForm', n).addEventListener('submit', function (e) {
      e.preventDefault(); var bad = false;
      function chk(i, ok, k) { Shop.fieldErr(i, ok ? null : k); if (!ok) bad = true; }
      chk('amName', $('#amName').value.trim().length > 1, 'err_name'); chk('amPhone', Shop.validPhone($('#amPhone').value.replace(/[\s-]/g, '')), 'err_phone');
      chk('amDist', $('#amDist').value !== '', 'ad_err_district'); chk('amArea', $('#amArea').value.trim().length > 1, 'ad_err_area'); chk('amLine', $('#amLine').value.trim().length > 4, 'ad_err_line');
      if (bad) return;
      var rec = { id: id === 'new' ? 'a' + Date.now() : id, label: $('input[name=amLbl]:checked').value, name: $('#amName').value.trim(), phone: $('#amPhone').value.replace(/[\s-]/g, ''), di: +$('#amDist').value, area: $('#amArea').value.trim(), line: $('#amLine').value.trim(), def: a.def || !l.length };
      if (id === 'new') l.push(rec); else l = l.map(function (x) { return x.id === id ? rec : x; });
      Shop.addr.save(l); Shop.ovl.close(n); Shop.toast(t('ad_saved')); render();
    });
    Shop.ovl.open(n, 'input');
  }

  var NOTES = [
    { id: 'n1', ic: 'truck', ago: 60 * 60000, en: 'Order BD-100219: parcel 1 handed to Pathao (PTH-8841233).', bn: 'অর্ডার BD-100219: পার্সেল 1 পাঠাও-এ হস্তান্তর (PTH-8841233)।', href: '#order/BD-100219' },
    { id: 'n2', ic: 'tag', ago: 5 * 3600000, en: 'Puja Mega Sale is live. Up to 60% off and new coupons.', bn: 'পূজা মেগা সেল শুরু। 60% পর্যন্ত ছাড় ও নতুন কুপন।', href: 'event.html' },
    { id: 'n3', ic: 'bell', ago: 11 * 60000, en: 'Order BD-100163 is waiting for payment. Pay within 30 minutes.', bn: 'অর্ডার BD-100163 পেমেন্টের অপেক্ষায়। 30 মিনিটের মধ্যে পরিশোধ করুন।', href: 'payment.html?o=BD-100163&m=gw' },
    { id: 'n4', ic: 'cash', ago: 2 * 86400000, en: '৳850 was added to your store wallet (refund for BD-100120).', bn: 'আপনার স্টোর ওয়ালেটে ৳850 যোগ হয়েছে (BD-100120 এর রিফান্ড)।', href: '#wallet' },
    { id: 'n5', ic: 'check', ago: 3 * 86400000, en: 'Order BD-100174 was delivered. How was it?', bn: 'অর্ডার BD-100174 ডেলিভার হয়েছে। কেমন লাগল?', href: '#order/BD-100174' },
    { id: 'n6', ic: 'bolt', ago: 4 * 86400000, en: '300 loyalty points expire in 24 days.', bn: '300 লয়্যালটি পয়েন্ট 24 দিনে শেষ হবে।', href: '#points' },
    { id: 'n7', ic: 'user', ago: 20 * 86400000, en: 'Welcome to ShopName! Here is your first coupon: WELCOME100.', bn: 'ShopName-এ স্বাগতম! প্রথম কুপন: WELCOME100।', href: '#coupons' }
  ];
  function notes() { return Shop.isDemo() ? NOTES : NOTES.slice(-1); }
  function notifications() {
    var NT = notes(), read = store.getJSON('shop.nread', ['n5', 'n6', 'n7']), pr = store.getJSON('shop.nprefs', { sms: true, email: true, push: false });
    var unread = NT.filter(function (n) { return read.indexOf(n.id) < 0; }).length;
    var list = NT.slice().sort(function (a, b) { return a.ago - b.ago; }).map(function (n) {
      var un = read.indexOf(n.id) < 0;
      return '<li class="nt' + (un ? ' unread' : '') + '"><a href="' + n.href + '" data-nread="' + n.id + '"><span class="nt-i" aria-hidden="true">' + icon(n.ic, 18) + '</span><span class="nt-t"><span ' + Shop.LX(n.en, n.bn) + '</span><small class="muted">' + Shop.dateX(Date.now() - n.ago, true) + '</small></span>' + (un ? '<span class="nt-dot" aria-hidden="true"></span><span class="sr-only" ' + X('mark') + '</span>' : '') + '</a></li>';
    }).join('');
    var sw = function (k, lab, sub, dis) { return '<label class="switch"><input type="checkbox" data-pref="' + k + '"' + (pr[k] || dis ? ' checked' : '') + (dis ? ' disabled' : '') + '><span class="sw-t"></span><span class="sw-l"><b ' + X(lab) + '</b><small class="muted" ' + X(sub) + '</small></span></label>'; };
    return sectionHead('n_notifications', unread ? '<button class="btn-link" type="button" data-act="allread" ' + X('nt_all_read') + '</button>' : '') + '<ul class="nts">' + list + '</ul>' +
      '<section class="card-box mt"><h2 class="sec-h3" ' + X('nt_prefs') + '</h2><div class="prefs">' + sw('inapp', 'nt_inapp', 'nt_inapp_s', true) + sw('sms', 'nt_sms', 'nt_sms_s') + sw('email', 'nt_email', 'nt_email_s') + sw('push', 'nt_push', 'nt_push_s') + '</div></section>';
  }

  function ticketsData() {
    var l = store.getJSON('shop.tickets', null);
    if (!l && !Shop.isDemo()) return [];
    if (!l) { l = [
      { id: 'T-2041', ts: Date.now() - 6 * Shop.DAY, subj: 's3', order: 'BD-100174', status: 'replied', msgs: [{ who: 'me', ts: Date.now() - 6 * Shop.DAY, txt: 'The size is too small. Can I exchange it?' }, { who: 'agent', ts: Date.now() - 5 * Shop.DAY, txt: 'Sorry about that. You can request a return within 7 days of delivery and place a new order in the right size.' }] },
      { id: 'T-1988', ts: Date.now() - 30 * Shop.DAY, subj: 's2', order: '', status: 'closed', msgs: [{ who: 'me', ts: Date.now() - 30 * Shop.DAY, txt: 'My bKash payment failed but money was deducted.' }, { who: 'agent', ts: Date.now() - 29 * Shop.DAY, txt: 'We found the payment and refunded it to your bKash account.' }] }
    ]; }
    return l;
  }
  function tickets() {
    var l = ticketsData();
    var rows = l.map(function (x) {
      return '<details class="tkc"><summary><span class="tkc-id mono">' + x.id + '</span><b ' + X('tk_' + x.subj.replace('s', 's')) + '</b><span class="pill pill-' + (x.status === 'closed' ? 'ok' : x.status === 'replied' ? 'info' : 'warn') + '" ' + X('tk_' + x.status) + '</span><span class="muted">' + Shop.dateX(x.ts) + '</span></summary>' +
        '<div class="thread">' + x.msgs.map(function (m) { return '<div class="msg msg-' + m.who + '"><small class="muted"><span ' + X(m.who === 'me' ? 'tk_you' : 'tk_agent') + '</span> · ' + Shop.dateX(m.ts, true) + '</small><p>' + esc(m.txt) + '</p></div>'; }).join('') + '</div></details>';
    }).join('');
    var orders = Shop.orders.all().map(function (o) { return '<option value="' + o.no + '">' + o.no + '</option>'; }).join('');
    var form = '<section class="card-box" id="tkNew" hidden><h2 class="sec-h3" ' + X('tk_new') + '</h2><form id="tkForm" novalidate><div class="two"><div class="fld"><label for="tfSubj" ' + X('tk_subject') + '</label><select class="inp" id="tfSubj">' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="s' + n + '" ' + X('tk_s' + n) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="tfOrder" ' + X('tk_order') + '</label><select class="inp" id="tfOrder"><option value="" ' + X('tk_none_order') + '</option>' + orders + '</select></div></div>' +
      '<div class="fld"><label for="tfMsg" ' + X('tk_msg') + '</label><textarea class="inp" id="tfMsg" rows="4" ' + XA('placeholder', 'tk_msg_ph') + ' aria-describedby="tfMsg-e"></textarea><p class="fld-e" id="tfMsg-e" role="alert" hidden></p></div>' +
      '<div class="fld"><label for="tfFile" ' + X('tk_attach') + '</label><input class="inp" type="file" id="tfFile" accept="image/*"></div><button class="btn btn-primary" type="submit" ' + X('tk_send') + '</button></form></section>';
    return sectionHead('n_tickets', '<button class="btn btn-primary btn-sm" type="button" data-act="newticket">' + icon('plus', 15) + ' <span ' + X('tk_new') + '</span></button>') + form +
      (l.length ? '<div class="tkcs">' + rows + '</div>' : empty('💬', 'tk_none', 'tk_none_s'));
  }

  function referral() {
    var code = 'RAHIM50', link = 'shopname.example/r/' + code;
    var friends = [['Nusrat J.', 'ordered'], ['Tanvir A.', 'ordered'], ['Sadia I.', 'joined'], ['Imran H.', 'inv']];
    return sectionHead('n_referral') + '<section class="card-box ref"><p class="muted" ' + X('rf_s') + '</p><div class="ref-code"><span class="muted" ' + X('rf_code') + '</span><div class="ref-c"><b class="mono">' + code + '</b><button class="btn btn-ghost btn-sm" type="button" data-copy="' + code + '">' + icon('share', 14) + ' <span ' + X('rf_copy') + '</span></button></div></div>' +
      '<div class="ref-code"><span class="muted" ' + X('rf_link') + '</span><div class="ref-c"><span class="mono">' + link + '</span><button class="btn btn-ghost btn-sm" type="button" data-copy="https://' + link + '"><span ' + X('rf_copy') + '</span></button></div></div>' +
      '<div class="ref-share"><span class="muted" ' + X('rf_share') + '</span><a class="chipl" href="#">WhatsApp</a><a class="chipl" href="#">Messenger</a><a class="chipl" href="#">SMS</a><a class="chipl" href="#">Facebook</a></div></section>' +
      '<div class="stats stats-3"><div class="stat"><span class="stat-l muted" ' + X('rf_inv') + '</span><b class="stat-v">4</b></div><div class="stat"><span class="stat-l muted" ' + X('rf_join') + '</span><b class="stat-v">3</b></div><div class="stat"><span class="stat-l muted" ' + X('rf_earn') + '</span><b class="stat-v">' + fmt(200) + '</b></div></div>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('rf_how') + '</h2><ol class="how"><li><span>1</span> <span ' + X('rf_h1') + '</span></li><li><span>2</span> <span ' + X('rf_h2') + '</span></li><li><span>3</span> <span ' + X('rf_h3') + '</span></li></ol></section>' +
      '<h2 class="sec-h3 mt" ' + X('rf_list') + '</h2><ul class="txs">' + friends.map(function (f) { return '<li><b>' + f[0] + '</b><span class="pill pill-' + (f[1] === 'ordered' ? 'ok' : f[1] === 'joined' ? 'info' : 'warn') + '" ' + X('rf_st_' + f[1]) + '</span></li>'; }).join('') + '</ul>';
  }

  function profile() {
    var u = user(), linked = store.getJSON('shop.linked', { Google: !!(u.provider === 'Google'), Facebook: !!(u.provider === 'Facebook') });
    var pw = function (id, k) { return '<div class="fld"><label for="' + id + '" ' + X(k) + '</label><div class="inp-wrap"><input class="inp" id="' + id + '" type="password" autocomplete="' + (id === 'pfCur' ? 'current-password' : 'new-password') + '" aria-describedby="' + id + '-e"></div><p class="fld-e" id="' + id + '-e" role="alert" hidden></p></div>'; };
    return sectionHead('n_profile') + '<section class="card-box"><h2 class="sec-h3" ' + X('pf_details') + '</h2><form id="pfForm" novalidate><div class="two">' + Shop.field({ id: 'pfName', label: 'pf_name', val: u.name, ac: 'name' }) + Shop.field({ id: 'pfEmail', label: 'pf_email', val: u.email, type: 'email', ac: 'email' }) + '</div>' +
      '<div class="fld"><label for="pfPhone" ' + X('pf_phone') + '</label><div class="inp-wrap"><input class="inp" id="pfPhone" type="tel" value="' + esc(u.phone || '') + '" inputmode="tel" maxlength="14" autocomplete="tel"><span class="vtag ' + (u.verified ? 'ok' : 'warn') + '">' + icon(u.verified ? 'check' : 'info', 14) + ' <span ' + X(u.verified ? 'pf_verified' : 'pf_unverified') + '</span></span></div>' +
      (u.verified ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-act="verify" ' + X('pf_verify') + '</button>') + '</div><button class="btn btn-primary" type="submit" ' + X('pf_save') + '</button></form></section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('pf_pw') + '</h2><form id="pwForm" novalidate>' + pw('pfCur', 'pf_cur') + '<div class="two">' + pw('pfNew', 'pf_new') + pw('pfNew2', 'pf_new2') + '</div><button class="btn btn-primary" type="submit" ' + X('pf_pw_save') + '</button></form></section>' +
      '<section class="card-box"><h2 class="sec-h3" ' + X('pf_linked') + '</h2><ul class="txs">' + ['Google', 'Facebook'].map(function (p) {
        return '<li><span class="lnk"><b class="' + (p === 'Google' ? 'au-g' : 'au-f') + '" aria-hidden="true">' + p.charAt(0) + '</b> ' + p + (linked[p] ? ' <span class="ok vf">' + icon('check', 13) + ' <span ' + X('pf_conn') + '</span></span>' : '') + '</span><button class="btn btn-ghost btn-sm" type="button" data-link="' + p + '" ' + X(linked[p] ? 'pf_disconnect' : 'pf_connect') + '</button></li>';
      }).join('') + '</ul></section>';
  }

  /* ---------------- navigation + render */
  function navHTML(cur) {
    var u = user(), unread = notes().filter(function (n) { return store.getJSON('shop.nread', ['n5', 'n6', 'n7']).indexOf(n.id) < 0; }).length;
    return '<nav class="acc-nav" ' + XA('aria-label', 'ac_menu') + '><div class="acc-who"><span class="ct-av" aria-hidden="true">' + esc(u.name.charAt(0)) + '</span><div><b>' + esc(u.name) + '</b><small class="muted">' + esc(u.phone || u.email) + '</small></div></div><ul>' + NAV.map(function (n) {
      var on = cur === n[0] || (cur === 'order' && n[0] === 'orders') || (cur === 'return' && n[0] === 'orders');
      return '<li><a href="' + (n[0] === 'logout' ? '#logout' : '#' + n[0]) + '"' + (on ? ' aria-current="page"' : '') + '>' + icon(n[1], 19) + '<span ' + X('n_' + n[0]) + '</span>' + (n[0] === 'notifications' && unread ? '<span class="cnt cnt-in">' + unread + '</span>' : '') + icon('chevR', 16, 'nv-c') + '</a></li>';
    }).join('') + '</ul></nav>';
  }
  function loginCard() {
    return '<div class="wrap acc-pg"><div class="lg-box card-box"><div class="au-h"><h1 ' + X('ac_login_h') + '</h1><p class="muted" ' + X('ac_login_s') + '</p></div><div id="accAuth"></div><p class="note-s"><a class="link" href="track.html"><span ' + X('ac_track_guest') + '</span>' + icon('chevR', 14) + '</a></p></div></div>';
  }
  function render() {
    var r = route(), u = user();
    if (!u && r.name !== 'wishlist') {
      host.innerHTML = loginCard(); Shop.applyI18n(host);
      Shop.auth.mount($('#accAuth', host), { mode: 'login', noFocus: true, onDone: function () { render(); Shop.headerUser(); } });
      document.title = t('ac_title') + ' - ShopName'; return;
    }
    if (r.name === 'logout') { Shop.user.clear(); Shop.toast(t('lo_done')); history.replaceState(null, '', 'account.html'); Shop.headerUser(); render(); return; }
    var isMenu = r.name === '' , cur = r.name || 'dashboard', body;
    if (!u) { body = wishlist(); isMenu = false; cur = 'wishlist'; }
    else if (cur === 'dashboard') body = dashboard();
    else if (cur === 'orders') body = orders();
    else if (cur === 'order') body = orderDetail(r.arg);
    else if (cur === 'return') body = retView(r.arg);
    else if (cur === 'wishlist') body = wishlist();
    else if (cur === 'coupons') body = coupons();
    else if (cur === 'wallet') body = wallet();
    else if (cur === 'points') body = points();
    else if (cur === 'addresses') body = addresses();
    else if (cur === 'notifications') body = notifications();
    else if (cur === 'tickets') body = tickets();
    else if (cur === 'referral') body = referral();
    else if (cur === 'profile') body = profile();
    else body = dashboard();
    host.innerHTML = '<div class="wrap acc-pg' + (isMenu ? ' is-menu' : '') + '">' + (u ? '<aside class="acc-side">' + navHTML(cur) + '</aside>' : '') + '<div class="acc-main" id="accMain">' + body + '</div></div>';
    Shop.applyI18n(host);
    document.title = t('ac_title') + ' - ShopName';
    var kept = host._focus; host._focus = null;
    if (kept) { var n = $(kept, host); if (n) n.focus(); }
  }

  /* ---------------- events */
  function bind() {
    host.addEventListener('click', function (e) {
      var b, r = route();
      if ((b = e.target.closest('[data-tab]'))) { tab = b.getAttribute('data-tab'); if (r.name !== 'orders') { go('orders'); } else { render(); var tb = $('[data-tab="' + tab + '"]', host); if (tb) tb.focus(); } if (b.tagName === 'A') e.preventDefault(); return; }
      if ((b = e.target.closest('[data-copy]'))) { var v = b.getAttribute('data-copy'); try { navigator.clipboard.writeText(v); } catch (x) { /* ignore */ } Shop.toast(t(/^http|\./.test(v) ? 'rf_copied' : 'cp_copied')); return; }
      if ((b = e.target.closest('[data-collect]'))) { Shop.collected.add(b.getAttribute('data-collect')); Shop.toast(t('cp_collected')); render(); return; }
      if ((b = e.target.closest('[data-wadd]'))) { var id = +b.getAttribute('data-wadd'); Shop.cart.add(id, D.detail(id).defaultKey(), 1); Shop.toast(t('w_added'), { href: 'cart.html', label: t('view_cart') }); return; }
      if ((b = e.target.closest('[data-aedit]'))) { addrModal(b.getAttribute('data-aedit')); return; }
      if ((b = e.target.closest('[data-adef]'))) { var id2 = b.getAttribute('data-adef'); Shop.addr.save(Shop.addr.get().map(function (a) { a.def = a.id === id2; return a; })); render(); return; }
      if ((b = e.target.closest('[data-adel]'))) { var id3 = b.getAttribute('data-adel'); Shop.addr.save(Shop.addr.get().filter(function (a) { return a.id !== id3; })); Shop.toast(t('ad_deleted')); render(); return; }
      if ((b = e.target.closest('[data-nread]'))) { var rd = store.getJSON('shop.nread', ['n5', 'n6', 'n7']); var nid = b.getAttribute('data-nread'); if (rd.indexOf(nid) < 0) rd.push(nid); store.setJSON('shop.nread', rd); return; }
      if ((b = e.target.closest('[data-link]'))) { var lk = store.getJSON('shop.linked', {}), pv = b.getAttribute('data-link'); lk[pv] = !lk[pv]; store.setJSON('shop.linked', lk); render(); return; }
      if ((b = e.target.closest('[data-rmph]'))) { RET.photos.splice(+b.getAttribute('data-rmph'), 1); render(); return; }
      if ((b = e.target.closest('[data-act]'))) {
        var act = b.getAttribute('data-act'), o = r.name === 'order' ? Shop.orders.get(r.arg) : null;
        if (act === 'cancel' && o) Shop.cancelModal(o, function () { render(); });
        else if (act === 'invoice' && o) Shop.downloadInvoice(o);
        else if (act === 'allread') { store.setJSON('shop.nread', notes().map(function (n) { return n.id; })); render(); }
        else if (act === 'newticket') { var f = $('#tkNew'); f.hidden = !f.hidden; if (!f.hidden) $('#tfMsg').focus(); }
        else if (act === 'verify') verifyPhone();
      }
    });
    host.addEventListener('change', function (e) {
      var n = e.target, r = route();
      if (n.hasAttribute('data-pref')) { var p = store.getJSON('shop.nprefs', { sms: true, email: true, push: false }); p[n.getAttribute('data-pref')] = n.checked; store.setJSON('shop.nprefs', p); if (n.getAttribute('data-pref') === 'push' && n.checked && window.Notification) { try { Notification.requestPermission(); } catch (x) { /* ignore */ } } }
      else if (n.hasAttribute('data-ri')) { var i = +n.getAttribute('data-ri'), o = Shop.orders.get(r.arg); if (n.checked) RET.items[i] = RET.items[i] || o.items[i].qty; else delete RET.items[i]; keep('[data-ri="' + i + '"]'); }
      else if (n.hasAttribute('data-rq')) { RET.items[+n.getAttribute('data-rq')] = +n.value; keep('[data-rq="' + n.getAttribute('data-rq') + '"]'); }
      else if (n.id === 'reReason') { RET.reason = n.value; RET.note = ($('#reNote') || {}).value || ''; keep('#reReason'); }
      else if (n.name === 'reRef') RET.refund = n.value;
      else if (n.id === 'rePh' && n.files && n.files[0]) { RET.note = ($('#reNote') || {}).value || ''; try { RET.photos.push(URL.createObjectURL(n.files[0])); } catch (x) { /* ignore */ } keep('.photo-add input'); }
    });
    function keep(sel) { host._focus = sel; render(); }
    host.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, r = route();
      if (f.id === 'retForm') {
        var o = Shop.orders.get(r.arg), bad = false, rs = REASONS.filter(function (x) { return x[0] === RET.reason; })[0], any = Object.keys(RET.items).length;
        $('#re-items').hidden = !!any; $('#re-reason').hidden = !!rs; $('#re-photo').hidden = !(rs && rs[2] && !RET.photos.length);
        bad = !any || !rs || (rs[2] && !RET.photos.length);
        if (bad) { var first = $('.fld-e:not([hidden])', f); if (first) first.scrollIntoView({ block: 'center' }); return; }
        var amt = o.items.reduce(function (s, i, n) { return s + (RET.items[n] ? i.price * RET.items[n] : 0); }, 0) - (rs[2] ? 0 : (o.totals.stdCharge || 80));
        o.returnReq = { items: RET.items, reason: RET.reason, note: ($('#reNote') || {}).value, refund: RET.refund, ts: Date.now(), amount: Math.max(0, amt), status: 'requested', photos: RET.photos.length };
        Shop.orders.update(o); RET = { items: {}, reason: '', note: '', photos: [], refund: 'orig' }; render();
      } else if (f.id === 'tkForm') {
        var msg = $('#tfMsg').value.trim(); if (msg.length < 10) { Shop.fieldErr('tfMsg', 'tk_err_msg'); $('#tfMsg').focus(); return; }
        var l = ticketsData(); l.unshift({ id: 'T-' + (2042 + l.length), ts: Date.now(), subj: $('#tfSubj').value, order: $('#tfOrder').value, status: 'open', msgs: [{ who: 'me', ts: Date.now(), txt: msg }] });
        store.setJSON('shop.tickets', l); Shop.toast(t('tk_sent')); render();
      } else if (f.id === 'pfForm') {
        var u = user(); u.name = $('#pfName').value.trim() || u.name; u.email = $('#pfEmail').value.trim(); u.phone = $('#pfPhone').value.replace(/[\s-]/g, '');
        Shop.user.set(u); Shop.toast(t('pf_saved')); render();
      } else if (f.id === 'pwForm') {
        var bd = false; function c(id, ok, k) { Shop.fieldErr(id, ok ? null : k); if (!ok) bd = true; }
        c('pfCur', $('#pfCur').value.length > 0, 'pf_err_cur'); c('pfNew', $('#pfNew').value.length >= 6, 'au_err_pw'); c('pfNew2', $('#pfNew2').value === $('#pfNew').value, 'au_err_match');
        if (!bd) { Shop.toast(t('pf_pw_ok')); f.reset(); }
      }
    });
    window.addEventListener('hashchange', function () { RET.photos = RET.photos; render(); window.scrollTo({ top: 0 }); var fr = document.getElementById('frame'); if (fr) fr.scrollTop = 0; });
  }
  function verifyPhone() {
    var u = user(), n = Shop.ovlModal('vfOvl', Shop.modalHead('vfOvl', 'pf_verify') + '<div class="sheet-b">' + Shop.otp.html('vfOtp', u.phone) + '</div>', 'modal-sm');
    var w = Shop.otp.bind($('#vfOtp', n), { onOk: function () {
      u.verified = true; Shop.user.set(u); Shop.ovl.close(n);
      Shop.orders.stored().forEach(function (o) { if (o.guest && o.contact && o.contact.phone === u.phone) { o.guest = false; Shop.orders.update(o); } });
      Shop.toast(t('pf_ph_ok')); render();
    } });
    Shop.ovl.open(n, '.otp-b'); setTimeout(w.focus, 60);
  }

  Shop.renderPage('<div id="accHost"></div>', {
    active: 'account',
    onReady: function () {
      host = $('#accHost'); render(); bind();
      Shop.on('user', function () { /* callers re-render */ });
      Shop.on('wish', function () { if (route().name === 'wishlist') render(); });
      Shop.on('lang', function () { /* data-i18n handles it */ });
    }
  });
})();
