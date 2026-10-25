-- CreateEnum
CREATE TYPE "coupon_kind" AS ENUM ('code', 'auto');

-- CreateEnum
CREATE TYPE "coupon_type" AS ENUM ('percent', 'fixed', 'free_delivery', 'bxgy', 'tiered', 'bundle');

-- CreateEnum
CREATE TYPE "coupon_status" AS ENUM ('draft', 'active', 'paused');

-- CreateEnum
CREATE TYPE "coupon_visibility" AS ENUM ('public', 'hidden');

-- CreateEnum
CREATE TYPE "coupon_segment" AS ENUM ('all', 'first_order', 'specific', 'inactive_days');

-- CreateEnum
CREATE TYPE "coupon_platform" AS ENUM ('web', 'app', 'both');

-- CreateEnum
CREATE TYPE "coupon_source" AS ENUM ('manual', 'referral_signup', 'referral_reward', 'system');

-- CreateEnum
CREATE TYPE "redemption_status" AS ENUM ('applied', 'reversed');

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "coupon_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "discount_p" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "flash_sale_item_id" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discounts_json" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "coupon_kind" NOT NULL,
    "code" TEXT,
    "is_bulk" BOOLEAN NOT NULL DEFAULT false,
    "terms_en" TEXT,
    "terms_bn" TEXT,
    "visibility" "coupon_visibility" NOT NULL DEFAULT 'hidden',
    "is_collectable" BOOLEAN NOT NULL DEFAULT false,
    "status" "coupon_status" NOT NULL DEFAULT 'draft',
    "type" "coupon_type" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "max_discount_p" INTEGER,
    "config" JSONB NOT NULL DEFAULT '{}',
    "min_order_p" INTEGER,
    "min_qty" INTEGER,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "segment" "coupon_segment" NOT NULL DEFAULT 'all',
    "segment_param" INTEGER,
    "payment_methods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "platform" "coupon_platform" NOT NULL DEFAULT 'both',
    "max_uses_total" INTEGER,
    "max_per_customer" INTEGER,
    "max_per_phone" INTEGER,
    "max_per_device" INTEGER,
    "budget_cap_p" INTEGER,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "discount_given_p" INTEGER NOT NULL DEFAULT 0,
    "stacks_with_sale_price" BOOLEAN NOT NULL DEFAULT false,
    "stacks_with_other_coupons" BOOLEAN NOT NULL DEFAULT false,
    "stacks_with_points" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "source" "coupon_source" NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_targets" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "mode" TEXT NOT NULL,

    CONSTRAINT "coupon_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_zones" (
    "coupon_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,

    CONSTRAINT "coupon_zones_pkey" PRIMARY KEY ("coupon_id","zone_id")
);

-- CreateTable
CREATE TABLE "coupon_tiers" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "min_spend_p" INTEGER NOT NULL,
    "discount_p" INTEGER NOT NULL,

    CONSTRAINT "coupon_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_customers" (
    "coupon_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,

    CONSTRAINT "coupon_customers_pkey" PRIMARY KEY ("coupon_id","customer_id")
);

-- CreateTable
CREATE TABLE "coupon_codes" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "assigned_customer_id" UUID,
    "used_at" TIMESTAMPTZ,

    CONSTRAINT "coupon_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_wallet" (
    "customer_id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "collected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_wallet_pkey" PRIMARY KEY ("customer_id","coupon_id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "coupon_code_id" UUID,
    "order_id" UUID NOT NULL,
    "customer_id" UUID,
    "phone" TEXT,
    "visitor_id" TEXT,
    "discount_p" INTEGER NOT NULL,
    "status" "redemption_status" NOT NULL DEFAULT 'applied',
    "reversed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flash_sales" (
    "id" UUID NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_bn" TEXT,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flash_sale_items" (
    "id" UUID NOT NULL,
    "flash_sale_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "flash_price_p" INTEGER NOT NULL,
    "qty_limit" INTEGER NOT NULL,
    "qty_sold" INTEGER NOT NULL DEFAULT 0,
    "per_customer_limit" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "flash_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_batches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone_at" TIMESTAMPTZ,

    CONSTRAINT "sale_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_batch_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "prev_sale_price_p" INTEGER,
    "prev_sale_starts_at" TIMESTAMPTZ,
    "prev_sale_ends_at" TIMESTAMPTZ,
    "new_sale_price_p" INTEGER NOT NULL,

    CONSTRAINT "sale_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_kind_status_idx" ON "coupons"("kind", "status");

-- CreateIndex
CREATE INDEX "coupon_targets_coupon_id_idx" ON "coupon_targets"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_tiers_coupon_id_idx" ON "coupon_tiers"("coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_codes_code_key" ON "coupon_codes"("code");

-- CreateIndex
CREATE INDEX "coupon_codes_coupon_id_idx" ON "coupon_codes"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_status_idx" ON "coupon_redemptions"("coupon_id", "status");

-- CreateIndex
CREATE INDEX "coupon_redemptions_customer_id_idx" ON "coupon_redemptions"("customer_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_phone_idx" ON "coupon_redemptions"("phone");

-- CreateIndex
CREATE INDEX "coupon_redemptions_visitor_id_idx" ON "coupon_redemptions"("visitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_coupon_id_key" ON "coupon_redemptions"("order_id", "coupon_id");

-- CreateIndex
CREATE INDEX "flash_sales_starts_at_ends_at_idx" ON "flash_sales"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "flash_sale_items_variant_id_idx" ON "flash_sale_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "flash_sale_items_flash_sale_id_variant_id_key" ON "flash_sale_items"("flash_sale_id", "variant_id");

-- CreateIndex
CREATE INDEX "sale_batch_items_batch_id_idx" ON "sale_batch_items"("batch_id");

-- CreateIndex
CREATE INDEX "sale_batch_items_variant_id_idx" ON "sale_batch_items"("variant_id");

-- AddForeignKey
ALTER TABLE "coupon_targets" ADD CONSTRAINT "coupon_targets_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_zones" ADD CONSTRAINT "coupon_zones_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_zones" ADD CONSTRAINT "coupon_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_tiers" ADD CONSTRAINT "coupon_tiers_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_customers" ADD CONSTRAINT "coupon_customers_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_customers" ADD CONSTRAINT "coupon_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_codes" ADD CONSTRAINT "coupon_codes_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_codes" ADD CONSTRAINT "coupon_codes_assigned_customer_id_fkey" FOREIGN KEY ("assigned_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_wallet" ADD CONSTRAINT "coupon_wallet_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_wallet" ADD CONSTRAINT "coupon_wallet_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_code_id_fkey" FOREIGN KEY ("coupon_code_id") REFERENCES "coupon_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sale_items" ADD CONSTRAINT "flash_sale_items_flash_sale_id_fkey" FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sale_items" ADD CONSTRAINT "flash_sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_batch_items" ADD CONSTRAINT "sale_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "sale_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_batch_items" ADD CONSTRAINT "sale_batch_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integrity the schema cannot express.
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_window_check" CHECK ("ends_at" > "starts_at");
ALTER TABLE "flash_sale_items"
  ADD CONSTRAINT "flash_sale_items_price_check" CHECK ("flash_price_p" > 0),
  ADD CONSTRAINT "flash_sale_items_qty_check" CHECK ("qty_limit" > 0 AND "qty_sold" >= 0 AND "qty_sold" <= "qty_limit"),
  ADD CONSTRAINT "flash_sale_items_per_customer_check" CHECK ("per_customer_limit" IS NULL OR "per_customer_limit" > 0);
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_code_upper_check" CHECK ("code" IS NULL OR "code" = upper("code")),
  ADD CONSTRAINT "coupons_value_check" CHECK ("value" >= 0),
  ADD CONSTRAINT "coupons_code_kind_check" CHECK ("kind" = 'code' OR "code" IS NULL);
ALTER TABLE "coupon_codes" ADD CONSTRAINT "coupon_codes_upper_check" CHECK ("code" = upper("code"));
ALTER TABLE "coupon_targets"
  ADD CONSTRAINT "coupon_targets_type_check" CHECK ("target_type" IN ('product', 'category', 'brand')),
  ADD CONSTRAINT "coupon_targets_mode_check" CHECK ("mode" IN ('include', 'exclude'));
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_discount_check" CHECK ("discount_p" >= 0);
CREATE INDEX "flash_sale_items_active_idx" ON "flash_sale_items" ("variant_id") WHERE "qty_sold" < "qty_limit";
