/**
 * Gom chuỗi kiểu hét (ALL CAPS) về sentence case cho hiển thị: chữ đầu hoa, còn lại thường.
 * Không xử lý tên riêng phức tạp; đủ để bài CMS hay nhập HOA hết nhìn “pro” hơn.
 */
export function toSentenceCase(input: string): string {
  const s = input.trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function formatPostDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Kiểu army2.net: 25500 → "25.5K", 1000 → "1K" */
export function formatViewCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  const rounded = Math.round(k * 10) / 10;
  const core = Number.isInteger(rounded) ? String(Math.round(rounded)) : String(rounded);
  return `${core}K`;
}
