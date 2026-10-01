-- AlterTable
ALTER TABLE "community_events" ADD COLUMN     "content_kind" TEXT NOT NULL DEFAULT 'any',
ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "goal_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "goal_type" TEXT NOT NULL DEFAULT 'SUBMIT_POST',
ADD COLUMN     "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "event_participations" ADD COLUMN     "xp_awarded" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "community_events_ends_at_idx" ON "community_events"("ends_at");

-- Remove the placeholder events that were seeded for demos; events are now
-- created by admins only.
DELETE FROM "community_events";
