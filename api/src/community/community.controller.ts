import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  getPosts(@Query('category') category?: string) {
    return {
      success: true,
      data: this.communityService.getPosts(category)
    };
  }

  @Post('posts')
  createPost(@Body() postData: any) {
    const post = this.communityService.createPost(postData);
    return {
      success: true,
      data: post
    };
  }

  @Post('posts/:id/upvote')
  upvotePost(@Param('id') id: string) {
    const updated = this.communityService.upvotePost(id);
    return {
      success: true,
      data: updated
    };
  }
}
