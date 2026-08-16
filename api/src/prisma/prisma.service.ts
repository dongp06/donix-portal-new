import 'dotenv/config';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../prisma/generated/prisma/client.js';
import { sqliteDbPath } from './database.js';

/**
 * Prisma 7: SQLite qua driver adapter (better-sqlite3), không còn file engine.
 * PrismaClient là ESM-only nên build API chạy ở chế độ NodeNext ESM.
 * Adapter cần url tuyệt đối (không tự resolve DATABASE_URL như Prisma 5).
 * DB nằm ở api/prisma/dev.db — xem database.ts.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: new PrismaBetterSqlite3({ url: sqliteDbPath() }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
