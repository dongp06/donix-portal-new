/** Tên thương hiệu — dùng thống nhất cho OG / JSON-LD. */
export const SITE_NAME = 'Donix.Net';

const DEFAULT_DESCRIPTION =
  'Lập trình, game mod, phần mềm, tool tiện ích — bài viết có file tải về và hướng dẫn chi tiết.';

export function getDefaultDescription(): string {
  return DEFAULT_DESCRIPTION;
}

/** Origin public (canonical, OG). Ưu tiên biến môi trường khi deploy. */
export function getSiteUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromPublic) return fromPublic.replace(/\/$/, '');
  const site = process.env.SITE_URL?.trim();
  if (site) return site.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/** Ảnh có thể là path site hoặc URL tuyệt đối — dùng cho og:image. */
export function absoluteOgImage(src: string | undefined): string | undefined {
  if (!src?.trim()) return undefined;
  const s = src.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return absoluteUrl(s.startsWith('/') ? s : `/${s}`);
}

/** Chuẩn ISO cho meta article:published_time / JSON-LD. */
export function toIsoDateOrUndefined(date: string | undefined): string | undefined {
  if (!date?.trim()) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
