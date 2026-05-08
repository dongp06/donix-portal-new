export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PostAttachment {
  id: string;
  filename: string;
  sizeLabel: string;
  /** ID phục vụ GET /api/files/:fileId */
  fileId: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  /** Hiển thị menu IN HOA kiểu army2.net */
  navLabel?: string;
  count: number;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  categoryId: string;
  categoryName: string;
  views: number;
  date: string;
  isPinned: boolean;
  /** Thời gian đọc ước lượng (phút), hiển thị "Đọc: N phút" */
  readTimeMinutes?: number;
  /** Nhãn cạnh icon tài liệu (vd: Python, Node.js) */
  stackLabel?: string;
  /** Nhãn cam phụ (vd: LẬP TRÌNH PYTHON) */
  tagLine?: string;
  codeExample?: { title?: string; language?: string; code: string };
  /** Ví dụ output JSON/text demo */
  sampleOutput?: string;
  /** File đính kèm — chia sẻ tài nguyên tải về */
  attachments?: PostAttachment[];
  /** Slug các bài liên quan */
  relatedSlugs?: string[];
}

export interface User {
  id: string;
  name: string;
}
export interface Chat {
  id: string;
  title: string;
}
export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  ts: number;
}
