import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { MOCK_CATEGORIES, MOCK_POSTS } from '../src/data/mock-data';
import type { Post } from '../src/data/types';
import type { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function toPostData(p: Post): Prisma.PostCreateInput {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    coverImage: p.coverImage,
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
    category: { connect: { id: p.categoryId } },
  };
}

async function main() {
  for (const c of MOCK_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        slug: c.slug,
        name: c.name,
        navLabel: c.navLabel ?? null,
      },
      update: {
        slug: c.slug,
        name: c.name,
        navLabel: c.navLabel ?? null,
      },
    });
  }

  for (const p of MOCK_POSTS) {
    await prisma.post.upsert({
      where: { id: p.id },
      create: toPostData(p),
      update: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        coverImage: p.coverImage,
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
        category: { connect: { id: p.categoryId } },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${MOCK_CATEGORIES.length} categories, ${MOCK_POSTS.length} posts.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
