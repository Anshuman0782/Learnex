-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "communities" ADD COLUMN     "created_by_id" TEXT;

-- AlterTable
ALTER TABLE "community_memberships" ADD COLUMN     "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER';
