-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachment_duration_ms" INTEGER,
ADD COLUMN     "attachment_mime" TEXT,
ADD COLUMN     "attachment_name" TEXT,
ADD COLUMN     "attachment_size" INTEGER,
ADD COLUMN     "attachment_type" TEXT,
ADD COLUMN     "attachment_url" TEXT,
ALTER COLUMN "text" SET DEFAULT '';

