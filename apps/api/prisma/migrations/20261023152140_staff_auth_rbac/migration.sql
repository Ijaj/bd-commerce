-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "totp_enabled_at" TIMESTAMPTZ,
    "totp_last_step" INTEGER,
    "totp_reset_at" TIMESTAMPTZ,
    "totp_reset_by_id" UUID,
    "disabled_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "session_timeout_min" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "mfa_verified_at" TIMESTAMPTZ,
    "mfa_attempts" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_known_devices" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "fingerprint_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_known_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_backup_codes" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ,

    CONSTRAINT "staff_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_key" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "staff_roles" (
    "staff_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "staff_roles_pkey" PRIMARY KEY ("staff_id","role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "staff_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "staff_sessions_staff_id_idx" ON "staff_sessions"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_known_devices_staff_id_fingerprint_hash_key" ON "staff_known_devices"("staff_id", "fingerprint_hash");

-- CreateIndex
CREATE INDEX "staff_backup_codes_staff_id_idx" ON "staff_backup_codes"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "staff_roles_role_id_idx" ON "staff_roles"("role_id");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_totp_reset_by_id_fkey" FOREIGN KEY ("totp_reset_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_known_devices" ADD CONSTRAINT "staff_known_devices_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_backup_codes" ADD CONSTRAINT "staff_backup_codes_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
