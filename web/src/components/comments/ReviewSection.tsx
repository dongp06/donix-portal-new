'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BotReview } from '@shared/types';
import { Star, Camera, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRole } from '../../context/RoleContext';

interface ReviewSectionProps {
  botId: string;
}

/** Upload 1 ảnh → URL (dùng /api/files/upload có sẵn) */
async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/files/upload', { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || !json.success || !json.data?.fileId) {
    throw new Error(json.error || 'Upload ảnh thất bại');
  }
  return `/api/files/${json.data.fileId}`;
}

const MAX_IMAGES = 5;

/**
 * Tab Đánh giá bot: form viết review (sao + nội dung + ảnh ≤5)
 * + danh sách review có ảnh + sửa/xóa review của mình.
 */
export function ReviewSection({ botId }: ReviewSectionProps) {
  const { user, isAuthenticated } = useRole();
  const [reviews, setReviews] = useState<BotReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Form đánh giá
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sửa review
  const [editTarget, setEditTarget] = useState<BotReview | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bots/${botId}/reviews`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) setReviews(json.data as BotReview[]);
    } catch {
      toast.error('Không tải được đánh giá');
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePickImages = async (e: React.ChangeEvent<HTMLInputElement>, edit = false) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const remaining = MAX_IMAGES - (edit ? editImages.length : images.length);
    if (files.length > remaining) {
      toast.error(`Tối đa ${MAX_IMAGES} ảnh cho mỗi đánh giá`);
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        if (!f.type.startsWith('image/')) {
          toast.error(`${f.name} không phải ảnh`);
          continue;
        }
        urls.push(await uploadImage(f));
      }
      if (edit) setEditImages((prev) => [...prev, ...urls]);
      else setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload ảnh thất bại');
    } finally {
      setUploading(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || submitting) {
      toast.error('Vui lòng chọn số sao đánh giá');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bots/${botId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, comment: comment.trim(), images }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Gửi đánh giá thất bại');
      }
      setReviews((prev) => [json.data as BotReview, ...prev]);
      setRating(0);
      setComment('');
      setImages([]);
      toast.success('Đã gửi đánh giá');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gửi đánh giá thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (r: BotReview) => {
    setEditTarget(r);
    setEditRating(r.rating);
    setEditComment(r.comment);
    setEditImages(r.images ?? []);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bots/${botId}/reviews/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating: editRating, comment: editComment.trim(), images: editImages }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Cập nhật đánh giá thất bại');
      }
      const updated = json.data as BotReview;
      setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditTarget(null);
      toast.success('Đã cập nhật đánh giá');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật đánh giá thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteReview = async (r: BotReview) => {
    if (!window.confirm('Xóa đánh giá này?')) return;
    try {
      const res = await fetch(`/api/bots/${botId}/reviews/${r.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Xóa đánh giá thất bại');
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
      toast.success('Đã xóa đánh giá');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa đánh giá thất bại');
    }
  };

  const renderStars = (value: number, onChange?: (n: number) => void, size = 'h-6 w-6') => (
    <div className="flex items-center gap-1" role={onChange ? 'radiogroup' : undefined} aria-label="Số sao đánh giá">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} sao`}
          title={`${n} sao`}
          className={cn(
            'cursor-pointer p-0.5 transition-transform',
            onChange ? 'hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50' : 'cursor-default',
          )}
        >
          <Star
            className={cn(
              size,
              n <= value ? 'fill-amber-400 text-amber-400' : 'text-zinc-400',
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30';

  return (
    <section className="space-y-6" aria-label="Đánh giá bot">
      {/* Form viết review */}
      {isAuthenticated === true ? (
        <form onSubmit={submitReview} className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h4 className="text-sm font-semibold text-foreground">Đánh giá bot này</h4>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Điểm của bạn:</span>
            {renderStars(rating, setRating)}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Chia sẻ trải nghiệm khi thuê bot…"
            className={inputClass}
            aria-label="Nội dung đánh giá"
          />
          {/* Ảnh kèm */}
          <div className="flex flex-wrap items-center gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative">
                <img src={url} alt={`Ảnh đánh giá ${i + 1}`} className="h-16 w-16 rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground/80 p-0.5 text-background hover:bg-foreground"
                  aria-label="Xóa ảnh"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground disabled:opacity-50"
                aria-label="Thêm ảnh đánh giá"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                <span className="text-[10px]">{images.length}/{MAX_IMAGES}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void handlePickImages(e)} />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Đang gửi…' : 'Gửi đánh giá'}
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          Đăng nhập để đánh giá bot này.
        </p>
      )}

      {/* Danh sách review */}
      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Đang tải đánh giá…</p>}
        {!loading && reviews.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Chưa có đánh giá nào cho bot này.
          </p>
        )}
        {reviews.map((r) => (
          <article key={r.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={r.userAvatar} alt={r.userName} className="h-8 w-8 rounded-full border border-border object-cover" />
                <div>
                  <span className="block text-sm font-semibold text-foreground">{r.userName}</span>
                  <span className="block text-[11px] text-muted-foreground">{r.date}</span>
                </div>
              </div>
              {r.isOwn && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => startEdit(r)} className="rounded-lg p-1.5 text-muted-foreground hover:text-brand" aria-label="Sửa đánh giá">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => void deleteReview(r)} className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500" aria-label="Xóa đánh giá">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {editTarget?.id === r.id ? (
              <div className="space-y-2 border-t border-border pt-3">
                {renderStars(editRating, setEditRating)}
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  className={inputClass}
                  aria-label="Sửa nội dung đánh giá"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {(editImages ?? []).map((url, i) => (
                    <div key={url} className="relative">
                      <img src={url} alt="" className="h-14 w-14 rounded-lg border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground/80 p-0.5 text-background"
                        aria-label="Xóa ảnh"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {(editImages ?? []).length < MAX_IMAGES && (
                    <button type="button" onClick={() => editFileRef.current?.click()} disabled={uploading} className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-brand/40 disabled:opacity-50" aria-label="Thêm ảnh">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                  )}
                  <input ref={editFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void handlePickImages(e, true)} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void saveEdit()} disabled={submitting || !editRating} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:brightness-110 disabled:opacity-50">
                    Lưu
                  </button>
                  <button type="button" onClick={() => setEditTarget(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex text-amber-400">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400" aria-hidden />
                  ))}
                </div>
                {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
                {(r.images ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(r.images ?? []).map((url) => (
                      <img key={url} src={url} alt="Ảnh đánh giá" loading="lazy" className="h-20 w-20 rounded-lg border border-border object-cover" />
                    ))}
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
