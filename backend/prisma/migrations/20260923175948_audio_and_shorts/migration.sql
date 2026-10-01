-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'AUDIO';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "audio_url" TEXT,
ADD COLUMN     "is_short" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "posts_is_short_created_at_idx" ON "posts"("is_short", "created_at");
