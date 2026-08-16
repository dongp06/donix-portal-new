import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ForumPost } from '../../prisma/generated/prisma/client.js';

export interface CreateForumPostInput {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  /** Người đăng bài đã xác thực (nếu có) */
  author?: { id: string; name: string; avatar: string; role: string };
}

function toOut(p: ForumPost) {
  return {
    id: p.id,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    authorId: p.authorId ?? undefined,
    authorName: p.authorName,
    authorAvatar: p.authorAvatar,
    authorRole: p.authorRole,
    category: p.category,
    upvotes: p.upvotes,
    commentsCount: p.commentsCount,
    createdAt: p.createdAt,
    tags: safeParse<string[]>(p.tags),
    isPinned: p.isPinned,
  };
}

function safeParse<T>(value: string | null): T {
  if (!value) return [] as unknown as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async getPosts(category?: string) {
    const where = category && category !== 'Tất cả' ? { category } : {};
    const rows = await this.prisma.forumPost.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toOut);
  }

  async createPost(input: CreateForumPostInput) {
    const author = input.author;
    const created = await this.prisma.forumPost.create({
      data: {
        id: `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        title: input.title,
        excerpt: input.content.slice(0, 120) + (input.content.length > 120 ? '...' : ''),
        content: input.content,
        authorId: author?.id ?? null,
        authorName: author?.name ?? 'Khách',
        authorAvatar:
          author?.avatar ??
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        authorRole:
          author?.role === 'seller' ? 'Người bán' : author?.role === 'admin' ? 'Admin' : 'Người mua',
        category: input.category || 'Chia sẻ kinh nghiệm',
        upvotes: 1,
        commentsCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
        tags: JSON.stringify(input.tags ?? []),
        isPinned: false,
      },
    });
    return toOut(created);
  }

  async upvotePost(id: string) {
    const existing = await this.prisma.forumPost.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }
    const updated = await this.prisma.forumPost.update({
      where: { id },
      data: { upvotes: existing.upvotes + 1 },
    });
    return toOut(updated);
  }
}
