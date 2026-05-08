import { Category, Post, User, Chat, ChatMessage } from './types';

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat1', slug: 'lap-trinh', name: 'Lập trình', navLabel: 'LẬP TRÌNH', count: 16 },
  { id: 'cat2', slug: 'game-mod', name: 'Mobi Army2 / Teamobi Mod', navLabel: 'MOBI ARMY2', count: 14 },
  { id: 'cat3', slug: 'phan-mem', name: 'Phần mềm & TUT Tricks', navLabel: 'PHẦN MỀM & TUT', count: 17 },
  { id: 'cat4', slug: 'tool-tien-ich', name: 'Tool tiện ích', navLabel: 'TOOL TIỆN ÍCH', count: 13 },
];

const SAMPLE_GROUPS_JSON = `[
  {
    "id": "241234567890123",
    "name": "Python Việt Nam — Hỏi đáp & chia sẻ",
    "visibility": "CLOSED",
    "member_count": 15234
  },
  {
    "id": "178834567890456",
    "name": "Lập trình Backend Node.js",
    "visibility": "PUBLIC",
    "member_count": 8932
  },
  {
    "id": "392016789012345",
    "name": "DevOps & VPS Self-host",
    "visibility": "CLOSED",
    "member_count": 4201
  }
]`;

export const MOCK_POSTS: Post[] = [
  {
    id: 'p-fb-groups',
    slug: 'lay-danh-sach-nhom-fb-uid',
    title: 'Lấy Danh Sách Nhóm Đã Tham Gia Của Một UID Facebook',
    excerpt:
      'API Python + cookie tài khoản FB để lấy danh sách nhóm (group) mà UID đã tham gia; có file mẫu tải về.',
    content: `<p>Script hỗ trợ lấy danh sách nhóm Facebook đã tham gia theo UID mục tiêu. Phù hợp cho mục đích nghiên cứu và automation có kiểm soát.</p>
<p><strong>Yêu cầu:</strong> Cookie tài khoản Facebook hợp lệ, Python 3.10+.</p>
<p><strong>Cách hoạt động (tóm tắt):</strong></p>
<ul>
<li>Lấy token thông qua cookie, cache token trong session để giảm số lần gọi.</li>
<li>Dùng Graph API nội bộ / endpoint tương đương để duyệt batch nhóm.</li>
<li>Xử lý rate-limit và lỗi 4xx/5xx an toàn.</li>
</ul>
<p><strong>Thông tin trả về:</strong> ID nhóm, tên, visibility, số thành viên.</p>`,
    coverImage:
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1200',
    categoryId: 'cat1',
    categoryName: 'Lập trình',
    views: 845,
    date: '2025-01-22',
    isPinned: true,
    tagLine: 'LẬP TRÌNH PYTHON',
    codeExample: {
      title: 'Gọi API (minh họa)',
      language: 'python',
      code: `import requests

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0"})

def fetch_groups(uid: str, cookie: str) -> list:
    # Luồng thật: đổi url/params theo endpoint bạn dùng
    SESSION.headers["Cookie"] = cookie
    r = SESSION.get(f"https://example.invalid/groups/{uid}")
    r.raise_for_status()
    return r.json()`,
    },
    sampleOutput: SAMPLE_GROUPS_JSON,
    attachments: [
      {
        id: 'att1',
        filename: 'GetGroupUid.py',
        sizeLabel: '5 KB',
        fileId: 'getgroup-uid-demo',
      },
    ],
    relatedSlugs: ['python-co-ban-cho-nguoi-moi', 'api-convert-url-group-facebook'],
  },
  {
    id: 'p-api-fb-url',
    slug: 'api-convert-url-group-facebook',
    title: 'API Convert URL Group Facebook Sang dạng URL Share',
    excerpt: 'Chuyển link nhóm FB sang dạng share chuẩn để nhúng hoặc gửi nhanh.',
    content: 'Hướng dẫn parse và chuẩn hóa URL nhóm Facebook...',
    coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat1',
    categoryName: 'Lập trình',
    views: 419,
    date: '2024-01-03',
    isPinned: false,
    tagLine: 'LẬP TRÌNH PYTHON',
    attachments: [
      { id: 'att2', filename: 'convert_group_url.zip', sizeLabel: '12 KB', fileId: 'convert-url-demo' },
    ],
    relatedSlugs: ['lay-danh-sach-nhom-fb-uid', 'python-co-ban-cho-nguoi-moi'],
  },
  {
    id: 'p1',
    slug: 'trien-khai-nodejs-vps-ubuntu',
    title: 'Hướng dẫn triển khai ứng dụng Node.js lên VPS Ubuntu từ A-Z',
    excerpt:
      'Tìm hiểu cách cấu hình Nginx, PM2 và SSL để đưa ứng dụng của bạn lên môi trường production một cách an toàn.',
    content:
      'Ứng dụng Node.js cần được quản lý bởi PM2 để tự động khởi động lại khi gặp lỗi. Bài viết này hướng dẫn bạn từng bước cấu hình server Ubuntu mới nhất...',
    coverImage: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat1',
    categoryName: 'Lập trình',
    views: 1250,
    date: '2024-05-15',
    isPinned: true,
  },
  {
    id: 'p2',
    slug: 'cloudflare-tunnel-vps-home-lab',
    title: 'Sử dụng Cloudflare Tunnel để public Home Lab an toàn',
    excerpt:
      'Giải pháp tuyệt vời cho những ai dùng mạng CGNAT hoặc muốn tăng cường bảo mật cho server nội bộ của mình.',
    content:
      'Cloudflare Tunnel tạo ra một kết nối outbound an toàn giữa server của bạn và Cloudflare, giúp bạn truy cập dịch vụ nội bộ qua domain...',
    coverImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc51?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat4',
    categoryName: 'Tool tiện ích',
    views: 890,
    date: '2024-05-10',
    isPinned: true,
  },
  {
    id: 'p3',
    slug: 'python-co-ban-cho-nguoi-moi',
    title: 'Lập trình Python cơ bản: Lộ trình học nhanh nhất cho người mới',
    excerpt: 'Khởi đầu hành trình lập trình với ngôn ngữ phổ biến nhất thế giới qua các ví dụ thực tiễn.',
    content:
      'Python là ngôn ngữ tuyệt vời để bắt đầu. Trong bài viết này, chúng ta sẽ đi qua các cú pháp cơ bản như biến, vòng lặp và hàm...',
    coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat1',
    categoryName: 'Lập trình',
    views: 3400,
    date: '2024-05-08',
    isPinned: true,
    tagLine: 'LẬP TRÌNH PYTHON',
  },
  {
    id: 'p4',
    slug: 'gta-v-realistic-graphics-mod-2024',
    title: 'Trải nghiệm GTA V với bản Mod đồ họa siêu thực Ray Tracing',
    excerpt: 'Lột xác hoàn toàn Los Santos với công nghệ Ray Tracing và texture 4K cực đỉnh.',
    content:
      'Bản mod đồ họa này không chỉ thay đổi ánh sáng mà còn làm lại toàn bộ hiệu ứng vật lý cực kỳ chân thực...',
    coverImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat2',
    categoryName: 'Mobi Army2 / Teamobi Mod',
    views: 5600,
    date: '2024-05-05',
    isPinned: false,
  },
  {
    id: 'p5',
    slug: 'toi-uu-performance-react-app',
    title: 'Kỹ thuật tối ưu Performance cho ứng dụng React quy mô lớn',
    excerpt: 'Làm thế nào để giảm thiểu re-render và tối ưu bundle size cho ứng dụng của bạn mượt mà hơn.',
    content:
      'Sử dụng React.memo, useMemo, và useCallback đúng cách là chìa khóa để giữ cho ứng dụng của bạn mượt mà...',
    coverImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat1',
    categoryName: 'Lập trình',
    views: 2100,
    date: '2024-05-01',
    isPinned: false,
  },
  {
    id: 'p6',
    slug: 'huong-dan-rest-api-documentation',
    title: 'Hướng dẫn viết tài liệu API (Documentation) chuyên nghiệp',
    excerpt: 'Sử dụng Swagger và Postman để tạo ra những bộ tài liệu API dễ hiểu cho đồng nghiệp và đối tác.',
    content:
      'Một API tốt mà không có tài liệu tốt cũng trở nên vô dụng. Hãy học cách chuẩn hóa dữ liệu đầu ra và đầu vào...',
    coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat1',
    categoryName: 'Lập trình',
    views: 1500,
    date: '2024-04-28',
    isPinned: false,
  },
  {
    id: 'p7',
    slug: 'mobile-game-review-genshin-impact',
    title: 'Review chi tiết Genshin Impact trên Smartphone tầm trung',
    excerpt: 'Liệu con chip Snapdragon 778G còn đủ sức gánh tựa game nặng đô này ở năm 2024?',
    content:
      'Genshin Impact vẫn là thước đo hiệu năng cho mọi smartphone. Qua bài test thực tế, chúng ta sẽ thấy sự tối ưu hóa phần mềm...',
    coverImage: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat2',
    categoryName: 'Mobi Army2 / Teamobi Mod',
    views: 4200,
    date: '2024-04-25',
    isPinned: false,
  },
  {
    id: 'p8',
    slug: 'advanced-nodejs-event-loop',
    title: 'Hiểu sâu về Node.js Event Loop và Worker Threads',
    excerpt: 'Nâng cao trình độ backend bằng cách nắm vững cơ chế vận hành bên trong của Node.js.',
    content:
      'Node.js đơn luồng nhưng tại sao nó lại nhanh? Câu trả lời nằm ở Event Loop. Khi nào nên dùng Worker Threads để xử lý CPU-intensive...',
    coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat1',
    categoryName: 'Lập trình',
    views: 2800,
    date: '2024-04-20',
    isPinned: false,
  },
  {
    id: 'p9',
    slug: 'top-phan-mem-quan-ly-cong-viec',
    title: 'Top 5 phần mềm quản lý công việc tốt nhất cho Team Dev',
    excerpt: 'So sánh chi tiết Jira, Trello, Notion và ClickUp cho các dự án Agile/Scrum.',
    content:
      'Quản lý dự án là yếu tố then chốt. Mỗi công cụ có một thế mạnh riêng, Notion mạnh về tài liệu, Jira mạnh về tracking...',
    coverImage: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat3',
    categoryName: 'Phần mềm & TUT Tricks',
    views: 3100,
    date: '2024-04-15',
    isPinned: false,
  },
  {
    id: 'p10',
    slug: 'script-bash-tu-dong-backup-vps',
    title: 'Script Bash tự động Backup dữ liệu VPS lên Google Drive',
    excerpt: 'Bảo vệ dữ liệu của bạn hàng ngày một cách hoàn toàn tự động với script đơn giản.',
    content:
      'Đừng để mất dữ liệu rồi mới hối hận. Script này sẽ nén source code, export database và đẩy lên Cloud định kỳ...',
    coverImage: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat4',
    categoryName: 'Tool tiện ích',
    views: 1850,
    date: '2024-04-10',
    isPinned: false,
  },
  {
    id: 'p11',
    slug: 'docker-compose-cho-project-php',
    title: 'Hướng dẫn sử dụng Docker Compose cho dự án PHP/Laravel',
    excerpt: 'Thiết lập môi trường phát triển đồng nhất cho cả Team chỉ với một câu lệnh docker-compose up.',
    content:
      'Docker giúp loại bỏ lỗi "it works on my machine". Bài viết chia sẻ các cấu hình tối ưu cho PHP, MySQL và Redis...',
    coverImage: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat1',
    categoryName: 'Lập trình',
    views: 2300,
    date: '2024-04-05',
    isPinned: false,
  },
  {
    id: 'p12',
    slug: 'diet-virus-malware-cho-window',
    title: 'Cách dọn dẹp Malware và tối ưu Windows 11 không cần phần mềm',
    excerpt: 'Tăng tốc máy tính và gỡ bỏ các ứng dụng chạy ngầm gây tốn tài nguyên hệ thống.',
    content:
      'Windows 11 tích hợp sẵn nhiều công cụ mạnh mẽ. Chúng ta sẽ sử dụng PowerShell và Group Policy để tinh chỉnh hệ thống...',
    coverImage: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&q=80&w=800',
    categoryId: 'cat3',
    categoryName: 'Phần mềm & TUT Tricks',
    views: 5200,
    date: '2024-04-01',
    isPinned: false,
  },
];

export const MOCK_USERS: User[] = [];
export const MOCK_CHATS: Chat[] = [];
export const MOCK_CHAT_MESSAGES: ChatMessage[] = [];
