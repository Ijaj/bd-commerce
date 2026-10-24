-- CreateEnum
CREATE TYPE "call_status" AS ENUM ('not_needed', 'pending', 'confirmed', 'unreachable', 'cancelled');

-- CreateEnum
CREATE TYPE "shipment_source" AS ENUM ('warehouse', 'supplier');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('pending', 'awaiting_supplier', 'supplier_confirmed', 'ready', 'booked', 'handed_over', 'in_transit', 'delivered', 'failed', 'returning', 'returned', 'cancelled');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('requested', 'booked', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "return_status" AS ENUM ('requested', 'approved', 'rejected', 'pickup_booked', 'received', 'inspected', 'closed');

-- CreateEnum
CREATE TYPE "return_fault" AS ENUM ('ours', 'customer');

-- CreateEnum
CREATE TYPE "return_reason" AS ENUM ('wrong_item', 'damaged', 'defective', 'not_as_described', 'change_of_mind', 'other');

-- CreateEnum
CREATE TYPE "return_condition" AS ENUM ('resellable', 'damaged');

-- CreateEnum
CREATE TYPE "refund_method" AS ENUM ('original', 'wallet');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('pending_approval', 'approved', 'rejected', 'processing', 'done', 'failed');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "call_at" TIMESTAMPTZ,
ADD COLUMN     "call_note" TEXT,
ADD COLUMN     "call_staff_id" UUID,
ADD COLUMN     "call_status" "call_status" NOT NULL DEFAULT 'not_needed',
ADD COLUMN     "risk_reasons" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "risk_score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "couriers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "shipment_no" TEXT NOT NULL,
    "seller_id" UUID NOT NULL,
    "source" "shipment_source" NOT NULL DEFAULT 'warehouse',
    "supplier_id" UUID,
    "status" "shipment_status" NOT NULL DEFAULT 'pending',
    "weight_g" INTEGER,
    "cod_amount_p" INTEGER NOT NULL DEFAULT 0,
    "delivery_charge_share_p" INTEGER NOT NULL DEFAULT 0,
    "courier_id" UUID,
    "consignment_id" TEXT,
    "tracking_url" TEXT,
    "note" TEXT,
    "packed_at" TIMESTAMPTZ,
    "handed_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_bookings" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "courier_id" UUID NOT NULL,
    "pickup" TEXT NOT NULL DEFAULT 'warehouse',
    "direction" TEXT NOT NULL DEFAULT 'delivery',
    "request" JSONB,
    "response" JSONB,
    "consignment_id" TEXT,
    "status" "booking_status" NOT NULL DEFAULT 'requested',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_status_events" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "raw_status" TEXT NOT NULL,
    "mapped_status" TEXT,
    "payload" JSONB,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vat_rate_bp" INTEGER NOT NULL,
    "vat_total_p" INTEGER NOT NULL,
    "grand_total_p" INTEGER NOT NULL,
    "bin_snapshot" TEXT,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" UUID NOT NULL,
    "return_no" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID,
    "status" "return_status" NOT NULL DEFAULT 'requested',
    "fault" "return_fault",
    "return_shipping_p" INTEGER NOT NULL DEFAULT 0,
    "pickup_booking_id" UUID,
    "staff_id" UUID,
    "note" TEXT,
    "reject_reason" TEXT,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" "return_reason" NOT NULL,
    "note" TEXT,
    "condition" "return_condition",
    "restock" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_media" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,

    CONSTRAINT "return_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "return_id" UUID,
    "amount_p" INTEGER NOT NULL,
    "method" "refund_method" NOT NULL,
    "status" "refund_status" NOT NULL DEFAULT 'pending_approval',
    "needs_approval" BOOLEAN NOT NULL DEFAULT false,
    "requested_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "provider_ref" TEXT,
    "note" TEXT,
    "done_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_items" (
    "id" UUID NOT NULL,
    "refund_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "amount_p" INTEGER NOT NULL,

    CONSTRAINT "refund_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "couriers_code_key" ON "couriers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipment_no_key" ON "shipments"("shipment_no");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_consignment_id_idx" ON "shipments"("consignment_id");

-- CreateIndex
CREATE INDEX "shipment_items_order_item_id_idx" ON "shipment_items"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_items_shipment_id_order_item_id_key" ON "shipment_items"("shipment_id", "order_item_id");

-- CreateIndex
CREATE INDEX "courier_bookings_shipment_id_idx" ON "courier_bookings"("shipment_id");

-- CreateIndex
CREATE INDEX "courier_bookings_consignment_id_idx" ON "courier_bookings"("consignment_id");

-- CreateIndex
CREATE INDEX "courier_status_events_booking_id_at_idx" ON "courier_status_events"("booking_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "returns_return_no_key" ON "returns"("return_no");

-- CreateIndex
CREATE INDEX "returns_order_id_idx" ON "returns"("order_id");

-- CreateIndex
CREATE INDEX "returns_status_idx" ON "returns"("status");

-- CreateIndex
CREATE INDEX "return_items_return_id_idx" ON "return_items"("return_id");

-- CreateIndex
CREATE INDEX "return_items_order_item_id_idx" ON "return_items"("order_item_id");

-- CreateIndex
CREATE INDEX "return_media_return_id_idx" ON "return_media"("return_id");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE INDEX "refunds_return_id_idx" ON "refunds"("return_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refund_items_refund_id_idx" ON "refund_items"("refund_id");

-- CreateIndex
CREATE INDEX "orders_call_status_placed_at_idx" ON "orders"("call_status", "placed_at");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_bookings" ADD CONSTRAINT "courier_bookings_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_bookings" ADD CONSTRAINT "courier_bookings_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_status_events" ADD CONSTRAINT "courier_status_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "courier_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_media" ADD CONSTRAINT "return_media_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written: numbering sequences, sanity checks, courier rows.
CREATE SEQUENCE shipment_no_seq;
CREATE SEQUENCE invoice_no_seq;
CREATE SEQUENCE return_no_seq;

ALTER TABLE shipment_items ADD CONSTRAINT shipment_items_qty_pos CHECK (qty > 0);
ALTER TABLE return_items ADD CONSTRAINT return_items_qty_pos CHECK (qty > 0);
ALTER TABLE refund_items ADD CONSTRAINT refund_items_qty_pos CHECK (qty > 0);
ALTER TABLE refunds ADD CONSTRAINT refunds_amount_pos CHECK (amount_p > 0);
-- At most one live booking per shipment and direction (rebooking keeps history as cancelled/failed).
CREATE UNIQUE INDEX courier_bookings_one_live ON courier_bookings (shipment_id, direction)
  WHERE status IN ('requested', 'booked');

INSERT INTO couriers (id, code, name, is_active) VALUES
  (gen_random_uuid(), 'steadfast', 'Steadfast', true),
  (gen_random_uuid(), 'pathao', 'Pathao', true),
  (gen_random_uuid(), 'fake', 'Fake courier (dev/test)', false);
