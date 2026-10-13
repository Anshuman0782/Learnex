-- DropIndex
DROP INDEX "season_standings_season_id_user_id_key";

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "skill" TEXT;

-- AlterTable
ALTER TABLE "xp_events" ADD COLUMN     "role" TEXT,
ADD COLUMN     "skill" TEXT;

-- CreateTable
CREATE TABLE "user_skills" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "skill_key" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_skills_skill_key_role_idx" ON "user_skills"("skill_key", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_user_id_skill_key_key" ON "user_skills"("user_id", "skill_key");

-- CreateIndex
CREATE UNIQUE INDEX "season_standings_season_id_user_id_role_key" ON "season_standings"("season_id", "user_id", "role");

-- CreateIndex
CREATE INDEX "xp_events_role_skill_created_at_idx" ON "xp_events"("role", "skill", "created_at");

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every existing Learner / Mentor gets their current hobby as their
-- first skill, with their current role.
INSERT INTO "user_skills" ("id", "user_id", "skill", "skill_key", "role")
SELECT md5(random()::text || clock_timestamp()::text || u."id")::uuid::text,
       u."id",
       COALESCE(NULLIF(BTRIM(u."hobby"), ''), 'General'),
       LOWER(COALESCE(NULLIF(BTRIM(u."hobby"), ''), 'General')),
       u."role"
FROM "users" u
WHERE u."role" IN ('LEARNER', 'MENTOR');

-- Backfill: XP earned so far belongs to that same skill and role.
UPDATE "xp_events" e
SET "skill" = LOWER(COALESCE(NULLIF(BTRIM(u."hobby"), ''), 'General')),
    "role"  = CASE WHEN u."role" = 'MENTOR' THEN 'Mentor' ELSE 'Learner' END
FROM "users" u
WHERE u."id" = e."user_id";

-- Backfill: existing posts belong to their author's skill.
UPDATE "posts" p
SET "skill" = NULLIF(BTRIM(u."hobby"), '')
FROM "users" u
WHERE u."id" = p."author_id";
