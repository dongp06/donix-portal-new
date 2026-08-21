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
  website?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  isTrustedSeller?: boolean;
  verificationState?: VerificationState;
  bio?: string;
  joinedDate: string;
  /** Liên hệ của seller (zalo/telegram/phone/messenger/facebook) */
  contact?: BotContactInfo;
}

export type BotCategorySlug = 'messenger' | 'telegram' | 'discord' | 'zalo' | 'instagram' | 'ai' | 'automation' | 'other';

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
  /** Blue badge is shown only for an active Trusted Seller state. */
  isTrusted: boolean;
  verificationState?: VerificationState;
  trustedAt?: string;
  trustedUntil?: string;
  basicVerifiedCount?: number;
  basicVerifiedTotal?: number;
  joinedDate: string;
  /** Slug profile seller (fallback id nếu chưa có) */
  slug?: string;
  contact?: BotContactInfo;
}

export interface BotPricing {
  /** Mức giá tham chiếu bắt buộc, luôn quy đổi theo tháng. */
  monthlyPrice: number;
  /** Markdown/text bảng giá bổ sung do seller tự trình bày. */
  pricingDescription?: string;
  /** Ảnh bảng giá bổ sung, tối đa 5 ảnh. */
  pricingImages?: string[];
}

export type BotStatus = 'online' | 'maintenance' | 'offline';

/** Đối tượng được bình luận/reaction */
export type CommentTargetType = 'post' | 'bot';

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

/** Đánh giá được gắn với bot khi hiển thị trong hồ sơ seller. */
export interface SellerReview extends BotReview {
  botId: string;
  botTitle: string;
}

export interface SellerReviewSummary {
  total: number;
  average: number;
  distribution: [number, number, number, number, number];
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
  targetAudience?: string[];
  version: string;
  systemReqs: string;
  reviews?: BotReview[];
  pricingUpdatedAt?: string;
  updatedAt: string;
}

export type PostType =
  | 'share'
  | 'question'
  | 'bot_update'
  | 'warning'
  | 'discussion'
  | 'announcement'
  | 'resource';

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'pending'
  | 'published'
  | 'hidden'
  | 'removed';

export type PostOfficialRole = 'owner' | 'admin' | 'system';

export interface PostAuthor {
  id?: string | null;
  name: string;
  avatar: string;
  role: UserRole | string;
  slug?: string;
  tier?: SellerTier;
  trustScore?: number;
  isTrusted?: boolean;
  /** Official authority is separate from Trusted Seller status. */
  isOfficial?: boolean;
  officialRole?: PostOfficialRole;
  verificationState?: VerificationState;
  trustedAt?: string;
  trustedUntil?: string;
}

export interface ResourceFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  sha256: string;
  previewable: boolean;
  downloadCount: number;
  language?: string;
}

export interface ResourceVersion {
  id: string;
  version: string;
  changelog: string;
  publishedAt?: string | null;
  files: ResourceFile[];
}

export interface PostResource {
  id: string;
  title: string;
  description: string;
  license: string;
  allowDownload: boolean;
  showSource: boolean;
  requiresLogin: boolean;
  currentVersion: ResourceVersion;
  versions?: ResourceVersion[];
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  type: PostType;
  status: PostStatus;
  category: string;
  categoryName: string;
  coverImage?: string | null;
  linkedBotId?: string | null;
  linkedBot?: BotItem | null;
  author: PostAuthor;
  tags: string[];
  views: number;
  commentsCount: number;
  reactionCount: number;
  bookmarkCount: number;
  reportCount?: number;
  isPinned: boolean;
  isFeatured: boolean;
  commentsLocked: boolean;
  answerCommentId?: string | null;
  readTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  resource?: PostResource | null;
  isBookmarked?: boolean;
  isOwn?: boolean;
  reactions?: ReactionSummary[];
}

/** Dữ liệu seed nội dung Posts; không phải payload public của API. */
export interface PostSeed {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  authorAvatar: string;
  authorRole: string;
  type: PostType;
  status: PostStatus;
  category: string;
  categoryName: string;
  coverImage?: string | null;
  linkedBotId?: string | null;
  views: number;
  upvotes: number;
  commentsCount: number;
  reactionCount: number;
  readTimeMinutes: number;
  createdAt: string;
  tags: string[];
  isPinned?: boolean;
  isFeatured?: boolean;
}

export interface PostFeed {
  items: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  categories: { slug: string; name: string; count: number }[];
  trendingTags: { tag: string; count: number }[];
}

export interface PostReport {
  id: string;
  postId: string;
  postTitle: string;
  reporterId?: string | null;
  category: string;
  details?: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  resolution?: string | null;
}

/** Loại sự kiện trong lịch sử uy tín của seller */
export type SellerTrustEventType =
  | 'joined'
  | 'tier_changed'
  | 'verification_submitted'
  | 'verification_state_changed'
  | 'verification_check_updated'
  | 'verification_reviewed'
  | 'verification_revoked'
  | 'trusted_expired';

export type VerificationState =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'trusted'
  | 'under_review'
  | 'suspended'
  | 'revoked'
  | 'rejected';

export type VerificationCheckKind =
  | 'email'
  | 'phone'
  | 'telegram'
  | 'website'
  | 'identity';

export interface VerificationCheck {
  kind: VerificationCheckKind;
  label: string;
  status: 'unverified' | 'pending' | 'verified' | 'revoked';
  provided: boolean;
  value?: string;
  method?: string;
  verifiedAt?: string;
  expiresAt?: string;
}

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
  category?: 'verification' | 'eligibility' | 'review';
  automated?: boolean;
  blocking?: boolean;
}

/** Trạng thái verification hiện tại của seller */
export interface TrustStatus {
  status: VerificationState | 'none';
  submittedAt?: string;
  reviewedAt?: string;
  expiresAt?: string;
  note?: string;
  /** true nếu đang chờ hồ sơ của admin (có thể hủy) */
  canCancel: boolean;
  recommendation?: 'approve' | 'reject';
}

export interface TrustSummary {
  state: VerificationState;
  isTrusted: boolean;
  trustScore: number;
  trustedAt?: string;
  trustedUntil?: string;
  basicVerifiedCount: number;
  basicVerifiedTotal: number;
  checks: VerificationCheck[];
  checklist: TrustChecklistItem[];
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
  isTrusted: boolean;
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
  verificationState: VerificationState;
  trustedAt?: string;
  trustedUntil?: string;
  basicVerifiedCount: number;
  basicVerifiedTotal: number;
  followerCount?: number;
  isFollowing?: boolean;
}

export type SellerLookupMatchType =
  | 'telegram'
  | 'website'
  | 'zalo'
  | 'phone'
  | 'messenger'
  | 'facebook'
  | 'contact'
  | 'slug'
  | 'name'
  | 'id';

export type SellerLookupVerificationStatus = VerificationState | 'none';

export type SellerLookupRiskStatus = 'clear' | 'limited' | 'caution';

export interface SellerLookupVerificationCheck {
  kind: VerificationCheckKind;
  label: string;
  status: VerificationCheck['status'];
}

/** Public result for the Check Seller lookup. */
export interface SellerLookupResult {
  id: string;
  name: string;
  shopName: string;
  avatar: string;
  slug?: string;
  profilePath: string;
  trustScore: number;
  tier: SellerTier;
  rating: number | null;
  reviewCount: number;
  botCount: number;
  joinedDate: string;
  verified: boolean;
  isTrusted: boolean;
  verificationStatus: SellerLookupVerificationStatus;
  verifiedAt?: string;
  trustedUntil?: string;
  basicVerifiedCount: number;
  basicVerifiedTotal: number;
  matchType: SellerLookupMatchType;
  exactMatch: boolean;
  verificationChecks: SellerLookupVerificationCheck[];
  riskStatus: SellerLookupRiskStatus;
  riskMessage: string;
}

export interface SellerLookupResponse {
  query: string;
  matches: SellerLookupResult[];
}

export interface SellerProfile {
  user: SellerProfileUser;
  bots: BotItem[];
  posts: Post[];
  /** Lịch sử uy tín (timeline) */
  trustEvents?: SellerTrustEvent[];
  reviews?: SellerReview[];
  reviewSummary?: SellerReviewSummary;
}
