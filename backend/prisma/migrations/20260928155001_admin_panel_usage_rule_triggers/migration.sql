-- AlterEnum
ALTER TYPE "XpSource" ADD VALUE 'CUSTOM_RULE';

-- AlterTable
ALTER TABLE "season_rewards" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "admin_granted_at" TIMESTAMP(3),
ADD COLUMN     "admin_granted_by_id" TEXT,
ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "xp_events" ADD COLUMN     "rule_key" TEXT;

-- AlterTable
ALTER TABLE "xp_rules" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "trigger" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "usage_days" (
    "user_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_days_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateIndex
CREATE INDEX "usage_days_day_idx" ON "usage_days"("day");

-- CreateIndex
CREATE INDEX "xp_events_user_id_rule_key_created_at_idx" ON "xp_events"("user_id", "rule_key", "created_at");

-- CreateIndex
CREATE INDEX "xp_rules_trigger_idx" ON "xp_rules"("trigger");

-- AddForeignKey
ALTER TABLE "usage_days" ADD CONSTRAINT "usage_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
