import { Controller, Get, Post, Put, Param, Query, Body } from '@nestjs/common';
import { BotsService } from './bots.service';

@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get('categories')
  getCategories() {
    return {
      success: true,
      data: this.botsService.getCategories()
    };
  }

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string
  ) {
    const bots = this.botsService.findAll({ category, search, status, sort });
    return {
      success: true,
      data: bots
    };
  }

  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string) {
    const bot = this.botsService.findOne(idOrSlug);
    return {
      success: true,
      data: bot
    };
  }

  @Post()
  create(@Body() botData: any) {
    const newBot = this.botsService.create(botData);
    return {
      success: true,
      data: newBot
    };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    const updated = this.botsService.update(id, updateData);
    return {
      success: true,
      data: updated
    };
  }
}
