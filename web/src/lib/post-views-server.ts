import { prisma } from '@/lib/prisma';

/** +1 view trực tiếp DB (Next server — không qua HTTP API). */
export async function incrementPostViewsBySlug(slug: string): Promise<number | null> {
  try {
    const row = await prisma.post.update({
      where: { slug },
      data: { views: { increment: 1 } },
      select: { views: true },
    });
    return row.views;
  } catch {
    return null;
  }
}
