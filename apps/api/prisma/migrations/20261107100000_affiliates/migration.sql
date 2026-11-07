-- CreateEnum
CREATE TYPE "affiliate_status" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "affiliate_attribution" AS ENUM ('link', 'code');

-- CreateEnum
CREATE TYPE "affiliate_commission_status" AS ENUM ('pending', 'approved', 'reversed', 'paid');

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "affiliate_code" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "affiliate_attribution" "affiliate_attribution",
ADD COLUMN     "affiliate_id" UUID;

-- CreateTable
CREATE TABLE "affiliates" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "website" TEXT,
    "commission_bp" INTEGER,
    "status" "affiliate_status" NOT NULL DEFAULT 'active',
    "suspended_at" TIMESTAMPTZ,
    "suspended_reason" TEXT,
    "payout_method" TEXT,
    "payout_details_enc" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "landing_url" TEXT NOT NULL,
    "utm" JSONB,
    "ip" TEXT,
    "clicked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commissions" (
    "id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "commission_bp" INTEGER NOT NULL,
    "base_p" INTEGER NOT NULL,
    "amount_p" INTEGER NOT NULL,
    "status" "affiliate_commission_status" NOT NULL DEFAULT 'pending',
    "available_at" TIMESTAMPTZ,
    "approved_at" TIMESTAMPTZ,
    "reversed_at" TIMESTAMPTZ,
    "reverse_reason" TEXT,
    "payout_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payouts" (
    "id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "amount_p" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "paid_by_id" UUID NOT NULL,
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_customer_id_key" ON "affiliates"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates"("code");

-- CreateIndex
CREATE INDEX "affiliate_clicks_visitor_id_clicked_at_idx" ON "affiliate_clicks"("visitor_id", "clicked_at");

-- CreateIndex
CREATE INDEX "affiliate_clicks_affiliate_id_clicked_at_idx" ON "affiliate_clicks"("affiliate_id", "clicked_at");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commissions_order_id_key" ON "affiliate_commissions"("order_id");

-- CreateIndex
CREATE INDEX "affiliate_commissions_affiliate_id_status_idx" ON "affiliate_commissions"("affiliate_id", "status");

-- CreateIndex
CREATE INDEX "affiliate_commissions_status_available_at_idx" ON "affiliate_commissions"("status", "available_at");

-- CreateIndex
CREATE INDEX "affiliate_payouts_affiliate_id_paid_at_idx" ON "affiliate_payouts"("affiliate_id", "paid_at");

-- CreateIndex
CREATE INDEX "orders_affiliate_id_idx" ON "orders"("affiliate_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "affiliate_payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written guards (step 7c).
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_code_format" CHECK ("code" ~ '^[A-Z0-9]{4,16}$');
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_commission_bp_range" CHECK ("commission_bp" IS NULL OR "commission_bp" BETWEEN 0 AND 10000);
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_payout_method" CHECK ("payout_method" IS NULL OR "payout_method" IN ('bkash', 'bank'));
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_amounts" CHECK ("base_p" >= 0 AND "amount_p" >= 0 AND "commission_bp" BETWEEN 0 AND 10000);
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_paid_has_payout" CHECK (("status" = 'paid') = ("payout_id" IS NOT NULL));
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_amount" CHECK ("amount_p" > 0);
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_method" CHECK ("method" IN ('bkash', 'bank', 'cash'));
