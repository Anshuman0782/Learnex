-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "member_count" TEXT NOT NULL,
    "icon_name" TEXT NOT NULL,
    "icon_bg_color" TEXT NOT NULL,
    "icon_color" TEXT NOT NULL,
    "is_hot" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB NOT NULL,
    "avatar_stack" JSONB NOT NULL,
    "stats" JSONB,
    "mentors" JSONB,
    "members" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon_name" TEXT NOT NULL,
    "icon_bg_color" TEXT NOT NULL,
    "icon_color" TEXT NOT NULL,
    "topics_count" INTEGER NOT NULL,
    "badge" TEXT,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communities_category_idx" ON "communities"("category");

-- CreateIndex
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex
CREATE INDEX "community_memberships_user_id_idx" ON "community_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_memberships_user_id_community_id_key" ON "community_memberships"("user_id", "community_id");

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
