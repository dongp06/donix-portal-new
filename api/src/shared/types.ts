export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  isVerifiedSeller?: boolean;
  bio?: string;
  joinedDate: string;
}

export type BotCategorySlug = 'messenger' | 'telegram' | 'discord' | 'zalo' | 'instagram';

export interface BotCategory {
  id: string;
  slug: BotCategorySlug;
  name: string;
  icon: string;
  description: string;
  count: number;
}

export interface BotSellerInfo {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalSales: number;
  /** Điểm uy tín 0-100 (tính từ rating, VD rating 4.9 → 98) */
  reputation?: number;
  isVerified: boolean;
  joinedDate: string;
  contact?: {
    zalo?: string;
    telegram?: string;
    phone?: string;
    messenger?: string;
    facebook?: string;
  };
}

export interface BotPricing {
  hourly: number;
  daily: number;
  monthly: number;
}

export type BotStatus = 'online' | 'maintenance' | 'offline';

export interface BotReview {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number;
  date: string;
  comment: string;
}

export interface BotItem {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  categorySlug: BotCategorySlug;
  categoryName: string;
  seller: BotSellerInfo;
  coverImage: string;
  gallery: string[];
  features: string[];
  pricing: BotPricing;
  status: BotStatus;
  rating: number;
  reviewCount: number;
  /** Lượt xem bot */
  views: number;
  tags: string[];
  version: string;
  systemReqs: string;
  reviews?: BotReview[];
  updatedAt: string;
}

export type ForumCategory =
  | 'Chia sẻ kinh nghiệm'
  | 'Yêu cầu làm bot'
  | 'Thảo luận Dev'
  | 'Báo lỗi & Hỗ trợ';

export interface ForumPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  /** ID người đăng bài (nếu đăng khi đã đăng nhập) */
  authorId?: string;
  authorName: string;
  authorAvatar: string;
  authorRole: 'Người mua' | 'Người bán' | 'Admin';
  category: ForumCategory;
  upvotes: number;
  commentsCount: number;
  createdAt: string;
  tags: string[];
  isPinned?: boolean;
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
