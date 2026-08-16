import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommunityService } from './community.service.js';
import { AuthService } from '../auth/auth.service.js';
import { getCurrentUser, requireUser } from '../auth/current-user.js';

@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly auth: AuthService,
  ) {}

  @Get('posts')
  async getPosts(@Query('category') category?: string, @Req() req?: Request) {
    const viewer = req ? await getCurrentUser(req, this.auth) : null;
    return {
      success: true,
      data: await this.communityService.getPosts(category, viewer?.id ?? null),
    };
  }

  /** Đăng bài — bắt buộc đăng nhập, bài gắn với user thật */
  @Post('posts')
  async createPost(
    @Body() postData: { title: string; content: string; category?: string; tags?: string[] },
    @Req() req: Request,
  ) {
    const user = await requireUser(req, this.auth);
    const post = await this.communityService.createPost({
      title: postData?.title,
      content: postData?.content,
      category: postData?.category,
      tags: postData?.tags,
      author: { id: user.id, name: user.name, avatar: user.avatar, role: user.role },
    });
    return {
      success: true,
      data: post,
    };
  }

  /** Sửa bài của mình */
  @Patch('posts/:id')
  async updatePost(
    @Param('id') id: string,
    @Body() postData: { title?: string; content?: string; category?: string; tags?: string[] },
    @Req() req: Request,
  ) {
    const user = await requireUser(req, this.auth);
    const post = await this.communityService.updatePost(id, user.id, postData);
    return {
      success: true,
      data: post,
    };
  }

  /** Xóa bài của mình */
  @Delete('posts/:id')
  async deletePost(@Param('id') id: string, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    await this.communityService.deletePost(id, user.id);
    return {
      success: true,
      data: true,
    };
  }

  @Post('posts/:id/upvote')
  async upvotePost(@Param('id') id: string) {
    return {
      success: true,
      data: await this.communityService.upvotePost(id),
    };
  }

  /** Toggle react emoji trên bài diễn đàn — yêu cầu đăng nhập */
  @Post('posts/:id/react')
  async reactPost(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    return {
      success: true,
      data: await this.communityService.togglePostReaction(id, body?.emoji, { id: user.id }),
    };
  }
}
