-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'IMAGE';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "image_urls" JSONB;
