# Seller Profile + Forum Posts gắn user đăng nhập

> **Superseded for authentication:** this historical design predates the pure Fastify cutover. Its JWT/`donix_token` references are not runtime contracts. Use `docs/fastify-migration/security-transport-spec.md` and `docs/fastify-migration/api-contract.md` for the current opaque `__Host-x`/DPoP architecture.

Ngày: 2026-08-16 · Trạng thái: đã duyệt

## Bối cảnh

Donix là chợ bot + diễn đàn. Đăng nhập Google đã có (JWT trong cookie httpOnly). Diễn đàn cho phép đăng bài ẩn danh ("Khách") và bot lưu thông tin seller dạng denormalized với sellerId mock (`prov-01…`), chưa liên kết với bảng `User`.

## Mục tiêu

1. Trang hồ sơ người bán `/sellers/[id]` công khai, liên kết với user thật; seller tự sửa được bio + liên hệ.
2. Đăng bài diễn đàn bắt buộc đăng nhập; bài gắn `authorId`; tác giả sửa/xóa được bài của mình.
3. Seller đăng bot mới gắn hồ sơ thật; bot seed cũ được gán user seed.

## Thiết kế dữ liệu

### Schema

- `User.contact String?` — JSON chuỗi `{zalo, telegram, phone, messenger, facebook}`.
- Không thêm quan hệ `User.bots` (giữ denormalized `Bot.seller*` như hiện tại, tránh migration lớn).

### Migration `link_sellers_to_users`

1. Tạo 3 user seed cho 3 seller mock hiện có (ID mới `usr-seed-…`, email `seller+1@donix.vn`…, `role='seller'`, `isVerified=true`, bio/rating/sales/joinedDate lấy từ bot seed `prov-01/02/03`).
2. `UPDATE Bot SET sellerId = <user id mới>` cho toàn bộ bot có sellerId cũ `prov-01/02/03`. Giữ nguyên các field denormalized khác (name/avatar/rating…) — nhất quán với user seed.
3. Cập nhật `seed.ts` idempotent: tạo user seed + bot seed tham chiếu user seed thật.

## API

### Helper auth dùng chung — `api/src/auth/current-user.ts`

- `getCurrentUser(req, auth): Promise<AuthUser | null>` — đọc cookie, verify, trả user hoặc null.
- `requireUser(req, auth): Promise<AuthUser>` — throw `UnauthorizedException('Bạn cần đăng nhập.')` nếu chưa.
- Cộng đồng controller bỏ logic cookie inline, dùng helper.

### Endpoints

| Endpoint | Quyền | Hành vi |
|---|---|---|
| `GET /api/sellers/:id` | public | `{ user: {id,name,avatar,role,isVerified,bio,joinedDate,contact,rating,sales}, bots: BotItem[], posts: ForumPostOut[] }`; rating/sales = max của các bot; 404 nếu user không tồn tại |
| `PATCH /api/users/me` | login | Body `{ bio?, contact? }` — validate độ dài; trả user mới; **sync** tên/avatar/contact xuống `Bot.sellerName/sellerAvatar/sellerContact*` của mọi bot có `sellerId = me` |
| `POST /api/community/posts` | **login** | 401 nếu chưa đăng nhập; gắn `authorId`, name/avatar/role từ user thật |
| `PATCH /api/community/posts/:id` | tác giả | Sửa `title/content/category/tags`, tính lại excerpt; 403 nếu không phải tác giả |
| `DELETE /api/community/posts/:id` | tác giả | Xóa hẳn; 403 nếu không phải tác giả |
| `GET /api/community/posts` | public | Mỗi bài thêm `isOwn: boolean` (so cookie với `authorId`; false khi chưa đăng nhập) |
| `POST /api/bots` | login | Bot gắn `sellerId`/seller* từ user thật (bỏ fallback mock); buyer tạo bot được nâng role → seller, `isVerified=true` (giống logic đăng nhập) |
| `PUT/DELETE /api/bots/:id` | chủ bot hoặc admin | 403 nếu không phải chủ; đọc cookie để xác định |

Upvote giữ nguyên cho khách (không yêu cầu login).

### Validation

- `title` 5–200 ký tự, `content` ≥ 20 ký tự, `category` phải thuộc danh mục hợp lệ, `tags` ≤ 5 phần tử. Sai → 400 với message tiếng Việt.
- `bio` ≤ 500 ký tự; mỗi giá trị contact ≤ 200 ký tự.

## Frontend

### Trang `/sellers/[id]` (dynamic route)

- Fetch `GET /api/sellers/:id` client-side; 404 → thông báo "Không tìm thấy hồ sơ".
- Header: avatar, tên, badge "Đã xác thực", ngày tham gia, bio, nút liên hệ (chỉ hiện kênh có giá trị: Zalo/Telegram/Phone/Messenger/Facebook — dùng `ContactModal` hiện có hoặc link trực tiếp như bot detail).
- Stats: số bot, tổng giao dịch, rating.
- 2 tab: **Bots** (grid `BotCard`) và **Bài viết diễn đàn** (compact list, upvote hoạt động).
- Nếu `user.id === seller.id` (RoleContext): hiện nút "Sửa hồ sơ" → modal PATCH `/api/users/me` (bio + 5 ô liên hệ); sau lưu cập nhật user trong context + refetch.

### Trang `/community`

- Chưa đăng nhập: bấm "Đăng bài" → panel nhỏ với `GoogleLoginButton` + dòng "Đăng nhập để đăng bài". Không mở form.
- Đã đăng nhập: form hiện banner "Đăng bài với tư cách [avatar] [tên]".
- Card bài: avatar/tên tác giả → link `/sellers/:authorId` (chỉ khi có `authorId`). Bài `isOwn` → nút **Sửa** (modal PATCH) và **Xóa** (confirm → DELETE, xóa khỏi list).

### Các chỗ khác

- `BotCard` + `bots/[id]`: tên seller → link `/sellers/:id`.
- `/profile`: role seller → thêm nút "Hồ sơ người bán của tôi" → `/sellers/:id`.
- `RoleContext`:
  - `addNewBot` không gửi `seller` nữa (backend gắn từ cookie).
  - Thêm `updateProfile(bio, contact)` gọi PATCH `/api/users/me`, cập nhật state user.
- `GoogleLoginButton`: thêm prop `redirectTo?: string` — login xong chuyển hướng tới đó thay vì theo role (dùng ở community).
- `shared/types.ts`: `ForumPost` thêm `isOwn?: boolean`; thêm `SellerProfile` interface cho response `/api/sellers/:id`.

### Lỗi & edge cases

- `/sellers/[id]` của user buyer → vẫn hiển thị (bio + posts, mục bots rỗng) — link từ diễn đàn sang author người mua không bị 404.
- Bài đăng cũ (seed, `authorId=null`): `isOwn=false`, không ai sửa/xóa.
- Cookie hết hạn giữa phiên: POST/PATCH/DELETE trả 401 → toast "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại".

## Testing

- Không có test framework API (đã bỏ jest). Verify thủ công bằng script curl: seed → đăng nhập mock → đăng bài/sửa/xóa bài → PATCH profile → GET seller → kiểm tra 401/403/404.
- `npm run build` cả api lẫn web phải pass.

## Không làm (YAGNI)

- Không có comment trên bài forum (chỉ `commentsCount` placeholder giữ nguyên).
- Không upload avatar thủ công (đồng bộ từ Google).
- Không rate limit riêng cho endpoints mới.
