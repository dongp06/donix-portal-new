/** Tên thương hiệu — dùng thống nhất cho OG / JSON-LD. */
export const SITE_NAME = 'thuebot.org';

const DEFAULT_DESCRIPTION =
  'Chợ bot thuê & tài nguyên tự động hóa — đăng bot, xem điểm uy tín, đánh giá và trao đổi trực tiếp với seller.';

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

/**
 * JSON-LD is emitted inside a script element. JSON.stringify alone does not
 * escape a user-controlled `</script>` sequence, so encode HTML-sensitive
 * characters before using the result with dangerouslySetInnerHTML.
 */
export function safeJsonLd(value: unknown): string {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
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
