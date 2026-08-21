import {
  BotCategory,
  BotItem,
  PostSeed,
  UserProfile
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
    seller: {
      id: 'prov-01',
      name: 'DevNguyen_Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      rating: 4.9,
      reputation: 98,
      totalSales: 1420,
      isTrusted: false,
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
      monthlyPrice: 350000
    },
    status: 'online',
    rating: 4.9,
    reviewCount: 210,
    views: 12840,
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
    description: 'Công cụ Bot Telegram cho Marketer, Crypto Seller và đội vận hành. Tự động tìm group theo từ khóa, lọc thành viên active 24h qua, gửi tin nhắn DM trực tiếp và hỗ trợ nút bấm inline.',
    categorySlug: 'telegram',
    categoryName: 'Bot Telegram',
    seller: {
      id: 'prov-02',
      name: 'CyberBot_Studio',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      rating: 4.8,
      reputation: 96,
      totalSales: 980,
      isTrusted: false,
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
      monthlyPrice: 450000
    },
    status: 'online',
    rating: 4.8,
    reviewCount: 145,
    views: 8620,
    tags: ['Telegram Bot', 'Kéo Mem Tele', 'Spam Group', 'Telegram Marketing'],
    version: 'v3.5.0',
    systemReqs: 'Chạy trực tiếp trên Web Browser (Chrome, Safari, Edge)',
    updatedAt: '2026-07-29'
  },
  {
    id: 'bot-103',
    slug: 'discord-post-manager-auto-role',
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
      reputation: 99,
      totalSales: 2150,
      isTrusted: false,
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
      monthlyPrice: 390000
    },
    status: 'online',
    rating: 4.92,
    reviewCount: 160,
    views: 15230,
    tags: ['Discord Bot', 'Auto Role', 'Discord Marketing', 'Posts Bot'],
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
      reputation: 95,
      totalSales: 740,
      isTrusted: false,
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
      monthlyPrice: 290000
    },
    status: 'online',
    rating: 4.85,
    reviewCount: 180,
    views: 11980,
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
      reputation: 98,
      totalSales: 1420,
      isTrusted: false,
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
      monthlyPrice: 360000
    },
    status: 'online',
    rating: 4.88,
    reviewCount: 110,
    views: 9840,
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
  bio: 'Chuyên viên Tự động hóa & Khách mua Bot thường xuyên tại Donix',
  joinedDate: '2024-02-01'
};

export const MOCK_POSTS: PostSeed[] = [
  {
    id: 'post-demo-1',
    slug: 'toi-uu-telegram-bot-voi-worker-queue',
    title: 'Tối ưu Telegram Bot với worker và queue: bài học sau 30 ngày vận hành',
    excerpt: 'Một checklist thực tế để bot Telegram chạy ổn định, dễ theo dõi và không nghẽn khi lượng tin tăng.',
    content: 'Sau 30 ngày vận hành bot Telegram cho nhiều kênh, mình tách phần nhận sự kiện khỏi phần xử lý bằng worker và queue. Mỗi job có retry giới hạn, idempotency key và log đủ context để tra lại khi có sự cố. Nếu chạy trên VPS nhỏ, hãy giới hạn concurrency trước khi tăng số worker.',
    authorName: 'CyberBot_Studio',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Người bán',
    type: 'share',
    status: 'published',
    category: 'telegram',
    categoryName: 'Telegram',
    coverImage: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=800&auto=format&fit=crop&q=80',
    linkedBotId: 'bot-102',
    views: 428,
    upvotes: 42,
    commentsCount: 1,
    reactionCount: 42,
    readTimeMinutes: 5,
    createdAt: '2026-08-15T09:30:00.000Z',
    tags: ['telegram', 'worker', 'queue'],
    isPinned: true,
    isFeatured: true
  },
  {
    id: 'post-demo-2',
    slug: 'can-bot-discord-tu-dong-cap-role-sau-thanh-toan',
    title: 'Cần bot Discord tự cấp role sau khi thành viên thanh toán',
    excerpt: 'Mình đang tìm hướng triển khai flow xác nhận thanh toán, cấp role và thu hồi role khi gói hết hạn.',
    content: 'Mình cần bot Discord nhận webhook từ hệ thống thanh toán, đối chiếu mã đơn rồi cấp role theo gói. Có thể dùng database nhỏ để lưu thời hạn và tự thu hồi role khi hết hạn. Mọi người cho mình xin kinh nghiệm về các điểm cần bảo vệ khi nhận webhook.',
    authorName: 'Trần Minh Tuấn',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Người mua',
    type: 'question',
    status: 'published',
    category: 'discord',
    categoryName: 'Discord',
    views: 271,
    upvotes: 19,
    commentsCount: 0,
    reactionCount: 19,
    readTimeMinutes: 3,
    createdAt: '2026-08-14T14:10:00.000Z',
    tags: ['discord', 'payment', 'webhook']
  },
  {
    id: 'post-demo-3',
    slug: 'telegram-auto-post-v2-4-da-cap-nhat',
    title: 'Telegram Auto Post v2.4: thêm retry và theo dõi trạng thái gửi',
    excerpt: 'Bản cập nhật mới bổ sung retry có kiểm soát, log dễ đọc hơn và dashboard theo dõi từng lịch đăng.',
    content: 'Telegram Auto Post v2.4 đã phát hành. Lần này hệ thống thêm retry có backoff, cảnh báo khi token hết hạn và bộ lọc theo trạng thái lịch đăng. Seller cũng cập nhật tài liệu migration để các tài khoản đang chạy có thể nâng cấp trong vài phút.',
    authorName: 'DevNguyen_Pro',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Người bán',
    type: 'bot_update',
    status: 'published',
    category: 'automation',
    categoryName: 'Bot & Automation',
    coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    linkedBotId: 'bot-101',
    views: 612,
    upvotes: 35,
    commentsCount: 0,
    reactionCount: 35,
    readTimeMinutes: 3,
    createdAt: '2026-08-13T08:20:00.000Z',
    tags: ['update', 'automation', 'changelog']
  },
  {
    id: 'post-demo-4',
    slug: 'canh-bao-kiem-tra-quyen-truoc-khi-cap-token-bot',
    title: 'Cảnh báo: kiểm tra quyền trước khi cấp token cho bot bên thứ ba',
    excerpt: 'Một checklist ngắn để giảm rủi ro khi kết nối bot vào group, server hoặc tài khoản doanh nghiệp.',
    content: 'Trước khi cấp token hoặc quyền quản trị, hãy kiểm tra seller, phạm vi quyền, nơi lưu secret và cách thu hồi quyền. Không gửi token vào chat công khai, không dùng lại secret giữa nhiều bot và luôn yêu cầu hướng dẫn xóa dữ liệu khi ngừng sử dụng.',
    authorName: 'thuebot.org',
    authorAvatar: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=100&auto=format&fit=crop&q=80',
    authorRole: 'Admin',
    type: 'warning',
    status: 'published',
    category: 'warning',
    categoryName: 'Cảnh báo',
    views: 903,
    upvotes: 57,
    commentsCount: 0,
    reactionCount: 57,
    readTimeMinutes: 2,
    createdAt: '2026-08-12T07:45:00.000Z',
    tags: ['security', 'trust', 'seller'],
    isFeatured: true
  }
];
