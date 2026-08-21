# Product

## Register

product

## Users

- Người mua bot, automation và dịch vụ kỹ thuật tại Việt Nam; thường cần kiểm tra seller trước khi liên hệ hoặc thanh toán ngoài nền tảng.
- Seller/developer cần một shop profile, nơi đăng bot, chia sẻ Posts và chứng minh lịch sử hoạt động.
- Moderator/admin vận hành hàng đợi kiểm duyệt Posts, report và Trusted Seller.

## Product Purpose

thuebot.org là marketplace và lớp trust cho thị trường bot Việt Nam. Người dùng có thể tìm bot, kiểm tra uy tín seller, đọc Posts, xem review và kết nối trực tiếp với nhà cung cấp. Seller có thể quản lý listing, profile, nội dung và quy trình xác minh. Thành công được đo bằng việc người mua ra quyết định an toàn hơn và seller uy tín tạo được lead chất lượng, không phải bằng việc bán badge.

## Brand Personality

Tin cậy, rõ ràng, thực dụng.

Giao diện và copy nên tạo cảm giác bình tĩnh, chuyên nghiệp và có bằng chứng. Trust Seller là trạng thái được xét duyệt, không phải một decoration hay quyền lợi mua bằng tiền. Posts là lớp nội dung sản phẩm và kinh nghiệm, không phải blog quảng cáo một chiều.

## Anti-references

- Không biến marketplace thành bản sao Shopee với badge, banner và khuyến mãi dày đặc.
- Không dùng checkbox tròn hoặc boolean `verified` để đại diện cho Trusted Seller.
- Không hiển thị Trust Score `0/100` khi seller chỉ mới thiếu dữ liệu.
- Không để fake/demo fallback xuất hiện trong trải nghiệm runtime khi API chưa trả dữ liệu.
- Posts là module nội dung duy nhất; không còn feed/blog legacy.

## Design Principles

1. Show evidence before assurance: tách basic verification, Trusted Seller và Verified Bot.
2. Make uncertainty honest: dùng trạng thái chưa đủ dữ liệu, đang xem xét và hết hạn thay cho tín hiệu giả chắc chắn.
3. Keep the buyer flow legible: seller là ai, uy tín ra sao, có bot gì, review thế nào rồi mới liên hệ.
4. Treat moderation as a real workflow: moderator đề xuất, admin/owner cấp hoặc thu hồi Trusted Seller.
5. Prefer real API state: empty, loading và error states phải rõ ràng; không che lỗi bằng mock data runtime.

## Accessibility & Inclusion

Mục tiêu WCAG 2.2 AA. Dùng semantic HTML, focus-visible states, keyboard-operable dialogs/popovers, nhãn ARIA cho badge tương tác và status không phụ thuộc riêng vào màu. Hỗ trợ responsive mobile/desktop, text tiếng Việt dễ đọc và reduced motion thông qua media query hiện có.
