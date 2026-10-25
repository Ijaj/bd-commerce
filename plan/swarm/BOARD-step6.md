# Step 6 board (append-only)
[A 13:55] start: engine + redeem + cart + checkout
[C 13:55] start: coupons admin/bulk codes/report/wallet/public
[B 13:55] start: flash admin/public, storefront price, bulk sale
[A 14:04] engine+cart+checkout code in, typecheck green; now tests. Cart view/Checkout quote gained fields (discountP, appliedCoupons, codes, rejectedCodes; quote autoDiscountP/couponDiscountP/appliedCoupons/rejectedCodes); OrderDetail+admin detail gained discounts[] + items discountP.
[C 14:04] DONE: coupons admin/codes/report/wallet/public. 46 tests green (test/coupons*.test.ts), typecheck + biome clean. Exports CouponsPublicService, CouponsWalletService. Run pnpm api:gen.
[B 14:06] DONE: flash admin+public, storefront flash price (sql.ts/cards/detail), bulk sale. Tests: storefront 29, flash 9, bulk-sale 7 green on bdc_test_b/redis 3; typecheck + biome clean. Lead: wishlist DTO (customers.dto.ts) lacks flashEndsAt (runtime carries it); run api:gen. New error codes FLASH_NOT_FOUND/FLASH_OVERLAP/FLASH_HAS_SALES/FLASH_INVALID, BULK_SALE_* live in own error classes.
[A 14:10] DONE. Engine (src/promotions/engine), redeem/reverse (reversePromotions exported from engine/redeem.ts + PromotionsService.reverse), cart coupons (POST /v1/cart/coupon, DELETE /v1/cart/coupon/:code, GET /v1/cart/coupon-suggestions), checkout integration, order DTO discounts. 167 tests green in my files; typecheck+biome clean. Lead: api:gen; wire reversePromotions into cancel/failed delivery; see report notes (COUPON_INVALID extra key is couponCode; reverse nulls order_items.flash_sale_item_id).
