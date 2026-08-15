import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { BotsService } from './bots.service';

@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

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

  @Post()
  async create(@Body() botData: any) {
    const newBot = await this.botsService.create(botData);
    return { success: true, data: newBot };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    const updated = await this.botsService.update(id, updateData);
    return { success: true, data: updated };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.botsService.delete(id);
    return { success: true, data: true };
  }
}
