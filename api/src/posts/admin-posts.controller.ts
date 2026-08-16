import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/admin.guard.js';
import { ok } from '../common/api-response.js';
import type { CreatePostInput, UpdatePostInput } from './posts.service.js';
import { PostsService } from './posts.service.js';

@Controller('admin/posts')
@UseGuards(AdminGuard)
export class AdminPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  async list() {
    return ok(await this.posts.listAll());
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const p = await this.posts.findById(id);
    if (!p) {
      throw new NotFoundException({ success: false, error: 'Post not found' });
    }
    return ok(p);
  }

  @Post()
  async create(@Body() body: CreatePostInput) {
    return ok(await this.posts.create(body));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePostInput) {
    return ok(await this.posts.update(id, body));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.posts.delete(id);
    return ok(true);
  }
}
