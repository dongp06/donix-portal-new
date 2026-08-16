import {
  BotCategory,
  BotItem,
  Category,
  ForumPost,
  Post,
  UserProfile
} from './types.js';

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
    seller: {
      id: 'prov-01',
      name: 'DevNguyen_Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      rating: 4.9,
      totalSales: 1420,
      isVerified: true,
      joinedDate: '2024-03-15',
      contact: { zalo: '0987 654 321', telegram: '@devnguyen_pro', messenger: 'm.me/devnguyen_pro', facebook: 'fb.com/devnguyen.pro' },
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
    rating: 4.9,
    reviewCount: 210,
    tags: ['Messenger Bot', 'Facebook Fanpage', 'Auto Inbox', 'Sale Bot'],
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
    seller: {
      id: 'prov-02',
      name: 'CyberBot_Studio',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      rating: 4.8,
      totalSales: 980,
      isVerified: true,
      joinedDate: '2024-01-10',
      contact: { zalo: '0912 345 678', telegram: '@cyberbot_studio' },
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
    rating: 4.8,
    reviewCount: 145,
    tags: ['Telegram Bot', 'Kéo Mem Tele', 'Spam Group', 'Telegram Marketing'],
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
    seller: {
      id: 'prov-03',
      name: 'VN_Crypto_Tech',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      rating: 4.95,
      totalSales: 2150,
      isVerified: true,
      joinedDate: '2023-11-05',
      contact: { telegram: '@vn_crypto_tech', phone: '0933 222 111' },
    },
    coverImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80'
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
    rating: 4.92,
    reviewCount: 160,
    tags: ['Discord Bot', 'Auto Role', 'Discord Marketing', 'Community Bot'],
    version: 'v2.1.0',
    systemReqs: 'Token Bot Discord + Quyền Administrator trên Server',
    updatedAt: '2026-07-31'
  },
  {
    id: 'bot-104',
    slug: 'zalo-auto-friend-message-oa',
    title: 'Bot Zalo OA & Zalo Cá Nhân Tự Động Kết Bạn & Spam Tin Nhắn',
    tagline: 'Gửi tin nhắn hàng loạt theo danh sách SĐT, tự động kết bạn & chăm sóc khách hàng qua Zalo',
    description: 'Bot Zalo đỉnh cao dành cho dân Telesale, Bất Động Sản, Bảo Hiểm. Nhập danh sách SĐT, bot sẽ tự động tìm kiếm, gửi lời mời kết bạn kèm tin nhắn cá nhân hóa tên khách hàng.',
    categorySlug: 'zalo',
    categoryName: 'Bot Zalo OA & Zalo cá nhân',
    seller: {
      id: 'prov-04',
      name: 'Trần_Văn_Automation',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      rating: 4.75,
      totalSales: 740,
      isVerified: false,
      joinedDate: '2024-05-20',
      contact: { zalo: '0977 888 999' },
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
    rating: 4.85,
    reviewCount: 180,
    tags: ['Zalo Bot', 'Auto Zalo', 'Zalo Marketing', 'ZNS Official'],
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
    seller: {
      id: 'prov-01',
      name: 'DevNguyen_Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      rating: 4.9,
      totalSales: 1420,
      isVerified: true,
      joinedDate: '2024-03-15',
      contact: { zalo: '0987 654 321', telegram: '@devnguyen_pro', messenger: 'm.me/devnguyen_pro', facebook: 'fb.com/devnguyen.pro' },
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
    rating: 4.88,
    reviewCount: 110,
    tags: ['Instagram Bot', 'Auto DM', 'Instagram Seeding', 'Ig Marketing'],
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
  role: 'buyer',
  isVerifiedSeller: false,
  bio: 'Chuyên viên Tự động hóa & Khách mua Bot thường xuyên tại Donix',
  joinedDate: '2024-02-01'
};

export const MOCK_FORUM_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    title: 'Kinh nghiệm chống khóa nick Zalo khi dùng Bot Spam tin nhắn kết bạn',
    excerpt: 'Hôm nay mình xin chia sẻ bộ quy tắc đặt Delay & xoay IP Proxy giúp Bot Zalo chạy cả tháng không lo die nick.',
    content: 'Khi chạy bot Zalo Marketing, điều quan trọng nhất không phải là tốc độ gửi mà là mô phỏng hành vi người dùng thật. Các bạn nên lưu ý: 1. Đặt delay ngẫu nhiên từ 15s-45s giữa mỗi tin nhắn. 2. Dùng xoay Proxy IPv4/IPv6 Dân cư (Residential Proxy). 3. Nuôi nick tối thiểu 7 ngày trước khi bật bot...',
    authorName: 'CyberBot_Studio',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Người bán',
    category: 'Chia sẻ kinh nghiệm',
    upvotes: 42,
    commentsCount: 15,
    createdAt: '2026-07-30',
    tags: ['Zalo Bot', 'Proxy', 'Spam Safe'],
    isPinned: true
  },
  {
    id: 'post-2',
    title: '[Yêu cầu làm bot] Cần mua Bot tự động crawl tin tuyển dụng IT từ VietnamWorks & TopCV',
    excerpt: 'Mình cần một người làm bot crawl thông tin công ty, vị trí, mức lương và xuất file Excel mỗi ngày 8h sáng.',
    content: 'Yêu cầu cụ thể: Chạy bằng Python/Playwright, hỗ trợ proxy để không bị block IP, đẩy dữ liệu vào Google Sheet và thông báo qua Telegram. Ngân sách duy trì tháng khoảng 500k-800k. Anh em nào có sẵn bot hoặc nhận code nhắn mình nhé!',
    authorName: 'MinhTu_Game99',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Người mua',
    category: 'Yêu cầu làm bot',
    upvotes: 19,
    commentsCount: 8,
    createdAt: '2026-07-29',
    tags: ['Crawl Data', 'Python', 'Yêu Cầu Mới']
  },
  {
    id: 'post-3',
    title: 'Đã cập nhật Auto Võ Lâm v4.8.2: Sửa lỗi đơ màn hình khi vượt ải 80',
    excerpt: 'Thông báo update quan trọng cho toàn bộ anh em đang dùng Auto Võ Lâm HNX & Mobile.',
    content: 'Chào các bạn, bản v4.8.2 đã chính thức phát hành. Bản này sửa triệt để lỗi đứng hình khi gặp Boss hệ Thủy ở ải 80, đồng thời tối ưu thêm 20% dung lượng RAM sử dụng trên LDPlayer. Anh em chỉ cần khởi động lại tool là tự auto update nhé.',
    authorName: 'DevNguyen_Pro',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Người bán',
    category: 'Thảo luận Dev',
    upvotes: 35,
    commentsCount: 12,
    createdAt: '2026-07-28',
    tags: ['Võ Lâm', 'Update', 'Changelog']
  }
];

// ==== Blog ====
export const MOCK_BLOG_CATEGORIES: Category[] = [
  { id: 'bc-1', slug: 'chia-se', name: 'Chia sẻ kinh nghiệm', navLabel: 'Chia sẻ', count: 1 },
  { id: 'bc-2', slug: 'tu-dong-hoa', name: 'Tự động hóa', navLabel: 'Tự động hóa', count: 1 },
  { id: 'bc-3', slug: 'cong-cu', name: 'Công cụ & Tool', navLabel: 'Công cụ', count: 1 },
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'post-b1',
    slug: 'cach-chay-bot-zalo-an-toan',
    title: 'Cách chạy Bot Zalo an toàn, tránh khóa nick khi spam tin nhắn',
    excerpt: 'Bộ quy tắc đặt delay, xoay proxy và nuôi nick giúp bot Zalo chạy ổn định nhiều tháng.',
    content: '<p>Khi chạy bot Zalo marketing, điều quan trọng nhất là mô phỏng hành vi người thật.</p><ul><li>Đặt delay ngẫu nhiên 15-45s giữa mỗi tin nhắn.</li><li>Xoay proxy dân cư theo từng phiên.</li><li>Nuôi nick tối thiểu 7 ngày trước khi bật bot.</li></ul>',
    coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    categoryId: 'bc-1',
    categoryName: 'Chia sẻ kinh nghiệm',
    views: 1284,
    date: '2026-07-28',
    isPinned: true,
    readTimeMinutes: 6,
    stackLabel: 'Zalo',
    tagLine: 'Chống khóa nick',
    relatedSlugs: ['cach-chay-bot-zalo-an-toan'],
  },
  {
    id: 'post-b2',
    slug: 'bot-telegram-keo-mem',
    title: 'Bot Telegram kéo mem vào group không dính spam filter',
    excerpt: 'Chiến thuật kéo mem bằng bot Telegram mà vẫn giữ tài khoản an toàn.',
    content: '<p>Kéo mem group Telegram cần chia nhỏ lịch và thêm phản hồi tự nhiên.</p><p>Tránh gửi cùng một nội dung lặp lại liên tục trong khung giờ ngắn.</p>',
    coverImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    categoryId: 'bc-2',
    categoryName: 'Tự động hóa',
    views: 952,
    date: '2026-07-22',
    isPinned: false,
    readTimeMinutes: 4,
    stackLabel: 'Telegram',
    tagLine: 'Kéo mem group',
    relatedSlugs: ['cach-chay-bot-zalo-an-toan'],
  },
  {
    id: 'post-b3',
    slug: 'top-5-tool-tang-tuong-tac-tiktok',
    title: 'Top 5 tool tăng tương tác TikTok miễn phí năm 2026',
    excerpt: 'Tổng hợp những tool hỗ trợ tăng view, follow và tương tác TikTok tốt nhất hiện nay.',
    content: '<p>Chúng tôi đã thử và tổng hợp 5 công cụ hỗ trợ TikTok.</p><p>Lưu ý chọn tool có proxy dân cư để an toàn tài khoản.</p>',
    coverImage: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80',
    categoryId: 'bc-3',
    categoryName: 'Công cụ & Tool',
    views: 2410,
    date: '2026-07-15',
    isPinned: true,
    readTimeMinutes: 8,
    stackLabel: 'TikTok',
    tagLine: 'Review tool',
    relatedSlugs: ['bot-telegram-keo-mem'],
  },
];
