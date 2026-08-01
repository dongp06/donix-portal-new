import { Injectable } from '@nestjs/common';
import { MOCK_FORUM_POSTS } from '../data/mock-data';

@Injectable()
export class PostsService {
  async findAll() {
    return MOCK_FORUM_POSTS;
  }

  async findPinned() {
    return MOCK_FORUM_POSTS.filter((p) => p.isPinned);
  }

  async findBySlug(slug: string) {
    return MOCK_FORUM_POSTS.find((p) => p.id === slug) || MOCK_FORUM_POSTS[0];
  }

  async getRenderedArticleHtml(slug: string) {
    const post = await this.findBySlug(slug);
    return post.content;
  }

  async findRelated() {
    return MOCK_FORUM_POSTS.slice(0, 2);
  }

  async categories() {
    return [
      { id: 'cat-1', slug: 'chia-se', name: 'Chia sẻ kinh nghiệm', count: 10 },
      { id: 'cat-2', slug: 'yeu-cau', name: 'Yêu cầu làm bot', count: 5 }
    ];
  }

  async listAll() {
    return MOCK_FORUM_POSTS;
  }
}
