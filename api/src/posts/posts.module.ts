import { Module } from '@nestjs/common';
import { AdminPostsController } from './admin-posts.controller.js';
import { CategoriesController } from '../categories/categories.controller.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  controllers: [PostsController, CategoriesController, AdminPostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
