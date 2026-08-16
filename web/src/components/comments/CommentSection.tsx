'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CommentItem, CommentTargetType, ReactionSummary } from '@shared/types';
import { MessageSquare, ThumbsUp, Heart, Smile, Frown, Angry, Laugh, Meh, Pencil, Trash2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRole } from '../../context/RoleContext';
import { GoogleLoginButton } from '../auth/GoogleLoginButton';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'] as const;

/** Chuyển emoji → icon lucide (fallback: text emoji) */
function EmojiGlyph({ emoji, className }: { emoji: string; className?: string }) {
  switch (emoji) {
    case '👍':
      return <ThumbsUp className={cn('h-4 w-4', className)} aria-hidden />;
    case '❤️':
      return <Heart className={cn('h-4 w-4', className)} aria-hidden />;
    case '😂':
      return <Laugh className={cn('h-4 w-4', className)} aria-hidden />;
    case '😮':
      return <Meh className={cn('h-4 w-4', className)} aria-hidden />;
    case '😢':
      return <Frown className={cn('h-4 w-4', className)} aria-hidden />;
    case '😡':
      return <Angry className={cn('h-4 w-4', className)} aria-hidden />;
    default:
      return <span className={cn('text-sm', className)} aria-hidden>{emoji}</span>;
  }
}

interface CommentSectionProps {
  targetType: CommentTargetType;
  targetId: string;
}

/**
 * Hệ thống bình luận FB-style: comment + reply lồng nhiều cấp + react emoji.
 * Dùng chung cho blog, diễn đàn, trang bot.
 */
export function CommentSection({ targetType, targetId }: CommentSectionProps) {
  const { user, isAuthenticated } = useRole();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [draft, setDraft] = useState('');
  const [editTarget, setEditTarget] = useState<CommentItem | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [openEmojiFor, setOpenEmojiFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/comments?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) setComments(json.data as CommentItem[]);
    } catch {
      toast.error('Không tải được bình luận');
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetType,
          targetId,
          content,
          parentId: replyTo?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Gửi bình luận thất bại');
      }
      setDraft('');
      setReplyTo(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gửi bình luận thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const content = editDraft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/comments/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Sửa bình luận thất bại');
      setEditTarget(null);
      setEditDraft('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sửa bình luận thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const removeComment = async (c: CommentItem) => {
    if (!window.confirm('Xóa bình luận này?')) return;
    try {
      const res = await fetch(`/api/comments/${c.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Xóa bình luận thất bại');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa bình luận thất bại');
    }
  };

  const react = async (c: CommentItem, emoji: string) => {
    try {
      const res = await fetch(`/api/comments/${c.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'React thất bại');
      setOpenEmojiFor(null);
      // Cập nhật reactions cục bộ cho nhanh
      setComments((prev) => patchCommentReactions(prev, c.id, json.data as ReactionSummary[]));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'React thất bại');
    }
  };

  const totalCount = comments.reduce((n, c) => n + 1 + countReplies(c), 0);

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30';

  return (
    <section className="space-y-4" aria-label="Bình luận">
      {/* Header + count */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <MessageSquare className="h-4 w-4 text-brand" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">
          Bình luận ({loading ? '…' : totalCount})
        </h3>
      </div>

      {/* Input comment */}
      {isAuthenticated === true ? (
        <div className="space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Đang trả lời <strong className="text-foreground">{replyTo.authorName}</strong>
              </span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground" aria-label="Hủy trả lời">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-start gap-3">
            <img src={user.avatar} alt={user.name} className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
            <div className="flex-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={replyTo ? `Viết trả lời cho ${replyTo.authorName}…` : 'Viết bình luận…'}
                rows={2}
                className={inputClass}
                maxLength={2000}
                aria-label="Nội dung bình luận"
              />
              <div className="mt-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!draft.trim() || submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {submitting ? 'Đang gửi…' : 'Bình luận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : isAuthenticated === false ? (
        <div className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
          <p className="mb-2">Đăng nhập để tham gia bình luận.</p>
          <div className="flex justify-center">
            <GoogleLoginButton redirectTo={typeof window !== 'undefined' ? window.location.pathname : '/community'} />
          </div>
        </div>
      ) : null}

      {/* List */}
      <div className="space-y-4">
        {loading && <p className="py-2 text-sm text-muted-foreground">Đang tải bình luận…</p>}
        {!loading && comments.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">Chưa có bình luận. Hãy là người đầu tiên!</p>
        )}
        {comments.map((c) => (
          <CommentNode
            key={c.id}
            comment={c}
            depth={0}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            editTarget={editTarget}
            setEditTarget={setEditTarget}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onSaveEdit={() => void saveEdit()}
            onDelete={(c) => void removeComment(c)}
            onReact={(c, e) => void react(c, e)}
            openEmojiFor={openEmojiFor}
            setOpenEmojiFor={setOpenEmojiFor}
          />
        ))}
      </div>
    </section>
  );
}

function countReplies(c: CommentItem): number {
  return c.replies.reduce((n, r) => n + 1 + countReplies(r), 0);
}

/** Cập nhật reactions theo id trong cây (đệ quy) */
function patchCommentReactions(
  list: CommentItem[],
  id: string,
  reactions: ReactionSummary[],
): CommentItem[] {
  return list.map((c) => {
    if (c.id === id) {
      return {
        ...c,
        reactions,
        reactionCount: reactions.reduce((s, r) => s + r.count, 0),
        replies: c.replies,
      };
    }
    return { ...c, replies: patchCommentReactions(c.replies, id, reactions) };
  });
}

interface CommentNodeProps {
  comment: CommentItem;
  depth: number;
  replyTo: CommentItem | null;
  setReplyTo: (c: CommentItem | null) => void;
  editTarget: CommentItem | null;
  setEditTarget: (c: CommentItem | null) => void;
  editDraft: string;
  setEditDraft: (s: string) => void;
  onSaveEdit: () => void;
  onDelete: (c: CommentItem) => void;
  onReact: (c: CommentItem, e: string) => void;
  openEmojiFor: string | null;
  setOpenEmojiFor: (s: string | null) => void;
}

function CommentNode({
  comment,
  depth,
  replyTo,
  setReplyTo,
  editTarget,
  setEditTarget,
  editDraft,
  setEditDraft,
  onSaveEdit,
  onDelete,
  onReact,
  openEmojiFor,
  setOpenEmojiFor,
}: CommentNodeProps) {
  const maxDepth = Math.min(depth, 5); // Giới hạn thụt lề tối đa

  return (
    <div className={cn('space-y-3', maxDepth > 0 && 'border-l border-border pl-4 ml-3')}>
      <div className="space-y-1">
        <div className="flex items-start gap-2.5">
          <img src={comment.authorAvatar} alt={comment.authorName} className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">{comment.authorName}</span>
              <span className="text-muted-foreground">{comment.createdAt}</span>
            </div>

            {/* Nội dung / chỉnh sửa */}
            {editTarget?.id === comment.id ? (
              <div className="mt-1.5 space-y-1.5">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-xl border border-brand/40 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
                  aria-label="Sửa bình luận"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={onSaveEdit} className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground hover:brightness-110">
                    Lưu
                  </button>
                  <button type="button" onClick={() => { setEditTarget(null); setEditDraft(''); }} className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{comment.content}</p>
            )}

            {/* Reactions + actions */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {comment.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact(comment, r.emoji)}
                  title={`${r.emoji} ${r.count}`}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                    r.reactedByMe
                      ? 'border-brand/50 bg-brand/10 text-brand'
                      : 'border-border bg-background text-muted-foreground hover:border-brand/40',
                  )}
                >
                  <EmojiGlyph emoji={r.emoji} />
                  <span>{r.count}</span>
                </button>
              ))}

              {/* Nút react chọn emoji */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenEmojiFor(openEmojiFor === comment.id ? null : comment.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                  aria-expanded={openEmojiFor === comment.id}
                  aria-haspopup="true"
                  aria-label={`React bình luận của ${comment.authorName}`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                  Thích
                </button>
                {openEmojiFor === comment.id && (
                  <div className="absolute bottom-full left-0 z-10 mb-1.5 flex items-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-xl" role="menu" aria-label="Chọn cảm xúc">
                    {REACTION_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => onReact(comment, e)}
                        className="rounded-full p-1.5 text-lg transition-transform hover:scale-125"
                        role="menuitem"
                        aria-label={e}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply + own actions */}
              <div className="inline-flex items-center gap-1">
                <button type="button" onClick={() => setReplyTo(replyTo?.id === comment.id ? null : comment)} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-brand">
                  Trả lời
                </button>
                {comment.isOwn && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setEditTarget(editTarget?.id === comment.id ? null : comment); setEditDraft(comment.content); }}
                      className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-brand"
                    >
                      Sửa
                    </button>
                    <button type="button" onClick={() => onDelete(comment)} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-red-500">
                      Xóa
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Replies */}
        {comment.replies.length > 0 && (
          <div className="space-y-3">
            {comment.replies.map((child) => (
              <CommentNode
                key={child.id}
                comment={child}
                depth={depth + 1}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                editTarget={editTarget}
                setEditTarget={setEditTarget}
                editDraft={editDraft}
                setEditDraft={setEditDraft}
                onSaveEdit={onSaveEdit}
                onDelete={onDelete}
                onReact={onReact}
                openEmojiFor={openEmojiFor}
                setOpenEmojiFor={setOpenEmojiFor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
