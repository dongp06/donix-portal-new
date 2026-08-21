# Fastify completion plan — post-cutover

> Cutover status (2026-08-19): the HTTP runtime is `apps/api-fastify`. The
> former `api/src` HTTP tree and Nest/Express runtime dependencies are gone.
> This document now tracks completion, hardening and release evidence only.

## 1. Nguyên tắc

Fastify là runtime duy nhất. Mỗi slice phải có contract test và frontend call-site
coverage; một process cũ không được dùng làm bằng chứng cho source/build mới.

Thứ tự ưu tiên:

1. freeze contract và inventory hiện tại;
2. giữ Fastify core/security/schema boundary;
3. hoàn thiện media/resource/worker reconciliation;
4. hoàn thiện browser/live evidence cho auth, WebAuthn và E2EE;
5. thêm adapter Redis khi triển khai nhiều instance;
6. chạy fresh-process, edge canary và release gates;
7. dọn automation/documentation stale.

Không gộp đồng thời framework migration với database provider rewrite hoặc auth protocol redesign nếu không có RFC/rollback riêng.

## 2. Phase checklist

### Phase 0 — Fastify baseline

~~~text
[x] chụp git status, không reset dirty worktree
[x] ghi route inventory Fastify
[x] ghi response/error/auth behavior hiện tại
[x] tạo fixture không chứa token/secret/PII nhạy cảm
[x] xác nhận web API_URL và rewrite behavior
[ ] xác nhận database backup và restore trong môi trường triển khai
~~~

Exit gate: mọi route đang dùng có owner và expected response shape; lỗi baseline được phân loại, không bị nhầm với regression Fastify.

### Phase 1 — Core Fastify

~~~text
[x] buildApp và server entry
[x] request id, logger, trust proxy
[x] cookie, CORS, Helmet, rate-limit
[x] error/response envelope
[x] database adapter
[x] transport v4
[x] multipart parser/limits
[ ] Redis adapter cho rate/TTL-heavy state khi scale nhiều instance; DB vẫn là authority cho session/audit/replay
[ ] metrics/tracing exporter
~~~

Exit gate:

~~~text
npm run typecheck --workspace api-fastify
npm run build --workspace api-fastify
npm test --workspace api-fastify
~~~

### Phase 2 — Security/auth foundation

~~~text
[x] opaque session cookie hash
[x] session family/generation
[x] idle/absolute expiry
[x] rotation grace/reuse detection
[x] opaque short-lived access grant
[x] device public key registration
[x] ECDSA device proof
[x] body digest/nonce/idempotency
[x] action permit/capability gateway
[x] DB transaction contention test cho rotate/permit/nonce ở current SQLite contract boundary
[ ] Redis/distributed contention test khi bật multi-instance adapter
[x] WebAuthn registration/authentication và critical step-up trong Fastify
[ ] browser/passkey hardware E2E
[ ] adaptive risk/challenge policy
~~~

Exit gate: replay old cookie, duplicate nonce, access/session mismatch, device revoke và transport downgrade đều fail closed trong integration tests.

### Phase 3 — Public read

~~~text
[x] bots/categories/list/detail/reviews
[x] posts/categories/tags/list/slug/detail
[x] sellers/lookup/profile/follow state
[x] comments read
[x] resources public list/detail/preview/download
[ ] public media parity với resource attachments
[ ] opaque cursor nếu thêm pagination mới
~~~

Exit gate: canonical DTO compare trên fixture cùng database; không leak internal fields.

### Phase 4 — Auth/onboarding và frontend client

~~~text
[x] Google auth input bounded
[x] onboarding buyer/seller
[x] become-seller
[x] auth/me/logout/admin-access cloak
[x] access/renew client path nền tảng
[ ] browser E2E Google OAuth thật
[ ] device key persistence/recovery UX
[x] multi-tab single-flight renewal
[ ] expired/reuse UX và security notification
~~~

Exit gate: browser test local/staging có cookie attributes, transport negotiation, device registration, renew và logout; chưa claim production Google pass nếu chưa có credential/test account hợp lệ.

### Phase 5 — Media và upload boundary

~~~text
[x] image multipart 1 file / 10 MiB
[x] extension + MIME + magic bytes
[x] dimensions + SHA-256
[x] generated storage key/path traversal check
[x] draft/private/published visibility
[x] metadata update
[x] reference-aware delete
[x] stream-to-disk temporary upload và resource/media delivery thay vì buffer toàn file
[ ] object storage adapter
[ ] antivirus/content disarm nếu threat model yêu cầu
[x] generic legacy-file runtime removed; active uploads use media/resource/E2EE modules
~~~

Exit gate: upload malformed magic bytes, MIME mismatch, oversize, traversal filename, guest draft read, orphan delete và referenced delete đều có test.

### Phase 6 — Mutation slice đã port

~~~text
[x] profile.update
[x] bot create/update/delete
[x] post create/update/delete
[x] post reaction/upvote/bookmark/report
[x] review create/update/delete
[x] comment create/update/delete/react
[x] media upload/update/delete
[x] seller follow PUT/DELETE
[x] domain-specific moderation/trust mutation
~~~

Exit gate: mỗi mutation phải đi qua permit, body commitment, ownership/eligibility, idempotency và response schema. Payload có field role/isTrusted/trustScore phải reject.

### Phase 7 — Seller/trust/resources/moderation

~~~text
[x] seller profile write và contact parity
[x] seller follow mutation
[x] seller verification request/check state
[x] Trusted Seller review/approve/reject/revoke/suspend
[x] resource upload/publish/version
[x] preview/view/download authorization
[x] generic legacy-file compatibility decision documented; routes retired from Fastify and frontend
[x] moderation report queue/decision/audit
[x] verification expiry/cleanup worker pass
~~~

Exit gate: domain state machine có explicit transition table, staff authorization và audit. Không port chỉ controller surface mà bỏ transaction/invariant.

### Phase 8 — Admin và critical security

~~~text
[x] admin verification 404 cloak
[x] overview/search/analytics
[x] sellers/bots/users/comments/reviews (read surface)
[x] cases/moderation queue (read surface)
[x] cases/moderation/reports
[x] audit viewer và immutable audit write
[x] staff CRUD/RBAC
[x] admin posts/categories/tags/status/comments/distribution/versions (current content slice)
[x] WebAuthn registration
[x] WebAuthn authentication/step-up
[x] critical action target commitment + one-time handle
[ ] exact dynamic body commitment for server-issued critical handles
[ ] session TTL/risk policy riêng cho staff
~~~

Exit gate: non-staff thấy 404, staff role derive server-side, critical action yêu cầu WebAuthn assertion và one-time grant, audit không chứa secret.

### Phase 9 — E2EE và workers

~~~text
[x] E2EE devices/key bundle
[x] public prekey rotation/revocation
[x] conversations/messages ciphertext-only
[x] encrypted attachment upload/download
[x] no plaintext in logs/DB/response serializer
[x] cleanup expired sessions/access/permits/nonces
[x] media missing-row/orphan-file reconciliation với grace window
[x] resource missing-row/orphan-file reconciliation với grace window
[x] checksum audit định kỳ theo batch xoay vòng; object storage adapter vẫn là production follow-up
[x] resource staged-file cleanup
[ ] audit retention/export
~~~

Exit gate: server chỉ thấy public key/ciphertext/metadata tối thiểu; browser/WASM E2EE smoke riêng; không coi offline WASM smoke là live messaging E2E.

## 3. Module parity matrix

| Module | Fastify destination | State |
| --- | --- | --- |
| health | core/control | DONE slice |
| auth | core/control + core/auth | DONE offline; browser/OAuth evidence pending |
| security transport | core/transport | DONE contract |
| security access | core/security + control | DONE slice |
| security gateway | control + mutations | DONE offline; distributed production proof pending |
| security/WebAuthn | modules/security | DONE offline; browser hardware E2E pending |
| bots | modules/public + mutations | DONE offline; browser/live evidence pending |
| posts | modules/public + mutations + admin content | DONE route slice; scheduled publication is in maintenance |
| comments | modules/public + mutations | DONE offline |
| sellers | modules/sellers | DONE offline; browser/live evidence pending |
| users/profile | mutations | DONE offline |
| media | modules/media | DONE image slice; reconciliation added |
| resources | modules/resources | DONE staging/publish/public delivery and reconciliation |
| file compatibility | removed | RETIRED; no active frontend call-site remains |
| trust | modules/trust | DONE offline for current state machine; browser/live parity pending |
| admin | modules/admin | DONE offline for read/content/case/staff route matrix; browser/live E2E pending |
| client errors | control bounded telemetry route | DONE offline; external sink/retention pending |
| E2EE | modules/e2ee | DONE offline ciphertext-only route/storage boundary; live E2E pending |
| workers/cron | core maintenance plugin | DONE process/distributed lock baseline; browser/live and object-storage evidence pending |

## 4. Porting rules per route

Mỗi route port theo commit/slice phải có:

~~~text
[ ] route path/method compatibility decision
[ ] params/query/body schema
[ ] response schema
[ ] auth level và action policy
[ ] ownership/role/domain invariant
[ ] error mapping
[ ] rate/idempotency policy
[ ] unit test
[ ] fastify.inject contract test
[ ] negative/security tests
[ ] frontend call-site update
[ ] observability fields
~~~

Nest controller decorator không được bê nguyên sang Fastify. Map:

~~~text
Guard         -> preHandler/security service
Pipe          -> JSON Schema + domain parser
Interceptor   -> hook/onSend/service wrapper
ExceptionFilter -> setErrorHandler
Middleware    -> plugin/hook chỉ khi cross-cutting
Module        -> fastify-plugin/module registration
Injectable    -> explicit constructor dependency
~~~

## 5. Contract compare và canary

Chỉ compare read trước; không thực thi mutation hai lần. Read compare cần:

- canonicalized JSON;
- bỏ requestId/timestamp/volatile fields;
- so sánh status/error code;
- so sánh public field allowlist;
- log drift hash, không log raw PII;
- sampling rate và retention rõ ràng.

Mutation compare dùng một trong:

- dry-run domain service;
- transaction rollback;
- fixture database isolated;
- command idempotency key và một authoritative writer.

Không mở canary chỉ vì health 200. Phải có route-level readiness.

## 6. Cutover

### Pre-cutover

~~~text
[ ] Fastify build mới và process mới đã test
[ ] schema/migration đã apply ở staging
[ ] backup/restore đã verify
[ ] CORS_ORIGINS/API_URL/transport key đúng environment
[ ] web build và JS artifact verifier pass
[ ] browser smoke pass
[ ] auth replay/renew tests pass
[ ] admin critical action test pass
[ ] rollback command và owner đã xác nhận
~~~

### Canary / edge switch

1. chuyển một route public/read hoặc một user cohort nhỏ;
2. theo dõi status/error/latency/security events;
3. giữ mutation critical ở maintenance/deny mode cho tới khi Fastify step-up parity;
4. mở dần theo module;
5. không đổi DB schema trong cùng cửa sổ canary nếu không bắt buộc.

### Full cutover (completed)

Mọi route production frontend hiện đã có target Fastify hoặc deprecation decision. Release tiếp theo chỉ mở rộng evidence/hardening; không đưa lại runtime legacy.

## 7. Emergency edge switch

Emergency handling là edge switch sang maintenance page hoặc binary Fastify đã được approve, không switch về runtime legacy:

~~~text
1. stop sending new traffic to the affected Fastify process
2. serve the approved maintenance page or known-good Fastify release
3. invalidate/rotate credentials if protocol state differs
4. inspect duplicate/partial mutations using idempotency/audit
5. restore the approved API upstream
6. verify health + representative read/mutation
7. preserve Fastify logs/security events for incident review
~~~

Không xử lý sự cố bằng cách xóa migration hoặc restore DB mù. Nếu đã tạo session family/device/permit records, phải dùng compatibility reader hoặc cleanup job đã test.

## 8. Post-cutover verification gate

Mọi release phải chạy legacy-runtime audit và các lệnh sau:

~~~text
rg "@nestjs/common|@nestjs/core|@nestjs/platform-express|Express.Request|Express.Response|from ['\"]express|Multer" api apps web
~~~

Expected application result: không còn import runtime; chỉ tài liệu lịch sử có thể nhắc tên cũ. Sau đó:

~~~text
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run build
npm run build --workspace api-fastify
npm test --workspace api-fastify
~~~

Root scripts hiện chưa bao phủ toàn bộ Fastify integration; phải cập nhật CI trước khi dùng checklist này như release gate.
