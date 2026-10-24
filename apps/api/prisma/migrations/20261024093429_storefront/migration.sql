-- CreateEnum
CREATE TYPE "lang" AS ENUM ('en', 'bn');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('signup', 'reset', 'guest_cod', 'phone_change');

-- CreateEnum
CREATE TYPE "slide_lang" AS ENUM ('all', 'en', 'bn');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phone_verified_at" TIMESTAMPTZ,
    "email" TEXT,
    "email_verified_at" TIMESTAMPTZ,
    "password_hash" TEXT,
    "lang" "lang" NOT NULL DEFAULT 'en',
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "disabled_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_sessions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_slides" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "image_desktop_media_id" UUID NOT NULL,
    "image_mobile_media_id" UUID,
    "link_url" TEXT,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "lang" "slide_lang" NOT NULL DEFAULT 'all',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carousel_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_sessions_token_hash_key" ON "customer_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "customer_sessions_customer_id_idx" ON "customer_sessions"("customer_id");

-- CreateIndex
CREATE INDEX "otp_codes_phone_purpose_created_at_idx" ON "otp_codes"("phone", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "wishlists_product_id_idx" ON "wishlists"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_customer_id_product_id_key" ON "wishlists"("customer_id", "product_id");

-- AddForeignKey
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carousel_slides" ADD CONSTRAINT "carousel_slides_image_desktop_media_id_fkey" FOREIGN KEY ("image_desktop_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carousel_slides" ADD CONSTRAINT "carousel_slides_image_mobile_media_id_fkey" FOREIGN KEY ("image_mobile_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
