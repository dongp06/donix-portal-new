'use client';

import React, { useState } from 'react';
import { MOCK_FORUM_POSTS } from '@shared/mock-data';
import { ForumPost } from '@shared/types';
import { MessageSquare, ThumbsUp, Plus, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CommunityPage() {
  const [posts, setPosts] = useState<ForumPost[]>([...MOCK_FORUM_POSTS]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [isNewPostOpen, setIsNewPostOpen] = useState<boolean>(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<any>('Chia sẻ kinh nghiệm');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('Bot Auto, Dev');

  const categories = [
    'Tất cả',
    'Chia sẻ kinh nghiệm',
    'Yêu cầu làm bot',
    'Thảo luận Dev',
    'Báo lỗi & Hỗ trợ',
  ];

  const filteredPosts = posts.filter(
    (p) => selectedCategory === 'Tất cả' || p.category === selectedCategory,
  );

  const handleUpvote = (postId: string) => {
    setPosts(posts.map((p) => (p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p)));
    toast.success('Đã upvote bài viết');
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const created: ForumPost = {
      id: `post-${Date.now()}`,
      title: newTitle,
      excerpt: newContent.slice(0, 120) + '...',
      content: newContent,
      authorName: 'Trần Minh Tuấn',
      authorAvatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      authorRole: 'Khách Thuê',
      category: newCategory,
      upvotes: 1,
      commentsCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      tags: newTags.split(',').map((t) => t.trim()),
    };

    setPosts([created, ...posts]);
    setIsNewPostOpen(false);
    setNewTitle('');
    setNewContent('');
    toast.success('Đăng bài viết mới thành công');
  };

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Diễn đàn thảo luận</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              Cộng đồng lập trình & thuê bot
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Chia sẻ bí quyết chạy bot an toàn, đăng yêu cầu làm bot mới hoặc cập nhật từ các developer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsNewPostOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Đăng bài thảo luận
          </button>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Lọc theo chủ đề">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={selectedCategory === cat}
              className={cn(
                'shrink-0 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors',
                selectedCategory === cat
                  ? 'border-brand/50 bg-brand/10 text-brand'
                  : 'border-border bg-card text-muted-foreground hover:border-brand/30 hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts list */}
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="flex flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-brand/30 md:flex-row md:items-center"
            >
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 font-semibold text-brand">
                    {post.category}
                  </span>
                  {post.isPinned && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-semibold text-amber-500">
                      Ghim nổi bật
                    </span>
                  )}
                  <span className="text-muted-foreground">• {post.createdAt}</span>
                </div>

                <h3 className="text-lg font-semibold leading-snug">{post.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="h-6 w-6 rounded-full border border-border object-cover"
                    />
                    <span className="font-semibold text-foreground">{post.authorName}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {post.authorRole}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {post.tags.map((tag) => (
                      <span key={tag} className="font-mono text-[11px] text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upvote & comments */}
              <div className="flex items-center gap-3 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <button
                  type="button"
                  onClick={() => handleUpvote(post.id)}
                  className="flex min-w-[60px] flex-col items-center justify-center rounded-xl border border-border bg-background p-3 text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                  aria-label={`Upvote bài "${post.title}"`}
                >
                  <ThumbsUp className="mb-1 h-4 w-4" aria-hidden />
                  <span className="text-xs font-bold">{post.upvotes}</span>
                </button>
                <div className="flex min-w-[60px] flex-col items-center justify-center rounded-xl border border-border bg-background p-3 text-muted-foreground">
                  <MessageSquare className="mb-1 h-4 w-4" aria-hidden />
                  <span className="text-xs font-bold">{post.commentsCount}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* New post modal */}
      {isNewPostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl">
            <button
              type="button"
              onClick={() => setIsNewPostOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-lg font-bold">Đăng bài thảo luận mới</h3>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label htmlFor="post-title" className="mb-1 block text-xs text-muted-foreground">
                  Tiêu đề bài viết
                </label>
                <input
                  id="post-title"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="VD: Cần thuê làm bot Auto TikTok Reup"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="post-category" className="mb-1 block text-xs text-muted-foreground">
                  Chủ đề
                </label>
                <select
                  id="post-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="Chia sẻ kinh nghiệm">Chia sẻ kinh nghiệm</option>
                  <option value="Yêu cầu làm bot">Yêu cầu làm bot</option>
                  <option value="Thảo luận Dev">Thảo luận Dev</option>
                  <option value="Báo lỗi & Hỗ trợ">Báo lỗi & Hỗ trợ</option>
                </select>
              </div>

              <div>
                <label htmlFor="post-content" className="mb-1 block text-xs text-muted-foreground">
                  Nội dung bài viết
                </label>
                <textarea
                  id="post-content"
                  rows={4}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Mô tả chi tiết ý tưởng hoặc câu hỏi của bạn..."
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="post-tags" className="mb-1 block text-xs text-muted-foreground">
                  Thẻ tag (phân cách bằng dấu phẩy)
                </label>
                <input
                  id="post-tags"
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPostOpen(false)}
                  className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
                >
                  Đăng bài ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
