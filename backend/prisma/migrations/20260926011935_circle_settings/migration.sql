-- CreateEnum
CREATE TYPE "CommunityPostPolicy" AS ENUM ('ALL', 'ADMINS');

-- AlterTable
ALTER TABLE "communities" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "post_policy" "CommunityPostPolicy" NOT NULL DEFAULT 'ALL';
