-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "order_status" ADD VALUE 'delivery_failed';
ALTER TYPE "order_status" ADD VALUE 'failed';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "blocked_by_staff_id" UUID,
ADD COLUMN     "blocked_reason" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "failed_reason" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "height_mm" INTEGER,
ADD COLUMN     "length_mm" INTEGER,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "warranty_bn" TEXT,
ADD COLUMN     "warranty_en" TEXT,
ADD COLUMN     "width_mm" INTEGER;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "received_back_at" TIMESTAMPTZ,
ADD COLUMN     "received_back_by_id" UUID,
ADD COLUMN     "received_back_note" TEXT;

-- CreateTable
CREATE TABLE "order_edits" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_notified_at" TIMESTAMPTZ,

    CONSTRAINT "order_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_bn" TEXT,
    "body_html_en" TEXT,
    "body_html_bn" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "show_in_footer" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_edits_order_id_created_at_idx" ON "order_edits"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_notes_customer_id_created_at_idx" ON "customer_notes"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_is_published_show_in_footer_sort_order_idx" ON "pages"("is_published", "show_in_footer", "sort_order");

-- CreateIndex
CREATE INDEX "products_tags_idx" ON "products" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "order_edits" ADD CONSTRAINT "order_edits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: package dimensions must be positive when set (C7).
ALTER TABLE "products"
  ADD CONSTRAINT "products_dimensions_positive"
  CHECK (
    ("length_mm" IS NULL OR "length_mm" > 0)
    AND ("width_mm" IS NULL OR "width_mm" > 0)
    AND ("height_mm" IS NULL OR "height_mm" > 0)
  );

-- Hand-written: starter static pages as drafts (C89). Owner writes the text, then publishes.
INSERT INTO "pages" ("id", "slug", "title_en", "title_bn", "is_published", "show_in_footer", "sort_order", "updated_at") VALUES
  (uuidv7(), 'about',   'About us',          'আমাদের সম্পর্কে',        false, true, 10, now()),
  (uuidv7(), 'contact', 'Contact us',        'যোগাযোগ',                false, true, 20, now()),
  (uuidv7(), 'privacy', 'Privacy policy',    'গোপনীয়তা নীতি',          false, true, 30, now()),
  (uuidv7(), 'terms',   'Terms of service',  'ব্যবহারের শর্তাবলী',       false, true, 40, now()),
  (uuidv7(), 'returns', 'Returns and refunds', 'ফেরত ও রিফান্ড নীতি',   false, true, 50, now()),
  (uuidv7(), 'faq',     'FAQ',               'সাধারণ জিজ্ঞাসা',         false, true, 60, now());
