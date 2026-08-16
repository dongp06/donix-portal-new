import 'dotenv/config';
import path from 'node:path';

/**
 * Đường dẫn tuyệt đối tới DB SQLite.
 * DATABASE_URL dạng file:./prisma/dev.db được resolve tương đối theo CWD —
 * các npm script đều chạy trong api/ nên DB luôn nằm ở api/prisma/dev.db,
 * bất kể process được khởi động từ đâu.
 */
export function sqliteDbPath(): string {
  const raw = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  const file = raw.replace(/^file:/, '');
  return path.resolve(process.cwd(), file);
}
