-- AlterTable
ALTER TABLE "reposts" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "community_id" TEXT;

-- CreateIndex
CREATE INDEX "reposts_created_at_idx" ON "reposts"("created_at");
