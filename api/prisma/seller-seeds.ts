/**
 * Seed users cho 4 seller mock (prov-01…prov-04) — chuyển sellerId trên Bot
 * từ ID mock sang user thật trong bảng User. ID deterministic để seed idempotent
 * và migration dữ liệu chỉ cần chạy lại `prisma db seed`.
 */
export interface SellerSeed {
  /** User ID thật trong bảng User */
  userId: string;
  /** sellerId mock cũ trong MOCK_BOTS */
  oldSellerId: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  joinedDate: string;
  isVerified: boolean;
  contact: Partial<Record<'zalo' | 'telegram' | 'phone' | 'messenger' | 'facebook', string>>;
}

export const SELLER_SEEDS: SellerSeed[] = [
  {
    userId: 'usr-seed-devnguyen',
    oldSellerId: 'prov-01',
    name: 'DevNguyen_Pro',
    email: 'devnguyen.pro@donix.vn',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio: 'Chuyên phát triển Bot Facebook Messenger & Zalo OA cho bán hàng tự động.',
    joinedDate: '2024-03-15',
    isVerified: true,
    contact: {
      zalo: '0987 654 321',
      telegram: '@devnguyen_pro',
      messenger: 'm.me/devnguyen_pro',
      facebook: 'fb.com/devnguyen.pro',
    },
  },
  {
    userId: 'usr-seed-cyberbot',
    oldSellerId: 'prov-02',
    name: 'CyberBot_Studio',
    email: 'cyberbot.studio@donix.vn',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: 'Studio chuyên Bot Telegram kéo mem, marketing cộng đồng & crypto.',
    joinedDate: '2024-01-10',
    isVerified: true,
    contact: { zalo: '0912 345 678', telegram: '@cyberbot_studio' },
  },
  {
    userId: 'usr-seed-vncrypto',
    oldSellerId: 'prov-03',
    name: 'VN_Crypto_Tech',
    email: 'vncrypto.tech@donix.vn',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    bio: 'Bot Discord & tool tự động hóa cho cộng đồng crypto Việt Nam.',
    joinedDate: '2023-11-05',
    isVerified: true,
    contact: { telegram: '@vn_crypto_tech', phone: '0933 222 111' },
  },
  {
    userId: 'usr-seed-tranvanauto',
    oldSellerId: 'prov-04',
    name: 'Trần_Văn_Automation',
    email: 'tranvan.automation@donix.vn',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    bio: 'Bot Zalo cá nhân & OA, tự động hóa marketing giá tốt.',
    joinedDate: '2024-05-20',
    isVerified: false,
    contact: { zalo: '0977 888 999' },
  },
];

/** sellerId mock → user ID thật (giữ nguyên nếu không phải seed) */
export function sellerSeedUserId(oldSellerId: string): string {
  return SELLER_SEEDS.find((s) => s.oldSellerId === oldSellerId)?.userId ?? oldSellerId;
}

/** authorName bài forum → user ID seed (bài của khách không có user thì null) */
export function forumAuthorSeedId(authorName: string): string | null {
  return SELLER_SEEDS.find((s) => s.name === authorName)?.userId ?? null;
}
