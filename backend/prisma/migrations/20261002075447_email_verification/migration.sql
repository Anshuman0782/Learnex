-- AlterTable
ALTER TABLE "password_resets" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "new_email" TEXT,
    "new_phone" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_codes_user_id_purpose_idx" ON "email_codes"("user_id", "purpose");

-- AddForeignKey
ALTER TABLE "email_codes" ADD CONSTRAINT "email_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing accounts are grandfathered as verified (nobody gets locked out).
UPDATE "users" SET "email_verified_at" = NOW() WHERE "email_verified_at" IS NULL;
