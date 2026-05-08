'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, apiAdmin, apiUploadAttachment } from '@/lib/api-client';
import type { Category, Post, PostAttachment } from '@shared/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

function newAttId() {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type Mode = 'create' | 'edit';

export function PostEditor({ mode, postId }: { mode: Mode; postId?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('cat1');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [readMinutes, setReadMinutes] = useState('');
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const cats = await api<Category[]>('/api/categories');
        if (cancelled) return;
        setCategories(cats);
        if (mode === 'create' && cats.length) {
          setCategoryId((prev) => (cats.some((c) => c.id === prev) ? prev : cats[0].id));
        }

        if (mode === 'edit' && postId) {
          const post = await apiAdmin<Post>(`/api/admin/posts/${postId}`);
          if (cancelled) return;
          setSlug(post.slug);
          setTitle(post.title);
          setCategoryId(post.categoryId);
          setExcerpt(post.excerpt);
          setContent(post.content);
          setCoverImage(post.coverImage);
          setIsPinned(post.isPinned);
          setReadMinutes(
            post.readTimeMinutes != null ? String(post.readTimeMinutes) : '',
          );
          setAttachments(post.attachments ?? []);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Tải dữ liệu thất bại');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, postId]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const data = await apiUploadAttachment(file);
      setAttachments((prev) => [
        ...prev,
        {
          id: newAttId(),
          filename: data.filename,
          sizeLabel: data.sizeLabel,
          fileId: data.fileId,
        },
      ]);
      toast.success('Đã upload file');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload lỗi');
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const readTimeMinutes = readMinutes.trim()
      ? Number.parseInt(readMinutes, 10)
      : undefined;
    if (readMinutes.trim() && Number.isNaN(readTimeMinutes)) {
      toast.error('Phút đọc không hợp lệ');
      return;
    }
    const payload = {
      slug,
      title,
      categoryId,
      excerpt,
      content,
      coverImage,
      isPinned,
      readTimeMinutes:
        readTimeMinutes != null && !Number.isNaN(readTimeMinutes)
          ? readTimeMinutes
          : undefined,
      attachments: attachments.length ? attachments : undefined,
    };
    setSaving(true);
    try {
      if (mode === 'create') {
        const created = await apiAdmin<Post>('/api/admin/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Đã tạo bài');
        router.push(`/admin/posts/${created.id}`);
      } else if (postId) {
        await apiAdmin<Post>(`/api/admin/posts/${postId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Đã cập nhật');
        router.push('/admin/posts');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (loadingMeta) {
    return <p className="text-zinc-400">Đang tải…</p>;
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title" className="text-zinc-200">
            Tiêu đề
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            required
            className="border-zinc-700 bg-zinc-900 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug" className="text-zinc-200">
            Slug (URL)
          </Label>
          <Input
            id="slug"
            value={slug}
            onChange={(ev) => setSlug(ev.target.value)}
            required
            className="border-zinc-700 bg-zinc-900 text-white"
            placeholder="vi-du-bai-viet"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-200">Danh mục</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="border-zinc-700 bg-zinc-900 text-white">
              <SelectValue placeholder="Chọn danh mục" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="excerpt" className="text-zinc-200">
            Mô tả ngắn
          </Label>
          <Textarea
            id="excerpt"
            value={excerpt}
            onChange={(ev) => setExcerpt(ev.target.value)}
            rows={3}
            className="border-zinc-700 bg-zinc-900 text-white"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="content" className="text-zinc-200">
            Nội dung (HTML)
          </Label>
          <Textarea
            id="content"
            value={content}
            onChange={(ev) => setContent(ev.target.value)}
            rows={14}
            className="border-zinc-700 bg-zinc-900 font-mono text-sm text-white"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cover" className="text-zinc-200">
            Ảnh bìa (URL)
          </Label>
          <Input
            id="cover"
            value={coverImage}
            onChange={(ev) => setCoverImage(ev.target.value)}
            className="border-zinc-700 bg-zinc-900 text-white"
            placeholder="https://..."
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="pinned"
            checked={isPinned}
            onCheckedChange={(v) => setIsPinned(v === true)}
          />
          <Label htmlFor="pinned" className="cursor-pointer text-zinc-200">
            Ghim bài
          </Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="read" className="text-zinc-200">
            Phút đọc (tuỳ chọn)
          </Label>
          <Input
            id="read"
            type="number"
            min={0}
            value={readMinutes}
            onChange={(ev) => setReadMinutes(ev.target.value)}
            className="border-zinc-700 bg-zinc-900 text-white"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-white">File đính kèm</p>
            <p className="text-xs text-zinc-500">Upload sẽ lưu tạm trên API; link tải dùng /api/files/:fileId</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => void onPickFile(e)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
          >
            {uploading ? 'Đang tải…' : 'Chọn file'}
          </Button>
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-zinc-500">Chưa có file.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
              >
                <span className="text-zinc-200">
                  {a.filename}{' '}
                  <span className="text-zinc-500">({a.sizeLabel})</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:bg-red-950/50 hover:text-red-300"
                  onClick={() => removeAttachment(a.id)}
                >
                  Gỡ
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={saving}
          className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
        >
          {saving ? 'Đang lưu…' : mode === 'create' ? 'Tạo bài' : 'Lưu thay đổi'}
        </Button>
        <Button type="button" variant="outline" asChild className="border-zinc-600 text-zinc-200">
          <Link href="/admin/posts">Huỷ</Link>
        </Button>
      </div>
    </form>
  );
}
