-- CreateTable
CREATE TABLE "sr_commission_adjustments" (
    "id" UUID NOT NULL,
    "sr_staff_id" UUID NOT NULL,
    "sr_sale_id" UUID,
    "amount_p" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "applied_to_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sr_commission_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sr_commission_adjustments_sr_staff_id_applied_to_id_idx" ON "sr_commission_adjustments"("sr_staff_id", "applied_to_id");

-- AddForeignKey
ALTER TABLE "sr_commission_adjustments" ADD CONSTRAINT "sr_commission_adjustments_sr_staff_id_fkey" FOREIGN KEY ("sr_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_commission_adjustments" ADD CONSTRAINT "sr_commission_adjustments_sr_sale_id_fkey" FOREIGN KEY ("sr_sale_id") REFERENCES "sr_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sr_commission_adjustments" ADD CONSTRAINT "sr_commission_adjustments_applied_to_id_fkey" FOREIGN KEY ("applied_to_id") REFERENCES "sr_commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

