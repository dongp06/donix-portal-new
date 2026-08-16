import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';
import {
  MOCK_BLOG_CATEGORIES,
  MOCK_POSTS,
  MOCK_BOTS,
  MOCK_FORUM_POSTS,
  MOCK_USER,
} from '../src/data/mock-data.js';
import { sqliteDbPath } from '../src/prisma/database.js';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: sqliteDbPath() }),
});

function toBotData(b: (typeof MOCK_BOTS)[number]) {
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    tagline: b.tagline,
    description: b.description,
    categorySlug: b.categorySlug,
    categoryName: b.categoryName,
    sellerId: b.seller.id,
    sellerName: b.seller.name,
    sellerAvatar: b.seller.avatar,
    sellerRating: b.seller.rating,
    sellerSales: b.seller.totalSales,
    sellerVerified: b.seller.isVerified,
    sellerJoinedDate: b.seller.joinedDate,
    contactZalo: b.seller.contact?.zalo ?? null,
    contactTelegram: b.seller.contact?.telegram ?? null,
    contactPhone: b.seller.contact?.phone ?? null,
    contactMessenger: b.seller.contact?.messenger ?? null,
    contactFacebook: b.seller.contact?.facebook ?? null,
    coverImage: b.coverImage,
    gallery: JSON.stringify(b.gallery),
    features: JSON.stringify(b.features),
    priceHourly: b.pricing.hourly,
    priceDaily: b.pricing.daily,
    priceMonthly: b.pricing.monthly,
    status: b.status,
    rating: b.rating,
    reviewCount: b.reviewCount,
    tags: JSON.stringify(b.tags),
    version: b.version,
    systemReqs: b.systemReqs,
    updatedAt: b.updatedAt,
  };
}

function toForumData(p: (typeof MOCK_FORUM_POSTS)[number]) {
  return {
    id: p.id,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    authorId: null,
    authorName: p.authorName,
    authorAvatar: p.authorAvatar,
    authorRole: p.authorRole,
    category: p.category,
    upvotes: p.upvotes,
    commentsCount: p.commentsCount,
    createdAt: p.createdAt,
    tags: JSON.stringify(p.tags),
    isPinned: p.isPinned ?? false,
  };
}

async function main() {
  // User
  await prisma.user.upsert({
    where: { id: MOCK_USER.id },
    create: {
      id: MOCK_USER.id,
      googleId: null,
      name: MOCK_USER.name,
      email: MOCK_USER.email,
      avatar: MOCK_USER.avatar,
      role: MOCK_USER.role,
      isVerified: MOCK_USER.isVerifiedSeller ?? false,
      bio: MOCK_USER.bio ?? null,
      joinedDate: MOCK_USER.joinedDate,
    },
    update: {},
  });

  // Blog categories
  // Xóa các category cũ (bot marketplace) không thuộc blog — chỉ giữ các id blog
  await prisma.post.deleteMany({ where: { category: { is: { id: { notIn: MOCK_BLOG_CATEGORIES.map((c) => c.id) } } } } });
  await prisma.category.deleteMany({ where: { id: { notIn: MOCK_BLOG_CATEGORIES.map((c) => c.id) } } });
  for (const c of MOCK_BLOG_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: c.id },
      create: { id: c.id, slug: c.slug, name: c.name, navLabel: c.navLabel ?? null },
      update: { slug: c.slug, name: c.name, navLabel: c.navLabel ?? null },
    });
  }

  // Posts
  for (const p of MOCK_POSTS) {
    await prisma.post.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        coverImage: p.coverImage,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        views: p.views,
        date: p.date,
        isPinned: p.isPinned,
        readTimeMinutes: p.readTimeMinutes ?? null,
        stackLabel: p.stackLabel ?? null,
        tagLine: p.tagLine ?? null,
        codeExample: p.codeExample ? JSON.stringify(p.codeExample) : null,
        sampleOutput: p.sampleOutput ?? null,
        attachments: p.attachments ? JSON.stringify(p.attachments) : null,
        relatedSlugs: p.relatedSlugs ? JSON.stringify(p.relatedSlugs) : null,
      },
      update: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        coverImage: p.coverImage,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        views: p.views,
        date: p.date,
        isPinned: p.isPinned,
        readTimeMinutes: p.readTimeMinutes ?? null,
        stackLabel: p.stackLabel ?? null,
        tagLine: p.tagLine ?? null,
        codeExample: p.codeExample ? JSON.stringify(p.codeExample) : null,
        sampleOutput: p.sampleOutput ?? null,
        attachments: p.attachments ? JSON.stringify(p.attachments) : null,
        relatedSlugs: p.relatedSlugs ? JSON.stringify(p.relatedSlugs) : null,
      },
    });
  }

  // Bots
  for (const b of MOCK_BOTS) {
    await prisma.bot.upsert({
      where: { id: b.id },
      create: toBotData(b),
      update: toBotData(b),
    });
  }

  // Forum posts
  for (const fp of MOCK_FORUM_POSTS) {
    await prisma.forumPost.upsert({
      where: { id: fp.id },
      create: toForumData(fp),
      update: toForumData(fp),
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${MOCK_BLOG_CATEGORIES.length} categories, ${MOCK_POSTS.length} posts, ${MOCK_BOTS.length} bots, ${MOCK_FORUM_POSTS.length} forum posts, 1 user.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
