# Hệ thống bình luận (FB-style) + Đánh giá bot

Ngày: 2026-08-16
Trạng thái: Approved

## Mục tiêu

- Hệ thống bình luận giống Facebook: comment + reply lồng nhiều cấp + react emoji.
- Áp dụng cho **Blog (`Post`), Diễn đàn (`ForumPost`), Trang chi tiết bot (`Bot`)**.
- Đánh giá bot: ai đăng nhập cũng được, sao 1–5 + comment + tối đa 5 ảnh.

## Quyết định thiết kế (đã hỏi & chốt)

| Câu hỏi | Quyết định |
|---|---|
| Phạm vi | Blog + Diễn đàn + Trang bot |
| Kiểu reply | Lồng nhiều cấp (tree sâu) |
| Kiểu react | Nhiều emoji: 👍 ❤️ 😂 😮 😢 😡 (toggle từng emoji) |
| Điều kiện đánh giá bot | Ai đăng nhập cũng được |
| Ảnh kèm đánh giá | Tối đa 5, dùng `/api/files/upload` có sẵn |

## Schema (Prisma migration)

```prisma
model Comment {
  id          String     @id
  targetType  String     // 'post' | 'forum' | 'bot'
  targetId    String
  parentId    String?
  parent      Comment?   @relation("CommentTree", fields: [parentId], references: [id], onDelete: Cascade)
  replies     Comment[]  @relation("CommentTree")
  authorId    String?
  author      User?      @relation(fields: [authorId], references: [id], onDelete: SetNull)
  authorName  String
  authorAvatar String
  content     String
  reactions   String     @default("[]")  // JSON cache: [{emoji, count, reactedByMe}]
  createdAt   String
  @@index([targetType, targetId])
  @@index([parentId])
  @@index([authorId])
}

model Reaction {
  id        String @id
  targetType String // 'comment' | 'forum' | 'post'
  targetId  String
  userId    String
  emoji     String
  createdAt String
  @@unique([targetType, targetId, userId, emoji])
  @@index([targetType, targetId])
}

model BotReview {
  id        String @id
  botId     String
  userId    String
  rating    Int    // 1..5
  comment   String
  images    String @default("[]") // JSON array, tối đa 5 URL
  createdAt String
  @@index([botId])
  @@index([userId])
}
```

- `Bot`: rating = AVG(BotReview.rating), reviewCount = COUNT(BotReview). Cập nhật lại khi thêm/sửa/xóa review.
- `ForumPost.commentsCount` hiện là số giả → chuyển sang đếm thật theo `Comment` (targetType='forum'). `Post` thêm `commentsCount Int @default(0)`.
- `Comment.reactions` là JSON cache (giữ trạng thái `reactedByMe` của user đang xem khi GET) — tính từ `Reaction` row thực tế.

## API

| Method + path | Yêu cầu | Ghi chú |
|---|---|---|
| `GET /api/comments?targetType=&targetId=` | — | Trả cây comment (parentId → children), `myReactions` trên mỗi comment |
| `POST /api/comments` `{targetType, targetId, content, parentId?}` | login | Tạo comment/reply; parentId phải thuộc cùng target |
| `PATCH /api/comments/:id` `{content}` | chủ comment | 403 nếu khác người |
| `DELETE /api/comments/:id` | chủ comment | Xóa cascade con; cập nhật commentsCount |
| `POST /api/comments/:id/react` `{emoji}` | login | Toggle react (upsert/xóa Reaction row) |
| `POST /api/forum/posts/:id/react` `{emoji}` | login | Toggle react bài diễn đàn (giữ upvote hiện tại) |
| `GET /api/bots/:id/reviews` | — | Danh sách review + isOwn |
| `POST /api/bots/:id/reviews` `{rating, comment, images[]}` | login | Validate rating 1–5, comment ≤1000, images ≤5 |
| `PATCH/DELETE /api/bots/:id/reviews/:rid` | chủ review | 403 người khác, recalc bot rating |

Có target type duy nhất cho blog: `post` (dùng `Post.id`), diễn đàn: `forum` (`ForumPost.id`), bot: `bot` (`Bot.id`).

## Web

- `components/comments/CommentSection.tsx` (client): nhận `targetType`, `targetId`. Hiển thị cây comment thụt lề theo độ sâu, ô nhập comment, nút Reply, nút react emoji (bảng chọn), nút Sửa/Xóa cho comment của mình. Login gate: chưa đăng nhập → hiện nút đăng nhập thay vì ô nhập.
- Dùng ở: `/posts/[slug]` (blog), `/community` (forum), `/bots/[id]` (trang bot).
- Trang bot: form đánh giá (chọn sao, textarea, upload ≤5 ảnh qua `/api/files/upload`), danh sách review có ảnh thumb, nút react trên bài forum.
- Forum: thêm react emoji trên bài viết, cập nhật `commentsCount` hiển thị.

## Validation & lỗi (tiếng Việt)

- Chưa đăng nhập: 401 `Bạn cần đăng nhập để thực hiện thao tác này.`
- Comment trống / >2000 ký tự: 400 `Nội dung bình luận không được để trống.` / `Bình luận tối đa 2000 ký tự.`
- Sửa/xóa comment người khác: 403 `Bạn chỉ có thể sửa/xóa bình luận của mình.`
- Review: rating không hợp lệ 400 `Đánh giá phải từ 1 đến 5 sao.`, ảnh >5 → 400 `Tối đa 5 ảnh cho mỗi đánh giá.`

## YAGNI (bỏ qua)

- Báo cáo / admin xóa comment.
- Reaction trên blog Post (chỉ comment + forum react).
- Chỉnh sửa bài diễn đàn có comment con.
