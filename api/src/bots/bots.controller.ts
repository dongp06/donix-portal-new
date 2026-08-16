import { Controller, Get, Post, Patch, Put, Delete, Param, Query, Body, Req, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { BotsService } from './bots.service.js';
import { AuthService } from '../auth/auth.service.js';
import { requireUser, getCurrentUser } from '../auth/current-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustService } from '../trust/trust.service.js';

@Controller('bots')
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
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

  // ── Reviews (đánh giá bot) ─────────────────────────────

  @Get(':idOrSlug/reviews')
  async listReviews(@Param('idOrSlug') idOrSlug: string, @Req() req: Request) {
    const bot = await this.botsService.findOne(idOrSlug);
    const viewer = await getCurrentUser(req, this.auth);
    const data = await this.botsService.getReviews(bot.id, viewer?.id ?? null);
    return { success: true, data };
  }

  @Post(':idOrSlug/reviews')
  async addReview(@Param('idOrSlug') idOrSlug: string, @Body() body: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const bot = await this.botsService.findOne(idOrSlug);
    const data = await this.botsService.createReview(
      bot.id,
      { rating: body?.rating, comment: body?.comment, images: body?.images },
      { id: user.id, name: user.name, avatar: user.avatar },
    );
    return { success: true, data };
  }

  @Patch(':idOrSlug/reviews/:rid')
  async editReview(
    @Param('idOrSlug') idOrSlug: string,
    @Param('rid') rid: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const user = await requireUser(req, this.auth);
    const bot = await this.botsService.findOne(idOrSlug);
    const data = await this.botsService.updateReview(bot.id, rid, body, { id: user.id });
    return { success: true, data };
  }

  @Delete(':idOrSlug/reviews/:rid')
  async removeReview(@Param('idOrSlug') idOrSlug: string, @Param('rid') rid: string, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const bot = await this.botsService.findOne(idOrSlug);
    const data = await this.botsService.deleteReview(bot.id, rid, { id: user.id });
    return { success: true, data };
  }

  /**
   * Tạo bot — yêu cầu đăng nhập + vai trò người bán.
   * Bot gắn với hồ sơ user thật. Buyer không được đăng bot.
   */
  @Post()
  async create(@Body() botData: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);

    // Chỉ người bán mới được đăng bot
    if (user.role !== 'seller') {
      throw new ForbiddenException('Bạn cần là người bán để đăng bot. Hãy chọn vai trò Người bán khi đăng ký.');
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

    // Snapshot trust hiện tại lên bot vừa tạo để sellerVerified/sellerName/sellerAvatar khớp
    if (user.role === 'seller') {
      await this.trust.syncBotSnapshots(user.id);
    }

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
