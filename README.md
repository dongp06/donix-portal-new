# Donix Portal

> Backend production/dev đã chuyển sang pure Fastify v5 tại `apps/api-fastify` (mặc định `:3002`). `api/` chỉ còn giữ Prisma schema, migration, seed, generated client và storage; không còn HTTP runtime NestJS/Express.

Spec và checklist triển khai: [docs/fastify-migration/README.md](docs/fastify-migration/README.md).

Frontend (**Next.js**) + backend API (**Fastify**). Dữ liệu Posts và marketplace dùng seed trong `shared`.

## Chạy local

Yêu cầu Node.js 20+.

```bash
npm install
npm run dev
```

- Web: [http://localhost:3000](http://localhost:3000) — proxy `/api/*` tới Fastify (mặc định `http://localhost:3002`).
- API: [http://localhost:3002/api](http://localhost:3002/api) — `GET /api/health`; Posts: `GET /api/posts`, `GET /api/posts/slug/:slug`; media/resource/E2EE bytes are delivered through their scoped Fastify routes.

Tùy chọn: tạo `web/.env.local` từ `web/.env.example` nếu API chạy port khác.

## Cấu trúc

| Thư mục | Vai trò |
|---------|---------|
| `web/` | App Router, UI (shadcn), TanStack Query |
| `apps/api-fastify/` | Pure Fastify API, security gateway, routes, domain services và maintenance worker |
| `api/` | Prisma schema/migrations/generated client, seed và storage ngoài web root |
| `shared/` | Types + mock dùng chung cho frontend và seed API |

## Build production

```bash
npm run build
```

Chạy: `npm run start -w web` và `npm run start:prod -w api-fastify` (cấu hình reverse proxy `/api` theo môi trường thực tế).

Kiểm tra trước khi release:

```bash
npm run verify
```

`verify` chạy Fastify contract/build/fresh-process smoke, API/web typecheck,
web lint + production obfuscation/manifest scan, fresh Next-to-Fastify rewrite
smoke và E2EE WASM smoke. `npm run audit:production` là gate riêng; hiện audit
production sạch và override `deepmerge-ts` cần được revalidate mỗi khi nâng
Prisma.

## Security runtime

- Session đăng nhập là opaque random 48-byte token trong HttpOnly cookie (`__Host-x` production, `x` local HTTP); database chỉ lưu SHA-256 token hash. Không còn `JWT_SECRET` và không còn fallback cookie legacy.
- Protected mutation API yêu cầu cookie + opaque short-lived access grant `Authorization: DPoP <token>` + standard DPoP ES256 device proof. Proof bind access-token hash, session/device, body digest, timestamp/nonce và idempotency key; server-issued action permit vẫn bắt buộc cho action strict. Access grant được silent-renew trong RAM; session cookie xoay theo family/generation, cookie cũ chỉ có grace window ngắn và replay sau đó revoke cả family.
- Google login dùng authorization-code + PKCE qua `GET /api/auth/google/start` và callback server-side; state/PKCE verifier/nonce nằm server-side, cookie state là HttpOnly và `POST /api/auth/google` chỉ còn trả lỗi chuyển đổi, không nhận token browser.
- `/api/m/<capability>` chỉ là capability dùng một lần, TTL ngắn; route decoy/capability giả được ghi nhận vào security telemetry.
- Admin action nhạy cảm yêu cầu RBAC và passkey/WebAuthn step-up. Audit log có hash chain và SQLite append-only triggers.
- E2EE dùng bridge WASM gọi implementation chính thức đã pin của Signal/libsignal: PQXDH/Kyber pre-key, Double Ratchet, skipped-message keys và snapshot state chỉ mã hóa local trong IndexedDB. API chỉ nhận public key/ciphertext; encrypted attachments được lưu như opaque ciphertext. Xem [e2ee/README.md](e2ee/README.md) để biết rõ boundary và giới hạn web-only.

Production cần đặt `CORS_ORIGINS`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `SECURITY_IP_SALT` và lưu media ngoài web root; TLS/HSTS phải được bật ở edge.
