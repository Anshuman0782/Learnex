-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reviews" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "skill_label" TEXT NOT NULL,
    "rubric_version" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "scores" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "improvements" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB,
    "transcript" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "skill_label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "task" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "recording_url" TEXT,
    "recording_mime" TEXT,
    "duration_ms" INTEGER,
    "code_answer" TEXT,
    "critique_text" TEXT,
    "ai_score" INTEGER,
    "performance_score" INTEGER,
    "critique_score" INTEGER,
    "ai_result" JSONB,
    "ai_note" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "retry_after" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skill_settings" (
    "skill" TEXT NOT NULL,
    "progress_enabled" BOOLEAN NOT NULL DEFAULT true,
    "mentor_test_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skill_settings_pkey" PRIMARY KEY ("skill")
);

-- CreateTable
CREATE TABLE "ai_usage_days" (
    "day" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_days_pkey" PRIMARY KEY ("day","provider")
);

-- CreateIndex
CREATE INDEX "ai_jobs_status_run_after_idx" ON "ai_jobs"("status", "run_after");

-- CreateIndex
CREATE UNIQUE INDEX "ai_jobs_kind_ref_id_key" ON "ai_jobs"("kind", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_reviews_post_id_key" ON "ai_reviews"("post_id");

-- CreateIndex
CREATE INDEX "ai_reviews_user_id_skill_created_at_idx" ON "ai_reviews"("user_id", "skill", "created_at");

-- CreateIndex
CREATE INDEX "mentor_applications_user_id_skill_idx" ON "mentor_applications"("user_id", "skill");

-- CreateIndex
CREATE INDEX "mentor_applications_status_idx" ON "mentor_applications"("status");

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_applications" ADD CONSTRAINT "mentor_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

