import { Module } from '@nestjs/common';
import { AdminPostsController } from './admin-posts.controller';
import { CategoriesController } from '../categories/categories.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  controllers: [PostsController, CategoriesController, AdminPostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
