-- CreateEnum
CREATE TYPE "sr_delivery_by" AS ENUM ('sr', 'staff');

-- AlterEnum
ALTER TYPE "ledger_type" ADD VALUE 'reversal';

-- AlterEnum
ALTER TYPE "sr_sale_status" ADD VALUE 'reversed';

-- AlterTable
ALTER TABLE "b2b_ledger" ADD COLUMN     "reject_reason" TEXT,
ADD COLUMN     "rejected_at" TIMESTAMPTZ,
ADD COLUMN     "rejected_by_id" UUID;

-- AlterTable
ALTER TABLE "sr_sales" ADD COLUMN     "delivery_by" "sr_delivery_by" NOT NULL DEFAULT 'staff',
ADD COLUMN     "memo_token" TEXT,
ADD COLUMN     "memo_token_at" TIMESTAMPTZ,
ADD COLUMN     "reverse_reason" TEXT,
ADD COLUMN     "reversed_at" TIMESTAMPTZ,
ADD COLUMN     "reversed_by_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "sr_sales_memo_token_key" ON "sr_sales"("memo_token");

-- AddForeignKey
ALTER TABLE "sr_sales" ADD CONSTRAINT "sr_sales_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_ledger" ADD CONSTRAINT "b2b_ledger_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Ledger guard (C43): the only allowed UPDATE is resolving a pending row once —
-- either confirm (confirmed_by_id + confirmed_at) or reject (rejected_by_id + rejected_at + reject_reason).
CREATE OR REPLACE FUNCTION b2b_ledger_guard() RETURNS trigger AS $$
DECLARE
  resolve_cols text[] := ARRAY['confirmed_at', 'confirmed_by_id', 'rejected_at', 'rejected_by_id', 'reject_reason'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'b2b_ledger is append-only';
  END IF;
  IF OLD.confirmed_at IS NULL AND OLD.rejected_at IS NULL
     AND ((NEW.confirmed_at IS NOT NULL) <> (NEW.rejected_at IS NOT NULL))
     AND (to_jsonb(NEW) - resolve_cols) = (to_jsonb(OLD) - resolve_cols) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'b2b_ledger rows can only be confirmed or rejected once, never edited';
END;
$$ LANGUAGE plpgsql;
