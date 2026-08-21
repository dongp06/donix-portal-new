'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, FileText, PenLine, Save, Send } from 'lucide-react';
import type { BotItem, Post, PostType } from '@shared/types';
import { useRole } from '@/context/RoleContext';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import { MediaImageUpload } from '@/components/media/MediaImageUpload';
import { MediaImage } from '@/components/media/MediaImage';
import { readDraft, removeDraft, writeDraft } from '@/lib/draft-storage';
import { toast } from 'sonner';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

const TYPES: { value: PostType; label: string; description: string }[] = [
  { value: 'share', label: 'Chia sẻ', description: 'Tutorial, kinh nghiệm hoặc tài nguyên hữu ích.' },
  { value: 'question', label: 'Hỏi đáp', description: 'Đặt câu hỏi để cộng đồng cùng giải đáp.' },
  { value: 'bot_update', label: 'Cập nhật bot', description: 'Thông báo tính năng, phiên bản hoặc bảo trì.' },
  { value: 'discussion', label: 'Thảo luận', description: 'Mở một chủ đề để cùng trao đổi.' },
  { value: 'warning', label: 'Cảnh báo', description: 'Chia sẻ tín hiệu rủi ro có bằng chứng rõ ràng.' },
];

const CATEGORIES = [
  ['automation', 'Bot & Automation'],
  ['telegram', 'Telegram'],
  ['discord', 'Discord'],
  ['ecommerce', 'E-commerce'],
  ['ai', 'AI'],
  ['development', 'Development'],
  ['guides', 'Hướng dẫn'],
  ['qa', 'Hỏi đáp'],
  ['warning', 'Cảnh báo'],
  ['discussion', 'Thảo luận'],
] as const;

type EditorProps = { postId?: string };
type DraftState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function draftKey(postId?: string) {
  return `thuebot-post-draft:${postId ?? 'new'}`;
}

export function PostEditor({ postId }: EditorProps) {
  const { user, isAuthenticated, bots } = useRole();
  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('share');
  const [category, setCategory] = useState('automation');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [linkedBotId, setLinkedBotId] = useState('');
  const [loading, setLoading] = useState(Boolean(postId));
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<DraftState>('idle');
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) {
      try {
        const draft = readDraft<Partial<Post> & { category?: string; tagsText?: string }>(draftKey());
        if (draft) {
          setTitle(draft.title ?? '');
          setContent(draft.content ?? '');
          setType(draft.type ?? 'share');
          setCategory(draft.category ?? 'automation');
          setTags(draft.tagsText ?? draft.tags?.join(', ') ?? '');
          setCoverImage(draft.coverImage ?? '');
          setLinkedBotId(draft.linkedBotId ?? '');
          setSavedAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
          setDraftState('saved');
        }
      } catch {
        removeDraft(draftKey());
        setDraftError('Không đọc được bản nháp trên thiết bị này.');
        setDraftState('error');
      }
      return;
    }

    void fetchWithTimeout(`/api/posts/${encodeURIComponent(postId)}`, { credentials: 'include' }, 20_000)
      .then(async (response) => {
        const json = await response.json().catch(() => null) as { success?: boolean; data?: Post; error?: string } | null;
        if (!response.ok || !json?.success || !json.data) throw new Error(json?.error || 'Không tải được bài viết.');
        return json.data as Post;
      })
      .then((data) => {
        setPost(data);
        setTitle(data.title);
        setContent(data.content ?? '');
        setType(data.type);
        setCategory(data.category);
        setTags(data.tags.join(', '));
        setCoverImage(data.coverImage ?? '');
        setLinkedBotId(data.linkedBotId ?? '');
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không tải được bài viết.'))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    if (loading || postId || (!title && !content)) return;
    const dirtyTimer = window.setTimeout(() => setDraftState('dirty'), 0);
    const timer = window.setTimeout(() => {
      setDraftState('saving');
      try {
        writeDraft(draftKey(), { title, content, type, category, tagsText: tags, coverImage, linkedBotId });
        setSavedAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
        setDraftError(null);
        setDraftState('saved');
      } catch {
        setDraftError('Không thể lưu bản nháp trên thiết bị. Nội dung hiện tại vẫn được giữ lại.');
        setDraftState('error');
      }
    }, 700);
    return () => {
      window.clearTimeout(dirtyTimer);
      window.clearTimeout(timer);
    };
  }, [category, content, coverImage, linkedBotId, loading, postId, tags, title, type]);

  const selectedType = TYPES.find((item) => item.value === type) ?? TYPES[0];
  const selectedBot = useMemo(() => bots.find((bot) => bot.id === linkedBotId), [bots, linkedBotId]);

  const submit = async (status: 'draft' | 'published') => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const body = {
        title: title.trim(),
        content,
        type,
        category,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        coverImage: coverImage.trim() || null,
        linkedBotId: linkedBotId || null,
        status,
      };
      const response = await fetchWithTimeout(postId ? `/api/posts/${encodeURIComponent(postId)}` : '/api/posts', {
        method: postId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      }, 30_000);
      const json = await response.json().catch(() => null) as { success?: boolean; data?: Post; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error || 'Không lưu được bài viết.');
      removeDraft(draftKey(postId));
      const saved = json.data as Post;
      toast.success(status === 'draft' ? 'Đã lưu bản nháp.' : 'Bài viết đã được đăng.');
      window.location.href = status === 'draft' ? '/me/posts' : `/posts/${encodeURIComponent(saved.slug)}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được bài viết.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthenticated === null || loading) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-sm text-muted-foreground">Đang tải trình soạn thảo…</div>;
  }

  if (isAuthenticated !== true) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="surface p-8">
          <PenLineIcon />
          <h1 className="mt-4 font-display text-2xl font-bold">Đăng nhập để đăng bài</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Bài viết được gắn với hồ sơ của bạn để người đọc biết ai đang chia sẻ.</p>
          <div className="mt-5 flex justify-center"><GoogleLoginButton redirectTo={postId ? `/posts/${postId}/edit` : '/posts/new'} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/posts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden /> Quay lại Posts</Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {draftState === 'saving' ? <span role="status">Đang lưu bản nháp…</span> : null}
          {draftState === 'dirty' ? <span role="status">Thay đổi chưa được lưu…</span> : null}
          {draftState === 'saved' && savedAt ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> Đã lưu bản nháp lúc {savedAt}</span> : null}
          {draftState === 'error' ? <span className="text-destructive" role="alert">{draftError ?? 'Không thể lưu bản nháp.'}</span> : null}
          <span className="inline-flex items-center gap-1.5"><MediaImage src={user.avatar} fallbackSrc="/avt.png" alt="" className="h-6 w-6 rounded-full object-cover" />{user.name}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main className="surface overflow-hidden">
          <div className="border-b border-border p-5 sm:p-7">
            <p className="eyebrow">{post ? 'Chỉnh sửa bài viết' : 'Bài viết mới'}</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Viết điều đáng lưu lại</h1>
            <p className="mt-2 text-sm text-muted-foreground">Một bài rõ ràng, có ví dụ hoặc bằng chứng sẽ giúp cộng đồng tin bạn hơn.</p>
          </div>
          <div className="space-y-6 p-5 sm:p-7">
            <div>
              <label htmlFor="post-title" className="mb-2 block text-sm font-semibold">Tiêu đề</label>
              <input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Ví dụ: Cách chạy Telegram Bot 24/7 với Docker" className="h-12 w-full rounded-xl border border-border bg-background px-3.5 text-base outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20" />
              <p className="mt-1 text-right text-xs text-muted-foreground">{title.length}/200</p>
            </div>

            <div>
              <label htmlFor="post-content" className="mb-2 block text-sm font-semibold">Nội dung</label>
              <MarkdownEditor id="post-content" value={content} onChange={setContent} preset="community-post" maxLength={100_000} minHeightClassName="min-h-[26rem]" />
              <p className="mt-1.5 text-xs text-muted-foreground">Tối thiểu 20 ký tự · Preview dùng đúng renderer của bài public.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="post-type" className="mb-2 block text-sm font-semibold">Loại bài</label>
                <select id="post-type" value={type} onChange={(event) => setType(event.target.value as PostType)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-brand/60">
                  {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <p className="mt-1.5 text-xs text-muted-foreground">{selectedType.description}</p>
              </div>
              <div>
                <label htmlFor="post-category" className="mb-2 block text-sm font-semibold">Chủ đề</label>
                <select id="post-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-brand/60">
                  {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="post-tags" className="mb-2 block text-sm font-semibold">Tags</label>
              <input id="post-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="telegram, docker, automation" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-brand/60" />
              <p className="mt-1.5 text-xs text-muted-foreground">Phân cách bằng dấu phẩy, tối đa 8 tag.</p>
            </div>
          </div>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="surface p-5">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand" aria-hidden /><h2 className="font-semibold">Tùy chọn</h2></div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Ảnh cover (tùy chọn)</p>
                <MediaImageUpload value={coverImage} onChange={setCoverImage} usage="post_cover" label="Tải ảnh cover lên" />
              </div>
              {user.role === 'seller' && bots.length > 0 ? (
                <div>
                  <label htmlFor="post-bot" className="mb-2 block text-xs font-semibold text-muted-foreground">Liên kết bot của bạn</label>
                  <select id="post-bot" value={linkedBotId} onChange={(event) => setLinkedBotId(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-brand/60">
                    <option value="">Không liên kết</option>
                    {bots.filter((bot: BotItem) => bot.seller.id === user.id).map((bot) => <option key={bot.id} value={bot.id}>{bot.title}</option>)}
                  </select>
                  {selectedBot ? <p className="mt-2 text-xs text-muted-foreground">Bài sẽ liên kết tới {selectedBot.title}.</p> : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="font-semibold">Trước khi đăng</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>• Tiêu đề rõ và không viết toàn chữ in hoa.</li>
              <li>• Không đăng thông tin cá nhân hoặc giao dịch nhạy cảm.</li>
              <li>• Bài cảnh báo cần nêu nguồn/bằng chứng để admin kiểm tra.</li>
            </ul>
          </section>

          <div className="flex flex-col gap-2">
            <button type="button" disabled={submitting || title.trim().length < 5 || content.trim().length < 20} onClick={() => void submit('published')} className="btn-brand w-full py-3"><Send className="h-4 w-4" aria-hidden />{submitting ? 'Đang lưu…' : 'Đăng bài'}</button>
            <button type="button" disabled={submitting || !title.trim() || !content.trim()} onClick={() => void submit('draft')} className="btn-outline w-full py-3"><Save className="h-4 w-4" aria-hidden /> Lưu bản nháp</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PenLineIcon() {
  return <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><PenLine className="h-6 w-6" aria-hidden /></div>;
}
