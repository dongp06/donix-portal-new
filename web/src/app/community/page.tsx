'use client';

import React, { useState } from 'react';
import { MOCK_FORUM_POSTS } from '@shared/mock-data';
import { ForumPost } from '@shared/types';
import { MessageSquare, ThumbsUp, PlusCircle, Sparkles, Tag, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CommunityPage() {
  const [posts, setPosts] = useState<ForumPost[]>([...MOCK_FORUM_POSTS]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [isNewPostOpen, setIsNewPostOpen] = useState<boolean>(false);

  // New post form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<any>('Chia sẻ kinh nghiệm');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('Bot Auto, Dev');

  const categories = [
    'Tất cả',
    'Chia sẻ kinh nghiệm',
    'Yêu cầu làm bot',
    'Thảo luận Dev',
    'Báo lỗi & Hỗ trợ'
  ];

  const filteredPosts = posts.filter(
    (p) => selectedCategory === 'Tất cả' || p.category === selectedCategory
  );

  const handleUpvote = (postId: string) => {
    setPosts(
      posts.map((p) => (p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p))
    );
    toast.success('Đã upvote bài viết!');
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
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      authorRole: 'Khách Thuê',
      category: newCategory,
      upvotes: 1,
      commentsCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      tags: newTags.split(',').map((t) => t.trim())
    };

    setPosts([created, ...posts]);
    setIsNewPostOpen(false);
    setNewTitle('');
    setNewContent('');
    toast.success('Đăng bài viết mới thành công!');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Diễn Đàn Thảo Luận
            </div>
            <h1 className="text-3xl font-black text-white">Cộng Đồng Lập Trình & Thuê Bot</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Chia sẻ bí quyết chạy bot an toàn, đăng yêu cầu làm bot mới hoặc cập nhật thông báo từ các Developer.
            </p>
          </div>

          <button
            onClick={() => setIsNewPostOpen(true)}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-xs text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Đăng Bài Thảo Luận Mới
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-md'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts List */}
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-cyan-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                    {post.category}
                  </span>
                  {post.isPinned && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                      Ghim Nổi Bật
                    </span>
                  )}
                  <span className="text-zinc-500">• {post.createdAt}</span>
                </div>

                <h3 className="text-lg font-bold text-white hover:text-cyan-400 transition-colors">
                  {post.title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{post.excerpt}</p>

                {/* Author Info & Tags */}
                <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="w-6 h-6 rounded-full object-cover border border-zinc-700"
                    />
                    <span className="font-semibold text-zinc-300">{post.authorName}</span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                      {post.authorRole}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    {post.tags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] text-zinc-500 font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upvote & Comment counts */}
              <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6">
                <button
                  onClick={() => handleUpvote(post.id)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all text-zinc-300 hover:text-cyan-400 min-w-[60px]"
                >
                  <ThumbsUp className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold">{post.upvotes}</span>
                </button>

                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 min-w-[60px]">
                  <MessageSquare className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold">{post.commentsCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Post Modal */}
      {isNewPostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 text-white space-y-4">
            <button
              onClick={() => setIsNewPostOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white">Đăng Bài Thảo Luận Mới</h3>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Tiêu đề bài viết</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="VD: Cần thuê làm Bot Auto TikTok Reup"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Chủ đề</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Chia sẻ kinh nghiệm">Chia sẻ kinh nghiệm</option>
                  <option value="Yêu cầu làm bot">Yêu cầu làm bot</option>
                  <option value="Thảo luận Dev">Thảo luận Dev</option>
                  <option value="Báo lỗi & Hỗ trợ">Báo lỗi & Hỗ trợ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nội dung bài viết</label>
                <textarea
                  rows={4}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Mô tả chi tiết ý tưởng hoặc câu hỏi của bạn..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Thẻ tag (Phân cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPostOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 text-sm hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-bold text-black text-sm"
                >
                  Đăng Bài Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
