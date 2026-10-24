-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending_payment', 'processing', 'on_hold', 'partially_shipped', 'shipped', 'delivered', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'failed');

-- CreateEnum
CREATE TYPE "sr_sale_status" AS ENUM ('submitted', 'approved', 'rejected', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "ledger_type" AS ENUM ('sale_due', 'collection', 'adjustment');

-- CreateEnum
CREATE TYPE "supplier_ship_mode" AS ENUM ('direct_to_customer', 'via_warehouse');

-- CreateEnum
CREATE TYPE "po_status" AS ENUM ('draft', 'sent', 'partially_received', 'received', 'cancelled');

-- DropIndex
DROP INDEX "brands_name_trgm_idx";

-- DropIndex
DROP INDEX "products_title_trgm_idx";

-- CreateTable
CREATE TABLE "divisions" (
    "id" INTEGER NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" INTEGER NOT NULL,
    "division_id" INTEGER NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upazilas" (
    "id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,

    CONSTRAINT "upazilas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" SERIAL NOT NULL,
    "upazila_id" INTEGER NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_bn" TEXT,
    "base_charge_p" INTEGER NOT NULL,
    "base_weight_g" INTEGER NOT NULL DEFAULT 1000,
    "extra_per_kg_p" INTEGER NOT NULL DEFAULT 0,
    "eta_min_days" INTEGER NOT NULL,
    "eta_max_days" INTEGER NOT NULL,
    "free_above_p" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_locations" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "district_id" INTEGER,
    "upazila_id" INTEGER,
    "area_id" INTEGER,

    CONSTRAINT "zone_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "district_id" INTEGER NOT NULL,
    "upazila_id" INTEGER NOT NULL,
    "area_id" INTEGER,
    "line" TEXT NOT NULL,
    "landmark" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "visitor_id" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abandoned_notified_at" TIMESTAMPTZ,
    "merged_into_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "price_at_add_p" INTEGER NOT NULL,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_no" TEXT NOT NULL,
    "customer_id" UUID,
    "guest_name" TEXT,
    "guest_phone" TEXT,
    "guest_email" TEXT,
    "visitor_id" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "ip" TEXT,
    "user_agent" TEXT,
    "lang" "lang" NOT NULL DEFAULT 'en',
    "ship_name" TEXT NOT NULL,
    "ship_phone" TEXT NOT NULL,
    "ship_division_id" INTEGER NOT NULL,
    "ship_district_id" INTEGER NOT NULL,
    "ship_upazila_id" INTEGER NOT NULL,
    "ship_area_id" INTEGER,
    "ship_place_text" TEXT NOT NULL,
    "ship_line" TEXT NOT NULL,
    "ship_landmark" TEXT,
    "zone_id" UUID NOT NULL,
    "customer_note" TEXT,
    "status" "order_status" NOT NULL DEFAULT 'processing',
    "payment_status" "payment_status" NOT NULL DEFAULT 'unpaid',
    "payment_method_chosen" TEXT NOT NULL DEFAULT 'cod',
    "is_preorder" BOOLEAN NOT NULL DEFAULT false,
    "cancel_reason" TEXT,
    "held_reason" TEXT,
    "subtotal_p" INTEGER NOT NULL,
    "auto_discount_p" INTEGER NOT NULL DEFAULT 0,
    "coupon_discount_p" INTEGER NOT NULL DEFAULT 0,
    "delivery_charge_p" INTEGER NOT NULL,
    "delivery_discount_p" INTEGER NOT NULL DEFAULT 0,
    "grand_total_p" INTEGER NOT NULL,
    "advance_required_p" INTEGER NOT NULL DEFAULT 0,
    "paid_p" INTEGER NOT NULL DEFAULT 0,
    "refunded_p" INTEGER NOT NULL DEFAULT 0,
    "cod_due_p" INTEGER NOT NULL,
    "guest_otp_verified_at" TIMESTAMPTZ,
    "placed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "options_text" TEXT,
    "image_media_id" UUID,
    "qty" INTEGER NOT NULL,
    "qty_cancelled" INTEGER NOT NULL DEFAULT 0,
    "qty_returned" INTEGER NOT NULL DEFAULT 0,
    "unit_base_p" INTEGER NOT NULL,
    "unit_price_p" INTEGER NOT NULL,
    "price_source" TEXT NOT NULL,
    "weight_g" INTEGER,
    "return_window_days" INTEGER,
    "line_total_p" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "amount_p" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "provider" TEXT,
    "provider_txn_id" TEXT,
    "initiated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sr_profiles" (
    "staff_id" UUID NOT NULL,
    "area" TEXT,
    "commission_bp" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sr_profiles_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE "b2b_shops" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "owner_name" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "area" TEXT,
    "created_by_id" UUID NOT NULL,
    "is_new" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "due_balance_p" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "b2b_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sr_sales" (
    "id" UUID NOT NULL,
    "memo_no" TEXT NOT NULL,
    "sr_staff_id" UUID NOT NULL,
    "b2b_shop_id" UUID NOT NULL,
    "status" "sr_sale_status" NOT NULL DEFAULT 'submitted',
    "total_p" INTEGER NOT NULL,
    "paid_at_sale_p" INTEGER NOT NULL DEFAULT 0,
    "due_p" INTEGER NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ,
    "rejected_reason" TEXT,
    "delivered_by_id" UUID,
    "delivered_at" TIMESTAMPTZ,
    "note" TEXT,

    CONSTRAINT "sr_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sr_sale_items" (
    "id" UUID NOT NULL,
    "sr_sale_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_p" INTEGER NOT NULL,
    "line_total_p" INTEGER NOT NULL,

    CONSTRAINT "sr_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_ledger" (
    "id" UUID NOT NULL,
    "b2b_shop_id" UUID NOT NULL,
    "sr_sale_id" UUID,
    "type" "ledger_type" NOT NULL,
    "amount_p" INTEGER NOT NULL,
    "method" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "note" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sr_targets" (
    "id" UUID NOT NULL,
    "sr_staff_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "target_p" INTEGER NOT NULL,

    CONSTRAINT "sr_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sr_commissions" (
    "id" UUID NOT NULL,
    "sr_staff_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "base_p" INTEGER NOT NULL,
    "commission_bp" INTEGER NOT NULL,
    "amount_p" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "sr_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "ship_mode" "supplier_ship_mode" NOT NULL DEFAULT 'via_warehouse',
    "payment_terms" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_suppliers" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_sku" TEXT,
    "cost_p" INTEGER,
    "lead_time_days" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "variant_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "po_no" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" "po_status" NOT NULL DEFAULT 'draft',
    "expected_at" DATE,
    "subtotal_p" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "qty_ordered" INTEGER NOT NULL,
    "qty_received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost_p" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "districts_division_id_idx" ON "districts"("division_id");

-- CreateIndex
CREATE INDEX "upazilas_district_id_idx" ON "upazilas"("district_id");

-- CreateIndex
CREATE INDEX "areas_upazila_id_idx" ON "areas"("upazila_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_locations_district_id_key" ON "zone_locations"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_locations_upazila_id_key" ON "zone_locations"("upazila_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_locations_area_id_key" ON "zone_locations"("area_id");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE INDEX "carts_customer_id_idx" ON "carts"("customer_id");

-- CreateIndex
CREATE INDEX "carts_visitor_id_idx" ON "carts"("visitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_variant_id_key" ON "cart_items"("cart_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_guest_phone_idx" ON "orders"("guest_phone");

-- CreateIndex
CREATE INDEX "orders_status_placed_at_idx" ON "orders"("status", "placed_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_at_idx" ON "order_status_history"("order_id", "at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "b2b_shops_phone_idx" ON "b2b_shops"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sr_sales_memo_no_key" ON "sr_sales"("memo_no");

-- CreateIndex
CREATE INDEX "sr_sales_sr_staff_id_submitted_at_idx" ON "sr_sales"("sr_staff_id", "submitted_at");

-- CreateIndex
CREATE INDEX "sr_sales_b2b_shop_id_idx" ON "sr_sales"("b2b_shop_id");

-- CreateIndex
CREATE INDEX "sr_sales_status_idx" ON "sr_sales"("status");

-- CreateIndex
CREATE INDEX "sr_sale_items_sr_sale_id_idx" ON "sr_sale_items"("sr_sale_id");

-- CreateIndex
CREATE INDEX "b2b_ledger_b2b_shop_id_at_idx" ON "b2b_ledger"("b2b_shop_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "sr_targets_sr_staff_id_month_key" ON "sr_targets"("sr_staff_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "sr_commissions_sr_staff_id_month_key" ON "sr_commissions"("sr_staff_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "variant_suppliers_variant_id_supplier_id_key" ON "variant_suppliers"("variant_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_no_key" ON "purchase_orders"("po_no");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_po_id_idx" ON "purchase_order_items"("po_id");

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upazilas" ADD CONSTRAINT "upazilas_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "upazilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_locations" ADD CONSTRAINT "zone_locations_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_locations" ADD CONSTRAINT "zone_locations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_locations" ADD CONSTRAINT "zone_locations_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "upazilas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_locations" ADD CONSTRAINT "zone_locations_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "upazilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_profiles" ADD CONSTRAINT "sr_profiles_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_shops" ADD CONSTRAINT "b2b_shops_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_sales" ADD CONSTRAINT "sr_sales_sr_staff_id_fkey" FOREIGN KEY ("sr_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_sales" ADD CONSTRAINT "sr_sales_b2b_shop_id_fkey" FOREIGN KEY ("b2b_shop_id") REFERENCES "b2b_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_sales" ADD CONSTRAINT "sr_sales_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_sales" ADD CONSTRAINT "sr_sales_delivered_by_id_fkey" FOREIGN KEY ("delivered_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_sale_items" ADD CONSTRAINT "sr_sale_items_sr_sale_id_fkey" FOREIGN KEY ("sr_sale_id") REFERENCES "sr_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_sale_items" ADD CONSTRAINT "sr_sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_ledger" ADD CONSTRAINT "b2b_ledger_b2b_shop_id_fkey" FOREIGN KEY ("b2b_shop_id") REFERENCES "b2b_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_ledger" ADD CONSTRAINT "b2b_ledger_sr_sale_id_fkey" FOREIGN KEY ("sr_sale_id") REFERENCES "sr_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_ledger" ADD CONSTRAINT "b2b_ledger_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_ledger" ADD CONSTRAINT "b2b_ledger_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_targets" ADD CONSTRAINT "sr_targets_sr_staff_id_fkey" FOREIGN KEY ("sr_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_commissions" ADD CONSTRAINT "sr_commissions_sr_staff_id_fkey" FOREIGN KEY ("sr_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_suppliers" ADD CONSTRAINT "variant_suppliers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_suppliers" ADD CONSTRAINT "variant_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Running numbers (C32): formatted in code as YYMM-NNNNN, SR-YYMM-NNNNN, PO-YYMM-NNNNN.
CREATE SEQUENCE "order_no_seq" START 1;
CREATE SEQUENCE "sr_memo_no_seq" START 1;
CREATE SEQUENCE "po_no_seq" START 1;

-- Zone location: exactly one level set.
ALTER TABLE "zone_locations" ADD CONSTRAINT "zone_locations_one_level"
  CHECK (num_nonnulls("district_id", "upazila_id", "area_id") = 1);
-- One default delivery zone.
CREATE UNIQUE INDEX "delivery_zones_one_default" ON "delivery_zones" ("is_default") WHERE "is_default";
-- One live cart per customer and per guest visitor.
CREATE UNIQUE INDEX "carts_live_customer" ON "carts" ("customer_id") WHERE "customer_id" IS NOT NULL AND "merged_into_id" IS NULL;
CREATE UNIQUE INDEX "carts_live_visitor" ON "carts" ("visitor_id") WHERE "customer_id" IS NULL AND "merged_into_id" IS NULL;
-- Quantities sanity.
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_qty_pos" CHECK ("qty" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_qty_pos" CHECK ("qty" > 0);
ALTER TABLE "sr_sale_items" ADD CONSTRAINT "sr_sale_items_qty_pos" CHECK ("qty" > 0);
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "po_items_qty_pos" CHECK ("qty_ordered" > 0 AND "qty_received" >= 0);

-- b2b_ledger is append-only like stock_movements; the only allowed UPDATE is staff
-- confirming a collection once (confirmed_by_id + confirmed_at).
CREATE FUNCTION b2b_ledger_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'b2b_ledger is append-only';
  END IF;
  IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL
     AND (to_jsonb(NEW) - 'confirmed_at' - 'confirmed_by_id') = (to_jsonb(OLD) - 'confirmed_at' - 'confirmed_by_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'b2b_ledger rows can only be confirmed once, never edited';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER b2b_ledger_append_only BEFORE UPDATE OR DELETE ON "b2b_ledger"
  FOR EACH ROW EXECUTE FUNCTION b2b_ledger_guard();
