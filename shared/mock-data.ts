import {
  BotCategory,
  BotItem,
  BotRental,
  ForumPost,
  PlatformStats,
  ProviderStats,
  UserProfile,
  WalletInfo
} from './types';

export const MOCK_CATEGORIES: BotCategory[] = [
  {
    id: 'cat-1',
    slug: 'messenger',
    name: 'Bot Facebook Messenger',
    icon: 'MessageCircle',
    description: 'Tự động trả lời tin nhắn Fanpage, tư vấn bán hàng, chốt đơn & gửi tin nhắn hàng loạt',
    count: 32
  },
  {
    id: 'cat-2',
    slug: 'telegram',
    name: 'Bot Telegram',
    icon: 'Send',
    description: 'Kéo mem group, spam tin nhắn tự động, bot quản trị kênh & bot phát tín hiệu Signal',
    count: 45
  },
  {
    id: 'cat-3',
    slug: 'discord',
    name: 'Bot Discord',
    icon: 'MessageSquare',
    description: 'Bot tự động phân vai (Auto-Role), bot nhạc, spam server, thông báo crypto & game NFT',
    count: 28
  },
  {
    id: 'cat-4',
    slug: 'zalo',
    name: 'Bot Zalo OA & Zalo cá nhân',
    icon: 'PhoneCall',
    description: 'Gửi tin nhắn chăm sóc khách hàng Zalo OA, tự kết bạn & gửi tin nhắn hàng loạt an toàn',
    count: 39
  },
  {
    id: 'cat-5',
    slug: 'instagram',
    name: 'Bot Instagram Direct (DM)',
    icon: 'Instagram',
    description: 'Tự động trả lời Story/DM, spam seeding bình luận bài viết & tăng tương tác follower',
    count: 21
  }
];

export const MOCK_BOTS: BotItem[] = [
  {
    id: 'bot-101',
    slug: 'facebook-messenger-auto-chat-sales',
    title: 'Bot AI Facebook Messenger Sales & Inbox Auto 24/7',
    tagline: 'Tự động trả lời tin nhắn Fanpage, tư vấn báo giá, chốt đơn hàng & gửi tin nhắn chăm sóc lại',
    description: 'Giải pháp Bot Messenger chuyên nghiệp cho chủ shop và doanh nghiệp. Tự động quét comment bài viết ẩn SĐT đối thủ, gửi tin nhắn chào mừng, tư vấn danh mục sản phẩm và đồng bộ lead sang Google Sheet.',
    categorySlug: 'messenger',
    categoryName: 'Bot Facebook Messenger',
    provider: {
      id: 'prov-01',
      name: 'DevNguyen_Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      rating: 4.9,
      totalSales: 1420,
      isVerified: true,
      joinedDate: '2024-03-15'
    },
    coverImage: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      'Auto Reply Inbox & Comment Fanpage mượt mà như người thật',
      'Tự động ẩn bình luận chứa số điện thoại chống đối thủ cướp khách',
      'Gửi tin nhắn hàng loạt Broadcast cho khách cũ chuẩn chính sách Meta',
      'Tích hợp ChatGPT-4o tư vấn kịch bản sản phẩm nâng cao',
      'Dashboard quản lý nhiều Fanpage cùng lúc'
    ],
    pricing: {
      hourly: 3000,
      daily: 25000,
      monthly: 350000
    },
    status: 'online',
    totalRentals: 1240,
    activeRentals: 156,
    rating: 4.9,
    reviewCount: 210,
    tags: ['Messenger Bot', 'Facebook Fanpage', 'Auto Inbox', 'Sale Bot'],
    licenseType: 'web_portal',
    version: 'v4.8.2',
    systemReqs: 'Chạy trực tiếp trên Web Cloud, kết nối Facebook Graph API',
    updatedAt: '2026-07-30'
  },
  {
    id: 'bot-102',
    slug: 'telegram-auto-broadcast-group-puller',
    title: 'Bot Telegram Kéo Mem & Auto Spam Broadcast Group',
    tagline: 'Quét UID thành viên nhóm đối thủ, tự động kéo mem & gửi tin nhắn quảng cáo 500+ group/ngày',
    description: 'Công cụ Bot Telegram hàng đầu cho Marketer, Crypto Community & Seller. Tự động tìm group theo từ khóa, lọc ra thành viên active 24h qua, gửi tin nhắn DM trực tiếp và hỗ trợ nút bấm Inline nút link.',
    categorySlug: 'telegram',
    categoryName: 'Bot Telegram',
    provider: {
      id: 'prov-02',
      name: 'CyberBot_Studio',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      rating: 4.8,
      totalSales: 980,
      isVerified: true,
      joinedDate: '2024-01-10'
    },
    coverImage: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=800&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      'Quét Username / UID từ bất kỳ Group Telegram công khai nào',
      'Gửi tin nhắn riêng (DM) hoặc đăng tin tự động vào 500+ Group/ngày',
      'Xoay vòng Session Telegram API chống Tele-ban hiệu quả',
      'Định dạng HTML, ảnh đính kèm, nút bấm Inline Button tùy chỉnh',
      'Bảng điều khiển Web Cloud không cần cài phần mềm'
    ],
    pricing: {
      hourly: 5000,
      daily: 35000,
      monthly: 450000
    },
    status: 'online',
    totalRentals: 980,
    activeRentals: 120,
    rating: 4.8,
    reviewCount: 145,
    tags: ['Telegram Bot', 'Kéo Mem Tele', 'Spam Group', 'Telegram Marketing'],
    licenseType: 'web_portal',
    version: 'v3.5.0',
    systemReqs: 'Chạy trực tiếp trên Web Browser (Chrome, Safari, Edge)',
    updatedAt: '2026-07-29'
  },
  {
    id: 'bot-103',
    slug: 'discord-community-manager-auto-role',
    title: 'Bot Discord Auto-Role, Spam Server & Thông Báo Signal',
    tagline: 'Tự động phân quyền thành viên, gửi tin nhắn quảng cáo server & thông báo tín hiệu coin/game',
    description: 'Hệ thống Bot Discord toàn diện cho các cộng đồng Gaming, Crypto, Trading & E-learning. Tự động kiểm tra điều kiện cấp Role, phát nhạc HD, đăng bài tự động trên nhiều server và chào mừng mem mới.',
    categorySlug: 'discord',
    categoryName: 'Bot Discord',
    provider: {
      id: 'prov-03',
      name: 'VN_Crypto_Tech',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      rating: 4.95,
      totalSales: 2150,
      isVerified: true,
      joinedDate: '2023-11-05'
    },
    coverImage: 'https://images.unsplash.com/photo-1614680376593-902f749f7edc?w=800&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1614680376593-902f749f7edc?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      'Tự động gán vé VIP / Verification / Auto-Role qua nút bấm Reaction',
      'Gửi thông báo Signal Trading / Crypto / NFT cập nhật realtime',
      'Quét tin nhắn vi phạm, chống spam link độc hại & ban user tự động',
      'Đăng tin quảng cáo đồng bộ tới 100+ Server Discord',
      'Tích hợp lệnh Slash Command (/help, /verify, /pay)'
    ],
    pricing: {
      hourly: 4000,
      daily: 30000,
      monthly: 390000
    },
    status: 'online',
    totalRentals: 850,
    activeRentals: 98,
    rating: 4.92,
    reviewCount: 160,
    tags: ['Discord Bot', 'Auto Role', 'Discord Marketing', 'Community Bot'],
    licenseType: 'api_access',
    version: 'v2.1.0',
    systemReqs: 'Token Bot Discord + Quyền Administrator trên Server',
    updatedAt: '2026-07-31'
  },
  {
    id: 'bot-104',
    slug: 'zalo-auto-friend-message-oa',
    title: 'Bot Zalo OA & Zalo Cá Nhân Tự Động Kết Bạn & Spam Tin Nhắn',
    tagline: 'Gửi tin nhắn hàng loạt theo danh sách SĐT, tự động kết bạn & chăm sóc khách hàng qua Zalo',
    description: 'Phần mềm cho thuê Bot Zalo đỉnh cao dành cho dân Telesale, Bất Động Sản, Bảo Hiểm. Nhập danh sách SĐT, bot sẽ tự động tìm kiếm, gửi lời mời kết bạn kèm tin nhắn cá nhân hóa tên khách hàng.',
    categorySlug: 'zalo',
    categoryName: 'Bot Zalo OA & Zalo cá nhân',
    provider: {
      id: 'prov-04',
      name: 'Trần_Văn_Automation',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      rating: 4.75,
      totalSales: 740,
      isVerified: false,
      joinedDate: '2024-05-20'
    },
    coverImage: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=800&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      'Tự động đọc danh sách SĐT từ file Excel / Google Sheet',
      'Gửi tin nhắn Zalo kèm hình ảnh sản phẩm & đường link website',
      'Cấu hình Delay thông minh & xoay IP Proxy chống khóa nick Zalo',
      'Đồng bộ với Zalo Official Account (Zalo OA) để gửi thông báo ZNS',
      'Hỗ trợ quản lý nhiều tài khoản Zalo chạy song song'
    ],
    pricing: {
      hourly: 3000,
      daily: 22000,
      monthly: 290000
    },
    status: 'online',
    totalRentals: 1050,
    activeRentals: 135,
    rating: 4.85,
    reviewCount: 180,
    tags: ['Zalo Bot', 'Auto Zalo', 'Zalo Marketing', 'ZNS Official'],
    licenseType: 'key',
    version: 'v4.2.1',
    systemReqs: 'Windows 10/11 hoặc máy chủ VPS Windows',
    updatedAt: '2026-07-28'
  },
  {
    id: 'bot-105',
    slug: 'instagram-dm-auto-responder-seeding',
    title: 'Bot Instagram Direct (DM) & Auto Comment Seeding Pro',
    tagline: 'Tự động trả lời tin nhắn Instagram DM, thả tim Story & spam bình luận tăng lượt tương tác',
    description: 'Công cụ tăng trưởng tài khoản Instagram nhanh chóng cho Fashion Brand, Influencer & Shop Online. Bot tự động nhắn tin cho người xem Story, gửi mã giảm giá khi follower mới bấm Follow.',
    categorySlug: 'instagram',
    categoryName: 'Bot Instagram Direct (DM)',
    provider: {
      id: 'prov-01',
      name: 'DevNguyen_Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      rating: 4.9,
      totalSales: 1420,
      isVerified: true,
      joinedDate: '2024-03-15'
    },
    coverImage: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80'
    ],
    features: [
      'Auto Reply tin nhắn DM khi nhận từ khóa hoặc phản hồi Story',
      'Gửi tin nhắn chào mừng kèm Coupon Voucher cho Follower mới',
      'Tự động thả tim & comment theo Hashtag lĩnh vực kinh doanh',
      'Phát hiện tin nhắn chứa từ khóa mua hàng để chuyển tư vấn viên',
      'Định dạng ảnh đính kèm & link sản phẩm mua sắm'
    ],
    pricing: {
      hourly: 4000,
      daily: 28000,
      monthly: 360000
    },
    status: 'online',
    totalRentals: 790,
    activeRentals: 88,
    rating: 4.88,
    reviewCount: 110,
    tags: ['Instagram Bot', 'Auto DM', 'Instagram Seeding', 'Ig Marketing'],
    licenseType: 'web_portal',
    version: 'v3.0.1',
    systemReqs: 'Nền tảng Cloud SaaS - Không cần treo máy',
    updatedAt: '2026-07-30'
  }
];

export const MOCK_USER: UserProfile = {
  id: 'usr-999',
  name: 'Trần Minh Tuấn',
  email: 'minhtuan.dev@donix.vn',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  role: 'renter',
  walletBalance: 1250000,
  isVerifiedProvider: true,
  bio: 'Chuyên viên Tự động hóa & Khách thuê Bot thường xuyên tại Donix',
  joinedDate: '2024-02-01'
};

export const MOCK_RENTALS: BotRental[] = [
  {
    id: 'rent-801',
    botId: 'bot-101',
    botTitle: 'Auto Võ Lâm Truyền Kỳ HNX & Mobile 2026',
    botCover: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
    botCategory: 'Game Automation',
    renterId: 'usr-999',
    renterName: 'Trần Minh Tuấn',
    plan: 'monthly',
    duration: 1,
    totalCost: 250000,
    licenseKey: 'DNX-VLTK-9921-X88A-77B2',
    accessUrl: 'https://vltk-auto.donix.vn/control/DNX-VLTK-9921',
    startDate: '2026-07-15 10:00',
    endDate: '2026-08-15 10:00',
    status: 'active',
    autoRenew: true,
    providerId: 'prov-01',
    providerName: 'DevNguyen_Pro'
  },
  {
    id: 'rent-802',
    botId: 'bot-103',
    botTitle: 'Solana DexScreener Meme Coin Sniper Ultra',
    botCover: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop&q=80',
    botCategory: 'Crypto & Trading Bot',
    renterId: 'usr-999',
    renterName: 'Trần Minh Tuấn',
    plan: 'daily',
    duration: 7,
    totalCost: 420000,
    licenseKey: 'DNX-SOL-SNIPE-API-7721-KEY',
    accessUrl: 'https://api-solana.donix.vn/v1/snipe',
    startDate: '2026-07-28 14:30',
    endDate: '2026-08-04 14:30',
    status: 'active',
    autoRenew: false,
    providerId: 'prov-03',
    providerName: 'VN_Crypto_Tech'
  }
];

export const MOCK_FORUM_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    title: 'Kinh nghiệm chống khóa nick Zalo khi dùng Bot Spam tin nhắn kết bạn',
    excerpt: 'Hôm nay mình xin chia sẻ bộ quy tắc đặt Delay & xoay IP Proxy giúp Bot Zalo chạy cả tháng không lo die nick.',
    content: 'Khi chạy bot Zalo Marketing, điều quan trọng nhất không phải là tốc độ gửi mà là mô phỏng hành vi người dùng thật. Các bạn nên lưu ý: 1. Đặt delay ngẫu nhiên từ 15s-45s giữa mỗi tin nhắn. 2. Dùng xoay Proxy IPv4/IPv6 Dân cư (Residential Proxy). 3. Nuôi nick tối thiểu 7 ngày trước khi bật bot...',
    authorName: 'CyberBot_Studio',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Nhà Cung Cấp',
    category: 'Chia sẻ kinh nghiệm',
    upvotes: 42,
    commentsCount: 15,
    createdAt: '2026-07-30',
    tags: ['Zalo Bot', 'Proxy', 'Spam Safe'],
    isPinned: true
  },
  {
    id: 'post-2',
    title: '[Yêu cầu làm bot] Cần thuê Bot tự động crawl tin tuyển dụng IT từ VietnamWorks & TopCV',
    excerpt: 'Mình cần một người làm bot crawl thông tin công ty, vị trí, mức lương và xuất file Excel mỗi ngày 8h sáng.',
    content: 'Yêu cầu cụ thể: Chạy bằng Python/Playwright, hỗ trợ proxy để không bị block IP, đẩy dữ liệu vào Google Sheet và thông báo qua Telegram. Ngân sách thuê duy trì tháng khoảng 500k-800k. Anh em nào có sẵn bot hoặc nhận code nhắn mình nhé!',
    authorName: 'MinhTu_Game99',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Khách Thuê',
    category: 'Yêu cầu làm bot',
    upvotes: 19,
    commentsCount: 8,
    createdAt: '2026-07-29',
    tags: ['Crawl Data', 'Python', 'Yêu Cầu Mới']
  },
  {
    id: 'post-3',
    title: 'Đã cập nhật Auto Võ Lâm v4.8.2: Sửa lỗi đơ màn hình khi vượt ải 80',
    excerpt: 'Thông báo update quan trọng cho toàn bộ anh em đang thuê key Auto Võ Lâm HNX & Mobile.',
    content: 'Chào các bạn, bản v4.8.2 đã chính thức phát hành. Bản này sửa triệt để lỗi đứng hình khi gặp Boss hệ Thủy ở ải 80, đồng thời tối ưu thêm 20% dung lượng RAM sử dụng trên LDPlayer. Anh em chỉ cần khởi động lại tool là tự auto update nhé.',
    authorName: 'DevNguyen_Pro',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Nhà Cung Cấp',
    category: 'Thảo luận Dev',
    upvotes: 35,
    commentsCount: 12,
    createdAt: '2026-07-28',
    tags: ['Võ Lâm', 'Update', 'Changelog']
  }
];

export const MOCK_PROVIDER_STATS: ProviderStats = {
  totalBots: 4,
  activeTenants: 148,
  totalRevenue: 38500000,
  monthlyRevenue: 8400000,
  pendingPayout: 2100000,
  averageRating: 4.88,
  recentOrdersCount: 36
};

export const MOCK_WALLET: WalletInfo = {
  balance: 1250000,
  currency: 'VND',
  transactions: [
    {
      id: 'tx-101',
      type: 'deposit',
      amount: 1000000,
      description: 'Nạp tiền qua Chuyển Khoản Ngân Hàng (VietQR)',
      timestamp: '2026-07-28 09:15',
      status: 'completed'
    },
    {
      id: 'tx-102',
      type: 'rental_payment',
      amount: -250000,
      description: 'Thuê Bot Auto Võ Lâm Truyền Kỳ (Gói 1 tháng)',
      timestamp: '2026-07-28 10:00',
      status: 'completed'
    },
    {
      id: 'tx-103',
      type: 'rental_payment',
      amount: -420000,
      description: 'Thuê Bot Solana DexScreener Meme Sniper (Gói 7 ngày)',
      timestamp: '2026-07-28 14:30',
      status: 'completed'
    },
    {
      id: 'tx-104',
      type: 'deposit',
      amount: 920000,
      description: 'Nạp tiền qua Ví MoMo',
      timestamp: '2026-07-25 18:20',
      status: 'completed'
    }
  ]
};

export const MOCK_PLATFORM_STATS: PlatformStats = {
  totalActiveBots: 105,
  totalRentalsCompleted: 8490,
  totalProviders: 32,
  totalPayouts: 145000000,
  systemUptimePercentage: 99.94
};
