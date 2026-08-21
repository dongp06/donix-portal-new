'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { PostType } from '@shared/types';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  Code2,
  FileArchive,
  FileCode2,
  FileText,
  GripVertical,
  MessageSquare,
  Pin,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import { MediaImageUpload } from '@/components/media/MediaImageUpload';
import { OfficialBadge } from '@/components/trust/OfficialBadge';
import { useRole } from '@/context/RoleContext';
import { useAdminAccess } from '@/context/AdminAccessContext';
import { apiAdmin, apiDeleteResourceFile, apiPreviewAdminResourceFile, apiUploadResourceFile, type ResourcePreview, type ResourceUploadResult } from '@/lib/api-client';
import type { AdminRole } from '@/lib/admin-server';
import { readDraft, removeDraft, writeDraft } from '@/lib/draft-storage';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PublishMode = 'published' | 'draft' | 'scheduled';
type DraftState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const TYPE_OPTIONS: Array<{ value: PostType; label: string; description: string }> = [
  { value: 'share', label: 'Bài viết', description: 'Nội dung hướng dẫn hoặc chia sẻ.' },
  { value: 'announcement', label: 'Thông báo', description: 'Thông tin mới từ thuebot.org.' },
  { value: 'warning', label: 'Cảnh báo', description: 'Cảnh báo an toàn cần được chú ý.' },
  { value: 'bot_update', label: 'Cập nhật hệ thống', description: 'Thay đổi sản phẩm hoặc vận hành.' },
  { value: 'resource', label: 'Tài nguyên', description: 'Source code, template, archive hoặc tài liệu.' },
];

const CATEGORIES: Array<[string, string]> = [
  ['automation', 'Bot & Automation'],
  ['guides', 'Hướng dẫn'],
  ['warning', 'Bảo mật & cảnh báo'],
  ['telegram', 'Telegram'],
  ['discord', 'Discord'],
  ['development', 'Development'],
];

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function versionValid(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value.replace(/^v/i, '').trim());
}

function formatSavedAt(value: Date | null): string {
  return value ? `Đã lưu ${value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa lưu bản nháp';
}

export function AdminPostEditor({ initialRole }: { initialRole?: AdminRole } = {}) {
  const { staffRole, bots } = useRole();
  const { role: bootstrappedRole } = useAdminAccess();
  const role = bootstrappedRole ?? staffRole ?? initialRole;
  const canPublishOfficial = role === 'owner';
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('announcement');
  const [category, setCategory] = useState('automation');
  const [tags, setTags] = useState('official');
  const [coverImage, setCoverImage] = useState('');
  const [linkedBotId, setLinkedBotId] = useState('');
  const [publishMode, setPublishMode] = useState<PublishMode>('published');
  const [scheduledFor, setScheduledFor] = useState('');
  const [official, setOfficial] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [commentsLocked, setCommentsLocked] = useState(false);
  const [resourceVersion, setResourceVersion] = useState('1.0.0');
  const [resourceChangelog, setResourceChangelog] = useState('');
  const [resourceLicense, setResourceLicense] = useState('MIT');
  const [resourceAllowDownload, setResourceAllowDownload] = useState(true);
  const [resourceShowSource, setResourceShowSource] = useState(true);
  const [resourceRequiresLogin, setResourceRequiresLogin] = useState(false);
  const [resourceFiles, setResourceFiles] = useState<ResourceUploadResult[]>([]);
  const [resourceUploading, setResourceUploading] = useState(false);
  const [resourcePreview, setResourcePreview] = useState<ResourcePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [draftState, setDraftState] = useState<DraftState>('idle');
  const [draftError, setDraftError] = useState<string | null>(null);

  const isResource = type === 'resource';
  const selectedType = TYPE_OPTIONS.find((option) => option.value === type) ?? TYPE_OPTIONS[0];
  const tagValues = useMemo(() => [...new Set(tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 8), [tags]);
  const titleError = attempted && title.trim().length < 5 ? 'Tiêu đề cần ít nhất 5 ký tự.' : null;
  const contentError = attempted && content.trim().length < 20 ? 'Nội dung cần ít nhất 20 ký tự.' : null;
  const scheduleError = attempted && publishMode === 'scheduled' && !toIso(scheduledFor) ? 'Chọn thời gian đăng hợp lệ.' : null;
  const resourceVersionError = attempted && isResource && !versionValid(resourceVersion) ? 'Phiên bản cần có dạng 1.0.0.' : null;
  const resourceFilesError = attempted && isResource && resourceFiles.length === 0 ? 'Tài nguyên cần ít nhất một file đính kèm.' : null;
  const valid = title.trim().length >= 5 && content.trim().length >= 20 && (publishMode !== 'scheduled' || Boolean(toIso(scheduledFor))) && (!isResource || (resourceFiles.length > 0 && versionValid(resourceVersion)));

  useEffect(() => {
    if (!canPublishOfficial) setOfficial(false);
    else if (isResource) setOfficial(true);
  }, [canPublishOfficial, isResource]);

  useEffect(() => {
    try {
      const draft = readDraft<Partial<Record<string, unknown>>>('thuebot-admin-post-draft');
      if (!draft) return;
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.excerpt === 'string') setExcerpt(draft.excerpt);
      if (typeof draft.content === 'string') setContent(draft.content);
      if (typeof draft.type === 'string') setType(draft.type as PostType);
      if (typeof draft.category === 'string') setCategory(draft.category);
      if (typeof draft.tags === 'string') setTags(draft.tags);
      if (typeof draft.coverImage === 'string') setCoverImage(draft.coverImage);
      if (typeof draft.linkedBotId === 'string') setLinkedBotId(draft.linkedBotId);
      if (typeof draft.publishMode === 'string') setPublishMode(draft.publishMode as PublishMode);
      if (typeof draft.scheduledFor === 'string') setScheduledFor(draft.scheduledFor);
      if (typeof draft.official === 'boolean') setOfficial(draft.official);
      if (typeof draft.isPinned === 'boolean') setIsPinned(draft.isPinned);
      if (typeof draft.isFeatured === 'boolean') setIsFeatured(draft.isFeatured);
      if (typeof draft.commentsLocked === 'boolean') setCommentsLocked(draft.commentsLocked);
      if (typeof draft.resourceVersion === 'string') setResourceVersion(draft.resourceVersion);
      if (typeof draft.resourceChangelog === 'string') setResourceChangelog(draft.resourceChangelog);
      if (typeof draft.resourceLicense === 'string') setResourceLicense(draft.resourceLicense);
      if (typeof draft.resourceAllowDownload === 'boolean') setResourceAllowDownload(draft.resourceAllowDownload);
      if (typeof draft.resourceShowSource === 'boolean') setResourceShowSource(draft.resourceShowSource);
      if (typeof draft.resourceRequiresLogin === 'boolean') setResourceRequiresLogin(draft.resourceRequiresLogin);
      if (Array.isArray(draft.resourceFiles)) setResourceFiles(draft.resourceFiles as ResourceUploadResult[]);
      setSavedAt(new Date());
      setDraftState('saved');
    } catch {
      removeDraft('thuebot-admin-post-draft');
      setDraftError('Không đọc được bản nháp admin trên thiết bị này.');
      setDraftState('error');
    }
  }, []);

  useEffect(() => {
    if (!title && !content && !excerpt) return;
    const dirtyTimer = window.setTimeout(() => setDraftState('dirty'), 0);
    const timer = window.setTimeout(() => {
      setDraftState('saving');
      try {
        writeDraft('thuebot-admin-post-draft', { title, excerpt, content, type, category, tags, coverImage, linkedBotId, publishMode, scheduledFor, official, isPinned, isFeatured, commentsLocked, resourceVersion, resourceChangelog, resourceLicense, resourceAllowDownload, resourceShowSource, resourceRequiresLogin, resourceFiles });
        setSavedAt(new Date());
        setDraftError(null);
        setDraftState('saved');
      } catch {
        setDraftError('Không thể lưu bản nháp admin trên thiết bị. Nội dung hiện tại vẫn được giữ lại.');
        setDraftState('error');
      }
    }, 900);
    return () => {
      window.clearTimeout(dirtyTimer);
      window.clearTimeout(timer);
    };
  }, [title, excerpt, content, type, category, tags, coverImage, linkedBotId, publishMode, scheduledFor, official, isPinned, isFeatured, commentsLocked, resourceVersion, resourceChangelog, resourceLicense, resourceAllowDownload, resourceShowSource, resourceRequiresLogin, resourceFiles]);

  const uploadResourceFiles = async (files: FileList | File[]) => {
    const candidates = Array.from(files).slice(0, Math.max(0, 20 - resourceFiles.length));
    if (!candidates.length) return toast.error('Mỗi bài tối đa 20 file tài nguyên.');
    setResourceUploading(true);
    try {
      for (const file of candidates) {
        try {
          const uploaded = await apiUploadResourceFile(file);
          setResourceFiles((current) => [...current, uploaded]);
        } catch (error) {
          toast.error(error instanceof Error ? `${file.name}: ${error.message}` : `Không tải được ${file.name}.`);
        }
      }
    } finally {
      setResourceUploading(false);
    }
  };

  const removeResourceFile = async (fileId: string) => {
    try {
      await apiDeleteResourceFile(fileId);
      setResourceFiles((current) => current.filter((file) => file.fileId !== fileId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xóa được file.');
    }
  };

  const previewResourceFile = async (file: ResourceUploadResult) => {
    if (!file.previewable) return;
    setPreviewLoading(true);
    try {
      setResourcePreview(await apiPreviewAdminResourceFile(file.fileId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xem được mã nguồn.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const submit = async () => {
    setAttempted(true);
    setFormError(null);
    if (!valid || submitting) {
      setFormError('Kiểm tra lại các trường bắt buộc trước khi đăng.');
      return;
    }
    setSubmitting(true);
    try {
      const post = await apiAdmin<{ id: string; slug: string }>('/api/admin/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          excerpt: excerpt.trim(),
          content,
          type,
          category,
          tags: tagValues,
          coverImage: coverImage.trim() || null,
          linkedBotId: linkedBotId || null,
          status: publishMode,
          scheduledAt: publishMode === 'scheduled' ? toIso(scheduledFor) : null,
          official: canPublishOfficial && official,
          isPinned,
          isFeatured,
          commentsLocked,
          resource: isResource ? {
            title: title.trim(),
            description: excerpt.trim(),
            version: resourceVersion.replace(/^v/i, '').trim(),
            changelog: resourceChangelog,
            license: resourceLicense,
            allowDownload: resourceAllowDownload,
            showSource: resourceShowSource,
            requiresLogin: resourceRequiresLogin,
            fileIds: resourceFiles.map((file) => file.fileId),
          } : undefined,
        }),
      });
      removeDraft('thuebot-admin-post-draft');
      toast.success(publishMode === 'scheduled' ? 'Đã lên lịch bài viết.' : publishMode === 'draft' ? 'Đã lưu bản nháp.' : 'Đã đăng bài viết.');
      window.location.href = publishMode === 'published' ? `/posts/${encodeURIComponent(post.slug)}` : `/admin/posts/${encodeURIComponent(post.id)}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo bài viết.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/posts" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden /> Bài viết</Link>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Tạo bài viết</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Đăng nội dung chính thức, thông báo hoặc tài nguyên của thuebot.org.</p>
        </div>
        <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground" role={draftState === 'error' ? 'alert' : 'status'}><span className={cn('h-1.5 w-1.5 rounded-full', draftState === 'saved' ? 'bg-emerald-500' : draftState === 'error' ? 'bg-destructive' : draftState === 'saving' ? 'animate-pulse bg-brand' : 'bg-muted-foreground/40')} aria-hidden />{draftState === 'dirty' ? 'Thay đổi chưa được lưu…' : draftState === 'saving' ? 'Đang lưu bản nháp…' : draftState === 'error' ? (draftError ?? 'Không thể lưu bản nháp.') : formatSavedAt(savedAt)}</p>
      </header>

      {formError ? <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm text-red-700 dark:text-red-300" role="alert"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden />{formError}</div> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="surface min-w-0 overflow-hidden p-5 sm:p-7">
          <div className="border-b border-border pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Đăng với tư cách</p>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-info/25 bg-info/[0.06] px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-info/10 text-info"><ShieldCheck className="h-4 w-4" aria-hidden /></div>
              <div className="min-w-0"><p className="flex items-center gap-1.5 text-sm font-bold">{official ? 'thuebot.org' : 'Tài khoản staff hiện tại'}{official ? <OfficialBadge size="sm" /> : null}</p><p className="mt-0.5 text-xs text-muted-foreground">{official ? 'Tài khoản chính thức' : `${role ?? 'staff'} · nội dung vận hành`}</p></div>
            </div>
          </div>

          <div className="border-b border-border py-6">
            <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Loại bài</p><p className="mt-1 text-xs text-muted-foreground">Preset editor sẽ đổi theo ngữ cảnh.</p></div><span className="hidden text-xs text-muted-foreground sm:block">{selectedType.description}</span></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-5">{TYPE_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setType(option.value)} className={cn('rounded-xl border px-3 py-3 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand', type === option.value ? 'border-brand bg-brand/10 text-foreground' : 'border-border text-muted-foreground hover:border-brand/45 hover:text-foreground')}>{option.label}</button>)}</div>
          </div>

          <div className="space-y-6 pt-6">
            <div><label htmlFor="admin-post-title" className="block text-sm font-semibold">Tiêu đề <span className="text-destructive">*</span></label><input id="admin-post-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Ví dụ: Cập nhật quy trình xác minh seller" className={cn('mt-2 h-12 w-full rounded-xl border bg-background px-3.5 text-base outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/15', titleError ? 'border-destructive' : 'border-border')} />{titleError ? <p className="mt-1.5 text-xs text-destructive">{titleError}</p> : null}</div>
            <div><label htmlFor="admin-post-excerpt" className="block text-sm font-semibold">Mô tả ngắn</label><textarea id="admin-post-excerpt" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} maxLength={280} rows={2} placeholder="Một câu giúp người đọc hiểu bài viết này nói về điều gì." className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/15" /><p className="mt-1 text-right text-[11px] text-muted-foreground">{excerpt.length}/280</p></div>
            <div><div className="mb-2 flex items-center justify-between gap-3"><div><label htmlFor="admin-post-content" className="block text-sm font-semibold">Nội dung <span className="text-destructive">*</span></label><p className="mt-1 text-xs text-muted-foreground">Markdown + GFM · preview dùng đúng renderer production.</p></div></div><MarkdownEditor id="admin-post-content" value={content} onChange={setContent} preset={isResource ? 'resource' : 'official-post'} maxLength={100_000} minHeightClassName="min-h-[30rem]" />{contentError ? <p className="mt-1.5 text-xs text-destructive">{contentError}</p> : null}</div>
            {isResource ? <ResourceFileManager files={resourceFiles} uploading={resourceUploading} error={resourceFilesError} onUpload={(files) => void uploadResourceFiles(files)} onPreview={(file) => void previewResourceFile(file)} onRemove={(fileId) => void removeResourceFile(fileId)} /> : null}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-[88px]">
          {isResource ? <section className="surface border-info/25 bg-info/[0.04] p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Tài nguyên</h3><FileCode2 className="h-4 w-4 text-info" aria-hidden /></div><label htmlFor="resource-version" className="mt-4 block text-xs font-semibold text-muted-foreground">Phiên bản</label><input id="resource-version" value={resourceVersion} onChange={(event) => setResourceVersion(event.target.value)} placeholder="1.0.0" className={cn('mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-info focus:ring-2 focus:ring-info/15', resourceVersionError ? 'border-destructive' : 'border-border')} />{resourceVersionError ? <p className="mt-1 text-xs text-destructive">{resourceVersionError}</p> : null}<label htmlFor="resource-license" className="mt-4 block text-xs font-semibold text-muted-foreground">License</label><select id="resource-license" value={resourceLicense} onChange={(event) => setResourceLicense(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-info"><option>MIT</option><option>Apache-2.0</option><option>GPL-3.0</option><option>BSD-3-Clause</option><option>ISC</option><option>Proprietary</option><option>Other</option></select><label htmlFor="resource-changelog" className="mt-4 block text-xs font-semibold text-muted-foreground">Changelog</label><textarea id="resource-changelog" value={resourceChangelog} onChange={(event) => setResourceChangelog(event.target.value)} rows={3} maxLength={4000} placeholder="Có gì mới trong phiên bản này?" className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-5 outline-none focus:border-info" /><div className="mt-4 space-y-2 border-t border-info/15 pt-4"><Toggle checked={resourceAllowDownload} onChange={setResourceAllowDownload} icon={Upload} label="Cho phép tải xuống" /><Toggle checked={resourceShowSource} onChange={setResourceShowSource} icon={Code2} label="Hiển thị mã nguồn" /><Toggle checked={resourceRequiresLogin} onChange={setResourceRequiresLogin} icon={Check} label="Yêu cầu đăng nhập" /></div><p className="mt-4 text-[11px] leading-5 text-muted-foreground">File chỉ được lưu và tải xuống, không bao giờ được execute trên server.</p></section> : null}

          <section className="surface p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Xuất bản</h3><CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden /></div><div className="mt-4 space-y-2">{([['published', 'Đăng ngay'], ['draft', 'Lưu nháp'], ['scheduled', 'Lên lịch']] as Array<[PublishMode, string]>).map(([value, label]) => <label key={value} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors', publishMode === value ? 'border-brand/45 bg-brand/10' : 'border-border text-muted-foreground hover:border-brand/35')}><input type="radio" name="publish-mode" value={value} checked={publishMode === value} onChange={() => setPublishMode(value)} className="accent-[hsl(var(--brand))]" /><span className="font-semibold">{label}</span></label>)}</div>{publishMode === 'scheduled' ? <div className="mt-3"><label htmlFor="scheduled-for" className="text-xs font-semibold text-muted-foreground">Thời gian đăng</label><input id="scheduled-for" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className={cn('mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand', scheduleError ? 'border-destructive' : 'border-border')} />{scheduleError ? <p className="mt-1 text-xs text-destructive">{scheduleError}</p> : null}</div> : null}<div className="mt-4 space-y-2"><button type="button" onClick={() => void submit()} disabled={submitting || resourceUploading} className="btn-brand w-full py-3">{submitting ? 'Đang lưu…' : publishMode === 'draft' ? 'Lưu bản nháp' : publishMode === 'scheduled' ? 'Lên lịch bài' : <><Send className="h-4 w-4" aria-hidden /> Đăng bài</>}</button><Link href="/admin/posts" className="btn-outline w-full py-2.5">Hủy</Link></div></section>

          <section className="surface p-5"><h3 className="text-sm font-bold">Nhận diện</h3><label className={cn('mt-4 flex items-start gap-3 rounded-xl border p-3', canPublishOfficial ? 'cursor-pointer border-info/25 bg-info/[0.05]' : 'border-border bg-muted/30')}><input type="checkbox" checked={official} onChange={(event) => setOfficial(event.target.checked)} disabled={!canPublishOfficial} className="mt-0.5 accent-[hsl(var(--info))]" /><span><span className="flex items-center gap-1.5 text-sm font-bold">Official <OfficialBadge size="sm" /></span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{canPublishOfficial ? 'Chỉ Owner được đăng với tư cách thuebot.org.' : 'Chỉ Owner mới có thể bật nhãn Official.'}</span></span></label></section>

          <section className="surface p-5"><h3 className="text-sm font-bold">Phân phối</h3><div className="mt-4 space-y-2.5"><Toggle checked={isPinned} onChange={setIsPinned} icon={Pin} label="Ghim trên Posts" /><Toggle checked={isFeatured} onChange={setIsFeatured} icon={Sparkles} label="Nội dung nổi bật" /><Toggle checked={commentsLocked} onChange={setCommentsLocked} icon={MessageSquare} label="Khóa bình luận" /></div></section>

          <section className="surface p-5"><h3 className="text-sm font-bold">Phân loại</h3><label htmlFor="admin-post-category" className="mt-4 block text-xs font-semibold text-muted-foreground">Chủ đề</label><select id="admin-post-category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand">{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label htmlFor="admin-post-tags" className="mt-4 block text-xs font-semibold text-muted-foreground">Tags</label><div className="relative mt-1.5"><Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><input id="admin-post-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="security, trust" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-brand" /></div>{tagValues.length ? <div className="mt-2 flex flex-wrap gap-1.5">{tagValues.map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">#{tag}</span>)}</div> : null}</section>

          <section className="surface p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Ảnh cover</h3><FileText className="h-4 w-4 text-muted-foreground" aria-hidden /></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Ảnh trong nội dung dùng nút Ảnh, kéo thả hoặc paste trực tiếp trong Markdown editor.</p><div className="mt-4"><MediaImageUpload value={coverImage} onChange={setCoverImage} usage="post_cover" label="Tải ảnh cover lên" /></div></section>

          {bots.length ? <section className="surface p-5"><h3 className="text-sm font-bold">Liên kết nội dung</h3><label htmlFor="admin-post-bot" className="mt-4 block text-xs font-semibold text-muted-foreground">Bot</label><select id="admin-post-bot" value={linkedBotId} onChange={(event) => setLinkedBotId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand"><option value="">Không liên kết</option>{bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.title}</option>)}</select></section> : null}
        </aside>
      </div>

      {resourcePreview || previewLoading ? <ResourcePreviewModal preview={resourcePreview} loading={previewLoading} onClose={() => setResourcePreview(null)} /> : null}
    </div>
  );
}

function Toggle({ checked, onChange, icon: Icon, label }: { checked: boolean; onChange: (value: boolean) => void; icon: typeof Upload; label: string }) {
  return <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-foreground"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded accent-[hsl(var(--brand))]" /><Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /><span>{label}</span></label>;
}

function ResourceFileManager({ files, uploading, error, onUpload, onPreview, onRemove }: { files: ResourceUploadResult[]; uploading: boolean; error: string | null; onUpload: (files: FileList | File[]) => void; onPreview: (file: ResourceUploadResult) => void; onRemove: (fileId: string) => void }) {
  const handleDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); onUpload(event.dataTransfer.files); };
  return <section className="rounded-2xl border border-info/25 bg-info/[0.035] p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">File đính kèm</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Code, template, ZIP, PDF hoặc tài liệu. File upload không bao giờ được execute.</p></div><FileArchive className="h-5 w-5 text-info" aria-hidden /></div><div className="mt-4 rounded-xl border border-dashed border-info/35 bg-background p-5 text-center" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}><Upload className="mx-auto h-6 w-6 text-info" aria-hidden /><p className="mt-2 text-sm font-semibold">Kéo file vào đây</p><p className="mt-1 text-xs text-muted-foreground">hoặc chọn file · tối đa 50 MB/file</p><label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-info/50"><Upload className="h-3.5 w-3.5" aria-hidden /> Chọn file<input type="file" multiple className="hidden" onChange={(event) => { if (event.target.files) onUpload(event.target.files); event.target.value = ''; }} /></label></div>{uploading ? <p className="mt-3 text-xs text-info" role="status">Đang tải file…</p> : null}{error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}<div className="mt-4 space-y-2">{files.map((file) => <div key={file.fileId} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"><GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />{file.previewable ? <FileCode2 className="h-4 w-4 shrink-0 text-info" aria-hidden /> : <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}<span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{file.filename}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{file.sizeLabel}{file.language ? ` · ${file.language}` : ''}</span></span>{file.previewable ? <button type="button" onClick={() => onPreview(file)} className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-info hover:bg-info/10">Xem</button> : null}<button type="button" onClick={() => onRemove(file.fileId)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Xóa ${file.filename}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button></div>)}</div></section>;
}

function ResourcePreviewModal({ preview, loading, onClose }: { preview: ResourcePreview | null; loading: boolean; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    if (!preview || downloading) return;
    setDownloading(true);
    try {
      const response = await fetchWithTimeout(`/api/resources/files/${encodeURIComponent(preview.fileId)}/download`, { credentials: 'include', cache: 'no-store' }, 60_000);
      if (!response.ok) throw new Error(`Tải file thất bại (${response.status}).`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = preview.filename || 'resource-file';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được file.');
    } finally {
      setDownloading(false);
    }
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Preview file resource" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white shadow-2xl"><div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><p className="text-sm font-bold">{preview?.filename ?? 'Đang tải mã nguồn…'}</p>{preview ? <p className="mt-1 text-xs text-white/55">{preview.mimeType} · SHA-256 {preview.sha256}</p> : null}</div><div className="flex items-center gap-2">{preview ? <button type="button" onClick={() => void download()} disabled={downloading} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-50">{downloading ? 'Đang tải…' : 'Tải file'}</button> : null}<button type="button" onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Đóng preview"><X className="h-4 w-4" aria-hidden /></button></div></div><div className="min-h-48 overflow-auto p-5">{loading ? <p className="text-sm text-white/60">Đang tải preview…</p> : <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-white/85">{preview?.content}</pre>}</div></div></div>;
}
