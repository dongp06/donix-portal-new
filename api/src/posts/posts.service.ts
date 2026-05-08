import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { ArticleCacheService } from '../cache/article-cache.service';
import type { Category, Post, PostAttachment } from '../data/types';
import { PrismaService } from '../prisma/prisma.service';

export type CreatePostInput = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  categoryId: string;
  date?: string;
  isPinned?: boolean;
  readTimeMinutes?: number;
  stackLabel?: string;
  tagLine?: string;
  attachments?: PostAttachment[];
  relatedSlugs?: string[];
  views?: number;
  codeExample?: { title?: string; language?: string; code: string };
  sampleOutput?: string;
};

export type UpdatePostInput = Partial<CreatePostInput>;

type PostRow = Prisma.PostGetPayload<{ include: { category: true } }>;

function parseJson<T>(raw: string | null | undefined): T | undefined {
  if (raw == null || raw === '') return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articleCache: ArticleCacheService,
  ) {}

  private toApiPost(p: PostRow): Post {
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
      readTimeMinutes: p.readTimeMinutes ?? undefined,
      stackLabel: p.stackLabel ?? undefined,
      tagLine: p.tagLine ?? undefined,
      codeExample: parseJson<NonNullable<Post['codeExample']>>(p.codeExample),
      sampleOutput: p.sampleOutput ?? undefined,
      attachments: parseJson<NonNullable<Post['attachments']>>(p.attachments),
      relatedSlugs: parseJson<string[]>(p.relatedSlugs),
    };
  }

  async findAll(categorySlug?: string, sort?: string): Promise<Post[]> {
    const where: Prisma.PostWhereInput = {};
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    const rows = await this.prisma.post.findMany({
      where,
      ...(sort === 'latest' ? { orderBy: { date: 'desc' as const } } : {}),
      include: { category: true },
    });
    return rows.map((r) => this.toApiPost(r));
  }

  async findPinned(): Promise<Post[]> {
    const rows = await this.prisma.post.findMany({
      where: { isPinned: true },
      include: { category: true },
    });
    return rows.map((r) => this.toApiPost(r));
  }

  async findBySlug(slug: string, slim = false): Promise<Post> {
    const p = await this.prisma.post.findFirst({
      where: { slug },
      include: { category: true },
    });
    if (!p) {
      throw new HttpException(
        { success: false, error: 'Post not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    const full = this.toApiPost(p);
    if (!slim) return full;
    return { ...full, content: '' };
  }

  async getRenderedArticleHtml(slug: string): Promise<string> {
    const cached = await this.articleCache.getHtml(slug);
    if (cached !== null) {
      return cached;
    }
    const p = await this.prisma.post.findFirst({
      where: { slug },
      select: { content: true },
    });
    if (!p) {
      throw new HttpException(
        { success: false, error: 'Post not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    const html = p.content ?? '';
    await this.articleCache.setHtml(slug, html);
    return html;
  }

  private async bustArticleHtmlCache(slug: string) {
    await this.articleCache.deleteHtml(slug);
  }

  async findRelated(slug: string): Promise<Post[]> {
    const p = await this.prisma.post.findFirst({
      where: { slug },
      select: { relatedSlugs: true },
    });
    const slugs = parseJson<string[]>(p?.relatedSlugs);
    if (!slugs?.length) return [];
    const rows = await this.prisma.post.findMany({
      where: { slug: { in: slugs } },
      include: { category: true },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r] as const));
    return slugs.map((s) => bySlug.get(s)).filter((r): r is PostRow => r !== undefined).map((r) => this.toApiPost(r));
  }

  async categories(): Promise<Category[]> {
    const cats = await this.prisma.category.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { posts: true } } },
    });
    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      navLabel: c.navLabel ?? undefined,
      count: c._count.posts,
    }));
  }

  async listAll(): Promise<Post[]> {
    const rows = await this.prisma.post.findMany({
      orderBy: { date: 'desc' },
      include: { category: true },
    });
    return rows.map((r) => this.toApiPost(r));
  }

  async findById(id: string): Promise<Post | undefined> {
    const p = await this.prisma.post.findFirst({
      where: { id },
      include: { category: true },
    });
    return p ? this.toApiPost(p) : undefined;
  }

  private normalizeAttachments(raw: PostAttachment[] | undefined): PostAttachment[] | undefined {
    if (!raw?.length) return undefined;
    const out: PostAttachment[] = [];
    for (const a of raw) {
      const id = a.id?.trim();
      const filename = a.filename?.trim();
      const sizeLabel = a.sizeLabel?.trim();
      const fileId = a.fileId?.trim();
      if (!id || !filename || !sizeLabel || !fileId) {
        throw new HttpException(
          { success: false, error: 'Mỗi file đính kèm cần id, filename, sizeLabel, fileId' },
          HttpStatus.BAD_REQUEST,
        );
      }
      out.push({ id, filename, sizeLabel, fileId });
    }
    return out;
  }

  async create(input: CreatePostInput): Promise<Post> {
    const slug = input.slug.trim();
    if (!slug || !input.title?.trim() || !input.categoryId) {
      throw new HttpException(
        { success: false, error: 'Thiếu slug, title hoặc categoryId' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const dup = await this.prisma.post.findFirst({ where: { slug } });
    if (dup) {
      throw new HttpException(
        { success: false, error: 'Slug đã tồn tại' },
        HttpStatus.CONFLICT,
      );
    }
    const category = await this.prisma.category.findFirst({ where: { id: input.categoryId } });
    if (!category) {
      throw new HttpException(
        { success: false, error: 'Danh mục không hợp lệ' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const id = `p-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const date = input.date?.trim() || new Date().toISOString().slice(0, 10);
    const attachments = this.normalizeAttachments(input.attachments);

    const created = await this.prisma.post.create({
      data: {
        id,
        slug,
        title: input.title.trim(),
        excerpt: (input.excerpt ?? '').trim(),
        content: input.content ?? '',
        coverImage:
          input.coverImage?.trim() ||
          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1200',
        categoryId: input.categoryId,
        categoryName: category.name,
        views: input.views ?? 0,
        date,
        isPinned: Boolean(input.isPinned),
        readTimeMinutes: input.readTimeMinutes ?? null,
        stackLabel: input.stackLabel?.trim() || null,
        tagLine: input.tagLine?.trim() || null,
        attachments: attachments ? JSON.stringify(attachments) : null,
        relatedSlugs: input.relatedSlugs?.length ? JSON.stringify(input.relatedSlugs) : null,
        codeExample: input.codeExample ? JSON.stringify(input.codeExample) : null,
        sampleOutput: input.sampleOutput ?? null,
      },
      include: { category: true },
    });
    return this.toApiPost(created);
  }

  async update(id: string, patch: UpdatePostInput): Promise<Post> {
    const current = await this.prisma.post.findFirst({
      where: { id },
      include: { category: true },
    });
    if (!current) {
      throw new HttpException(
        { success: false, error: 'Post not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (patch.slug !== undefined && patch.slug.trim() !== current.slug) {
      const s = patch.slug.trim();
      const clash = await this.prisma.post.findFirst({ where: { slug: s, NOT: { id } } });
      if (clash) {
        throw new HttpException(
          { success: false, error: 'Slug đã tồn tại' },
          HttpStatus.CONFLICT,
        );
      }
    }
    if (patch.categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({ where: { id: patch.categoryId } });
      if (!category) {
        throw new HttpException(
          { success: false, error: 'Danh mục không hợp lệ' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const data: Prisma.PostUpdateInput = {};
    if (patch.slug !== undefined) data.slug = patch.slug.trim();
    if (patch.title !== undefined) data.title = patch.title.trim();
    if (patch.excerpt !== undefined) data.excerpt = patch.excerpt.trim();
    if (patch.content !== undefined) data.content = patch.content;
    if (patch.coverImage !== undefined) {
      data.coverImage =
        patch.coverImage.trim() ||
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1200';
    }
    if (patch.categoryId !== undefined) {
      data.category = { connect: { id: patch.categoryId } };
      const cat = await this.prisma.category.findFirstOrThrow({ where: { id: patch.categoryId } });
      data.categoryName = cat.name;
    }
    if (patch.date !== undefined) data.date = patch.date.trim();
    if (patch.isPinned !== undefined) data.isPinned = patch.isPinned;
    if (patch.readTimeMinutes !== undefined) data.readTimeMinutes = patch.readTimeMinutes;
    if (patch.stackLabel !== undefined) {
      data.stackLabel = patch.stackLabel?.trim() || null;
    }
    if (patch.tagLine !== undefined) data.tagLine = patch.tagLine?.trim() || null;
    if (patch.attachments !== undefined) {
      const a = this.normalizeAttachments(patch.attachments);
      data.attachments = a ? JSON.stringify(a) : null;
    }
    if (patch.relatedSlugs !== undefined) {
      data.relatedSlugs = patch.relatedSlugs?.length
        ? JSON.stringify(patch.relatedSlugs)
        : null;
    }
    if (patch.views !== undefined) data.views = patch.views;
    if (patch.codeExample !== undefined) {
      data.codeExample = patch.codeExample ? JSON.stringify(patch.codeExample) : null;
    }
    if (patch.sampleOutput !== undefined) data.sampleOutput = patch.sampleOutput;

    await this.bustArticleHtmlCache(current.slug);

    const updated = await this.prisma.post.update({
      where: { id },
      data,
      include: { category: true },
    });
    if (updated.slug !== current.slug) {
      await this.bustArticleHtmlCache(updated.slug);
    }
    return this.toApiPost(updated);
  }

  async delete(id: string): Promise<void> {
    const row = await this.prisma.post.findFirst({ where: { id } });
    if (!row) {
      throw new HttpException(
        { success: false, error: 'Post not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    await this.bustArticleHtmlCache(row.slug);
    await this.prisma.post.delete({ where: { id } });
  }
}
