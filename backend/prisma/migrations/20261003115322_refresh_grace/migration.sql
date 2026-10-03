-- AlterTable
ALTER TABLE "users" ADD COLUMN     "prev_refresh_token_hash" TEXT,
ADD COLUMN     "refresh_rotated_at" TIMESTAMP(3);

