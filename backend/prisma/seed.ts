import { PrismaClient } from '@prisma/client';
import { COMMUNITIES, SKILLS } from './seed-data.js';

const prisma = new PrismaClient();

/**
 * Idempotent seed: upserts the community + skill catalog. Safe to run repeatedly
 * (never touches users or their memberships).
 */
async function main() {
  console.log('Seeding communities…');
  for (const c of COMMUNITIES) {
    const data = {
      name: c.name,
      category: c.category,
      description: c.description,
      iconName: c.iconName,
      iconBgColor: c.iconBgColor,
      iconColor: c.iconColor,
      isHot: c.isHot ?? false,
      tags: c.tags,
    };
    await prisma.community.upsert({
      where: { id: c.id },
      create: { id: c.id, ...data },
      update: data,
    });
  }

  console.log('Seeding skills…');
  for (const s of SKILLS) {
    const data = {
      name: s.name,
      category: s.category,
      iconName: s.iconName,
      iconBgColor: s.iconBgColor,
      iconColor: s.iconColor,
      topicsCount: s.topicsCount,
      badge: s.badge ?? null,
    };
    await prisma.skill.upsert({
      where: { id: s.id },
      create: { id: s.id, ...data },
      update: data,
    });
  }

  // Season rewards are managed by admins (not seeded).

  // Circle events are created by admins in the app (not seeded).

  const [communities, skills] = await Promise.all([prisma.community.count(), prisma.skill.count()]);
  console.log(`Done. ${communities} communities, ${skills} skills.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
