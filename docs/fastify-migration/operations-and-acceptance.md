# Operations, release and acceptance

## 1. Environment contract

Không commit giá trị thật. Chỉ commit .env.example/documented names; secret manager giữ production values.

| Variable | Required | Purpose/default |
| --- | --- | --- |
| DATABASE_URL | yes | Prisma SQLite local hoặc production adapter URL |
| GOOGLE_CLIENT_ID | auth | Google OAuth audience |
| GOOGLE_CLIENT_SECRET | auth | Server-side Google authorization-code exchange secret; never expose to web |
| GOOGLE_REDIRECT_URI | auth | Exact registered callback, normally `http://localhost:3000/api/auth/google/callback` locally |
| PUBLIC_ORIGIN | auth | Browser origin used to derive the callback when `GOOGLE_REDIRECT_URI` is omitted |
| OWNER_EMAIL | auth/RBAC | normalized owner email; không log raw |
| FASTIFY_PORT / API_FASTIFY_PORT | no | 3002 |
| FASTIFY_HOST | no | 0.0.0.0 khi server |
| TB_API_ROOT | no | API root discovery override |
| CORS_ORIGINS | production | comma-separated exact origins |
| SECURITY_IP_SALT | production | secret salt cho IP digest |
| TB_ACCESS_TOKEN_TTL_MS | no | 180000, clamp 60000–300000 |
| TB_SESSION_IDLE_TTL_MS | no | 604800000 |
| TB_SESSION_ABSOLUTE_TTL_MS | no | 2592000000 |
| TB_SESSION_ROTATION_GRACE_MS | no | 8000, max 60000 |
| THB_TRANSPORT_PRIVATE_JWK | production | stable server transport private JWK |
| THB_TRANSPORT_KID | no | stable key id; derive nếu bỏ trống |
| WEBAUTHN_RP_NAME | step-up | thuebot.org |
| WEBAUTHN_RP_ID | step-up | phải khớp browser host |
| WEBAUTHN_ORIGIN | step-up | exact browser origin |
| MEDIA_DIR | storage | ngoài web root, default api/storage/media |
| RESOURCE_UPLOAD_DIR | optional | Fastify resource storage boundary; default `api/storage/resources` |
| API_URL | web | Next rewrite target, default http://localhost:3002 |
| TB_NEXT_INTERNAL_PORT | web server | loopback Next renderer port |
| TB_MAINTENANCE_INTERVAL_MS | worker | cleanup/publication interval, default 60000 and bounded |
| TB_MEDIA_ORPHAN_GRACE_MS | worker | minimum age before unreferenced media bytes can be removed |
| TB_RESOURCE_ORPHAN_GRACE_MS | worker | minimum age before unreferenced resource bytes can be removed |
| TB_STORAGE_CHECKSUM_MAX_FILES | worker | known storage files hashed per reconciliation pass; default 256, `0` means full pass |

Production requirements:

- TLS/HSTS ở edge;
- CORS exact allowlist, không wildcard với credentials;
- transport private JWK và SECURITY_IP_SALT từ secret manager;
- media/resource storage không nằm dưới web/public;
- DB backup encryption và access audit;
- WebAuthn RP ID/origin không lệch deployment host;
- Google Cloud OAuth client phải có đúng redirect URI; authorization-code + PKCE là flow duy nhất;
- log redaction trước khi ship log ra ngoài process.

## 2. Local setup

PowerShell nếu npm.ps1 bị policy block thì dùng npm.cmd.

~~~powershell
npm.cmd install
Copy-Item api/.env.example api/.env

# chỉnh DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI và CORS_ORIGINS tối thiểu
npm.cmd run typecheck --workspace api-fastify
npm.cmd run build --workspace api-fastify
npm.cmd test --workspace api-fastify
npx.cmd tsc -p web/tsconfig.json --noEmit
~~~

Chạy Fastify:

~~~powershell
npm.cmd run start:dev --workspace api-fastify
~~~

Mặc định:

~~~text
Web:             http://localhost:3000
Fastify:         http://localhost:3002/api
~~~

Fastify production-like:

~~~powershell
npm.cmd run build --workspace api-fastify
npm.cmd run start:prod --workspace api-fastify
~~~

Web build phải chạy pipeline obfuscation/verifier:

~~~powershell
npm.cmd run build --workspace web
~~~

Root `npm run build` vẫn là web build để giữ compatibility; Fastify có các
script root riêng để CI không bỏ qua API:

```powershell
npm.cmd run typecheck:fastify
npm.cmd run test:fastify
npm.cmd run build:fastify
npm.cmd run verify:fastify
```

## 3. Database and migration operations

Trước schema migration:

~~~text
[ ] ghi DB URL/adapter/environment
[ ] backup file/database và checksum
[ ] test restore vào directory riêng
[ ] kiểm tra process nào đang giữ DB
[ ] chạy migration một lần, không chạy song song
[ ] verify counts/indexes/constraints
[ ] chạy Fastify contract tests trên clone
~~~

Không commit test media hoặc generated database artifacts. Nếu test tạo file dưới api/storage/media, dọn artifact test theo harness hoặc đưa vào gitignore; không xóa file của user ngoài test directory.

Production chuyển từ SQLite sang Postgres/Redis cần RFC riêng:

- transaction semantics cho rotate/permit/nonce;
- unique constraint chống replay;
- TTL cleanup;
- connection pooling;
- backup/restore;
- concurrent renew race;
- read replica consistency cho security state.

Security state hiện được ghi durable trong database để restart không làm mất nonce/replay/session revocation. Redis là một adapter scale-out tùy chọn cho TTL-heavy access/nonce/permit/rate state; không được bật nửa vời nếu chưa có atomic operation, failure policy và contention test.

## 4. Observability

Structured log tối thiểu:

~~~json
{
  "requestId": "...",
  "route": "/api/m/<opaque>",
  "method": "POST",
  "statusCode": 200,
  "durationMs": 14,
  "userId": "redacted-or-internal-id",
  "deviceId": "redacted-or-internal-id",
  "securityLevel": "PROTECTED",
  "action": "post.react",
  "riskScore": 0
}
~~~

Không log:

~~~text
cookie raw
Authorization value
device signature
private/public transport private JWK
Google token
WebAuthn credential response raw
E2EE plaintext
full upload bytes
full request body nếu có PII
~~~

Metrics cần có:

- request count/latency/status theo route class;
- transport negotiation/decrypt failures;
- auth/session invalid/reuse;
- access renew success/failure;
- device signature/replay;
- permit issued/consumed/rejected/expired;
- media upload reject reason and bytes;
- pending migration route count;
- 5xx và DB latency.

Audit record phải có actor/session/device/action/target/result/time/requestId, nhưng chỉ giữ metadata đã sanitize. Critical action audit append-only/hash-chain policy phải được port trước admin cutover.

## 5. Acceptance matrix

| Area | Acceptance | Evidence required | Current state |
| --- | --- | --- | --- |
| Type safety | Fastify noEmit pass | command output | DONE in latest work session |
| Fastify build | dist generated | build output | DONE in latest work session |
| Contract tests | full Fastify suite covering core/posts/media/resources/seller/trust/admin/maintenance/E2EE/legacy-file retirement/device revoke/idempotency/binary streaming, seeded admin-read serialization, DPoP rejection, exact opaque credential shape, THB/4 unsafe-map-key rejection and durable E2EE key-bundle read budget | node test output | DONE, 40 tests in latest work session; runner is serialized to avoid SQLite/Node worker flake |
| Transport gate | missing negotiation -> 426 for mutation/private paths; allowlisted public/native reads clear-text | contract test | DONE |
| Transport crypto | key negotiation, AES-GCM envelope/decrypt | contract test | DONE |
| Session rotation | Set-Cookie, generation, grace/reuse revoke | contract test | DONE |
| Access grant | opaque token, TTL, device/session binding | contract test | DONE |
| Device proof | wrong signature/body/token/session rejects | contract test | DONE |
| Capability | action/path/body/nonce/uses/TTL bound | contract test | DONE |
| 404 cloak | expired/unknown capability and non-staff admin | contract test | DONE for current surface |
| Public DTO | no internal fields | contract test | DONE for bots/posts/sellers |
| Media | multipart/magic/MIME/hash/ownership/reference | media contract | DONE image slice |
| Google browser E2E | real OAuth redirect/token/cookie | browser/staging evidence | TODO |
| Cloudflare assurance | production Turnstile/siteverify | edge evidence | TODO/not in Fastify slice |
| WebAuthn | registration/auth/critical step-up | Fastify route + contract/security gate; browser hardware evidence still required | PARTIAL |
| Admin parity | all admin reads/mutations | route matrix + tests | DONE offline for current route matrix; browser/live cutover pending |
| Admin read core | overview, moderation, search, cases, sellers, bots, users, comments, analytics, audit, risky reviews | admin-read contract path + staff 404 cloak | DONE offline |
| Trust parity | verification state machine/audit | domain integration + admin trust contract | PARTIAL: audit retention/export policy and broader product invariants remain |
| Resources | preview/download/upload ownership, publication visibility, checksum verification and streamed delivery | resource + maintenance contract tests | DONE offline for current Fastify slice; live storage/object-store evidence pending |
| Seller follow | id/slug lookup, idempotent follow/unfollow, self/unknown/replay rejection | seller-follow contract test | DONE |
| Seller profile | session read, capability write, contact/image validation and completeness | seller-profile contract test | DONE for profile slice |
| Seller Trust Center | score/checklist, verification request/cancel/check request, permit-only mutation | trust contract test | DONE for seller-side slice |
| Admin Trust | staff queue, opaque review handles, state transitions, replay cloak, critical step-up | admin-trust contract test | DONE for current decision slice |
| E2EE | ciphertext-only route/storage flow | Fastify contract + authorized client/server E2E | DONE offline; live E2E pending |
| Runtime cutover | fresh process on new build | compiled API smoke plus fresh Next/API rewrite smoke; listener/health/browser evidence still required per release | PARTIAL offline |
| Emergency edge switch | maintenance/known-good Fastify release without data loss | drill record | TODO per release |

“DONE” ở đây là evidence của current code slice, không phải claim production browser/live third-party verification.

## 6. Release gates

### Required offline gate

~~~powershell
npm.cmd run verify
git diff --check
~~~

### Required security gate

~~~text
[ ] no secret patterns in git diff/artifact
[ ] no raw cookie/token in logs/test snapshots
[x] package audit reviewed; current production audit reports 0 high production vulnerabilities; Prisma/deepmerge-ts override remains pinned and must be revalidated on Prisma upgrades
[x] compiled Prisma runtime normalization and fresh-process smoke pass
[x] same-size media/resource tamper regression passes through SHA-256 reconciliation
[x] production security configuration fail-fast regression passes
[ ] CORS/secure cookie/host config verified
[ ] body/file limits verified
[ ] transport private key loaded from secret manager
[ ] action permit replay negative tests pass
[ ] session reuse revokes family
[x] admin trust critical route cannot use silent renewal alone
~~~

### Required runtime gate

~~~text
[ ] start fresh process from newest build
[ ] verify listener PID/port
[ ] GET health through configured edge
[ ] transport negotiation from real browser/client
[ ] browser smoke public/read/login/protected/media
[ ] inspect response headers/cookie flags
[ ] verify no plaintext source maps in public output
[ ] record rollback owner and timestamp
~~~

Không restart/kill service đang do user vận hành chỉ để tạo evidence nếu chưa có authorization rõ ràng. Một process cũ không chứng minh patch mới đã được serve.

## 7. Incident runbooks

### Session reuse detected

~~~text
1. giữ event/security metadata và requestId
2. revoke toàn session family + access grants
3. không silent retry
4. yêu cầu login/device proof lại
5. kiểm tra device/IP/time pattern bằng digest
6. notify user/admin theo risk policy
~~~

### Transport key rotated

~~~text
1. giữ private key cũ trong overlap window nếu policy cho phép
2. publish config/kid mới
3. client renegotiate
4. retry chỉ request idempotent
5. không log private JWK/ciphertext plaintext
6. revoke key cũ sau overlap
~~~

### Media mismatch/corruption

~~~text
1. disable delivery của attachment id
2. verify DB sha256/size và storage checksum
3. giữ metadata/audit, không public bytes lỗi
4. restore từ backup/object version nếu có
5. kiểm tra reference và orphan cleanup
~~~

### Fastify regression

~~~text
1. stop new Fastify traffic
2. route edge/config to the approved emergency backend or maintenance page
3. giữ Fastify logs và security events
4. kiểm tra duplicate side effects bằng idempotency/audit
5. mở incident và sửa theo route slice
~~~

## 8. Known gaps không được che

- Fastify đã có offline route parity cho seller/trust/admin/moderation/E2EE compatibility surfaces; resources có staging/publish/public delivery và maintenance có scheduled publication. Các gap còn lại là distributed worker/storage hardening và browser/live evidence, không phải controller chưa port.
- /api/security/request is a protected diagnostic surface and now requires the same device proof/access grant as other security metadata reads.
- Multipart upload đã stream vào temporary file; resource/E2EE upload và resource/media/E2EE delivery đã hash/size-verify theo stream trực tiếp. Media image upload validation vẫn dùng buffer giới hạn 10 MiB vì cần đọc header/kích thước ảnh; đây là giới hạn có chủ đích.
- Redis multi-instance adapter cho nonce/permit/access/rate state chưa bật; DB ledger và database-backed maintenance lock là baseline hiện tại.
- Critical `trust.review` đã được nối với WebAuthn step-up và dispatcher; các critical surface chưa port khác vẫn chưa có đủ step-up parity.
- Không có bằng chứng trong tài liệu này cho Google OAuth browser E2E, Cloudflare production assurance, WebAuthn hardware E2E hoặc live E2EE messaging.
- Root `npm run verify` now runs the offline Fastify, web artifact, rewrite and
  E2EE smoke gates; the hosting provider still needs to invoke that command in
  its CI workflow.
- Resource module is now implemented for staging, publish, public delivery, owner preview and storage reconciliation. Remaining gaps are object storage, optional malware scanning and live production evidence; this is not a claim of live production parity.
