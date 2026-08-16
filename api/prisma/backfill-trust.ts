import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';
import { sqliteDbPath } from '../src/prisma/database.js';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: sqliteDbPath() }),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'seller'
  );
}

async function main() {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  let createdProfiles = 0;
  let createdJoinedEvents = 0;
  let unverifiedSellers = 0;
  let backfilledBots = 0;

  for (const u of users) {
    // TrustEvent 'joined' cho MỌI user — chỉ tạo nếu chưa có
    const existingEvent = await prisma.trustEvent.findFirst({
      where: { userId: u.id, type: 'joined' },
    });
    if (!existingEvent) {
      await prisma.trustEvent.create({
        data: {
          id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: u.id,
          type: 'joined',
          detail: '{}',
          createdAt: u.joinedDate || new Date().toISOString(),
        },
      });
      createdJoinedEvents += 1;
    }

    // Phần còn lại chỉ dành cho seller
    if (u.role !== 'seller') continue;

    // 1. Tạo SellerProfile nếu chưa có (shopName = user.name, slug unique)
    let profile = await prisma.sellerProfile.findUnique({
      where: { userId: u.id },
    });
    if (!profile) {
      const base = slugify(u.name);
      const existing = await prisma.sellerProfile.findFirst({
        where: { slug: { startsWith: base } },
        orderBy: { slug: 'desc' },
      });
      const slug = existing
        ? `${base}-${Date.now().toString(36).slice(-4)}`
        : base;
      profile = await prisma.sellerProfile.create({
        data: {
          id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: u.id,
          shopName: u.name,
          slug,
          updatedAt: new Date().toISOString(),
        },
      });
      createdProfiles += 1;
    }

    // 2. isVerified=false nếu chưa có verification approved
    const approved = await prisma.trustVerification.findFirst({
      where: { userId: u.id, status: 'approved' },
    });
    if (!approved && u.isVerified) {
      await prisma.user.update({
        where: { id: u.id },
        data: { isVerified: false },
      });
      unverifiedSellers += 1;
    }

    // 3. Backfill Bot.sellerSlug = profile.slug
    const res = await prisma.bot.updateMany({
      where: { sellerId: u.id },
      data: { sellerSlug: profile.slug },
    });
    backfilledBots += res.count;

    // eslint-disable-next-line no-console
    console.log(
      `→ ${u.name} (${u.id}): profile ${profile.slug}, bots=${res.count}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `Done: ${createdProfiles} profiles created, ${createdJoinedEvents} joined events, ${unverifiedSellers} sellers unverified, ${backfilledBots} bots backfilled.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
