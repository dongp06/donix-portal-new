import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PostsService } from './posts.service';
import { ok } from '../common/api-response';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  async list(
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    return ok(await this.posts.findAll(category, sort));
  }

  @Get('pinned')
  async pinned() {
    return ok(await this.posts.findPinned());
  }

  /** Trả thẳng HTML nội dung bài (prose) — CDN/Next có thể cache theo Cache-Control. */
  @Get('rendered/:slug')
  async renderedHtml(@Param('slug') slug: string, @Res() res: Response) {
    const html = await this.posts.getRenderedArticleHtml(slug);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=120, stale-while-revalidate=300',
    );
    res.send(html);
  }

  @Get(':slug/related')
  async related(@Param('slug') slug: string) {
    return ok(await this.posts.findRelated(slug));
  }

  /** Query `omit=content` để bỏ HTML body (lấy qua GET rendered/:slug). */
  @Get(':slug')
  async one(@Param('slug') slug: string, @Query('omit') omit?: string) {
    const slim = omit === 'content';
    return ok(await this.posts.findBySlug(slug, slim));
  }
}
