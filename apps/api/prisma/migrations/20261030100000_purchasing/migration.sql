-- CreateEnum
CREATE TYPE "supplier_ledger_type" AS ENUM ('receipt', 'payment', 'adjustment', 'dropship', 'reversal');

-- AlterEnum
ALTER TYPE "po_status" ADD VALUE 'closed';

-- DropIndex
DROP INDEX "purchase_order_items_po_id_idx";

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "qty_rejected" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "close_reason" TEXT,
ADD COLUMN     "closed_at" TIMESTAMPTZ,
ADD COLUMN     "closed_by_id" UUID,
ADD COLUMN     "sent_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "pickup_address" TEXT;

-- CreateTable
CREATE TABLE "po_receipts" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "total_p" INTEGER NOT NULL,
    "note" TEXT,
    "received_by_id" UUID NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "po_item_id" UUID NOT NULL,
    "qty_good" INTEGER NOT NULL,
    "qty_rejected" INTEGER NOT NULL,
    "unit_cost_p" INTEGER NOT NULL,
    "cost_before_p" INTEGER,
    "cost_after_p" INTEGER,

    CONSTRAINT "po_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ledger" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "type" "supplier_ledger_type" NOT NULL,
    "amount_p" INTEGER NOT NULL,
    "po_receipt_id" UUID,
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "reverses_id" UUID,
    "recorded_by_id" UUID NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "po_receipts_po_id_idx" ON "po_receipts"("po_id");

-- CreateIndex
CREATE INDEX "po_receipt_items_receipt_id_idx" ON "po_receipt_items"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_ledger_po_receipt_id_key" ON "supplier_ledger"("po_receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_ledger_reverses_id_key" ON "supplier_ledger"("reverses_id");

-- CreateIndex
CREATE INDEX "supplier_ledger_supplier_id_at_idx" ON "supplier_ledger"("supplier_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_po_id_variant_id_key" ON "purchase_order_items"("po_id", "variant_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_created_at_idx" ON "purchase_orders"("status", "created_at");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_receipts" ADD CONSTRAINT "po_receipts_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_receipts" ADD CONSTRAINT "po_receipts_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_receipt_items" ADD CONSTRAINT "po_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "po_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_receipt_items" ADD CONSTRAINT "po_receipt_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_po_receipt_id_fkey" FOREIGN KEY ("po_receipt_id") REFERENCES "po_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "supplier_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Payables ledger and receipts are append-only (C76; doc 12 §0). TRUNCATE (tests) is not affected.
CREATE FUNCTION purchasing_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER supplier_ledger_append_only
  BEFORE UPDATE OR DELETE ON "supplier_ledger"
  FOR EACH ROW EXECUTE FUNCTION purchasing_append_only();

CREATE TRIGGER po_receipts_append_only
  BEFORE UPDATE OR DELETE ON "po_receipts"
  FOR EACH ROW EXECUTE FUNCTION purchasing_append_only();

CREATE TRIGGER po_receipt_items_append_only
  BEFORE UPDATE OR DELETE ON "po_receipt_items"
  FOR EACH ROW EXECUTE FUNCTION purchasing_append_only();

-- Ledger sign rules: receipt/dropship add what we owe, payment reduces it.
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_sign_chk" CHECK (
  ("type" IN ('receipt', 'dropship') AND "amount_p" > 0)
  OR ("type" = 'payment' AND "amount_p" < 0)
  OR ("type" IN ('adjustment', 'reversal') AND "amount_p" <> 0)
);
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_qty_chk" CHECK (
  "qty_ordered" > 0 AND "unit_cost_p" >= 0 AND "qty_received" >= 0 AND "qty_rejected" >= 0
  AND "qty_received" + "qty_rejected" <= "qty_ordered"
);
