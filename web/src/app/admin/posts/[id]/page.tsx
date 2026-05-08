'use client';

import { PostEditor } from '@/components/admin/PostEditor';
import { useParams } from 'next/navigation';

export default function AdminEditPostPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  if (!id) {
    return <p className="text-zinc-400">Thiếu id bài viết.</p>;
  }
  return <PostEditor mode="edit" postId={id} />;
}
