-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "XpSource" ADD VALUE 'COMMENT';
ALTER TYPE "XpSource" ADD VALUE 'LIKE_RECEIVED';
ALTER TYPE "XpSource" ADD VALUE 'ADMIN_ADJUSTMENT';

-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "finalized_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "xp_rules" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "daily_cap" INTEGER,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xp_rules_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "season_standings" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_standings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "season_standings_season_id_role_rank_idx" ON "season_standings"("season_id", "role", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "season_standings_season_id_user_id_key" ON "season_standings"("season_id", "user_id");

-- AddForeignKey
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rewards are now admin-managed (next phase). Remove the placeholder catalog that
-- was seeded for demo purposes; claims cascade with their reward.
DELETE FROM "season_rewards";
