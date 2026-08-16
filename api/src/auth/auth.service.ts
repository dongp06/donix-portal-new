import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'buyer' | 'seller' | 'admin';
  isVerified: boolean;
  bio: string | null;
  joinedDate: string;
  /** Liên hệ seller (zalo/telegram/phone/messenger/facebook) — JSON trên User.contact */
  contact?: Record<string, string>;
  /** true nếu tài khoản vừa được tạo mới trong lần đăng nhập này */
  isNewUser: boolean;
  /** Vai trò mặc định người dùng chọn khi tạo tài khoản (được gửi từ client) */
  selectedRole?: 'buyer' | 'seller';
}

function parseContact(contact: string | null): Record<string, string> | undefined {
  if (!contact) return undefined;
  try {
    return JSON.parse(contact) as Record<string, string>;
  } catch {
    return undefined;
  }
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw new UnauthorizedException('Google token không chứa email.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Google token không hợp lệ.');
    }
  }

  async authenticate(
    idToken: string,
    selectedRole?: 'buyer' | 'seller',
  ): Promise<AuthUser> {
    const payload = await this.verifyGoogleToken(idToken);
    const email = payload.email!;
    const googleId = payload.sub;
    const name = payload.name?.trim() || email.split('@')[0];
    const avatar = payload.picture ?? '';

    let user = await this.prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          googleId,
          name,
          email,
          avatar,
          role: selectedRole ?? 'buyer',
          isVerified: false,
          bio: selectedRole === 'seller' ? 'Người bán bot tại Donix' : 'Người mua bot tại Donix',
          joinedDate: new Date().toISOString().split('T')[0],
        },
      });
    } else {
      // Cập nhật avatar/name mới nhất từ Google, giữ vai trò đã chọn
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          avatar,
          ...(selectedRole && user.role === 'buyer' && selectedRole === 'seller'
            ? { role: 'seller' }
            : {}),
        },
      });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role as AuthUser['role'],
      isVerified: user.isVerified,
      bio: user.bio,
      joinedDate: user.joinedDate,
      contact: parseContact(user.contact),
      isNewUser,
      selectedRole: isNewUser ? selectedRole : undefined,
    };
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role as AuthUser['role'],
      isVerified: user.isVerified,
      bio: user.bio,
      joinedDate: user.joinedDate,
      contact: parseContact(user.contact),
      isNewUser: false,
    };
  }

  /**
   * Nâng buyer lên seller (verified) — dùng khi buyer đăng bot đầu tiên.
   * Nếu đã là seller/admin thì giữ nguyên.
   */
  async promoteToSeller(email: string): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }
    if (existing.role !== 'buyer') {
      return this.toAuthUser(existing);
    }
    const updated = await this.prisma.user.update({
      where: { email },
      data: { role: 'seller' },
    });
    return this.toAuthUser(updated);
  }

  private toAuthUser(user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: string;
    isVerified: boolean;
    bio: string | null;
    joinedDate: string;
    contact: string | null;
  }): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role as AuthUser['role'],
      isVerified: user.isVerified,
      bio: user.bio,
      joinedDate: user.joinedDate,
      contact: parseContact(user.contact),
      isNewUser: false,
    };
  }

  signToken(user: Pick<AuthUser, 'id' | 'email' | 'role'>): string {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }

  verifyToken(token: string): { sub: string; email: string; role: string } {
    return this.jwt.verify<{ sub: string; email: string; role: string }>(token);
  }
}
