import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: `Điều khoản sử dụng | ${SITE_NAME}`,
  description: 'Các nguyên tắc sử dụng thuebot.org dành cho người mua, seller và cộng đồng.',
  alternates: { canonical: absoluteUrl('/terms') },
};

const sections = [
  {
    title: '1. Vai trò của thuebot.org',
    body: 'thuebot.org là marketplace và lớp thông tin uy tín giúp người dùng tìm bot, xem hồ sơ seller, đọc nội dung cộng đồng và kết nối trực tiếp. Các giao dịch ngoài nền tảng do hai bên tự trao đổi và chịu trách nhiệm xác nhận.',
  },
  {
    title: '2. Trách nhiệm của seller',
    body: 'Seller cần cung cấp thông tin listing, giá tham chiếu, kênh liên hệ và nội dung chính xác, không gây hiểu nhầm. Seller có trách nhiệm cập nhật khi sản phẩm, giá hoặc trạng thái cung cấp thay đổi.',
  },
  {
    title: '3. Trách nhiệm của người mua',
    body: 'Hãy kiểm tra seller, phạm vi quyền, giá và cách hỗ trợ trước khi liên hệ hoặc thanh toán. Trust Score, badge và thông tin xác minh là tín hiệu tham khảo, không phải bảo đảm tuyệt đối cho một giao dịch.',
  },
  {
    title: '4. Nội dung và an toàn cộng đồng',
    body: 'Không đăng nội dung lừa đảo, mạo danh, xâm phạm quyền riêng tư, phát tán mã độc hoặc vi phạm pháp luật. thuebot.org có thể ẩn nội dung, hạn chế tài khoản hoặc thu hồi trạng thái xác minh khi phát hiện vi phạm hoặc có rủi ro đáng kể.',
  },
  {
    title: '5. Cập nhật điều khoản',
    body: 'Điều khoản có thể được điều chỉnh khi sản phẩm và quy trình vận hành thay đổi. Phiên bản mới sẽ được công bố trên trang này cùng ngày cập nhật.',
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Về trang chủ
        </Link>
        <p className="eyebrow mt-12">thuebot.org</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Điều khoản sử dụng</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
          Các nguyên tắc cơ bản để thuebot.org vận hành marketplace, lớp trust và cộng đồng một cách rõ ràng, an toàn hơn.
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
