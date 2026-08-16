'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../../../context/RoleContext';
import { BotItem, ForumPost, SellerProfile } from '@shared/types';
import { BotCard } from '../../../components/bot/BotCard';
import { ContactModal } from '../../../components/modals/ContactModal';
import { EditProfileModal } from '../../../components/modals/EditProfileModal';
import { Badge } from '../../../components/ui/badge';
import { Progress } from '../../../components/ui/progress';
import {
  ShieldCheck,
  CalendarDays,
  Bot,
  MessageSquare,
  ThumbsUp,
  PencilLine,
  UserRound,
  MessageCircle,
  Send,
  Phone,
  History,
  Award,
  BadgeCheck,
} from 'lucide-react';
import { toast } from 'sonner';

/** Nhãn tiếng Việt cho từng loại sự kiện uy tín */
const TRUST_EVENT_LABELS: Record<string, string> = {
  joined: 'Gia nhập thuebot.org',
  verification_approved: 'Đã xác minh',
  verification_submitted: 'Đã nộp hồ sơ xác minh',
  verification_rejected: 'Bị từ chối xác minh',
  verification_expired: 'Xác minh hết hạn',
  verification_revoked: 'Bị thu hồi xác minh',
  tier_changed: 'Đổi hạng',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function SellerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { user, isAuthenticated, updateProfile } = useRole();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<'bots' | 'posts'>('bots');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [contactBot, setContactBot] = useState<BotItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sellers/${slug}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setNotFound(true);
        return;
      }
      const nextProfile = json.data as SellerProfile;
      setProfile(nextProfile);
      if (nextProfile.user.slug && nextProfile.user.slug !== slug) {
        setRedirecting(true);
        router.replace(`/sellers/${encodeURIComponent(nextProfile.user.slug)}`);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [router, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`Đã sao chép ${label}`);
  };

  if (loading || redirecting) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Đang tải hồ sơ…</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background px-4 text-foreground">
        <div className="space-y-4 text-center">
          <UserRound className="mx-auto h-10 w-10 text-brand" aria-hidden />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Không tìm thấy hồ sơ
          </h1>
          <p className="text-sm text-muted-foreground">
            Người bán này không tồn tại hoặc đã bị xóa.
          </p>
          <Link
            href="/bots"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
          >
            Về chợ bot
          </Link>
        </div>
      </div>
    );
  }

  const { user: seller, bots, posts, trustEvents } = profile;
  const isOwner = isAuthenticated === true && user.id === seller.id;
  const contact = seller.contact ?? {};
  const channels = [
    contact.zalo && { icon: MessageCircle, label: 'Zalo', value: contact.zalo },
    contact.messenger && { icon: MessageCircle, label: 'Messenger', value: contact.messenger },
    contact.facebook && { icon: MessageCircle, label: 'Facebook', value: contact.facebook },
    contact.telegram && { icon: Send, label: 'Telegram', value: contact.telegram },
    contact.phone && { icon: Phone, label: 'Điện thoại', value: contact.phone },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string }[];

  const joinDate = new Date(seller.joinedDate + 'T00:00:00');
  const joinLabel = Number.isNaN(joinDate.getTime())
    ? seller.joinedDate
    : joinDate.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });

  const trustScore = seller.trustScore;
  const tier = seller.tier;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-5">
            <img
              src={seller.avatar}
              alt={seller.name}
              className="h-24 w-24 shrink-0 rounded-2xl border border-border object-cover"
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight">{seller.name}</h1>
                {tier === 'trusted' && (
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Trust Seller
                  </Badge>
                )}
                {tier === 'top' && (
                  <Badge className="border-amber-400/40 bg-amber-400/10 text-amber-400">
                    <Award className="h-3.5 w-3.5" aria-hidden />
                    Top Seller
                  </Badge>
                )}
                {seller.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Đã xác thực
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {typeof trustScore === 'number' && (
                  <span className="inline-flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5" aria-hidden />
                    Điểm uy tín {trustScore}/100
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  Tham gia {joinLabel}
                </span>
                {seller.verifiedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Xác minh ngày {formatDate(seller.verifiedAt)}
                  </span>
                )}
              </div>
              {seller.bio ? (
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{seller.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có giới thiệu.</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand/40 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                <PencilLine className="h-4 w-4" aria-hidden />
                Sửa hồ sơ
              </button>
            )}
            {channels.length > 0 && (
              <div className="space-y-2">
                {channels.map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => copy(c.value, c.label)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-2.5 text-left text-sm transition-colors hover:border-brand/40"
                    >
                      <Icon className="h-4 w-4 text-brand" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[11px] text-muted-foreground">{c.label}</span>
                        <span className="block truncate font-semibold">{c.value}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Trust score + timeline */}
        {typeof trustScore === 'number' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Bot className="h-4 w-4" aria-hidden />
                Điểm uy tín
              </h2>
              <div className="flex items-end gap-2">
                <span className="font-display text-4xl font-bold tracking-tight">{trustScore}</span>
                <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
              </div>
              <Progress value={trustScore} aria-label={`Điểm uy tín ${trustScore}/100`} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Điểm được tính từ thời gian hoạt động, đánh giá và xác minh danh tính của người bán.
              </p>
            </section>

            {trustEvents && trustEvents.length > 0 && (
              <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <History className="h-4 w-4" aria-hidden />
                  Lịch sử uy tín
                </h2>
                <ol className="space-y-3">
                  {trustEvents.map((evt) => {
                    const label =
                      evt.type === 'tier_changed' && evt.detail?.from && evt.detail?.to
                        ? `Đổi hạng (${evt.detail.from} → ${evt.detail.to})`
                        : (TRUST_EVENT_LABELS[evt.type] ?? evt.type);
                    return (
                      <li key={evt.id} className="flex items-start gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
                        <div className="min-w-0 text-sm">
                          <p className="font-medium text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(evt.createdAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        )}

        {/* Tabs */}
        <div>
          <div role="tablist" aria-label="Nội dung hồ sơ" className="flex gap-2 border-b border-border">
            {(
              [
                { key: 'bots', label: `Bots (${bots.length})`, icon: Bot },
                { key: 'posts', label: `Bài viết diễn đàn (${posts.length})`, icon: MessageSquare },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-brand text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="pt-6">
            {tab === 'bots' &&
              (bots.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {bots.map((bot) => (
                    <BotCard key={bot.id} bot={bot} onContactClick={setContactBot} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Chưa có bot nào được đăng.
                </p>
              ))}

            {tab === 'posts' &&
              (posts.length > 0 ? (
                <div className="space-y-3">
                  {posts.map((post: ForumPost) => (
                    <article
                      key={post.id}
                      className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/40"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 font-semibold text-brand">
                          {post.category}
                        </span>
                        <span>{post.createdAt}</span>
                      </div>
                      <h3 className="mt-2 font-semibold text-foreground">{post.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {post.excerpt}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                        <span>{post.upvotes} upvote</span>
                        <span>·</span>
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        <span>{post.commentsCount} bình luận</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Chưa có bài viết diễn đàn nào.
                </p>
              ))}
          </div>
        </div>
      </div>

      <ContactModal bot={contactBot} isOpen={contactBot !== null} onClose={() => setContactBot(null)} />
      {isOwner && (
        <EditProfileModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          bio={seller.bio ?? ''}
          contact={contact}
          onSave={async (bio, contactDraft) => {
            await updateProfile(bio, contactDraft);
            await load();
          }}
        />
      )}
    </div>
  );
}
