'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { attachmentReference } from '@/lib/media';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { MediaImage } from './MediaImage';

type MediaImageUploadProps = {
  value?: string;
  onChange: (value: string) => void;
  usage: 'post_cover' | 'bot_logo' | 'bot_cover' | 'bot_demo' | 'pricing_image' | 'resource_image' | 'review_image';
  label?: string;
  className?: string;
};

export function MediaImageUpload({ value, onChange, usage, label = 'Tải ảnh lên', className }: MediaImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Chỉ nhận file hình ảnh.');
    if (file.size > 10 * 1024 * 1024) return toast.error('Ảnh phải nhỏ hơn 10 MB.');
    const body = new FormData();
    body.append('file', file);
    body.append('usage', usage);
    setUploading(true);
    try {
      const response = await fetchWithTimeout('/api/uploads/images', { method: 'POST', body, credentials: 'include' });
      const json = await response.json() as { success?: boolean; error?: string; data?: { attachmentId?: string } };
      if (!response.ok || !json.success || !json.data?.attachmentId) throw new Error(json.error || 'Upload ảnh thất bại.');
      onChange(attachmentReference(json.data.attachmentId));
      toast.success('Đã tải ảnh lên Media Library.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload ảnh thất bại.');
    } finally {
      setUploading(false);
    }
  };

  return <div className={cn('space-y-2', className)}><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} aria-label={label} />{value ? <div className="group relative overflow-hidden rounded-xl border border-border bg-muted"><MediaImage src={value} alt="Ảnh đã chọn" className="aspect-video w-full object-cover" /><div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2.5 py-2 text-xs text-white"><span className="truncate">Ảnh cover đã chọn</span><button type="button" onClick={() => onChange('')} className="rounded-md p-1 hover:bg-white/15" aria-label="Xóa ảnh"><X className="h-3.5 w-3.5" aria-hidden /></button></div></div> : <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex min-h-28 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-60">{uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ImagePlus className="h-5 w-5" aria-hidden />}{uploading ? 'Đang tải lên…' : label}</button>}</div>;
}
