import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from '../../prisma/generated/prisma/client.js';

const MAX_BIO = 500;
const MAX_CONTACT_VALUE = 200;
const CONTACT_KEYS = ['zalo', 'telegram', 'phone', 'messenger', 'facebook'] as const;

type ContactInput = Partial<Record<(typeof CONTACT_KEYS)[number], string>>;

function safeParse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sửa hồ sơ của chính mình: bio + contact.
   * Đồng bộ tên/avatar/contact xuống các Bot có sellerId = user (field denormalized)
   * để trang bot luôn khớp hồ sơ.
   */
  async updateMe(
    userId: string,
    input: { bio?: string; contact?: ContactInput },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }

    const data: Record<string, unknown> = {};

    if (input.bio !== undefined) {
      const bio = input.bio.trim();
      if (bio.length > MAX_BIO) {
        throw new BadRequestException(`Giới thiệu tối đa ${MAX_BIO} ký tự.`);
      }
      data.bio = bio === '' ? null : bio;
    }

    if (input.contact !== undefined) {
      const existing = safeParse<ContactInput>(user.contact) ?? {};
      const merged: ContactInput = { ...existing };
      for (const key of CONTACT_KEYS) {
        const val = input.contact[key];
        if (val === undefined) continue;
        const trimmed = val.trim();
        if (trimmed.length > MAX_CONTACT_VALUE) {
          throw new BadRequestException(
            `Liên hệ '${key}' tối đa ${MAX_CONTACT_VALUE} ký tự.`,
          );
        }
        // Chuỗi rỗng = xóa kênh liên hệ đó
        if (trimmed === '') {
          delete merged[key];
        } else {
          merged[key] = trimmed;
        }
      }
      data.contact = JSON.stringify(merged);
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });

    // Đồng bộ field denormalized trên các bot của seller này
    const contact = safeParse<ContactInput>(updated.contact) ?? {};
    await this.prisma.bot.updateMany({
      where: { sellerId: userId },
      data: {
        sellerName: updated.name,
        sellerAvatar: updated.avatar,
        contactZalo: contact.zalo ?? null,
        contactTelegram: contact.telegram ?? null,
        contactPhone: contact.phone ?? null,
        contactMessenger: contact.messenger ?? null,
        contactFacebook: contact.facebook ?? null,
      },
    });

    return this.toPublic(updated);
  }

  toPublic(u: User) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      isVerified: u.isVerified,
      bio: u.bio,
      joinedDate: u.joinedDate,
      contact: safeParse<ContactInput>(u.contact),
      isNewUser: false,
    };
  }
}
