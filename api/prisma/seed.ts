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
import {
  SELLER_SEEDS,
  sellerSeedUserId,
  forumAuthorSeedId,
} from './seller-seeds.js';

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
    sellerId: sellerSeedUserId(b.seller.id),
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
    views: b.views ?? 0,
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
    authorId: forumAuthorSeedId(p.authorName),
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

  // Seller users (mock prov-01…04 → user thật)
  for (const s of SELLER_SEEDS) {
    await prisma.user.upsert({
      where: { id: s.userId },
      create: {
        id: s.userId,
        googleId: null,
        name: s.name,
        email: s.email,
        avatar: s.avatar,
        role: 'seller',
        isVerified: s.isVerified,
        bio: s.bio,
        joinedDate: s.joinedDate,
        contact: JSON.stringify(s.contact),
      },
      update: {
        name: s.name,
        email: s.email,
        avatar: s.avatar,
        role: 'seller',
        isVerified: s.isVerified,
        bio: s.bio,
        joinedDate: s.joinedDate,
        contact: JSON.stringify(s.contact),
      },
    });
  }

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

  // Comments (blog + forum + bot) + reactions
  // Tác giả: dùng buyer MOCK_USER + các seller seed (đã có user)
  const SEED_AUTHORS = [
    { id: MOCK_USER.id, name: MOCK_USER.name, avatar: MOCK_USER.avatar },
    { id: SELLER_SEEDS[0].userId, name: SELLER_SEEDS[0].name, avatar: SELLER_SEEDS[0].avatar },
    { id: SELLER_SEEDS[1].userId, name: SELLER_SEEDS[1].name, avatar: SELLER_SEEDS[1].avatar },
  ];
  const botId = MOCK_BOTS[0]?.id;
  const forumId = MOCK_FORUM_POSTS[0]?.id;
  const postId = MOCK_POSTS[0]?.id;

  // Xóa dữ liệu comment/review cũ để reseed sạch
  await prisma.comment.deleteMany({});
  await prisma.botReview.deleteMany({});
  await prisma.reaction.deleteMany({});

  if (botId && forumId && postId) {
    const parentId = `seed-cmt-${botId}-1`;
    await prisma.comment.create({
      data: {
        id: parentId,
        targetType: 'bot',
        targetId: botId,
        authorId: SEED_AUTHORS[0].id,
        authorName: SEED_AUTHORS[0].name,
        authorAvatar: SEED_AUTHORS[0].avatar,
        content: 'Bot này chạy ổn định, mình dùng được 2 tuần rồi. Nhược điểm là lúc đầu hơi khó cài đặt.',
        reactions: JSON.stringify([{ emoji: '👍', count: 3, reactedByMe: false }]),
        createdAt: '2026-08-10',
      },
    });
    await prisma.comment.create({
      data: {
        id: `seed-cmt-${botId}-2`,
        targetType: 'bot',
        targetId: botId,
        parentId,
        authorId: SEED_AUTHORS[1].userId,
        authorName: SEED_AUTHORS[1].name,
        authorAvatar: SEED_AUTHORS[1].avatar,
        content: 'Cảm ơn bạn! Bản 1.2 đã thêm hướng dẫn cài đặt chi tiết từng bước rồi nhé.',
        reactions: JSON.stringify([{ emoji: '❤️', count: 1, reactedByMe: false }]),
        createdAt: '2026-08-11',
      },
    });
    await prisma.comment.create({
      data: {
        id: `seed-cmt-${forumId}-1`,
        targetType: 'forum',
        targetId: forumId,
        authorId: SEED_AUTHORS[2].userId,
        authorName: SEED_AUTHORS[2].name,
        authorAvatar: SEED_AUTHORS[2].avatar,
        content: 'Mình đã thử cách này, đỡ bị khóa nick hẳn. Cảm ơn tác giả đã chia sẻ!',
        reactions: JSON.stringify([
          { emoji: '👍', count: 5, reactedByMe: false },
          { emoji: '😂', count: 2, reactedByMe: false },
        ]),
        createdAt: '2026-08-09',
      },
    });
    await prisma.comment.create({
      data: {
        id: `seed-cmt-${postId}-1`,
        targetType: 'post',
        targetId: postId,
        authorId: SEED_AUTHORS[0].id,
        authorName: SEED_AUTHORS[0].name,
        authorAvatar: SEED_AUTHORS[0].avatar,
        content: 'Bài viết rất chi tiết, đọc xong mình tự làm được ngay. Mong có thêm phần mở rộng.',
        reactions: JSON.stringify([{ emoji: '👍', count: 2, reactedByMe: false }]),
        createdAt: '2026-08-08',
      },
    });

    // Bot reviews (kèm ảnh) — seed 2 review cho mỗi bot để tab "Đánh giá" không trống
    // Nội dung xoay vòng theo chỉ số bot để mỗi bot có review riêng.
    const REVIEW_COMMENTS = [
      'Bot chạy mượt, đúng như mô tả. Hỗ trợ nhanh, giao diện dễ dùng.',
      'Ổn định, chỉ mong thêm báo cáo tự động. Ngoài ra rất đáng tiền.',
      'Tốt lắm, mình dùng từ hôm mua tới giờ chưa gặp lỗi. Nhân viên hỗ trợ nhiệt tình.',
      'Cài đặt hơi mất thời gian lúc đầu nhưng xong là ổn định, mua thêm rẻ.',
    ];
    for (const [bi, b] of MOCK_BOTS.entries()) {
      const authorIdx = bi % SEED_AUTHORS.length;
      for (const ri of [0, 1]) {
        await prisma.botReview.upsert({
          where: { id: `seed-rv-${b.id}-${ri + 1}` },
          create: {
            id: `seed-rv-${b.id}-${ri + 1}`,
            botId: b.id,
            userId: SEED_AUTHORS[(authorIdx + ri) % SEED_AUTHORS.length].id,
            rating: ri === 0 ? 5 : 4,
            comment: REVIEW_COMMENTS[(bi + ri) % REVIEW_COMMENTS.length],
            images: JSON.stringify(
              ri === 0 ? ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=80'] : [],
            ),
            createdAt: '2026-08-05',
          },
          update: {},
        });
      }
    }

    // Cập nhật rating/reviewCount cho TẤT CẢ bot theo review thật (không còn số ảo 110-180)
    for (const b of MOCK_BOTS) {
      const agg = await prisma.botReview.aggregate({
        where: { botId: b.id },
        _avg: { rating: true },
        _count: true,
      });
      await prisma.bot.update({
        where: { id: b.id },
        data: { rating: agg._avg.rating ?? 5, reviewCount: agg._count },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${MOCK_BLOG_CATEGORIES.length} categories, ${MOCK_POSTS.length} posts, ${MOCK_BOTS.length} bots, ${MOCK_FORUM_POSTS.length} forum posts, ${1 + SELLER_SEEDS.length} users, comments+reviews.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
