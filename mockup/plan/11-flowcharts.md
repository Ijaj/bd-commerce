# 11 — Flowcharts

> Generated from `flowcharts/flows.js` by `node flowcharts/to-md.mjs` — do not hand-edit. The animated step-by-step version is `flowcharts/index.html`.

## Contents

1. [Checkout](#1-checkout)
2. [Order lifecycle](#2-order-lifecycle)
3. [Returns & refunds](#3-returns-refunds)
4. [Price & discount engine](#4-price-discount-engine)
5. [Category delete](#5-category-delete)
6. [Roles & permissions](#6-roles-permissions)
7. [Visitor tracking](#7-visitor-tracking)
8. [Dropship forwarding](#8-dropship-forwarding)
9. [Rewards: points, referral, affiliate](#9-rewards-points-referral-affiliate)

## 1. Checkout

Cart → order placed. Covers guests, coupons, points/wallet, COD advance rules, guest COD OTP, pre-order advance and online payment.

```mermaid
flowchart TD
  cart(["Customer opens cart"])
  reval["Revalidate cart"]
  dInvalid{{"Any line changed or invalid?"}}
  fix["Customer fixes cart"]
  go["Proceed to checkout"]
  dLogged{{"Logged in?"}}
  auth["Login, register, or continue as guest"]
  guest["Guest details"]
  addr["Choose / enter address"]
  zone["Resolve delivery zone"]
  split["Group items into shipments"]
  dcharge["Calculate delivery charge"]
  price["Run price engine"]
  coupon["Apply coupon (type code or pick from wallet)"]
  dCoupon{{"Coupon valid?"}}
  cErr["Show exact reason"]
  ptsw["Use loyalty points / store wallet (optional)"]
  pay["Choose payment method"]
  dCod{{"COD?"}}
  dOtp{{"Guest AND total > OTP threshold?"}}
  otp[/"SMS OTP to phone"/]
  dOtpOk{{"OTP correct?"}}
  otpFail["Blocked: cannot place COD order"]
  dPre{{"Contains a pre-order item?"}}
  dRule{{"COD advance rule matched?"}}
  review["Review & place order"]
  create["Create order"]
  dNeedPay{{"Anything to pay now?"}}
  gw[/"Pay via bKash / Nagad / gateway"/]
  dPaid{{"Payment success?"}}
  retry["Payment failed / cancelled"]
  done(["Order placed"])
  cart --> reval
  reval --> dInvalid
  dInvalid -->|"yes"| fix
  fix --> reval
  dInvalid -->|"no"| go
  go --> dLogged
  dLogged -->|"no"| auth
  auth -->|"guest"| guest
  auth -->|"logged in"| addr
  dLogged -->|"yes"| addr
  guest --> addr
  addr --> zone
  zone --> split
  split --> dcharge
  dcharge --> price
  price --> coupon
  coupon --> dCoupon
  dCoupon -->|"no"| cErr
  cErr --> ptsw
  dCoupon -->|"yes / skipped"| ptsw
  ptsw --> pay
  pay --> dCod
  dCod -->|"yes"| dOtp
  dOtp -->|"yes"| otp
  otp --> dOtpOk
  dOtpOk -->|"no"| otpFail
  otpFail -->|"switch method"| pay
  dOtpOk -->|"yes"| dPre
  dOtp -->|"no"| dPre
  dCod -->|"no (online)"| dPre
  dPre -->|"yes: advance %"| review
  dPre -->|"no"| dRule
  dRule -->|"yes: advance"| review
  dRule -->|"no"| review
  review --> create
  create --> dNeedPay
  dNeedPay -->|"yes"| gw
  dNeedPay -->|"no (plain COD)"| done
  gw --> dPaid
  dPaid -->|"yes"| done
  dPaid -->|"no"| retry
  retry -->|"retry"| gw
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef step fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  classDef bad fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  classDef ext fill:#cffafe,stroke:#0891b2,color:#164e63,stroke-dasharray:4 3
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class cart start
  class reval,zone,split,dcharge,price,create sys
  class dInvalid,dLogged,dCoupon,dCod,dOtp,dOtpOk,dPre,dRule,dNeedPay,dPaid dec
  class fix,go,auth,guest,addr,coupon,ptsw,pay,review step
  class cErr,otpFail,retry bad
  class otp,gw ext
  class done end
```

**Steps**

1. **Customer opens cart** (start) — Cart works for guests (tied to visitor-ID cookie) and logged-in users. Guest cart merges into the account cart on login.
2. **Revalidate cart** (sys) — Re-check every line: price changed since added, stock left, product archived, variant still valid, flash/event price still active. Problems shown inline.
3. **Any line changed or invalid?** (dec) — Price change, out of stock, quantity above stock, product archived.
4. **Customer fixes cart** (step) — Remove item / reduce qty / accept new price. Price-change banner must be acknowledged before continuing.
5. **Proceed to checkout** (step) — Single-page checkout on mobile and web: address → delivery → payment → review.
6. **Logged in?** (dec)
7. **Login, register, or continue as guest** (step) — Login: phone + password, email + password, Google, Facebook. New signup verifies phone with SMS OTP.
8. **Guest details** (step) — Name, phone (required), email (optional, needed for email receipts). Guest order links to an account later if this phone registers.
9. **Choose / enter address** (step) — Saved address, or new: Division → District → Upazila/Thana → Area + full address + receiver phone.
10. **Resolve delivery zone** (sys) — Area maps to a zone (Inside Dhaka / Dhaka suburbs / Outside Dhaka — editable in admin).
11. **Group items into shipments** (sys) — Warehouse items = one shipment; dropship items grouped per supplier (each supplier = one shipment).
12. **Calculate delivery charge** (sys) — Zone base + extra per kg above base weight + per-product overrides; free above ৳X threshold. One delivery charge per order even when it ships as several parcels.
13. **Run price engine** (sys) — Sale / flash / event price (best wins) → auto discounts → coupons → points → wallet → delivery. See flow "Price & discount engine".
14. **Apply coupon (type code or pick from wallet)** (step) — Checkout suggests the best coupon the customer has collected. Multiple coupons only if each allows stacking.
15. **Coupon valid?** (dec) — Dates, segment, min order/qty, scope/exclusions, payment method, zone, platform, usage limits, budget cap, stacking.
16. **Show exact reason** (bad) — e.g. "Minimum order ৳1,500", "Only valid with bKash", "Already used". Customer can continue without it.
17. **Use loyalty points / store wallet (optional)** (step) — Points: min redeem + max % of order (admin settings). Wallet: spend-only balance from refunds/cashback.
18. **Choose payment method** (step) — COD, bKash, Nagad, gateway (cards etc.). Changing method re-runs price engine (payment-method discounts).
19. **COD?** (dec)
20. **Guest AND total > OTP threshold?** (dec) — Threshold ৳X is an admin setting.
21. **SMS OTP to phone** (ext) — SMS provider is swappable (chosen later).
22. **OTP correct?** (dec) — Max attempts then cooldown (e.g. 3 tries, 15 min). Resend limited.
23. **Blocked: cannot place COD order** (bad) — Customer can switch to online payment instead.
24. **Contains a pre-order item?** (dec) — Pre-orders always need a partial advance (admin-set %).
25. **COD advance rule matched?** (dec) — Admin rules: total > ৳X, velocity-flagged phone/device, specific categories. Advance = delivery charge or set amount.
26. **Review & place order** (step) — Final summary with every discount line, delivery charge, advance due now, amount due on delivery.
27. **Create order** (sys) — Order no., price/coupon snapshot, discount allocated per line, reserve stock (at placement), record coupon use, deduct points/wallet, link visitor ID, run velocity rules.
28. **Anything to pay now?** (dec) — Online method, COD advance, or pre-order advance.
29. **Pay via bKash / Nagad / gateway** (ext) — Order waits in "Awaiting payment"; stock stays reserved for 30 min (admin setting).
30. **Payment success?** (dec) — Confirmed by server-side callback/verification, never only by the redirect.
31. **Payment failed / cancelled** (bad) — Retry or switch method within the timeout. On timeout: auto-cancel, release stock, restore coupon use, points and wallet.
32. **Order placed** (end) — Success page + SMS + email + in-app inbox + web push. Order enters "Order lifecycle".

## 2. Order lifecycle

Placed → completed. Velocity review, optional staff call, order edits, split shipments, multi-courier booking, hand-off, delivery, return window.

```mermaid
flowchart TD
  placed(["Order placed"])
  dFlag{{"Flagged by velocity rule?"}}
  rev["Staff reviews flagged order"]
  dLegit{{"Looks legit?"}}
  proc["Status: Processing"]
  dCall{{"Staff decides to call?"}}
  dProblem{{"Problem found?"}}
  edit["Edit order (qty / address / items)"]
  hold["Hold or cancel (reason logged)"]
  custCancel["Customer cancels"]
  ship["Create shipments"]
  pack["Pick & pack (warehouse)"]
  pick["Choose courier"]
  book[/"Book via courier API"/]
  dBook{{"Booking OK?"}}
  bookErr["Booking failed"]
  hand["Handed to courier"]
  sync[/"Courier status sync"/]
  dDel{{"Delivered?"}}
  failDel["Failed delivery / returned to sender"]
  deliv["Delivered"]
  win["Return window running"]
  dRet{{"Return requested?"}}
  retFlow["Go to Returns & refunds"]
  complete(["Completed"])
  placed --> dFlag
  dFlag -->|"yes"| rev
  rev --> dLegit
  dLegit -->|"yes"| proc
  dLegit -->|"no"| hold
  dFlag -->|"no"| proc
  proc --> dCall
  dCall -->|"yes"| dProblem
  dProblem -->|"needs change"| edit
  dProblem -->|"fake / unreachable"| hold
  dProblem -->|"all good"| ship
  edit --> ship
  dCall -->|"no"| ship
  proc -->|"customer"| custCancel
  ship --> pack
  pack --> pick
  pick --> book
  book --> dBook
  dBook -->|"no"| bookErr
  bookErr --> pick
  dBook -->|"yes"| hand
  hand --> sync
  sync --> dDel
  dDel -->|"no"| failDel
  dDel -->|"yes"| deliv
  deliv --> win
  win --> dRet
  dRet -->|"yes"| retFlow
  dRet -->|"no, window passed"| complete
  retFlow -->|"after resolution"| complete
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef staff fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef bad fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  classDef ext fill:#cffafe,stroke:#0891b2,color:#164e63,stroke-dasharray:4 3
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class placed start
  class dFlag,dLegit,dCall,dProblem,dBook,dDel,dRet dec
  class rev,edit,pack,pick,retFlow staff
  class proc,ship,hand,deliv,win sys
  class hold,custCancel,bookErr,failDel bad
  class book,sync ext
  class complete end
```

**Steps**

1. **Order placed** (start) — From checkout. Stock already reserved.
2. **Flagged by velocity rule?** (dec) — e.g. more than N orders from same phone/device/IP in X hours.
3. **Staff reviews flagged order** (staff) — Shown in a "Needs review" queue on the dashboard.
4. **Looks legit?** (dec)
5. **Status: Processing** (sys) — Customer notified. Orders go straight here — no mandatory confirmation.
6. **Staff decides to call?** (dec) — Optional, at staff discretion (e.g. high value, odd address). Call notes saved on order.
7. **Problem found?** (dec)
8. **Edit order (qty / address / items)** (staff) — Permission-gated. Re-runs price engine, adjusts stock reservation, audit-logged, customer notified.
9. **Hold or cancel (reason logged)** (bad) — Cancel releases stock, restores coupon use/points/wallet, refunds any advance (see Returns & refunds).
10. **Customer cancels** (bad) — Allowed any time before hand-off to courier.
11. **Create shipments** (sys) — Warehouse shipment + one per dropship supplier. Supplier shipments follow "Dropship forwarding".
12. **Pick & pack (warehouse)** (staff) — Print VAT invoice (BIN) + shipping label (bulk print supported).
13. **Choose courier** (staff) — Steadfast or Pathao at launch; staff picks per shipment.
14. **Book via courier API** (ext) — Returns consignment ID + tracking link. COD amount sent to courier.
15. **Booking OK?** (dec)
16. **Booking failed** (bad) — Retry, or choose the other courier. Alert on dashboard.
17. **Handed to courier** (sys) — Customer gets SMS/email/push with courier name + tracking link. Our tracking ends here; customer can no longer cancel.
18. **Courier status sync** (ext) — Webhook or polling until delivered / returned.
19. **Delivered?** (dec)
20. **Failed delivery / returned to sender** (bad) — Restock on arrival, order cancelled, advance refunded, coupon use/points/wallet restored, no rewards.
21. **Delivered** (sys) — COD cash collected by courier → recorded as receivable; matched later against courier remittance (COD reconciliation).
22. **Return window running** (sys) — 7 days by default, overridable per category/product. Review invitation sent.
23. **Return requested?** (dec) — See "Returns & refunds".
24. **Go to Returns & refunds** (staff)
25. **Completed** (end) — Triggers "Rewards": loyalty points, referral reward, affiliate commission.

## 3. Returns & refunds

Return request → inspection → refund to original method or store wallet, with approval above the threshold. Also used for cancellations with prepaid amounts.

```mermaid
flowchart TD
  req(["Customer requests return"])
  dWin{{"Within window AND item returnable?"}}
  autoRej["Rejected automatically"]
  rev["Staff reviews request"]
  dApprove{{"Approve?"}}
  rej["Rejected with reason"]
  pickup[/"Return pickup / customer sends item"/]
  inspect["Receive & inspect item"]
  dCond{{"Condition OK?"}}
  sendBack["Reject & send back"]
  dType{{"Refund or exchange?"}}
  exch["Create exchange order"]
  calc["Calculate refund amount"]
  dMethod{{"Refund to?"}}
  dThr{{"Amount > approval threshold?"}}
  approver["Approver decides"]
  exec[/"Execute refund"/]
  dOk{{"Refund succeeded?"}}
  manual["Retry / handle manually"]
  restock["Restock or write off"]
  adj["Adjust rewards"]
  done(["Refund done, customer notified"])
  req --> dWin
  dWin -->|"no"| autoRej
  dWin -->|"yes"| rev
  rev --> dApprove
  dApprove -->|"no"| rej
  dApprove -->|"yes"| pickup
  pickup --> inspect
  inspect --> dCond
  dCond -->|"no"| sendBack
  dCond -->|"yes"| dType
  dType -->|"exchange"| exch
  dType -->|"refund"| calc
  calc --> dMethod
  dMethod -->|"original method"| dThr
  dMethod -->|"wallet"| dThr
  dThr -->|"yes"| approver
  dThr -->|"no"| exec
  approver -->|"approved"| exec
  approver -->|"denied"| rej
  exec --> dOk
  dOk -->|"no"| manual
  manual --> exec
  dOk -->|"yes"| restock
  exch --> restock
  restock --> adj
  adj --> done
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef bad fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  classDef staff fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
  classDef ext fill:#cffafe,stroke:#0891b2,color:#164e63,stroke-dasharray:4 3
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class req start
  class dWin,dApprove,dCond,dType,dMethod,dThr,dOk dec
  class autoRej,rej,sendBack,manual bad
  class rev,inspect,approver staff
  class pickup,exec ext
  class exch,calc,restock,adj sys
  class done end
```

**Steps**

1. **Customer requests return** (start) — From order page: pick items + qty, reason, photos.
2. **Within window AND item returnable?** (dec) — Window per product/category (default 7 days). Some categories non-returnable.
3. **Rejected automatically** (bad) — Customer sees reason. Can open a support ticket.
4. **Staff reviews request** (staff) — Checks photos/reason. Can ask customer for more info.
5. **Approve?** (dec)
6. **Rejected with reason** (bad) — Customer notified.
7. **Return pickup / customer sends item** (ext) — Return shipping: we pay when it is our fault (wrong, damaged, defective); customer pays for change of mind.
8. **Receive & inspect item** (staff)
9. **Condition OK?** (dec)
10. **Reject & send back** (bad) — Customer notified with photos/notes.
11. **Refund or exchange?** (dec) — Customer chose at request time.
12. **Create exchange order** (sys) — Zero-price order for the replacement → normal "Order lifecycle".
13. **Calculate refund amount** (sys) — Item price minus its allocated coupon share. Points spent → re-credited. Delivery charge refund per policy.
14. **Refund to?** (dec) — Original method (bKash/Nagad/gateway) or store wallet (spend only). COD orders → wallet or manual bKash/Nagad transfer.
15. **Amount > approval threshold?** (dec) — Threshold is an admin setting.
16. **Approver decides** (staff) — Anyone with refunds.approve_high permission.
17. **Execute refund** (ext) — Payment-provider refund API, wallet credit, or manual transfer with reference no.
18. **Refund succeeded?** (dec)
19. **Retry / handle manually** (bad) — Stays in "Refund pending" queue until done.
20. **Restock or write off** (sys) — Sellable → back to stock; damaged → write-off. Stock history log.
21. **Adjust rewards** (sys) — Reduce affiliate commission / points base for this order (net amount).
22. **Refund done, customer notified** (end) — SMS/email/inbox.

## 4. Price & discount engine

Order in which prices, discounts, coupons, points, wallet and delivery are applied. Same engine for cart, checkout and staff order edits.

```mermaid
flowchart TD
  in(["Cart lines + customer + zone + payment method"])
  base["Base price per variant"]
  cand["Collect candidate prices"]
  best["Lowest candidate wins per line"]
  auto["Apply auto-applied discounts"]
  each["For each coupon in cart"]
  dValid{{"Passes all conditions?"}}
  drop["Drop coupon with reason"]
  dStack{{"Stacking flags allow combination?"}}
  bestCombo["Keep the combination with max saving"]
  type["Compute discount by type"]
  alloc["Allocate discount across lines"]
  dPts{{"Customer uses points?"}}
  pts["Apply points"]
  wallet["Apply store wallet"]
  deliv["Add delivery charge"]
  dPay{{"Payment method changed?"}}
  out(["Final payable"])
  in --> base
  base --> cand
  cand --> best
  best --> auto
  auto --> each
  each --> dValid
  dValid -->|"no"| drop
  dValid -->|"yes"| dStack
  dStack -->|"conflict"| bestCombo
  dStack -->|"ok"| type
  bestCombo --> type
  type --> alloc
  alloc --> dPts
  dPts -->|"yes"| pts
  dPts -->|"no"| wallet
  pts --> wallet
  wallet --> deliv
  deliv --> dPay
  dPay -->|"yes: re-run"| each
  dPay -->|"no"| out
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef bad fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class in start
  class base,cand,best,auto,each,bestCombo,type,alloc,pts,wallet,deliv sys
  class dValid,dStack,dPts,dPay dec
  class drop bad
  class out end
```

**Steps**

1. **Cart lines + customer + zone + payment method** (start)
2. **Base price per variant** (sys)
3. **Collect candidate prices** (sys) — Sale price (date window), flash price (slot active, stock left, per-customer limit), event price (the one active event).
4. **Lowest candidate wins per line** (sys)
5. **Apply auto-applied discounts** (sys) — No-code promotions, e.g. "10% off Electronics this week".
6. **For each coupon in cart** (sys)
7. **Passes all conditions?** (dec) — Dates, segment (first order / inactive N days / tier / specific), min amount/qty, scope + exclusions, payment method, zone, platform, limits (total, per customer, per phone, per device), budget cap.
8. **Drop coupon with reason** (bad) — Reason shown to customer.
9. **Stacking flags allow combination?** (dec) — Per coupon: with sale/event price? with other coupons? with points?
10. **Keep the combination with max saving** (sys) — System picks automatically; shows which coupon was dropped and why.
11. **Compute discount by type** (sys) — % (with cap), fixed, buy X get Y, tiered, bundle price, free delivery (applied to delivery charge later).
12. **Allocate discount across lines** (sys) — Prorated per line and stored — needed for partial returns and affiliate commission.
13. **Customer uses points?** (dec)
14. **Apply points** (sys) — Min redeem, max % of order, point value — admin settings.
15. **Apply store wallet** (sys) — Up to remaining payable.
16. **Add delivery charge** (sys) — Minus free-delivery coupon / free-above-threshold.
17. **Payment method changed?** (dec) — Payment-method coupons (e.g. bKash 10%) re-evaluated.
18. **Final payable** (end) — Snapshot of every line, discount and rule stored on the order.

## 5. Category delete

Admin deletes a category: move everything to one target, or delete everything (products with orders are archived).

```mermaid
flowchart TD
  click_(["Admin clicks Delete on a category"])
  dPerm{{"Has categories.delete?"}}
  deny["403 + audit log"]
  count["Count impact"]
  dialog["Dialog: Move / Delete everything / Cancel"]
  target["Pick ONE target category"]
  dTarget{{"Target valid?"}}
  tErr["Show why target is invalid"]
  move["Move sub-categories + products"]
  confirm["Type category name to confirm"]
  each["For each product in the subtree"]
  dOther{{"Also in a category outside this subtree?"}}
  unlink["Only remove link to deleted categories"]
  dOrders{{"Has order history?"}}
  archive["Archive product"]
  hard["Hard delete product"]
  refs["Clean references"]
  redir["Create URL redirects"]
  audit["Audit log"]
  done(["Done — summary shown"])
  click_ --> dPerm
  dPerm -->|"no"| deny
  dPerm -->|"yes"| count
  count --> dialog
  dialog -->|"move"| target
  target --> dTarget
  dTarget -->|"no"| tErr
  tErr --> target
  dTarget -->|"yes"| move
  dialog -->|"delete all"| confirm
  confirm --> each
  each --> dOther
  dOther -->|"yes"| unlink
  dOther -->|"no"| dOrders
  dOrders -->|"yes"| archive
  dOrders -->|"no"| hard
  move --> refs
  unlink --> refs
  archive --> refs
  hard --> refs
  refs --> redir
  redir --> audit
  audit --> done
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef bad fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef staff fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class click_ start
  class dPerm,dTarget,dOther,dOrders dec
  class deny,tErr bad
  class count,move,each,unlink,archive,hard,refs,redir,audit sys
  class dialog,target,confirm staff
  class done end
```

**Steps**

1. **Admin clicks Delete on a category** (start)
2. **Has categories.delete?** (dec) — Deleting products too also needs the delete-with-products permission.
3. **403 + audit log** (bad)
4. **Count impact** (sys) — Sub-categories, products (direct + descendants), products with orders, home-page flag, carousel/menu links, coupon scopes, event blocks.
5. **Dialog: Move / Delete everything / Cancel** (staff) — Shows the impact counts.
6. **Pick ONE target category** (staff) — Everything (sub-categories + products) moves under it.
7. **Target valid?** (dec) — Not itself or a descendant; moved subtree depth + target depth must stay ≤ 4 levels.
8. **Show why target is invalid** (bad)
9. **Move sub-categories + products** (sys) — Products also in other categories just keep those links.
10. **Type category name to confirm** (staff) — Strong confirmation for destructive action.
11. **For each product in the subtree** (sys)
12. **Also in a category outside this subtree?** (dec)
13. **Only remove link to deleted categories** (sys)
14. **Has order history?** (dec)
15. **Archive product** (sys) — Hidden everywhere, kept for orders/reports.
16. **Hard delete product** (sys) — Images cleaned from storage.
17. **Clean references** (sys) — Home featured list, carousel links, menus, coupon scopes, event blocks → removed or flagged for review.
18. **Create URL redirects** (sys) — Old category URLs → target (move) or parent (delete). Keeps SEO and shared links working.
19. **Audit log** (sys) — Before/after, counts, who, when.
20. **Done — summary shown** (end)

## 6. Roles & permissions

Two paths: (1) how every staff action is checked, (2) how roles are created/assigned without privilege escalation.

```mermaid
flowchart TD
  req(["Staff action (e.g. edit product)"])
  dSess{{"Session valid?"}}
  login["Login: password + 2FA (authenticator)"]
  eff["Effective permissions = union of all roles"]
  dSa{{"Super admin?"}}
  dHas{{"Has resource.action?"}}
  deny["403 + logged"]
  dAppr{{"Needs approval?"}}
  queue["Send to approvers"]
  exec["Execute + audit log"]
  ok(["Done"])
  g1(["Open role editor / assign roles"])
  dG{{"Has roles.manage / staff.assign_roles?"}}
  gDeny["403"]
  dSub{{"Every permission granted ⊆ own permissions?"}}
  gErr["Reject: cannot grant more than you have"]
  dProt{{"Touches super admin or own account?"}}
  save["Save + audit log"]
  gOk(["Role saved / assigned"])
  req --> dSess
  dSess -->|"no"| login
  login --> eff
  dSess -->|"yes"| eff
  eff --> dSa
  dSa -->|"yes"| exec
  dSa -->|"no"| dHas
  dHas -->|"no"| deny
  dHas -->|"yes"| dAppr
  dAppr -->|"yes"| queue
  queue -->|"approved"| exec
  queue -->|"rejected"| deny
  dAppr -->|"no"| exec
  exec --> ok
  g1 --> dG
  dG -->|"no"| gDeny
  dG -->|"yes"| dSub
  dSub -->|"no"| gErr
  dSub -->|"yes"| dProt
  dProt -->|"yes"| gErr
  dProt -->|"no"| save
  save --> gOk
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef step fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef bad fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  classDef staff fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class req,g1 start
  class dSess,dSa,dHas,dAppr,dG,dSub,dProt dec
  class login step
  class eff,exec,save sys
  class deny,gDeny,gErr bad
  class queue staff
  class ok,gOk end
```

**Steps**

1. **Staff action (e.g. edit product)** (start) — Path 1: permission check on every request.
2. **Session valid?** (dec) — Inactivity timeout.
3. **Login: password + 2FA (authenticator)** (step) — New device → alert to super admin.
4. **Effective permissions = union of all roles** (sys) — Staff can hold multiple roles.
5. **Super admin?** (dec)
6. **Has resource.action?** (dec) — e.g. products.edit, orders.book_courier, refunds.approve_high.
7. **403 + logged** (bad)
8. **Needs approval?** (dec) — v1: only refunds above the threshold.
9. **Send to approvers** (staff) — Holders of the approval permission get a notification.
10. **Execute + audit log** (sys) — Before/after values stored.
11. **Done** (end)
12. **Open role editor / assign roles** (start) — Path 2: managing roles.
13. **Has roles.manage / staff.assign_roles?** (dec) — Grantable permission, not only super admin.
14. **403** (bad)
15. **Every permission granted ⊆ own permissions?** (dec) — Nobody can grant more than they hold.
16. **Reject: cannot grant more than you have** (bad)
17. **Touches super admin or own account?** (dec) — Cannot edit/remove super admin, remove last super admin, or raise own permissions.
18. **Save + audit log** (sys) — Changed permissions apply on the next request.
19. **Role saved / assigned** (end)

## 7. Visitor tracking

Anonymous visitor ID → visits, events, pixels → linked to customer on login/order. Raw data kept forever.

```mermaid
flowchart TD
  hit(["Visitor opens site / app"])
  dCookie{{"Visitor-ID cookie exists?"}}
  newId["Create visitor ID"]
  notice["One-time cookie notice"]
  dVisit{{"Last activity > 30 min ago?"}}
  visit["Start new visit"]
  ev["Record events"]
  pix[/"Fire pixels"/]
  use["Feed site features"]
  dId{{"Logs in / registers / orders with phone?"}}
  link["Link visitor ID ↔ customer"]
  dAband{{"Cart idle > N hours AND email known?"}}
  mail[/"Abandoned-cart email"/]
  store["Storage"]
  end_(["Visible in admin analytics"])
  hit --> dCookie
  dCookie -->|"no"| newId
  newId --> notice
  notice --> dVisit
  dCookie -->|"yes"| dVisit
  dVisit -->|"yes"| visit
  dVisit -->|"no"| ev
  visit --> ev
  ev --> pix
  ev --> use
  ev --> dId
  dId -->|"yes"| link
  dId -->|"no"| dAband
  link --> dAband
  dAband -->|"yes"| mail
  dAband -->|"no"| store
  mail --> store
  pix --> store
  use --> store
  store --> end_
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef step fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  classDef ext fill:#cffafe,stroke:#0891b2,color:#164e63,stroke-dasharray:4 3
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class hit start
  class dCookie,dVisit,dId,dAband dec
  class newId,visit,ev,use,link,store sys
  class notice step
  class pix,mail ext
  class end_ end
```

**Steps**

1. **Visitor opens site / app** (start)
2. **Visitor-ID cookie exists?** (dec) — App uses an install ID instead.
3. **Create visitor ID** (sys) — First-party, long-lived cookie (~2 years).
4. **One-time cookie notice** (step) — Dismissible; links to privacy policy.
5. **Last activity > 30 min ago?** (dec)
6. **Start new visit** (sys) — visits++; record source (UTM, Facebook, TikTok, Google, direct), device/browser, district from IP.
7. **Record events** (sys) — Page view, product view, search (+ zero results), add-to-cart, checkout start, order.
8. **Fire pixels** (ext) — FB Pixel + Conversions API (server side, shared event_id for de-dup), GA4, TikTok Pixel.
9. **Feed site features** (sys) — Recently viewed, similar/also-bought, home feed weighting, funnels, velocity fraud rules.
10. **Logs in / registers / orders with phone?** (dec)
11. **Link visitor ID ↔ customer** (sys) — Backfill history to the customer; merge carts.
12. **Cart idle > N hours AND email known?** (dec)
13. **Abandoned-cart email** (ext) — Email only (SMS too costly).
14. **Storage** (sys) — Raw events kept forever, partitioned by month; daily aggregates power admin dashboards.
15. **Visible in admin analytics** (end) — Visitors (new vs returning, visits per visitor), sources, funnel, top products, searches.

## 8. Dropship forwarding

Order lines from dropship suppliers: per-supplier mode decides direct-to-customer or via our warehouse.

```mermaid
flowchart TD
  start(["Order has dropship item(s)"])
  group["One shipment per supplier"]
  send["Order appears in supplier portal"]
  dConf{{"Supplier confirms stock in time?"}}
  alt["Find alternative or drop the line"]
  dMode{{"Supplier mode?"}}
  direct[/"Courier picks up at supplier"/]
  trk["Tracking ID from our booking"]
  toWh[/"Supplier delivers to our warehouse"/]
  recv["Receive & inspect"]
  merge["Join warehouse shipment"]
  payable["Record supplier payable"]
  end_(["Shipment on its way"])
  start --> group
  group --> send
  send --> dConf
  dConf -->|"no"| alt
  dConf -->|"yes"| dMode
  dMode -->|"direct"| direct
  direct --> trk
  dMode -->|"via warehouse"| toWh
  toWh --> recv
  recv --> merge
  trk --> payable
  merge --> payable
  payable --> end_
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef staff fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
  classDef ext fill:#cffafe,stroke:#0891b2,color:#164e63,stroke-dasharray:4 3
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class start start
  class group,send,merge,payable sys
  class dConf,dMode dec
  class alt,trk,recv staff
  class direct,toWh ext
  class end_ end
```

**Steps**

1. **Order has dropship item(s)** (start) — Order is in Processing.
2. **One shipment per supplier** (sys)
3. **Order appears in supplier portal** (sys) — Suppliers log in to their own portal: see their orders, confirm stock, mark ready for pickup.
4. **Supplier confirms stock in time?** (dec) — SLA per supplier (e.g. 24 h).
5. **Find alternative or drop the line** (staff) — Other supplier, or cancel the line → partial refund + customer notified.
6. **Supplier mode?** (dec) — Per-supplier setting.
7. **Courier picks up at supplier** (ext) — We book Steadfast/Pathao from our account with pickup at the supplier address, so we keep tracking and COD collection.
8. **Tracking ID from our booking** (staff) — Customer notified with tracking link; shipment = handed to courier.
9. **Supplier delivers to our warehouse** (ext)
10. **Receive & inspect** (staff) — Stock log entry.
11. **Join warehouse shipment** (sys) — Continues as normal pack → courier in "Order lifecycle".
12. **Record supplier payable** (sys) — Supplier cost × qty; shows in supplier ledger / reports.
13. **Shipment on its way** (end)

## 9. Rewards: points, referral, affiliate

Everything credited only after delivery + return window (order Completed), on the net amount after refunds.

```mermaid
flowchart TD
  signup(["New customer signs up with referral code"])
  welcome["Issue welcome coupon to new customer"]
  comp(["Order Completed"])
  net["Compute net amount"]
  pts["Credit loyalty points"]
  dRef{{"First completed order AND referred?"}}
  refC["Issue coupon to referrer"]
  dAff{{"Attributed to an affiliate?"}}
  comm["Commission approved"]
  month["Monthly payout run"]
  pay["Staff pays via bKash / bank"]
  dash["Affiliate dashboard"]
  exp["Nightly: expire old points"]
  end_(["Rewards settled"])
  signup --> welcome
  comp --> net
  net --> pts
  pts --> dRef
  dRef -->|"yes"| refC
  dRef -->|"no"| dAff
  refC --> dAff
  dAff -->|"yes"| comm
  dAff -->|"no"| exp
  comm --> month
  month --> pay
  pay --> dash
  dash --> exp
  exp --> end_
  classDef start fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef sys fill:#e2e8f0,stroke:#64748b,color:#1e293b
  classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f
  classDef staff fill:#ede9fe,stroke:#7c3aed,color:#4c1d95
  classDef step fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  classDef end fill:#ccfbf1,stroke:#0d9488,color:#134e4a
  class signup,comp start
  class welcome,net,pts,refC,comm,month,exp sys
  class dRef,dAff dec
  class pay staff
  class dash step
  class end_ end
```

**Steps**

1. **New customer signs up with referral code** (start) — Path A: referral signup.
2. **Issue welcome coupon to new customer** (sys) — Amount/rules set in admin.
3. **Order Completed** (start) — Path B: delivered + return window passed (from "Order lifecycle").
4. **Compute net amount** (sys) — Order total minus refunded/returned lines (discounts already allocated per line).
5. **Credit loyalty points** (sys) — net × earn rate; expiry date set (admin settings).
6. **First completed order AND referred?** (dec)
7. **Issue coupon to referrer** (sys) — Referrer notified.
8. **Attributed to an affiliate?** (dec) — Affiliate code used at checkout, or affiliate link click within the last 30 days. Code at checkout wins over a link.
9. **Commission approved** (sys) — % × net amount.
10. **Monthly payout run** (sys) — Sum approved commissions per affiliate.
11. **Staff pays via bKash / bank** (staff) — Marks paid with transaction reference.
12. **Affiliate dashboard** (step) — Clicks, orders, pending/approved/paid earnings.
13. **Nightly: expire old points** (sys) — Reminder notification before expiry.
14. **Rewards settled** (end)

