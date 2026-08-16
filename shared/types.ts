export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface BotContactInfo {
  zalo?: string;
  telegram?: string;
  phone?: string;
  messenger?: string;
  facebook?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  isVerifiedSeller?: boolean;
  bio?: string;
  joinedDate: string;
  /** Liên hệ của seller (zalo/telegram/phone/messenger/facebook) */
  contact?: BotContactInfo;
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
  /** Bậc seller */
  tier?: SellerTier;
  isVerified: boolean;
  joinedDate: string;
  /** Slug profile seller (fallback id nếu chưa có) */
  slug?: string;
  contact?: BotContactInfo;
}

export interface BotPricing {
  hourly: number;
  daily: number;
  monthly: number;
}

export type BotStatus = 'online' | 'maintenance' | 'offline';

/** Đối tượng được bình luận/reaction */
export type CommentTargetType = 'post' | 'forum' | 'bot';

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

/** Comment + reply (tree). Nested qua `replies` */
export interface CommentItem {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  parentId?: string | null;
  authorId?: string | null;
  authorName: string;
  authorAvatar: string;
  content: string;
  reactions: ReactionSummary[];
  reactionCount: number;
  isOwn: boolean;
  createdAt: string;
  replies: CommentItem[];
}

export interface BotReview {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number;
  date: string;
  comment: string;
  /** Tối đa 5 ảnh kèm đánh giá */
  images?: string[];
  /** true nếu review này của người đang xem (cho phép sửa/xóa) */
  isOwn?: boolean;
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
  /** React emoji trên bài viết (tổng hợp từ Reaction) */
  reactions?: ReactionSummary[];
  /** true nếu bài này là của người xem đang đăng nhập (cho nút sửa/xóa) */
  isOwn?: boolean;
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

/** Loại sự kiện trong lịch sử uy tín của seller */
export type SellerTrustEventType =
  | 'joined'
  | 'tier_changed'
  | 'verification_submitted'
  | 'verification_approved'
  | 'verification_rejected'
  | 'verification_expired'
  | 'verification_revoked';

/** Sự kiện trong lịch sử uy tín */
export interface SellerTrustEvent {
  id: string;
  type: SellerTrustEventType;
  detail?: Record<string, unknown>;
  createdAt: string;
}

/** Một dòng trong checklist điều kiện xác minh Trust Seller */
export interface TrustChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  /** Giá trị hiện tại của tiêu chí (VD "32 ngày", "6 đánh giá") */
  current?: string;
  /** Giá trị cần đạt (VD "30 ngày", "5 đánh giá") */
  required?: string;
}

/** Trạng thái verification hiện tại của seller */
export interface TrustStatus {
  status: 'none' | 'pending' | 'approved' | 'under_review' | 'rejected' | 'expired';
  submittedAt?: string;
  reviewedAt?: string;
  expiresAt?: string;
  note?: string;
  /** true nếu đang chờ hồ sơ của admin (có thể hủy) */
  canCancel: boolean;
}

/** Trust Score hiện tại + breakdown theo component */
export interface TrustScoreInfo {
  score: number;
  breakdown: { key: string; label: string; weight: number; value: number; score: number }[];
  updatedAt?: string;
}

/** Tier của seller */
export type SellerTier = 'new' | 'active' | 'trusted' | 'top';

/** Hồ sơ seller công khai — GET /api/sellers/:identifier */
export interface SellerProfileUser {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  isVerified: boolean;
  bio?: string;
  joinedDate: string;
  contact?: BotContactInfo;
  /** Điểm uy tín 0-100 */
  trustScore?: number;
  /** Bậc seller */
  tier?: SellerTier;
  /** Slug profile seller */
  slug?: string;
  /** Ngày duyệt xác minh gần nhất (ISO) */
  verifiedAt?: string;
}

export interface SellerProfile {
  user: SellerProfileUser;
  bots: BotItem[];
  posts: ForumPost[];
  /** Lịch sử uy tín (timeline) */
  trustEvents?: SellerTrustEvent[];
}
