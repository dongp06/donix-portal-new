# Trust Foundation — Seller Profile v2, Trust Score, Tier & Xác minh

Ngày: 2026-08-17
Trạng thái: Approved

## Mục tiêu

- Nâng cấp seller thành "shop" có hồ sơ riêng, URL slug đẹp cho SEO.
- **Trust Score 0–100 thật**, tính từ dữ liệu thật (không số giả), kiến trúc module để cắm thêm thành phần sau này.
- Hệ tier 4 bậc: `New Seller → Active Seller → Trusted Seller ✓ → Top Seller 🏆`.
- Xác minh seller thực chất: **hồ sơ + admin duyệt tay**, tích xanh có thời hạn 180 ngày.
- Lịch sử uy tín (timeline) trên profile.
- Admin Trust Dashboard: queue duyệt xác minh.
- Trang sửa hồ sơ seller + tab Uy tín trong dashboard seller.

Đây là **Sub-project A** trong roadmap 6 phần (A: Trust Foundation → B: Review Integrity → C: Report + Admin Trust → D: Analytics + Contact Clicks → E: Marketplace UX → F: Monetization). Mọi thứ B–F bám vào model trust của A.

## Quyết định thiết kế (đã hỏi & chốt)

| Câu hỏi | Quyết định |
|---|---|
| Cơ chế xác minh | Hồ sơ seller + admin kiểm tra thủ công; **không** làm phone OTP giai đoạn này |
| Cấu trúc tier | 4 bậc; tier thấp tự động, `trusted` do admin cấp, có thời hạn |
| Trust Score | Chỉ tính từ dữ liệu thật hiện có; registry component để C/D cắm thêm, rescale trọng số khi thêm |
| Ngưỡng nộp hồ sơ Trust Seller | 30 ngày tuổi · ≥ 5 review · rating ≥ 4.5 · hồ sơ ≥ 80% · trust score ≥ 75 |
| Hiệu lực tích xanh | 180 ngày, hết hạn chuyển `expired`, seller nộp lại |
| Phạm vi thêm | Trang sửa hồ sơ + Admin Trust Dashboard + Lịch sử uy tín + Slug URL |
| Kiến trúc | Approach 1: Trust module riêng, tách hồ sơ seller thành entity `SellerProfile` |

## Vấn đề kỹ thuật cần giải quyết

Bảng `Bot` hiện chứa snapshot denormalized của seller (`sellerId` string không FK, `sellerName/sellerAvatar/sellerRating/sellerVerified/sellerSales/sellerJoinedDate`). Giữ snapshot (UI list cần render nhanh) nhưng thêm cơ chế sync: mọi thay đổi verification/tier/hồ sơ phải cập nhật lại snapshot trên tất cả bot của seller đó.

Bỏ heuristic `reputation = Math.round(rating * 20)` trong `api/src/sellers/sellers.service.ts` — thay bằng trust score thật.

## Schema (Prisma migration)

```prisma
model SellerProfile {
  id                  String  @id
  userId              String  @unique
  user                User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  shopName            String
  slug                String  @unique
  bio                 String?
  avatar              String?   // nếu bỏ trống thì UI fallback avatar của User
  banner              String?
  contact             String  @default("{}") // JSON: {zalo, telegram, phone, facebook, website}
  profileCompleteness Int     @default(0)    // 0..100, cache
  updatedAt           String
}

model TrustVerification {
  id          String  @id
  userId      String
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  status      String  // 'pending' | 'approved' | 'under_review' | 'rejected' | 'expired'
  note        String? // ghi chú của seller khi nộp / của admin khi duyệt/từ chối
  submittedAt String
  reviewedAt  String?
  reviewedBy  String? // userId admin
  expiresAt   String? // submittedAt + 180 ngày khi approved
  @@index([userId])
  @@index([status])
}

model TrustEvent {
  id        String @id
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String // 'joined' | 'tier_changed' | 'verification_submitted'
                   // | 'verification_approved' | 'verification_rejected'
                   // | 'verification_expired' | 'verification_revoked'
  detail    String @default("{}") // JSON: from/to tier, note, ...
  createdAt String
  @@index([userId])
}

model User {
  // ... các field hiện có giữ nguyên, thêm:
  tier                String  @default("new") // 'new' | 'active' | 'trusted' | 'top'
  trustScore          Int     @default(0)     // cache 0..100
  trustScoreUpdatedAt String?
  isVerified          Boolean @default(false) // ĐỔI NGỮ NGHĨA: chỉ true khi có TrustVerification approved còn hạn

  sellerProfile  SellerProfile?
  verifications  TrustVerification[]
  trustEvents    TrustEvent[]
}

model Bot {
  // thêm:
  sellerSlug String @default("") // backfill từ SellerProfile
  // giữ nguyên các snapshot denormalized hiện có
}
```

Lưu ý kiểu dữ liệu theo convention hiện tại của repo: timestamp lưu dạng `String`, JSON lưu dạng `String` (xem `Comment`, `BotReview`).

## Trust Score engine

`TrustScoreService` + registry `ScoreComponent[]`. Mỗi component:

```ts
interface ScoreComponent {
  key: string;        // 'reviews' | 'account_age' | ...
  weight: number;     // tổng weight giai đoạn A = 100
  compute(userId: string): Promise<number>; // 0..1
}
```

Thành phần giai đoạn A:

| Component | Weight | Cách tính |
|---|---|---|
| `reviews` | 45 | `avgRating/5 × confidence(reviewCount)`, confidence cap ở 20 review (VD: `min(count, 20)/20` dạng curve) |
| `account_age` | 20 | tuyến tính 0→1 tới 365 ngày tuổi, cap 1 |
| `profile` | 20 | `profileCompleteness / 100` |
| `active_bots` | 15 | `min(onlineBots, 5) / 5` |

`trustScore = round(Σ weight_i × value_i)` → cache vào `User.trustScore`.

Khi sub-project C/D hoàn thành: đăng ký thêm component `complaints`, `responsiveness` và rescale lại trọng số — không phải sửa dữ liệu hay API.

**Hồ sơ hoàn thiện ≥ 80%:** mỗi mục profile (shopName khác mặc định, bio, avatar, banner, ≥ 1 kênh liên hệ, ≥ 2 kênh liên hệ) có trọng số riêng cộng tối đa 100. Công thức cụ thể đặt trong code, không hardcode trong spec này.

## Tier & vòng đời xác minh

**Tier tự động** (recompute cùng lúc với trust score):

| Tier | Điều kiện |
|---|---|
| `new` | mặc định |
| `active` | tài khoản ≥ 30 ngày **và** ≥ 1 bot **và** ≥ 1 review trên bot của mình |
| `trusted` | **không tự động** — chỉ admin cấp qua TrustVerification `approved` còn hạn |
| `top` | đang `trusted` + rating TB các bot ≥ 4.7 + ≥ 25 review + thuộc top 10 trust score toàn sàn |

**Vòng đời Trust Seller:**

```
seller nộp hồ sơ → pending → admin duyệt (approve) → approved, expiresAt = +180 ngày
                           → admin từ chối (reject) → rejected (được nộp lại)
approved hết hạn (cron)  → expired → seller nộp lại
vi phạm / admin thu hồi  → under_review hoặc revoked
```

**Ngưỡng để nút "Nộp hồ sơ" khả dụng** (hiển thị checklist công khai trên dashboard seller):
30 ngày tuổi · ≥ 5 review · rating TB ≥ 4.5 · hồ sơ ≥ 80% · trust score ≥ 75 · không có report nghiêm trọng (điều kiện này chỉ kích hoạt khi sub-project C hoàn thành).

**Badge hiển thị trên profile** (tối đa 3, theo design gốc): `✓ Trust Seller`, `🏆 Top Seller`, `⚡ Phản hồi nhanh` (badge thứ ba chỉ render khi sub-project D hoàn thành).

**Đổi ngữ nghĩa `isVerified`:** seller hiện có đang `isVerified = true` tự động nhưng chưa qua duyệt → sau backfill chuyển về `false`. Tick xanh cũ biến mất — đây là hành vi đúng vì tích xanh cũ không có giá trị xác minh thật.

## API (NestJS module `trust`)

Giữ format response hiện có của API.

| Method + path | Yêu cầu | Ghi chú |
|---|---|---|
| `PUT /api/sellers/me/profile` `{shopName, bio?, avatar?, banner?, contact?}` | seller | Cập nhật `SellerProfile`, tự sinh slug nếu chưa có, recompute `profileCompleteness`, sync snapshot các bot |
| `GET /api/sellers/me/trust-status` | seller | Checklist ngưỡng (từng điều kiện đạt/chưa), trust score + breakdown theo component, trạng thái verification hiện tại |
| `POST /api/sellers/me/verification` `{note?}` | seller | Tạo `TrustVerification` pending; 409 nếu đã có verification đang pending/approved; 400 nếu chưa đủ ngưỡng |
| `GET /api/admin/verifications?status=pending` | admin guard | Danh sách nộp kèm trust score, số review, rating TB, tuổi tài khoản |
| `PATCH /api/admin/verifications/:id` `{action: 'approve'|'reject', note?}` | admin guard | Duyệt → `approved` + `expiresAt` + `tier='trusted'` + `isVerified=true` + sync Bot; từ chối → `rejected` + `isVerified=false` |
| `GET /api/sellers/:identifier` | — | Profile v2: nhận cả userId cũ lẫn slug (ưu tiên slug); trả user + sellerProfile + tier + trustScore + verification gần nhất (ngày duyệt) + timeline TrustEvent + bots + forum posts |

Frontend gọi `/api/sellers/:identifier` và chuyển hướng (301) client từ URL userId cũ về URL slug.

## Frontend (Next.js)

- **`/sellers/[slug]`** — trang "shop": tier badge, trust score + breakdown (tooltip/hover), ngày xác minh gần nhất, timeline lịch sử uy tín, danh sách bot.
- **`/dashboard`** (seller) — thêm 2 tab:
  - **Hồ sơ:** form sửa (tên shop, avatar, bio, kênh liên hệ) — dùng `react-hook-form + zod` như hiện có.
  - **Uy tín:** trust score + breakdown theo component, checklist điều kiện Trust Seller (đạt/chưa từng dòng), nút "Nộp hồ sơ xác minh", trạng thái hồ sơ đã nộp.
- **`/admin/verifications`** — queue duyệt: danh sách với score / reviews / tuổi tài khoản như mockup, nút `Duyệt ✓` / `Từ chối` (kèm note) / link `Xem profile`.
- **`BotCard` + trang chi tiết bot:** tick xanh theo snapshot `sellerVerified` — không đổi cấu trúc UI hiện có.
- UI tiếng Việt, tuân theo theme "premium dark, single accent" hiện có, shadcn/ui components.
- Accessibility theo chuẩn WCAG 2.2 AA (semantic HTML, keyboard nav, aria cho tooltip/tab).

## Vận hành

**Cron ngày** (`@nestjs/schedule`, cần thêm package này):
1. Recompute trust score + tier cho toàn bộ seller.
2. `TrustVerification` status `approved` và `expiresAt < now` → `expired`, `isVerified = false`, tier hạ về tier tự động tương ứng, sync Bot, ghi `TrustEvent`.

**Sync Bot snapshot:** sau mỗi thay đổi verification/tier/hồ sơ (shopName, avatar), cập nhật `sellerName/sellerAvatar/sellerVerified/sellerRating/sellerSlug` trên tất cả bot của seller đó.

**Migration + backfill (script 1 lần):**
1. Tạo bảng mới.
2. Tự động tạo `SellerProfile` cho seller hiện có (`shopName` = tên user, slug sinh từ tên, đảm bảo unique).
3. Ghi `TrustEvent` `joined` từ `joinedDate` cho mọi user.
4. Chạy recompute trust score + tier toàn bộ seller.
5. Seller chưa qua duyệt → `isVerified = false`.
6. Backfill `Bot.sellerSlug`.

**Redirect URL cũ:** `/sellers/[id]` → 301 về `/sellers/[slug]`.

## Testing

- **Unit:** từng `ScoreComponent` (giá trị biên: 0 review, cap 20 review, cap 365 ngày, cap 5 bot); công thức tier (active/top); vòng đời verification (submit → approve → expire → nộp lại; submit → reject; thu hồi); ngưỡng nộp hồ sơ (đủ/thiếu từng điều kiện); `profileCompleteness`.
- **E2E:** luồng đầy đủ seller nộp hồ sơ → admin duyệt → profile hiện tick xanh + tier trusted; hết hạn → expired (fake clock); seller sửa hồ sơ → snapshot bot cập nhật.
- **Regression:** `GET /sellers/:slug` trả đúng dữ liệu thay thế `:id` cũ; `BotCard` vẫn render với snapshot.

## Không thuộc phạm vi sub-project A

- Seller reply review, criteria rating, verified review → **B: Review Integrity**
- Report system, xử lý khiếu nại → **C: Report + Admin Trust**
- View/contact click tracking, seller analytics → **D: Analytics**
- Filter theo trust, compare, wishlist, follow, bot status → **E: Marketplace UX**
- Tier thu phí (Pro/Business), phí xét duyệt → **F: Monetization**

## Roadmap tổng (6 sub-projects, làm tuần tự)

| # | Sub-project | Nội dung chính | Phụ thuộc |
|---|---|---|---|
| A | Trust Foundation | spec này | — |
| B | Review Integrity | verified review (duyệt bằng chứng), criteria rating, seller reply, % giới thiệu | A |
| C | Report + Admin Trust | report theo category, queue admin, component score khiếu nại | A |
| D | Analytics + Contact Click | track views/contact clicks, dashboard seller, badge phản hồi nhanh | A |
| E | Marketplace UX | filter theo trust, bot status, compare, wishlist, follow, ranking | A, D |
| F | Monetization | tier Free/Pro/Business, giới hạn listing, phí xét duyệt | A–E |
