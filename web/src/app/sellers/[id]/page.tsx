'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { useRole } from '../../../context/RoleContext';
import { BotItem, ForumPost, SellerProfile } from '@shared/types';
import { BotCard } from '../../../components/bot/BotCard';
import { ContactModal } from '../../../components/modals/ContactModal';
import { EditProfileModal } from '../../../components/modals/EditProfileModal';
import {
  ShieldCheck,
  Star,
  CalendarDays,
  Bot,
  MessageSquare,
  ThumbsUp,
  PencilLine,
  UserRound,
  MessageCircle,
  Send,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SellerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAuthenticated, updateProfile } = useRole();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<'bots' | 'posts'>('bots');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [contactBot, setContactBot] = useState<BotItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sellers/${id}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setNotFound(true);
        return;
      }
      setProfile(json.data as SellerProfile);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`Đã sao chép ${label}`);
  };

  if (loading) {
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

  const { user: seller, bots, posts } = profile;
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
                {seller.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Đã xác thực
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  Rating {seller.rating.toFixed(1)} / 5.0
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" aria-hidden />
                  Điểm uy tín {seller.reputation ?? Math.round(seller.rating * 20)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  Tham gia {joinLabel}
                </span>
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
