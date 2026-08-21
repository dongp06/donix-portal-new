import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: `Quyền riêng tư | ${SITE_NAME}`,
  description: 'Cách thuebot.org sử dụng thông tin tài khoản, seller profile và nội dung cộng đồng.',
  alternates: { canonical: absoluteUrl('/privacy') },
};

const sections = [
  {
    title: 'Thông tin được sử dụng',
    body: 'Tùy tính năng bạn sử dụng, thuebot.org có thể xử lý thông tin tài khoản, hồ sơ seller, kênh liên hệ do bạn cung cấp, listing, bài viết, đánh giá và dữ liệu hoạt động cần thiết để vận hành dịch vụ.',
  },
  {
    title: 'Mục đích sử dụng',
    body: 'Thông tin được dùng để đăng nhập, hiển thị hồ sơ và listing, cung cấp Trust Check, xử lý nội dung cộng đồng, bảo vệ tài khoản, chống lạm dụng và cải thiện sản phẩm.',
  },
  {
    title: 'Thông tin công khai',
    body: 'Tên hiển thị, avatar, seller profile, listing, bài viết, đánh giá và các trạng thái xác minh được thiết kế để có thể hiển thị cho người dùng khác. Không đăng thông tin nhạy cảm nếu bạn không muốn công khai.',
  },
  {
    title: 'Chia sẻ và bảo vệ dữ liệu',
    body: 'thuebot.org không bán thông tin cá nhân. Dữ liệu chỉ được truy cập trong phạm vi cần thiết để vận hành nền tảng, bảo mật, kiểm duyệt hoặc thực hiện nghĩa vụ pháp lý phù hợp.',
  },
  {
    title: 'Quyền của bạn',
    body: 'Bạn có thể cập nhật hồ sơ, kênh liên hệ và nội dung do mình tạo trong các khu vực quản lý tương ứng. Nếu cần hỗ trợ về dữ liệu tài khoản, hãy liên hệ thuebot.org qua kênh Telegram được công bố ở footer.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Về trang chủ
        </Link>
        <p className="eyebrow mt-12">thuebot.org</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Quyền riêng tư</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
          Minh bạch về những thông tin cần thiết để thuebot.org vận hành marketplace và lớp trust.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Cập nhật lần cuối: 17/08/2026</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="border-t border-border pt-6">
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
