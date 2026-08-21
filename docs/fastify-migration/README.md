# Fastify migration and security documentation

Trạng thái tài liệu: Fastify cutover đã thực hiện, xác minh lại 2026-08-20.

Bộ tài liệu này là contract vận hành sau khi chuyển API sang pure Fastify, đồng thời ghi lại các quyết định port từ runtime cũ, lớp bảo vệ TSP, session family, device-bound access grant, action permit và media boundary. Tài liệu phân biệt implementation offline với bằng chứng browser/live/production; không coi một route hoặc test contract đơn lẻ là production-ready.

## Trạng thái hiện tại

| Surface | Hiện trạng | Cổng mặc định | Ghi chú |
| --- | --- | ---: | --- |
| Next.js web | Đang dùng | 3000 | Rewrite /api theo API_URL; build có post-build JavaScript obfuscation |
| Fastify API | Runtime chính | 3002 | `apps/api-fastify`, pure Fastify v5 |
| Database | Dùng chung schema Prisma hiện tại | — | Fastify đang dùng Prisma Better SQLite adapter |
| Storage | Media/resource/E2EE ngoài web root | — | MEDIA_DIR + RESOURCE_UPLOAD_DIR; Fastify kiểm soát mọi upload/download |

Fastify đã có contract coverage cho transport v4, session rotation/replay, device proof, opaque capability, public reads, mutation dispatch, image media, resource staging/public delivery, seller Trust Center, admin read/mutation/content, E2EE boundary, WebAuthn step-up và maintenance cleanup/reconciliation. Maintenance hiện kiểm tra cả SHA-256 theo batch xoay vòng cho media/resource và build fresh-process có smoke riêng. Generic legacy-file routes đã retired; những phần còn cần vận hành production là browser/live E2EE/WebAuthn/OAuth evidence, Redis scale-out, object storage/malware policy tùy threat model và release drills.

## Đọc tài liệu theo thứ tự

1. [architecture-spec.md](architecture-spec.md) — boundary, lifecycle, module layout và data flow.
2. [security-transport-spec.md](security-transport-spec.md) — protocol, auth binding, replay và permit contract.
3. [api-contract.md](api-contract.md) — route/action/schema/error contract hiện tại và route còn thiếu.
4. [migration-plan.md](migration-plan.md) — completion gates, contract compare, canary và emergency edge switch.
5. [frontend-artifact-hardening.md](frontend-artifact-hardening.md) — phạm vi obfuscation tất cả public JS chunk và giới hạn của nó.
6. [operations-and-acceptance.md](operations-and-acceptance.md) — environment, command, release gate, vận hành và acceptance evidence.
7. [current-state-2026-08-19.md](current-state-2026-08-19.md) - authoritative implementation delta, current evidence and remaining cutover work.
8. [../FASTIFY_ROUTE_INVENTORY.md](../FASTIFY_ROUTE_INVENTORY.md) - generated frontend-to-runtime route coverage gate.
9. [opaque-credentials-audit.md](opaque-credentials-audit.md) - requirement-by-requirement audit for opaque cookies, DPoP grants, OAuth state and renewal.
10. [database-source-of-truth.md](database-source-of-truth.md) - SQLite snapshot authority, migration boundary and safe deployment rules.

Các product/domain decision cũ vẫn nằm trong docs/superpowers/specs/. Nếu có mâu thuẫn, route/schema đang chạy và migration contract mới là nguồn sự thật cho HTTP layer; domain decision cũ chỉ được dùng để giữ behavior.

## Quy ước trạng thái

- DONE: đã có implementation và test hoặc evidence tương ứng trong checkout hiện tại.
- PARTIAL: có implementation một phần, hoặc test mới chỉ bao phủ một boundary.
- TODO: chưa port/triển khai; không được ghi là production-ready.
- BLOCKED: có dependency hoặc quyết định cần xử lý trước.

## Không được làm trong migration

- Không reset, checkout, clean hoặc overwrite dirty worktree.
- Không đưa lại runtime/framework legacy hoặc compatibility adapter kiểu Express vào application.
- Không dùng access token, cookie, Google token, private key, WebAuthn response hoặc E2EE plaintext làm fixture commit vào repo.
- Không coi obfuscation, transport encryption hay opaque route là bí mật tuyệt đối trong browser.
- Không đổi DB schema, auth protocol và frontend API client cùng một commit nếu chưa có compatibility plan.

## Definition of done cấp hệ thống

Migration chỉ được đánh dấu complete khi:

- mọi route trong route matrix đã ở Fastify hoặc có quyết định deprecate được ghi nhận;
- frontend không còn gọi route Nest-only;
- auth/session/device/permit behavior có contract tests và replay tests;
- upload/download có stream/limit/MIME/ownership/visibility tests;
- admin/trust/WebAuthn/E2EE có test boundary riêng;
- staging shadow compare không còn drift không giải thích được;
- có fresh process smoke test trên binary/build mới;
- Fastify fresh-process smoke và rollback ở edge/proxy đã được diễn tập theo runbook;
- grep package/import không còn NestJS, Express hoặc Multer trong application path;
- build, typecheck, test, migration verification và artifact scan đều pass.
- Resource-specific details are in [resource-module-spec.md](resource-module-spec.md): storage policy, staging/publish state, visibility, delivery and remaining production work.

## Transport and idempotency clarification

JSON API responses use THB/4 binary transport v4 when the client negotiates it. Media, resource downloads/views and E2EE attachment delivery remain binary payloads inside the same frame when a content length is known; unknown-length streams intentionally fall back to the original stream to avoid buffering. Binary delivery still requires HTTPS/TLS, the route's session/authorization/visibility checks and storage checksum verification; clients must restore the original content type and disposition from the THB/4 response headers.

Protected mutations have two independent replay boundaries:

- the request nonce/JTI rejects reuse of the exact signed proof;
- the durable idempotency ledger rejects reuse of the same user/device/HTTP method/normalized route/key even when an attacker creates a fresh valid proof.

The ledger stores hashes and a short-lived claim only. It intentionally does not replay a previous response. A duplicate returns `409 IDEMPOTENCY_REPLAYED`; the same key with a different request hash returns `409 IDEMPOTENCY_KEY_REUSED`. The caller must obtain a new permit/key when the original response was not received.

## Current verification snapshot

The source-level gates verified in this checkout are:

```text
npm.cmd run typecheck:fastify
npm.cmd run test:fastify
npm.cmd run inventory:fastify -- --check
git diff --check
```

The full `npm.cmd run verify` gate remains the release command. Passing offline contract tests is not evidence of a real Google OAuth, browser WebAuthn ceremony, production Cloudflare/Redis/object-storage deployment or authenticated user journey.
