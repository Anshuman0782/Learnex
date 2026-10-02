import { PrismaClient } from '@prisma/client';
import { COMMUNITIES, SKILLS } from './seed-data.js';

const prisma = new PrismaClient();

/**
 * Idempotent seed: upserts the skill catalog and removes unused demo circles.
 * Safe to run repeatedly (never touches users, real circles or memberships).
 */
async function main() {
  // Circles are created by real users — the old demo catalog is NOT seeded any
  // more. Remove catalog circles nobody ever used (no members, posts or events);
  // any that real people joined are kept.
  const removed = await prisma.community.deleteMany({
    where: {
      id: { in: COMMUNITIES.map((c) => c.id) },
      memberships: { none: {} },
      postLinks: { none: {} },
      events: { none: {} },
    },
  });
  if (removed.count) console.log(`Removed ${removed.count} unused demo circles.`);

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
