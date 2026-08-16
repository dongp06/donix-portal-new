import { Controller, Get, Post, Patch, Delete, Query, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommentsService } from './comments.service.js';
import { AuthService } from '../auth/auth.service.js';
import { getCurrentUser, requireUser } from '../auth/current-user.js';

@Controller('comments')
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    private readonly auth: AuthService,
  ) {}

  /** Lấy cây comment — viewer được truyền qua cookie để đánh dấu isOwn/reactedByMe */
  @Get()
  async list(
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
    @Req() req: Request,
  ) {
    const viewer = await getCurrentUser(req, this.auth);
    const data = await this.comments.getComments(targetType, targetId, viewer?.id ?? null);
    return { success: true, data };
  }

  /** Tạo comment / reply — yêu cầu đăng nhập */
  @Post()
  async create(@Body() body: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const data = await this.comments.createComment(
      {
        targetType: body?.targetType,
        targetId: body?.targetId,
        content: body?.content,
        parentId: body?.parentId,
      },
      { id: user.id, name: user.name, avatar: user.avatar },
    );
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const data = await this.comments.updateComment(id, body?.content, { id: user.id });
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const data = await this.comments.deleteComment(id, { id: user.id });
    return { success: true, data };
  }

  /** Toggle react emoji trên comment */
  @Post(':id/react')
  async react(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const data = await this.comments.toggleCommentReaction(id, body?.emoji, { id: user.id });
    return { success: true, data };
  }
}
