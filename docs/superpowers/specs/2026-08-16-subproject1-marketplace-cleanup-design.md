# Sub-project 1: Hoàn thiện bot marketplace + forum — Design

**Ngày:** 2026-08-16 · **Trạng thái:** Approved · **Cách làm:** Big-bang 1 changeset (sau khi commit phần WIP)

## Bối cảnh

Donix Portal đã chuyển hướng thành "bot marketplace + forum" (liên hệ trực tiếp, không thanh toán/thuê trong app) nhưng commit `98e25d0` chưa dọn sạch tàn dư. Sub-project này hoàn tất việc đó. Là phần đầu trong chuỗi 4 sub-project (deps → chất lượng → UI/UX).

## Phạm vi

| # | Hạng mục | Chi tiết |
|---|----------|----------|
| 0 | Commit WIP | Chia ~1900 dòng chưa commit thành các commit logic: auth, migrations/schema, register/profile UI, CreateBotModal, misc |
| 1 | Xóa wallet/rentals | Bỏ `api/src/wallet/`, `api/src/rentals/` khỏi AppModule + disk; bỏ schema fields `User.walletBalance`, `Bot.totalRentals/activeRentals/licenseType` + migration; dọn mọi tham chiếu UI |
| 2 | Rename buyer/seller | Role DB `renter`→`buyer`, `provider`→`seller` (data migration); Bot fields `providerId/Name/Avatar/Rating/Sales/Verified/JoinedDate`→`sellerId/sellerName/sellerAvatar/sellerRating/sellerSales/sellerVerified/sellerJoinedDate`; cập nhật `shared/types.ts`, `api/src/data/types.ts`, RoleContext, UI copy "thuê bot"→"mua bot", "cho thuê"→"bán" |
| 3 | Forum lưu DB | `CommunityService` từ mock in-memory → Prisma `ForumPost`; thêm `authorId` FK → User; giữ upvote (không cần comments); seed forum |
| 4 | Vá CORS | `origin: '*'` → whitelist env `CORS_ORIGINS` (mặc định `http://localhost:3000`), `credentials: true` |
| 5 | Verify | `npm run build` + typecheck pass |

## Ngoài phạm vi

Comments forum, dashboard buyer/seller mới, bỏ `ignoreBuildErrors`, nâng cấp dependencies, test/CI, audit bảo mật sâu.

## Thiết kế chính

### Buyer/seller
- `User.role`: `'buyer' | 'seller' | 'admin'`. DB default `'buyer'`.
- `RoleContext` web: đổi key/label; copy UI tiếng Việt: "Người mua bot" / "Người bán bot".
- Bot: mọi field `provider*` → `seller*` (schema + types + seed + UI).
- `api/src/provider/` module: đổi tên nội dung sang seller, giữ route `/api/seller/*` (hoặc giữ `/api/provider/*` nếu web đang gọi — quyết định khi code, ưu tiên nhất quán).

### Forum DB
- `ForumPost.authorId String?` + relation `author User?` (nullable để seed/demo posts không cần user).
- API: `GET /api/community/posts`, `POST /api/community/posts` (yêu cầu đăng nhập → authorId = user hiện tại, authorName/avatar lấy từ user), `POST /api/community/posts/:id/upvote`.
- Xóa biến in-memory; restart API không mất dữ liệu.

### CORS
- `main.ts`: đọc `process.env.CORS_ORIGINS` (comma-separated), fallback `http://localhost:3000`; `credentials: true`; bỏ `'*'`.

## Rủi ro

- Big-bang 1 changeset → nếu lỗi, revert 1 commit. WIP đã commit trước nên an toàn.
- Rename đụng nhiều file → verify bằng build + typecheck ở bước 5.
