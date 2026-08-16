import { Controller, Get, Post, Param, Query, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommunityService, CreateForumPostInput } from './community.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AUTH_COOKIE } from '../auth/auth.controller.js';

@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly auth: AuthService,
  ) {}

  /** Giải mã người dùng từ cookie (nếu đã đăng nhập) — bài đăng gắn với author thật */
  private async resolveAuthor(req: Request): Promise<CreateForumPostInput['author']> {
    const token = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (!token) return undefined;
    try {
      const payload = this.auth.verifyToken(token);
      const user = await this.auth.findByEmail(payload.email);
      if (!user) return undefined;
      return { id: user.id, name: user.name, avatar: user.avatar, role: user.role };
    } catch {
      return undefined;
    }
  }

  @Get('posts')
  async getPosts(@Query('category') category?: string) {
    return {
      success: true,
      data: await this.communityService.getPosts(category),
    };
  }

  @Post('posts')
  async createPost(
    @Body() postData: { title: string; content: string; category?: string; tags?: string[] },
    @Req() req: Request,
  ) {
    const author = await this.resolveAuthor(req);
    const post = await this.communityService.createPost({
      title: postData?.title,
      content: postData?.content,
      category: postData?.category,
      tags: postData?.tags,
      author,
    });
    return {
      success: true,
      data: post,
    };
  }

  @Post('posts/:id/upvote')
  async upvotePost(@Param('id') id: string) {
    return {
      success: true,
      data: await this.communityService.upvotePost(id),
    };
  }
}
