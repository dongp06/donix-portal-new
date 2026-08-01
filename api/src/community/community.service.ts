import { Injectable, NotFoundException } from '@nestjs/common';
import { MOCK_FORUM_POSTS } from '../data/mock-data';
import { ForumPost } from '../data/types';

@Injectable()
export class CommunityService {
  private posts: ForumPost[] = [...MOCK_FORUM_POSTS];

  getPosts(category?: string): ForumPost[] {
    if (category && category !== 'Tất cả') {
      return this.posts.filter((p) => p.category === category);
    }
    return this.posts;
  }

  createPost(postData: Partial<ForumPost>): ForumPost {
    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      title: postData.title || 'Bài viết mới',
      excerpt: postData.excerpt || (postData.content ? postData.content.slice(0, 100) + '...' : ''),
      content: postData.content || '',
      authorName: postData.authorName || 'Trần Minh Tuấn',
      authorAvatar: postData.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      authorRole: postData.authorRole || 'Khách Thuê',
      category: postData.category || 'Chia sẻ kinh nghiệm',
      upvotes: 1,
      commentsCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      tags: postData.tags || ['Thảo luận']
    };

    this.posts.unshift(newPost);
    return newPost;
  }

  upvotePost(id: string): ForumPost {
    const post = this.posts.find((p) => p.id === id);
    if (!post) throw new NotFoundException('Bài viết không tồn tại.');
    post.upvotes += 1;
    return post;
  }
}
