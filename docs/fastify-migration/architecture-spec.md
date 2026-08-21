# Architecture specification — pure Fastify API

## 1. Mục tiêu

API mới là một gateway Fastify v5 thuần TypeScript, không dùng Nest adapter và không kéo Express compatibility layer vào runtime. Fastify chịu trách nhiệm HTTP lifecycle, schema validation, serialization, plugin encapsulation và request context. Domain service/repository không biết Fastify.

Mục tiêu:

- giảm abstraction ở security-critical request path;
- gom transport, session, device proof, permit và replay handling vào một pipeline có thứ tự;
- giữ JSON contract ổn định khi port từng module;
- cho phép buildApp() được test bằng fastify.inject() mà không bind TCP;
- hoàn tất cutover về một HTTP runtime Fastify duy nhất; rollback vận hành là edge switch/maintenance mode, không khởi động lại Nest runtime.

Không phải mục tiêu:

- rewrite database hoặc đổi ORM trong cùng đợt;
- biến frontend thành vùng bí mật;
- dùng route opacity để thay authorization;
- tuyên bố mọi module Nest hiện tại đã có parity.

## 2. Topology hiện tại và topology đích

Topology hiện tại và đích:

~~~text
Browser / Next :3000
   |
   | Next rewrite /api/* hoặc edge upstream
   v
Pure Fastify API :3002
   |
   +--> Prisma schema và database hiện tại
   +--> media storage ngoài web root
~~~

Topology đích:

~~~text
Browser / Next SSR
        |
        v
Edge TLS + origin policy
        |
        v
Pure Fastify gateway
        |
  +-----+---------+----------------+
  |               |                |
  v               v                v
Auth/Security   Domain modules   Media/stream
  |               |                |
  +---------------+----------------+
                  |
            Prisma security ledger
                  |
       private storage / audit / workers
~~~

Local/contract tests dùng SQLite; production có thể thêm Redis cho rate/TTL-heavy state khi chạy nhiều instance, nhưng session revocation, audit và anti-replay hiện vẫn authoritative ở database. Việc Fastify listen thành công chỉ chứng minh process khởi động, không chứng minh inference, OAuth browser flow, WebAuthn hardware hay production parity.

## 3. buildApp lifecycle

Implementation hiện tại nằm ở apps/api-fastify/src/app/build-app.ts. Thứ tự bắt buộc:

1. load environment từ api/.env;
2. tạo hoặc nhận injected database;
3. tạo AuthService, SecurityService, TransportService;
4. tạo Fastify với request id, trust proxy, body limit 70 MB và không tự xóa additional properties;
5. decorate db/auth/security/transport;
6. register cookie, multipart, CORS, Helmet và rate-limit;
7. register parser cho application/x-thb;
8. onRequest: request id, security headers, Origin check cho mutation, THB/4 transport metadata và transport gate;
9. preValidation: decode CBOR request frame sau khi AES-256-GCM verify AAD;
10. onSend: frame JSON/bytes response thành THB/4 binary response;
11. error handler: map AppError/validation/413/500 về public error envelope;
12. register routes dưới prefix /api;
13. onClose: disconnect database nếu app sở hữu connection.

The production Fastify build runs `normalize-prisma-runtime.mjs` after
TypeScript compilation because Prisma 7's generated ESM runtime can retain
relative `.ts` imports in the generated client. The fresh-process smoke test
executes the normalized compiled entry, not the TypeScript test harness.

Các route plugin không được tự tạo một Fastify instance hoặc tự bypass global transport/error policy. Test-only options như enforceTransport=false phải được ghi rõ trong test và không được dùng ở production.

## 4. Module boundaries

Layout đích:

~~~text
apps/api-fastify/
  src/
    app/
      build-app.ts
      server.ts
    core/
      config.ts
      database.ts
      errors.ts
      response.ts
      crypto.ts
      cookies.ts
      auth.ts
      security.ts
      transport.ts
      multipart.ts
    modules/
      control/
      public/
      mutations/
      media/
      auth/          control routes + core/auth
      sellers/       profile/follow routes + mutation dispatcher
      trust/         seller/admin trust routes + mutation dispatcher
      resources/     storage, service, public/admin routes
      admin/         read/content/write services + permission context
      moderation/    admin case/content workflow (no separate HTTP bypass)
      e2ee/          ciphertext-only routes and storage boundary
    types/
~~~

Nguyên tắc dependency:

- app được phép compose mọi plugin;
- core chỉ chứa policy/infra primitive, không import UI;
- module route gọi service, không đọc trực tiếp cookie/header trong domain service;
- mutation service nhận request context đã verify, không tự tin role hoặc target từ payload;
- repository là nơi duy nhất truy cập Prisma;
- media storage không nhận path tùy ý từ client;
- audit/security telemetry không làm một request revoke/replay hợp lệ thất bại lần hai nếu ghi log gặp lỗi.

## 5. Request classes

### Public read

Các read route có thể trả DTO public; allowlisted native/browser reads (health, bootstrap/auth-me, public catalog, media và resource streams) có thể clear-text để không gãy img/download khi không thể gắn THB/4 headers. Các private/admin/E2EE reads vẫn chịu transport gate khi enforceTransport=true. Không trả email nội bộ, risk score, storageKey, staff notes, raw key material hoặc domain fields chưa được public hóa.

### Session-only

Dùng cho auth/me, device list và các flow cần biết user/session nhưng chưa cần mutation access grant. Session cookie vẫn phải được resolve server-side; client không gửi userId để xác định principal.

### Protected mutation

Flow chuẩn:

~~~text
session cookie
  -> access grant
  -> device proof
  -> body digest + replay check
  -> action permit
  -> authorization/domain ownership
  -> handler
~~~

Không route nào được dùng “cookie OR DPoP”. Các binding phải cùng user, session, device và key fingerprint.

### Media

GET /api/media/:id quyết định visibility từ attachment status, public reference, owner hoặc staff. Storage directory không được static expose. Published media có thể cache immutable; draft/private media là no-store.

## 6. Data/storage boundary

Fastify hiện dùng Prisma client được tạo từ api/prisma/generated và Better SQLite adapter. Khi chuyển production database, chỉ thay adapter/config sau khi contract tests pass; không nhúng driver choice vào business service.

Session/access/device/permit/nonce/security event là security state. Các record cần index theo:

- token hash/fingerprint;
- user/session family/device;
- expires/revoked/rotated;
- event type + createdAt;
- action + createdAt.

Media:

- metadata ở Attachment;
- bytes ở MEDIA_DIR;
- storageKey là generated relative key, không nhận từ user;
- file name chỉ dùng cho Content-Disposition đã sanitize;
- status/reference quyết định delivery;
- xóa là transaction + storage cleanup best effort, có kiểm tra reference trước và sau.

Resource files now have a Fastify ownership/visibility contract and live under `RESOURCE_UPLOAD_DIR`, separate from `MEDIA_DIR`. The removed generic legacy-file contract is not exposed by the Fastify runtime. E2EE attachments use the Fastify ciphertext-only storage boundary. Maintenance reconciles staged rows and storage references before deleting bytes.

Media and resource rows persist a SHA-256 digest. Reconciliation first checks
the directory listing and recorded size, then hashes known live files in a
rotating batch. A mismatch or unreadable file transitions the row to
`orphaned`; unknown files are never hashed as if they were trusted metadata and
are removed only after the configured grace period. `0` for
`TB_STORAGE_CHECKSUM_MAX_FILES` requests a full pass; the default is bounded to
256 files per pass.

## 7. Error/response contract

JSON thành công:

~~~json
{"success":true,"data":{}}
~~~

JSON lỗi:

~~~json
{"success":false,"error":"Public message","code":"ERROR_CODE","requestId":"..."}
~~~

Production không trả stack, SQL, filesystem path, internal class name hoặc secret. Error code là stable machine contract; message có thể bản địa hóa sau.

Response schema phải được khai báo cho mọi route mới. additionalProperties=false là mặc định cho input security-sensitive và response DTO public. Không dùng removeAdditional để âm thầm sửa payload attacker.

## 8. Frontend boundary

Next web chỉ nên nhận UI code, DTO đã lọc và capability/permit scoped. Trust score formula, fraud weights, owner resolution, RBAC internals, verification decision và security private state chỉ ở server.

Public JavaScript chunks hiện được obfuscate sau Next build; đó là lớp tăng chi phí phân tích, không phải confidentiality. Chi tiết nằm ở frontend-artifact-hardening.md.

## 9. Tổ chức route khi port tiếp

Mỗi module Fastify mới phải có:

~~~text
<module>.routes.ts
<module>.schemas.ts
<module>.service.ts
<module>.repository.ts
<module>.policy.ts
<module>.contract.test.ts
~~~

Route config phải khai báo security level/action rõ ràng. Nếu route mutation cần permit thì không expose domain endpoint trực tiếp ngoài capability gateway trừ khi có lý do compatibility được ghi trong API contract.
