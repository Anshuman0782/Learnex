-- AlterTable
ALTER TABLE "community_events" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "learner_tasks" JSONB,
ADD COLUMN     "learner_xp" INTEGER,
ADD COLUMN     "mentor_tasks" JSONB,
ADD COLUMN     "mentor_xp" INTEGER,
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "voting_ends_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "event_participations" ADD COLUMN     "progress_pct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'Learner';

-- Events now use voting + learner/mentor challenge tracks. Remove events in the
-- previous single-goal format (they have no tracks and cannot be played).
DELETE FROM "community_events" WHERE "learner_tasks" IS NULL AND "mentor_tasks" IS NULL;
