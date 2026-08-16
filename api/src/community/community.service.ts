import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ForumPost } from '../../prisma/generated/prisma/client.js';

export interface CreateForumPostInput {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  /** Người đăng bài đã xác thực (bắt buộc đăng nhập) */
  author: { id: string; name: string; avatar: string; role: string };
}

export const FORUM_CATEGORIES = [
  'Chia sẻ kinh nghiệm',
  'Yêu cầu làm bot',
  'Thảo luận Dev',
  'Báo lỗi & Hỗ trợ',
];

export function toOut(p: ForumPost) {
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

/** Validate dữ liệu bài viết — throw BadRequestException với message tiếng Việt */
function validatePostInput(input: {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
}) {
  const title = input.title?.trim();
  if (!title || title.length < 5 || title.length > 200) {
    throw new BadRequestException('Tiêu đề phải từ 5 đến 200 ký tự.');
  }
  const content = input.content?.trim();
  if (!content || content.length < 20) {
    throw new BadRequestException('Nội dung bài viết tối thiểu 20 ký tự.');
  }
  if (input.category && !FORUM_CATEGORIES.includes(input.category)) {
    throw new BadRequestException(
      `Danh mục không hợp lệ. Chọn một trong: ${FORUM_CATEGORIES.join(', ')}.`,
    );
  }
  if (input.tags && input.tags.length > 5) {
    throw new BadRequestException('Tối đa 5 thẻ tag.');
  }
  return { title, content };
}

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Danh sách bài diễn đàn. viewerId (nếu có) → gắn isOwn để client
   * hiện nút sửa/xóa cho bài của chính mình.
   */
  async getPosts(category?: string, viewerId?: string | null) {
    const where = category && category !== 'Tất cả' ? { category } : {};
    const rows = await this.prisma.forumPost.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((p) => ({
      ...toOut(p),
      isOwn: Boolean(viewerId && p.authorId === viewerId),
    }));
  }

  async createPost(input: CreateForumPostInput) {
    const { title, content } = validatePostInput(input);
    const author = input.author;
    const created = await this.prisma.forumPost.create({
      data: {
        id: `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        excerpt: content.slice(0, 120) + (content.length > 120 ? '...' : ''),
        content,
        authorId: author.id,
        authorName: author.name,
        authorAvatar: author.avatar,
        authorRole:
          author.role === 'seller' ? 'Người bán' : author.role === 'admin' ? 'Admin' : 'Người mua',
        category: input.category || 'Chia sẻ kinh nghiệm',
        upvotes: 1,
        commentsCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
        tags: JSON.stringify(input.tags ?? []),
        isPinned: false,
      },
    });
    return { ...toOut(created), isOwn: true };
  }

  /** Sửa bài — chỉ tác giả (authorId khớp userId) được sửa */
  async updatePost(
    id: string,
    userId: string,
    input: { title?: string; content?: string; category?: string; tags?: string[] },
  ) {
    const existing = await this.prisma.forumPost.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }
    if (existing.authorId !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể sửa bài viết của mình.');
    }
    const { title, content } = validatePostInput({
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      category: input.category ?? existing.category,
      tags: input.tags,
    });
    const updated = await this.prisma.forumPost.update({
      where: { id },
      data: {
        title,
        content,
        excerpt: content.slice(0, 120) + (content.length > 120 ? '...' : ''),
        ...(input.category ? { category: input.category } : {}),
        ...(input.tags ? { tags: JSON.stringify(input.tags) } : {}),
      },
    });
    return { ...toOut(updated), isOwn: true };
  }

  /** Xóa bài — chỉ tác giả được xóa */
  async deletePost(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.forumPost.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }
    if (existing.authorId !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể xóa bài viết của mình.');
    }
    await this.prisma.forumPost.delete({ where: { id } });
  }

  /** Bài của một tác giả (trang seller profile) */
  async getPostsByAuthor(authorId: string) {
    const rows = await this.prisma.forumPost.findMany({
      where: { authorId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toOut);
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
