import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CommentItem, ReactionSummary, CommentTargetType } from '../../../shared/types.js';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const MAX_COMMENT_LENGTH = 2000;
const TARGET_TYPES: CommentTargetType[] = ['post', 'forum', 'bot'];

interface ReactionRow {
  emoji: string;
  count: number;
  reactedByMe: number;
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateTargetType(type: string): CommentTargetType {
    if (!TARGET_TYPES.includes(type as CommentTargetType)) {
      throw new BadRequestException('Loại nội dung không hợp lệ.');
    }
    return type as CommentTargetType;
  }

  /** Kiểm tra đối tượng target tồn tại */
  private async ensureTarget(type: CommentTargetType, id: string) {
    const exists =
      type === 'post'
        ? !!(await this.prisma.post.findUnique({ where: { id }, select: { id: true } }))
        : type === 'forum'
          ? !!(await this.prisma.forumPost.findUnique({ where: { id }, select: { id: true } }))
          : !!(await this.prisma.bot.findUnique({ where: { id }, select: { id: true } }));
    if (!exists) throw new NotFoundException('Nội dung không tồn tại.');
  }

  /** Gom reactions theo emoji cho 1 target + đánh dấu reactedByMe theo user */
  private async reactionsFor(targetType: string, targetId: string, userId: string | null): Promise<ReactionSummary[]> {
    const rows = await this.prisma.reaction.groupBy({
      by: ['emoji'],
      where: { targetType, targetId },
      _count: { emoji: true },
    });
    const mine = userId
      ? await this.prisma.reaction.findMany({
          where: { targetType, targetId, userId },
          select: { emoji: true },
        })
      : [];
    const mySet = new Set(mine.map((r) => r.emoji));
    return rows
      .sort((a, b) => b._count.emoji - a._count.emoji)
      .map((r) => ({
        emoji: r.emoji,
        count: r._count.emoji,
        reactedByMe: mySet.has(r.emoji),
      }));
  }

  private reactionCount(reactions: ReactionSummary[]): number {
    return reactions.reduce((sum, r) => sum + r.count, 0);
  }

  /** Xây cây comment (parentId → children) từ list phẳng */
  private buildTree(list: CommentItem[]): CommentItem[] {
    const map = new Map<string, CommentItem>();
    const roots: CommentItem[] = [];
    for (const c of list) map.set(c.id, { ...c, replies: [] });
    for (const c of map.values()) {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.replies.push(c);
      } else {
        roots.push(c);
      }
    }
    return roots;
  }

  /**
   * GET comments cho target. viewerId để đánh dấu isOwn + reactedByMe.
   * Trả cây comment (lồng nhiều cấp qua replies).
   */
  async getComments(targetType: string, targetId: string, viewerId: string | null): Promise<CommentItem[]> {
    const t = this.validateTargetType(targetType);
    await this.ensureTarget(t, targetId);

    const rows = await this.prisma.comment.findMany({
      where: { targetType: t, targetId },
      orderBy: { createdAt: 'asc' },
    });
    const list: CommentItem[] = [];
    for (const r of rows) {
      const reactions = await this.reactionsFor('comment', r.id, viewerId);
      list.push({
        id: r.id,
        targetType: t,
        targetId: r.targetId,
        parentId: r.parentId,
        authorId: r.authorId,
        authorName: r.authorName,
        authorAvatar: r.authorAvatar,
        content: r.content,
        reactions,
        reactionCount: this.reactionCount(reactions),
        isOwn: Boolean(viewerId && r.authorId === viewerId),
        createdAt: r.createdAt,
        replies: [],
      });
    }
    return this.buildTree(list);
  }

  /** Tạo comment / reply. Yêu cầu login. */
  async createComment(
    input: { targetType: string; targetId: string; content: string; parentId?: string },
    author: { id: string; name: string; avatar: string },
  ) {
    const t = this.validateTargetType(input.targetType);
    const content = input.content?.trim?.() ?? '';
    if (!content) throw new BadRequestException('Nội dung bình luận không được để trống.');
    if (content.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestException(`Bình luận tối đa ${MAX_COMMENT_LENGTH} ký tự.`);
    }
    await this.ensureTarget(t, input.targetId);

    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: input.parentId },
        select: { id: true, targetType: true, targetId: true },
      });
      if (!parent) throw new BadRequestException('Bình luận cha không tồn tại.');
      // Reply phải cùng target với comment cha (chống lệch)
      if (parent.targetType !== t || parent.targetId !== input.targetId) {
        throw new BadRequestException('Bình luận cha không thuộc nội dung này.');
      }
      parentId = parent.id;
    }

    const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await this.prisma.comment.create({
      data: {
        id,
        targetType: t,
        targetId: input.targetId,
        parentId,
        authorId: author.id,
        authorName: author.name,
        authorAvatar: author.avatar,
        content,
        reactions: '[]',
        createdAt: new Date().toISOString().slice(0, 10),
      },
    });

    await this.syncCommentsCount(t, input.targetId);
    return {
      ...created,
      parentId: created.parentId ?? undefined,
      reactions: [] as ReactionSummary[],
      reactionCount: 0,
      isOwn: true,
      replies: [],
    };
  }

  /** Sửa comment — chỉ chủ sở hữu */
  async updateComment(id: string, content: string, actor: { id: string }) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bình luận không tồn tại.');
    if (existing.authorId !== actor.id) {
      throw new ForbiddenException('Bạn chỉ có thể sửa bình luận của mình.');
    }
    const newContent = content?.trim?.() ?? '';
    if (!newContent) throw new BadRequestException('Nội dung bình luận không được để trống.');
    if (newContent.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestException(`Bình luận tối đa ${MAX_COMMENT_LENGTH} ký tự.`);
    }
    const updated = await this.prisma.comment.update({
      where: { id },
      data: { content: newContent },
    });
    return updated;
  }

  /** Xóa comment — chỉ chủ sở hữu; xóa luôn cả cây con (cascade) */
  async deleteComment(id: string, actor: { id: string }) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bình luận không tồn tại.');
    if (existing.authorId !== actor.id) {
      throw new ForbiddenException('Bạn chỉ có thể xóa bình luận của mình.');
    }
    await this.prisma.comment.delete({ where: { id } });
    await this.syncCommentsCount(existing.targetType as CommentTargetType, existing.targetId);
    return true;
  }

  /** Toggle react emoji trên comment — 1 user toggle 1 emoji (upsert/xóa) */
  async toggleCommentReaction(id: string, emoji: string, actor: { id: string }) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bình luận không tồn tại.');
    if (!REACTION_EMOJIS.includes(emoji)) {
      throw new BadRequestException('Biểu tượng cảm xúc không hợp lệ.');
    }
    const found = await this.prisma.reaction.findUnique({
      where: {
        targetType_targetId_userId_emoji: {
          targetType: 'comment',
          targetId: id,
          userId: actor.id,
          emoji,
        },
      },
    });
    if (found) {
      await this.prisma.reaction.delete({ where: { id: found.id } });
    } else {
      await this.prisma.reaction.create({
        data: {
          id: `rct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          targetType: 'comment',
          targetId: id,
          userId: actor.id,
          emoji,
          createdAt: new Date().toISOString().slice(0, 10),
        },
      });
    }
    // Cập nhật cache reactions JSON trên comment
    const reactions = await this.reactionsFor('comment', id, actor.id);
    await this.prisma.comment.update({
      where: { id },
      data: { reactions: JSON.stringify(reactions) },
    });
    return reactions;
  }

  /** Đồng bộ commentsCount thật lên Post / ForumPost */
  private async syncCommentsCount(type: CommentTargetType, targetId: string) {
    if (type === 'forum') {
      const count = await this.prisma.comment.count({
        where: { targetType: 'forum', targetId },
      });
      await this.prisma.forumPost.update({
        where: { id: targetId },
        data: { commentsCount: count },
      });
    }
  }
}
