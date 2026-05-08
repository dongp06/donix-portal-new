import { Controller, Get } from '@nestjs/common';
import { PostsService } from '../posts/posts.service';
import { ok } from '../common/api-response';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  async list() {
    return ok(await this.posts.categories());
  }
}
