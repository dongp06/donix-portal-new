export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type UserRole = 'renter' | 'provider' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  walletBalance: number;
  isVerifiedProvider?: boolean;
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

export interface BotProviderInfo {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalSales: number;
  isVerified: boolean;
  joinedDate: string;
}

export interface BotPricing {
  hourly: number;
  daily: number;
  monthly: number;
}

export type BotStatus = 'online' | 'maintenance' | 'offline';
export type LicenseType = 'key' | 'web_portal' | 'api_access';

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
  provider: BotProviderInfo;
  coverImage: string;
  gallery: string[];
  features: string[];
  pricing: BotPricing;
  status: BotStatus;
  totalRentals: number;
  activeRentals: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  licenseType: LicenseType;
  version: string;
  systemReqs: string;
  reviews?: BotReview[];
  updatedAt: string;
}

export type RentalStatus = 'active' | 'expired' | 'paused';
export type RentalPlan = 'hourly' | 'daily' | 'monthly';

export interface BotRental {
  id: string;
  botId: string;
  botTitle: string;
  botCover: string;
  botCategory: string;
  renterId: string;
  renterName: string;
  plan: RentalPlan;
  duration: number; // e.g. 5 hours, 3 days, 1 month
  totalCost: number;
  licenseKey: string;
  accessUrl?: string;
  startDate: string;
  endDate: string;
  status: RentalStatus;
  autoRenew: boolean;
  providerId: string;
  providerName: string;
}

export interface ForumPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  authorAvatar: string;
  authorRole: 'Khách Thuê' | 'Nhà Cung Cấp' | 'Admin';
  category: 'Chia sẻ kinh nghiệm' | 'Yêu cầu làm bot' | 'Thảo luận Dev' | 'Báo lỗi & Hỗ trợ';
  upvotes: number;
  commentsCount: number;
  createdAt: string;
  tags: string[];
  isPinned?: boolean;
}

export interface ProviderStats {
  totalBots: number;
  activeTenants: number;
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayout: number;
  averageRating: number;
  recentOrdersCount: number;
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'rental_payment' | 'payout' | 'rental_earning';
  amount: number;
  description: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface WalletInfo {
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
}

export interface PlatformStats {
  totalActiveBots: number;
  totalRentalsCompleted: number;
  totalProviders: number;
  totalPayouts: number;
  systemUptimePercentage: number;
}
