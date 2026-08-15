import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CreatePostInput = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  categoryId: string;
  isPinned?: boolean;
  readTimeMinutes?: number | null;
  stackLabel?: string | null;
  tagLine?: string | null;
  codeExample?: string | null;
  sampleOutput?: string | null;
  attachments?: string | null;
  relatedSlugs?: string | null;
};

export type UpdatePostInput = Partial<CreatePostInput>;

function safeJsonParse<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  private toPostRow(p: {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    coverImage: string;
    categoryId: string;
    categoryName: string;
    views: number;
    date: string;
    isPinned: boolean;
    readTimeMinutes: number | null;
    stackLabel: string | null;
    tagLine: string | null;
    codeExample: string | null;
    sampleOutput: string | null;
    attachments: string | null;
    relatedSlugs: string | null;
  }) {
    return {
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
      readTimeMinutes: p.readTimeMinutes,
      stackLabel: p.stackLabel,
      tagLine: p.tagLine,
      codeExample: p.codeExample ? safeJsonParse(p.codeExample) : undefined,
      sampleOutput: p.sampleOutput ?? undefined,
      attachments: p.attachments ? safeJsonParse(p.attachments) : undefined,
      relatedSlugs: p.relatedSlugs ? safeJsonParse(p.relatedSlugs) : undefined,
    };
  }

  async findAll(category?: string, sort?: string) {
    const where =
      category && category !== 'all' ? { category: { slug: category } } : {};
    const posts = await this.prisma.post.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    let result = posts.map((p) => this.toPostRow(p));
    if (sort === 'latest') {
      result = result.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    } else if (sort === 'popular') {
      result = result.sort((a, b) => b.views - a.views);
    }
    return result;
  }

  async findPinned() {
    const posts = await this.prisma.post.findMany({
      where: { isPinned: true },
      orderBy: { date: 'desc' },
    });
    return posts.map((p) => this.toPostRow(p));
  }

  async findBySlug(slug: string, omitContent = false) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
    });
    if (!post) {
      throw new NotFoundException(`Bài viết '${slug}' không tồn tại.`);
    }
    const row = this.toPostRow(post);
    if (omitContent) {
      const { content, ...rest } = row;
      return rest;
    }
    return row;
  }

  async getRenderedArticleHtml(slug: string) {
    const post = await this.prisma.post.findUnique({ where: { slug } });
    if (!post) {
      throw new NotFoundException(`Bài viết '${slug}' không tồn tại.`);
    }
    return post.content;
  }

  async findRelated(slug: string) {
    const post = await this.prisma.post.findUnique({ where: { slug } });
    if (!post) return [];
    const related = await this.prisma.post.findMany({
      where: {
        id: { not: post.id },
        OR: [
          { categoryId: post.categoryId },
          { relatedSlugs: { contains: slug } },
        ],
      },
      orderBy: { views: 'desc' },
      take: 3,
    });
    return related.map((p) => this.toPostRow(p));
  }

  async categories() {
    const [cats, counts] = await Promise.all([
      this.prisma.category.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.post.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      navLabel: c.navLabel,
      count: countMap.get(c.id) ?? 0,
    }));
  }

  async listAll() {
    const posts = await this.prisma.post.findMany({
      orderBy: { date: 'desc' },
    });
    return posts.map((p) => this.toPostRow(p));
  }

  async findById(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) return null;
    return this.toPostRow(post);
  }

  async create(input: CreatePostInput) {
    const category = await this.prisma.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Danh mục '${input.categoryId}' không tồn tại.`,
      );
    }
    const created = await this.prisma.post.create({
      data: {
        id: crypto.randomUUID(),
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt ?? '',
        content: input.content ?? '',
        coverImage: input.coverImage ?? '',
        categoryId: input.categoryId,
        categoryName: category.name,
        isPinned: input.isPinned ?? false,
        readTimeMinutes: input.readTimeMinutes ?? null,
        stackLabel: input.stackLabel ?? null,
        tagLine: input.tagLine ?? null,
        codeExample: input.codeExample ?? null,
        sampleOutput: input.sampleOutput ?? null,
        attachments: input.attachments ?? null,
        relatedSlugs: input.relatedSlugs ?? null,
        date: new Date().toISOString().split('T')[0],
      },
    });
    return this.toPostRow(created);
  }

  async update(id: string, input: UpdatePostInput) {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bài viết '${id}' không tồn tại.`);
    }
    const category = input.categoryId
      ? await this.prisma.category.findUnique({
          where: { id: input.categoryId },
        })
      : null;
    if (input.categoryId && !category) {
      throw new NotFoundException(
        `Danh mục '${input.categoryId}' không tồn tại.`,
      );
    }
    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.coverImage !== undefined
          ? { coverImage: input.coverImage }
          : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId, categoryName: category?.name ?? existing.categoryName }
          : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
        ...(input.readTimeMinutes !== undefined
          ? { readTimeMinutes: input.readTimeMinutes }
          : {}),
        ...(input.stackLabel !== undefined
          ? { stackLabel: input.stackLabel }
          : {}),
        ...(input.tagLine !== undefined ? { tagLine: input.tagLine } : {}),
        ...(input.codeExample !== undefined
          ? { codeExample: input.codeExample }
          : {}),
        ...(input.sampleOutput !== undefined
          ? { sampleOutput: input.sampleOutput }
          : {}),
        ...(input.attachments !== undefined
          ? { attachments: input.attachments }
          : {}),
        ...(input.relatedSlugs !== undefined
          ? { relatedSlugs: input.relatedSlugs }
          : {}),
      },
    });
    return this.toPostRow(updated);
  }

  async delete(id: string) {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bài viết '${id}' không tồn tại.`);
    }
    await this.prisma.post.delete({ where: { id } });
  }
}
