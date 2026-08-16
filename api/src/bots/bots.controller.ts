import { Controller, Get, Post, Put, Delete, Param, Query, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BotsService } from './bots.service.js';
import { AuthService } from '../auth/auth.service.js';
import { requireUser } from '../auth/current-user.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('bots')
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('categories')
  getCategories() {
    return {
      success: true,
      data: this.botsService.getCategories(),
    };
  }

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    const bots = await this.botsService.findAll({ category, search, status, sort });
    return { success: true, data: bots };
  }

  @Get(':idOrSlug')
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    const bot = await this.botsService.findOne(idOrSlug);
    return { success: true, data: bot };
  }

  /**
   * Tạo bot — yêu cầu đăng nhập. Bot gắn với hồ sơ user thật.
   * Buyer tạo bot được nâng lên seller (verified) giống luồng đăng nhập.
   */
  @Post()
  async create(@Body() botData: any, @Req() req: Request) {
    let user = await requireUser(req, this.auth);

    // Nâng buyer lên seller khi họ đăng bot đầu tiên
    if (user.role === 'buyer') {
      user = await this.auth.promoteToSeller(user.email);
    }

    // Contact trong form tạo bot được ưu tiên; nếu không có thì lấy từ hồ sơ user
    const contact =
      botData?.contact && Object.values(botData.contact).some(Boolean)
        ? botData.contact
        : await this.readUserContact(user.id);
    const newBot = await this.botsService.create(botData, {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      joinedDate: user.joinedDate,
      isVerified: user.isVerified,
      contact,
    });
    return { success: true, data: newBot };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const updated = await this.botsService.update(id, updateData, {
      id: user.id,
      role: user.role,
    });
    return { success: true, data: updated };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    await this.botsService.delete(id, { id: user.id, role: user.role });
    return { success: true, data: true };
  }

  /** Đọc contact JSON trên User → object (cho field denormalized trên Bot) */
  private async readUserContact(userId: string): Promise<Record<string, string>> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { contact: true },
    });
    if (!u?.contact) return {};
    try {
      return JSON.parse(u.contact) as Record<string, string>;
    } catch {
      return {};
    }
  }
}
