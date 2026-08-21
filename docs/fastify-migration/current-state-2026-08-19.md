# Fastify migration current state (2026-08-19; verification refreshed 2026-08-21)

This document records the Fastify cutover state. The NestJS/Express HTTP
runtime has been removed; `api/` is now the Prisma/data workspace and
`apps/api-fastify` is the only API runtime. It does not claim browser, OAuth
provider, WebAuthn hardware, Redis, or live edge parity without corresponding
evidence.

## Implemented in the current checkout

### Runtime and security boundary

- Fastify v5 + TypeScript `buildApp()` and production server entry.
- Cookie, CORS, Helmet, rate limiting, request IDs, error envelope and
  transport-v4 negotiation.
- Production startup fails closed when CORS, IP salt, stable transport private
  JWK or WebAuthn origin/RP configuration is absent; non-production tests keep
  explicit ephemeral fixtures.
- Session family with hashed rotating cookie credentials, idle/absolute expiry,
  rotation grace and reuse detection. Production cookies are `__Host-x` for
  the session and `__Host-y` for one-time OAuth state; both are host-only,
  Secure and HttpOnly.
- Session, access and OAuth state credentials are generated from exactly 48
  random bytes (64 base64url characters). A shared parser rejects malformed,
  prefixed, JWT-like or oversized values before hash lookup. `tb_session` in
  DPoP is documented binding metadata, not a credential payload.
- Device-bound P-256 proof, body digest, timestamp, nonce, sequence,
  idempotency and short-lived opaque access grants. Session/access/OAuth state
  credentials are random base64url values; persisted session/access/state
  lookup credentials are hashes where the protocol permits it, and access
  grants remain browser-memory-only.
- One-time opaque action permits bound to user, session, device, route, method,
  body hash and server nonce.
- WebAuthn registration/authentication and recent step-up enforcement for
  critical permits.
- Security telemetry and 404 cloaking for unknown/expired capabilities and
  non-staff admin surfaces.

### Read and mutation surfaces

- Public bots, posts, sellers, comments, media and resources reads.
- Profile, bot, post, review, comment, reaction, bookmark, report and seller
  follow mutations through `/api/m/:cap`.
- Seller profile and Trust Center flows.
- Trust review/approve/reject/revoke/suspend, staff CRUD, cases and admin
  content mutations with role checks, permits, audit and step-up where policy
  requires it.
- Admin content reads plus status, comments lock, distribution, report
  resolution and version reads.
- `POST /api/admin/posts` now creates draft, scheduled or published admin posts
  through the `posts.moderate` capability. `scheduledAt` must be a valid future
  ISO date; arbitrary client role/official fields are not trusted.
- Public seller profile and lookup parity includes trust timeline, reviews,
  review summary, verification counts/checks, contact/URL matching, listing
  statistics and risk fields; the seller contract test exercises these fields.

### Upload and resource boundary

- `@fastify/multipart` accepts one file, bounded fields/parts and a 50 MiB
  shared parser limit.
- Multipart files are streamed to a mode-0600 temporary file while hashing;
  temporary files are removed on both success and failure paths.
- Resource staging validates extension, declared MIME, magic bytes, UTF-8/NUL
  safety, size and generated storage-key path safety.
- Resource staging copies from the temporary file by stream, not by loading a
  50 MiB resource into a Buffer.
- E2EE ciphertext attachments copy from the staged temporary file by stream;
  final storage records size and SHA-256 metadata without loading the uploaded
  file into a Buffer. The generic legacy-file routes are retired and covered
  by 404 regression guards.
- E2EE attachment delivery verifies stored size and digest while streaming
  ciphertext from disk.
- Resource files older than 72 hours and still unattached are claimed as
  `deleting`, removed from storage and deleted from metadata by maintenance.
- Media/resource storage reconciliation marks missing, size-mismatched or
  SHA-256-mismatched metadata as `orphaned` and removes only unknown files
  older than the grace window (`TB_MEDIA_ORPHAN_GRACE_MS` /
  `TB_RESOURCE_ORPHAN_GRACE_MS`). Known files are checksum-audited in a
  rotating bounded batch controlled by `TB_STORAGE_CHECKSUM_MAX_FILES`.
- Trusted Seller applications whose `trustedUntil`/`expiresAt` has passed are
  changed to `revoked`; projections and trust events are recomputed.

### Maintenance worker

`MaintenanceService.runOnce()` removes expired:

- security nonces;
- action permits;
- access grants;
- WebAuthn challenges;
- idempotency records;
- abandoned staged resource files;
- expired Trusted Seller applications.

The same pass promotes due scheduled posts atomically and promotes attached
resource versions after the post state transition. A broader resource-version
reconciliation pass is still a production follow-up.

The service has a non-overlap guard, starts from the control plugin, and stops
on app close. It also claims a database-backed expiring lock in the durable
security ledger, so multiple Fastify instances do not intentionally run the
same maintenance pass concurrently. A Redis lock can still be added for a
deployment that moves all TTL-heavy state out of the database, but it must be
atomic and tested before enabling that mode.

The maintenance pass also reconciles media/resource metadata against private
storage. Missing, size-mismatched and digest-mismatched rows are marked
`orphaned`; unreferenced `.bin` files are removed only after the configured
grace window. Recent or concurrent files are retained for a later pass. The
checksum cursor rotates between passes, and each result reports checked and
skipped known files so an operator can see whether a pass was bounded.

## Route contract

All protected mutations use this shape:

```text
POST /api/i
  -> opaque permit + serverNonce

POST|PUT|PATCH|DELETE /api/m/<permit>
  -> device proof + access grant + body commitment + permit consumption
```

Admin content examples:

```text
POST  /api/admin/posts                         posts.moderate
PATCH /api/admin/posts/:id/status              posts.moderate
PATCH /api/admin/posts/:id/comments            posts.moderate
PATCH /api/admin/posts/:id/distribution        posts.moderate
PATCH /api/admin/posts/reports/:id             posts.moderate
```

These internal paths are not direct mutation handlers. Direct calls are
expected to return 404; the capability gateway resolves and dispatches them
only after server-side staff authorization and permit verification.

Resource upload contract:

```text
POST /api/admin/resources/upload                resource.upload
DELETE /api/admin/resources/files/:id           resource.delete
GET /api/admin/resources/files/:id/preview      owner session read
```

Public resource delivery requires a published post, active resource,
published version and active file. `showSource`, `allowDownload` and
`requiresLogin` are enforced server-side.

## Verification evidence in this checkout

```powershell
npm.cmd run check:legacy
npm.cmd run verify
git diff --check
```

The Fastify contract suite currently contains 38 passing tests (verification
refreshed 2026-08-21). The suite
covers transport/auth/replay, public reads, media, resources, seller flows,
Trust Center, admin trust, admin writes/content, maintenance/multipart and
legacy-file retirement guard regressions. It also asserts opaque credential
length/shape, hash-only session/access persistence, production host cookie
attributes, one-time OAuth state consumption, and forwarding of the production
OAuth state cookie through the custom Next proxy. The web build also runs the
post-build obfuscator and artifact verifier for all discovered JavaScript
assets. The Fastify build normalizes Prisma's generated runtime imports for
the compiled ESM process, and `smoke:fastify` starts that fresh compiled
  process on an ephemeral port against a temporary SQLite copy before checking
  transport and health behavior. A separate `smoke:web` starts fresh API and
  custom Next server processes, proxies `/api/*` through the runtime
  `API_URL`, and verifies homepage headers plus the transport gate.

## Remaining production hardening

### Must be completed

- Revalidate the `deepmerge-ts` override whenever Prisma is upgraded. The
  current production audit is clean (`npm audit --omit=dev --audit-level=high`
  reports 0 vulnerabilities); the override is a compatibility pin, not a
  reason to run `npm audit fix --force` or downgrade Prisma.
- Add a real Redis adapter for nonce, permit, access-token and rate state when
  scaling beyond the database ledger; prove atomic consume/rotation under
  concurrent requests before enabling it.
- Run authorized client/server E2EE live tests with real device keys and
  ciphertext fixtures; the offline Fastify E2EE route and persistence slice is
  already present.
- Extend resource-version lifecycle reconciliation beyond scheduled-post
  promotion, including recovery for interrupted storage/database transitions.
- Add recovery/alert policy for repeated checksum mismatches; online
  reconciliation now checks presence, size and SHA-256 in a rotating bounded
  batch and marks corrupt rows unavailable.
- Expand moderation/report/case invariants if product policy requires flows
  beyond the current admin content and case slice.
- Finalize staff-session TTL/risk policy and audit retention/export policy;
  the route-level staff permission matrix is implemented.
- Add browser E2E for transport negotiation, device persistence, silent
  renewal, cookie rotation, logout and admin capability actions.
- Add Google OAuth browser E2E with an authorized test account, plus passkey
  hardware/browser E2E.
- Run staging edge/Next rewrite smoke tests and a fresh-process cutover and
  rollback drill.

### Recommended hardening

- Add range/resumable delivery if large-file traffic requires it; current
  resource/media delivery already preserves content length, hash and policy
  checks while streaming from disk.
- Add malware/content-disarm scanning for archives and executable-looking
  resource content if the product accepts untrusted uploads at scale.
- Continue response-schema coverage for any remaining intentionally broad
  admin/mutation DTOs and generate/validate an OpenAPI reference for the public
  contract. Public reads, resources, Trust Center, seller profile, E2EE,
  WebAuthn and admin read/content routes now have concrete serializers.
- Add artifact marker scanning for server-only policy names, source maps,
  credentials and accidental plaintext protected JavaScript.
- Add metrics/tracing for route class, security decision, permit rejection,
  replay, renewal, storage cleanup and worker lag.
- Root workspace now exposes `typecheck:fastify`, `test:fastify`,
  `build:fastify`, `verify:fastify`, `smoke:web` and a full `verify` command;
  the existing root `build` remains the web compatibility command. The full
  verify command also runs the E2EE WASM smoke.

## Cutover rule

The web rewrite and root scripts target Fastify. A release still requires
route-level contract evidence, database backup/restore verification, a fresh
process smoke, browser smoke, security replay tests and an edge-level rollback
switch that does not require restoring application source code.
