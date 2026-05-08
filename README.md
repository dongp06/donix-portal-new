# Donix Portal

Frontend (**Next.js** 15) + backend API (**NestJS**). Dữ liệu demo dùng mock trong `api/src/data` và `web/shared`.

## Chạy local

Yêu cầu Node.js 20+.

```bash
npm install
npm run dev
```

- Web: [http://localhost:3000](http://localhost:3000) — proxy `/api/*` tới backend (mặc định `http://localhost:3001`).
- API: [http://localhost:3001/api](http://localhost:3001/api) — `GET /api/health`; bài viết: `GET /api/posts` (`?category=&sort=latest`), `GET /api/posts/pinned`, `GET /api/posts/:slug`, `GET /api/posts/:slug/related`; tải file: `GET /api/files/:fileId`.

Tùy chọn: tạo `web/.env.local` từ `web/.env.example` nếu API chạy port khác.

## Cấu trúc

| Thư mục | Vai trò |
|---------|---------|
| `web/` | App Router, UI (shadcn), TanStack Query |
| `api/` | REST API NestJS, cùng format `{ success, data?, error? }` như trước |
| `shared/` | Types + mock (bản copy trong `web/shared` cho frontend; API dùng `api/src/data`) |

## Build production

```bash
npm run build
```

Chạy: `npm run start -w web` và `npm run start:prod -w api` (cấu hình reverse proxy `/api` theo môi trường thực tế).
