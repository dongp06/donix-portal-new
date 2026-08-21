'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Bookmark, Check, Clock3, Eye, MoreHorizontal, Pin, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Post, ReactionSummary } from '@shared/types';
import { CommentSection } from '@/components/comments/CommentSection';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { useRole } from '@/context/RoleContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PostCard } from './PostCard';
import { TrustedBadge } from '@/components/trust/TrustedBadge';
import { OfficialBadge } from '@/components/trust/OfficialBadge';
import { ImageLightbox } from '@/components/media/ImageLightbox';
import { ResourceFiles } from '@/components/resources/ResourceFiles';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { MediaImage } from '@/components/media/MediaImage';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

type DetailData = { post: Post; related: Post[] };

const TYPE_LABELS: Record<string, string> = {
  share: 'Chia sẻ',
  question: 'Hỏi đáp',
  bot_update: 'Seller update',
  warning: 'Cảnh báo',
  discussion: 'Thảo luận',
  announcement: 'Thông báo',
  resource: 'Tài nguyên',
};

export function PostDetail({ slug, initialData }: { slug: string; initialData?: DetailData | null }) {
  const { isAuthenticated } = useRole();
  const [data, setData] = useState<DetailData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [reportOpen, setReportOpen] = useState(false);
  const [officialMenuOpen, setOfficialMenuOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [coverPreviewOpen, setCoverPreviewOpen] = useState(false);

  useEffect(() => {
    if (initialData) return;
    void fetchWithTimeout(`/api/posts/slug/${encodeURIComponent(slug)}`, { credentials: 'include' }, 20_000)
      .then(async (res) => {
        const json = await res.json().catch(() => null) as { success?: boolean; data?: DetailData; error?: string } | null;
        if (!res.ok || !json?.success || !json.data) throw new Error(json?.error || 'Không tải được bài viết.');
        return json.data;
      })
      .then(setData)
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không tải được bài viết.'))
      .finally(() => setLoading(false));
  }, [initialData, slug]);

  const toggleReaction = async (emoji: string) => {
    if (!data) return;
    if (isAuthenticated !== true) {
      toast.info('Đăng nhập để bày tỏ cảm xúc.');
      return;
    }
    try {
      const res = await fetchWithTimeout(`/api/posts/${encodeURIComponent(data.post.id)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      }, 20_000);
      const json = await res.json().catch(() => null) as { success?: boolean; data?: ReactionSummary[]; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.error || 'Không cập nhật reaction.');
      const reactions = json.data;
      const count = reactions.reduce((sum, item) => sum + item.count, 0);
      setData((current) => current ? { ...current, post: { ...current.post, reactions, reactionCount: count } } : current);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không cập nhật reaction.');
    }
  };

  const toggleBookmark = async () => {
    if (!data) return;
    if (isAuthenticated !== true) {
      toast.info('Đăng nhập để lưu bài viết.');
      return;
    }
    try {
      const res = await fetchWithTimeout(`/api/posts/${encodeURIComponent(data.post.id)}/bookmark`, { method: 'PUT', credentials: 'include' }, 20_000);
      const json = await res.json().catch(() => null) as { success?: boolean; data?: { bookmarked: boolean; bookmarkCount: number }; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.error || 'Không lưu được bài viết.');
      const bookmark = json.data;
      setData((current) => current ? { ...current, post: { ...current.post, isBookmarked: bookmark.bookmarked, bookmarkCount: bookmark.bookmarkCount } } : current);
      toast.success(bookmark.bookmarked ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được bài viết.');
    }
  };

  const sendReport = async () => {
    if (!data || reporting) return;
    setReporting(true);
    try {
      const res = await fetchWithTimeout(`/api/posts/${encodeURIComponent(data.post.id)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category: reportCategory, details: reportDetails }),
      }, 20_000);
      const json = await res.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Không gửi được báo cáo.');
      setReportOpen(false);
      setReportDetails('');
      toast.success('Đã gửi báo cáo để admin kiểm tra.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không gửi được báo cáo.');
    } finally {
      setReporting(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-sm text-muted-foreground">Đang tải bài viết...</div>;
  if (!data) return <div className="mx-auto max-w-2xl px-4 py-20 text-center"><h1 className="font-display text-2xl font-bold">Không tìm thấy bài viết</h1><Link href="/posts" className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline">Về Posts</Link></div>;

  const { post } = data;
  const authorHref = post.author.slug ? `/sellers/${encodeURIComponent(post.author.slug)}` : post.author.id ? `/sellers/${encodeURIComponent(post.author.id)}` : undefined;
  const hasTrust = Boolean(post.author.isTrusted);
  const isOfficial = Boolean(post.author.isOfficial);
  // Official posts are published under the platform identity in public UI.
  const isSystemOfficial = isOfficial;
  const authorAvatar = isSystemOfficial ? '/favicon.svg' : post.author.avatar;
  const officialRoleLabel = post.author.officialRole === 'admin' ? 'Admin' : 'Owner';
  const isSecurityWarning = isOfficial && (post.type === 'warning' || post.tags.some((tag) => ['security', 'bảo mật', 'policy'].includes(tag.trim().toLowerCase())));
  const typeLabel = isSecurityWarning ? 'Cảnh báo · Bảo mật' : (TYPE_LABELS[post.type] ?? 'Bài viết');
  const showCategory = Boolean(!isSecurityWarning && post.categoryName && post.categoryName.trim().toLowerCase() !== typeLabel.toLowerCase());
  const reaction = (emoji: string) => post.reactions?.find((item) => item.emoji === emoji);

  const openReport = () => {
    setOfficialMenuOpen(false);
    if (isAuthenticated !== true) {
      toast.info('Đăng nhập để báo cáo bài viết.');
      return;
    }
    setReportOpen((value) => !value);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 md:py-12 lg:px-8">
        <Link href="/posts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden /> Tất cả Posts</Link>

        <article className="mt-6">
          <header className={cn('rounded-3xl border border-border bg-card p-5 sm:p-8 md:p-10', isOfficial && 'border-t-[3px] border-t-[#1677FF] border-[#1677FF]/25 bg-[#1677FF]/[0.025]')}>
            {isOfficial ? <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#1677FF]/15 pb-5">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#1677FF]">THUEBOT.ORG</span>
              <OfficialBadge size="sm" showLabel />
              <span className="text-xs text-muted-foreground">Nội dung chính thức từ nền tảng</span>
            </div> : null}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              <span className={isSecurityWarning ? 'text-amber-600 dark:text-amber-400' : undefined}>{typeLabel}</span>
              {showCategory ? <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{post.categoryName}</span></> : null}
              {post.isPinned ? <span className="ml-1 inline-flex items-center gap-1 text-amber-500"><Pin className="h-3.5 w-3.5" aria-hidden /> Ghim</span> : null}
            </div>
            <h1 className="mt-4 max-w-4xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl md:max-w-[820px] md:text-[46px] md:leading-[1.08]">{post.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">{post.excerpt}</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                {authorAvatar ? <MediaImage src={authorAvatar} alt="" className={cn('h-9 w-9 rounded-full border border-border object-cover', isOfficial && 'ring-2 ring-[#1677FF]/20 ring-offset-2 ring-offset-card')} /> : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {authorHref ? <Link href={authorHref} className="font-semibold text-foreground hover:text-brand">{post.author.name}</Link> : <strong className="text-foreground">{post.author.name}</strong>}
                    {isOfficial ? <OfficialBadge size="md" /> : hasTrust ? <TrustedBadge size="sm" interactive={false} info={{ isTrusted: true }} /> : null}
                  </div>
                  <p className={cn('mt-0.5 text-[11px]', isOfficial ? 'font-medium text-[#1677FF]' : 'text-muted-foreground')}>
                    {isOfficial ? `Official · ${officialRoleLabel}` : hasTrust ? (post.author.tier === 'top' ? 'Top Seller' : 'Trusted Seller') : 'Thành viên thuebot.org'}
                  </p>
                </div>
              </div>
              <span>{new Date(post.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden />{post.readTimeMinutes} phút đọc</span>
              <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" aria-hidden />{post.views} lượt xem</span>
            </div>
          </header>

          {post.coverImage ? <div className="group relative mt-5 overflow-hidden rounded-2xl border border-border bg-card"><button type="button" onClick={() => setCoverPreviewOpen(true)} className="relative block w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset" aria-label={`Xem ảnh ${post.title}`}><MediaImage src={post.coverImage} alt={post.title} className="max-h-[32rem] w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]" /><span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">Xem ảnh</span></button></div> : null}

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="min-w-0">
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
                {isOfficial ? <div className="mb-5 rounded-2xl border border-[#1677FF]/20 bg-[#1677FF]/[0.06] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0B5CCC] dark:text-[#75AEFF]">
                    <OfficialBadge size="sm" />
                    <span>Thông báo chính thức từ thuebot.org</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Nội dung dưới đây được đăng trực tiếp bởi đội ngũ vận hành thuebot.org.</p>
                </div> : null}
                {isSecurityWarning ? <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                    <ShieldAlert className="h-4 w-4" aria-hidden />
                    <span>Cảnh báo bảo mật</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-amber-900/80 dark:text-amber-100/80">Không cung cấp token hoặc quyền quản trị cho bot nếu bạn chưa xác minh rõ nhà cung cấp, phạm vi quyền và cách thu hồi quyền truy cập.</p>
                </div> : null}
                <MarkdownRenderer value={post.content ?? ''} />
                {post.resource ? <ResourceFiles resource={post.resource} /> : null}
                {post.tags.length > 0 ? <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-5">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">#{tag}</span>)}</div> : null}
              </div>

              {post.linkedBot ? <Link href={`/bots/${encodeURIComponent(post.linkedBot.id)}`} className="mt-4 flex items-center gap-3 rounded-2xl border border-brand/25 bg-brand/5 p-4 transition-colors hover:border-brand/50"><MediaImage src={post.linkedBot.coverImage} alt="" className="h-14 w-14 rounded-xl object-cover" /><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">Bot được nhắc đến</span><strong className="mt-1 block truncate text-sm">{post.linkedBot.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{post.linkedBot.seller.name} · ⭐ {post.linkedBot.rating.toFixed(1)} · {post.linkedBot.reviewCount} đánh giá</span></span><span className="text-sm font-semibold text-brand">Xem bot →</span></Link> : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
                <div className="flex flex-wrap gap-2">
                  <ReactionButton emoji="👍" label="Hữu ích" item={reaction('👍')} onClick={() => void toggleReaction('👍')} />
                  <ReactionButton emoji="❤️" label="Thích" item={reaction('❤️')} onClick={() => void toggleReaction('❤️')} />
                  <button type="button" onClick={toggleBookmark} className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors', post.isBookmarked ? 'border-brand/50 bg-brand/10 text-brand' : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground')}><Bookmark className="h-4 w-4" aria-hidden />{post.isBookmarked ? 'Đã lưu' : 'Lưu'} <span className="font-normal">{post.bookmarkCount}</span></button>
                </div>
                <div className="relative">
                  <button type="button" onClick={isOfficial ? () => setOfficialMenuOpen((value) => !value) : openReport} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={isOfficial ? 'Tùy chọn bài viết' : 'Báo cáo bài viết'} aria-expanded={isOfficial ? officialMenuOpen : undefined} aria-haspopup={isOfficial ? 'menu' : undefined}>
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                    {!isOfficial ? <span>Báo cáo</span> : null}
                  </button>
                  {isOfficial && officialMenuOpen ? <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                    <button type="button" role="menuitem" onClick={openReport} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Báo cáo nội dung</button>
                  </div> : null}
                </div>
              </div>

              {reportOpen ? <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-amber-500" aria-hidden /> Báo cáo nội dung</div><div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr]"><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-2 text-sm"><option value="spam">Spam</option><option value="scam">Nghi ngờ scam</option><option value="promotion">Quảng cáo quá mức</option><option value="misinformation">Sai lệch</option><option value="harassment">Quấy rối</option><option value="other">Khác</option></select><textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={2} maxLength={2000} placeholder="Mô tả thêm (không bắt buộc)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60" /></div><div className="mt-3 flex justify-end"><button type="button" disabled={reporting} onClick={() => void sendReport()} className="btn-brand px-3 py-2 text-xs">{reporting ? 'Đang gửi...' : 'Gửi báo cáo'}</button></div></div> : null}

              <div className="mt-8"><CommentSection targetType="post" targetId={post.id} locked={post.commentsLocked} /></div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <section className={cn('surface p-5', isOfficial && 'border-[#1677FF]/25 bg-[#1677FF]/[0.04]')}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tác giả</p>
                  {isOfficial ? <OfficialBadge size="sm" showLabel /> : null}
                </div>
                <div className="mt-4 flex items-start gap-3">
                  {authorAvatar ? <MediaImage src={authorAvatar} alt="" className={cn('h-12 w-12 rounded-full border border-border object-cover', isOfficial && 'ring-2 ring-[#1677FF]/20 ring-offset-2 ring-offset-card')} /> : null}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><p className="truncate font-semibold">{post.author.name}</p>{isOfficial ? <OfficialBadge size="sm" /> : hasTrust ? <TrustedBadge size="sm" interactive={false} info={{ isTrusted: true }} /> : null}</div>
                    <p className={cn('mt-0.5 text-xs', isOfficial ? 'font-medium text-[#1677FF]' : 'text-muted-foreground')}>{isOfficial ? `Official · ${officialRoleLabel}` : hasTrust ? (post.author.tier === 'top' ? 'Top Seller' : 'Trusted Seller') : 'Thành viên thuebot.org'}</p>
                  </div>
                </div>
                {isOfficial ? <>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Tài khoản chính thức của nền tảng thuebot.org.</p>
                  <div className="mt-4 space-y-2 border-t border-[#1677FF]/15 pt-4 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#1677FF]" aria-hidden /> Xác thực bởi hệ thống</p>
                    <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#1677FF]" aria-hidden /> Chủ nền tảng</p>
                  </div>
                </> : null}
                {!isOfficial && typeof post.author.trustScore === 'number' ? <p className="mt-4 text-xs text-muted-foreground">Trust Score <strong className="text-foreground">{post.author.trustScore}/100</strong></p> : null}
                {authorHref ? <Link href={authorHref} className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-brand/40 hover:text-brand">Xem hồ sơ seller</Link> : isOfficial ? <Link href="/posts" className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-[#1677FF]/25 px-3 py-2 text-xs font-semibold text-[#0B5CCC] hover:bg-[#1677FF]/[0.08] dark:text-[#75AEFF]">Xem Posts chính thức</Link> : null}
              </section>
              {post.type === 'question' && post.answerCommentId ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-600"><Check className="mb-2 h-5 w-5" aria-hidden /><strong>Đã có câu trả lời hữu ích</strong></div> : null}
            </aside>
          </div>
        </article>

        {data.related.length > 0 ? <section className="mt-12"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Đọc tiếp</p><h2 className="mt-1 font-display text-2xl font-bold">Có thể bạn quan tâm</h2></div><Link href="/posts" className="text-sm font-semibold text-brand hover:underline">Xem tất cả</Link></div><div className="grid gap-3 md:grid-cols-2">{data.related.map((item) => <PostCard key={item.id} post={item} compact />)}</div></section> : null}
      </div>
      {coverPreviewOpen && post.coverImage ? <ImageLightbox images={[{ src: post.coverImage, alt: post.title }]} initialIndex={0} onClose={() => setCoverPreviewOpen(false)} /> : null}
    </div>
  );
}

function ReactionButton({ emoji, label, item, onClick }: { emoji: string; label: string; item?: ReactionSummary; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors', item?.reactedByMe ? 'border-brand/50 bg-brand/10 text-brand' : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground')}><span aria-hidden>{emoji}</span>{label}<span className="font-normal">{item?.count ?? 0}</span></button>;
}
