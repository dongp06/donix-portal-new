# API contract — Fastify v1 migration surface

Trạng thái: route inventory được kiểm tra từ apps/api-fastify hiện tại ngày 2026-08-20. Baseline: 82 frontend references, 88 runtime route declarations, 29 capability actions, 0 missing active references. “Implemented” nghĩa là route tồn tại trong Fastify code; không tự động nghĩa là đã có browser E2E hoặc production upstream proof.

## 1. Global contract

Base path là /api. Khi transport enforcement bật, client phải negotiate transport v4 trước; response JSON/bytes sau đó được đóng thành THB/4 binary frame (`application/x-thb`).

Success:

~~~json
{"success":true,"data":{}}
~~~

Failure:

~~~json
{"success":false,"error":"Public message","code":"ERROR_CODE","requestId":"request-id"}
~~~

Các route mới phải có:

- full JSON Schema cho params/query/body và response;
- additionalProperties=false cho object input/output security-sensitive;
- maxLength/minimum/enum hợp lý;
- status code và error code ổn định;
- contract test dùng fastify.inject();
- không leak internal field qua response serializer.

Pagination mới phải ưu tiên opaque cursor, không expose database offset/internal sort key. Route cũ chưa có cursor thì port theo compatibility contract trước, rồi mới version hóa.

## 2. Transport/control routes hiện có

| Method | Path | Auth | Status | Contract |
| --- | --- | --- | --- | --- |
| GET | /api/transport/config | clear-text exception | DONE | public server transport key/kid |
| GET | /api/health | transport khi enforcement bật | DONE | status, timestamp, database |
| GET | /api/bootstrap | optional session | DONE | protocolVersion, authenticated, session/device context |
| POST | /api/bootstrap | session cookie | DONE | register/update device public JWK |
| GET | /api/auth/google/start | public redirect | DONE | create server-side state/PKCE/nonce and redirect to Google |
| GET | /api/auth/google/callback | OAuth redirect | DONE | consume state, exchange authorization code, verify OIDC nonce, set session cookie |
| POST | /api/auth/google | deprecated client-token shape | 410/400 | migration guard; never accepts browser Google tokens |
| POST | /api/auth/onboarding | session cookie | DONE | role buyer/seller |
| POST | /api/auth/become-seller | session cookie | DONE | promote current user |
| POST | /api/auth/access | session + device proof, no access token | DONE | issue short opaque DPoP-bound grant |
| POST | /api/auth/renew/challenge | session + device proof, no access token | DONE | one-time challenge |
| POST | /api/auth/renew | session + device proof + challenge | DONE | rotate cookie/access grant |
| POST | /api/auth/logout | optional session | DONE | revoke current session, clear cookie |
| GET | /api/auth/me | session cookie | DONE | public current user |
| GET | /api/auth/admin-access | staff session | DONE/404 cloak | public staff context; non-staff returns 404 |
| GET | /api/admin/verifications | staff session + device-bound handle issuance | DONE | verification queue; non-staff returns 404 |
| GET | /api/admin/overview | staff session | DONE | bounded operational overview and queue counts |
| GET | /api/admin/moderation | staff session | DONE | report/trust/case read queue |
| GET | /api/admin/search | staff session | DONE | bounded command-palette search |
| GET | /api/admin/cases[/:id] | staff session | DONE | case read surface |
| GET | /api/admin/sellers[/:id] | staff session | DONE | seller operations read surface |
| GET | /api/admin/bots[/:id] | staff session | DONE | bot operations read surface |
| GET | /api/admin/users | staff session | DONE | bounded user list/counts |
| GET | /api/admin/comments | staff session | DONE | bounded comment moderation read |
| GET | /api/admin/analytics | staff session | DONE | aggregate analytics without private auth data |
| GET | /api/admin/audit | staff session | DONE | append-only audit read |
| GET | /api/admin/reviews | staff session | DONE | risky review read queue |
| GET | /api/security/webauthn/registration/options | session cookie | DONE | passkey registration challenge |
| POST | /api/security/webauthn/registration/verify | session cookie | DONE | consume registration challenge and store public credential |
| GET | /api/security/webauthn/authentication/options | session cookie | DONE | passkey challenge; handle resolves critical action server-side |
| POST | /api/security/webauthn/authentication/verify | session cookie | DONE | consume assertion and record short-lived step-up |
| GET | /api/sellers/me/profile | seller session cookie | DONE | get or create current seller profile |
| GET | /api/sellers/me/trust-status | seller session cookie | DONE | seller-side trust summary |
| GET | /api/sellers/me/verification | seller session cookie | DONE | seller-side verification center summary |
| POST | /api/i | full protected proof | DONE | issue action permit |
| GET | /api/security/devices | session | DONE | device list, no private key |
| GET | /api/security/request | full device proof + access grant | DONE offline | diagnostic metadata is not exposed to unauthenticated callers; browser/live policy evidence pending |
| ALL | /api/m/:cap | full protected proof | DONE for migrated actions | opaque permit gateway, 404 for expired/unknown |
| POST (internal permit path) | /api/admin/posts | staff + posts.moderate permit | DONE | create admin draft, scheduled or published post; scheduledAt must be future |

Google login dùng authorization-code + PKCE S256. `GET /api/auth/google/start` lưu state hash, verifier, OIDC nonce, return path và expiry trong `OAuthState`; cookie state là HttpOnly. Callback yêu cầu cookie state khớp constant-time, consume một lần, exchange code server-side bằng `GOOGLE_CLIENT_SECRET` và verify ID-token audience/email/nonce trước khi tạo session. `POST /api/auth/google` chỉ trả lỗi migration (`GOOGLE_TOKEN_REQUIRED` hoặc `OAUTH_CODE_FLOW_REQUIRED`) và không phải login path.

## 3. Public/read routes hiện có

| Method | Path | Query/params | Status |
| --- | --- | --- | --- |
| GET | /api/bots/categories | none | DONE |
| GET | /api/bots | category, search, status, sort | DONE |
| GET | /api/bots/:idOrSlug | id hoặc slug | DONE |
| GET | /api/bots/:idOrSlug/reviews | id hoặc slug | DONE |
| GET | /api/posts/categories | none | DONE |
| GET | /api/posts/tags | none | DONE |
| GET | /api/posts | q, category, type, tab | DONE |
| GET | /api/posts/slug/:slug | slug | DONE |
| GET | /api/posts/:id | id | DONE |
| GET | /api/sellers/lookup | query | DONE |
| GET | /api/sellers/:identifier/follow | optional viewer | DONE read state |
| GET | /api/sellers/:identifier | id/slug | DONE |
| GET | /api/comments | targetType=post|bot, targetId | DONE |
| GET | /api/media/:id | attachment id | DONE |
| GET | /api/resources | q, limit | DONE |
| GET | /api/resources/post/:slug | slug | DONE |
| GET | /api/resources/:id | resource id | DONE |
| GET | /api/resources/files/:id/preview | optional session | DONE |
| GET | /api/resources/files/:id/download | optional session | DONE |
| GET | /api/resources/files/:id/view | optional session, image only | DONE |
| GET | /api/admin/resources/files/:id/preview | owner session | DONE |

Public DTO không được trả:

~~~text
raw email nếu không cần
internalRiskScore
staff notes
storageKey
device public/private auth records
session/access token
moderation-only metadata
~~~

GET /api/media/:id:

- draft chỉ owner được xem;
- published chỉ được xem nếu có public reference hoặc actor là staff;
- bytes được hash lại trước delivery;
- content type từ validated attachment;
- published có public immutable cache;
- private/draft là private, no-store;
- path storage không bao giờ static expose.

## 4. Mutation gateway và action mapping

Client không gọi mutation path trực tiếp trong production flow. Client tạo bodyHash, xin permit cho method/path, rồi gửi request tới endpoint trong response:

~~~text
POST /api/i
  -> data.endpoint = /api/m/<opaque-permit>
  -> internal path/method được bind trong ActionPermit
~~~

Action mapping đã có:

| Action | Internal method/path | Dispatch | Policy |
| --- | --- | --- | --- |
| profile.update | PATCH /api/users/me | DONE | permit + body |
| media.upload | POST /api/uploads/images | DONE | multipart + permit |
| media.update | PATCH /api/uploads/:id | DONE | permit + body |
| media.delete | DELETE /api/uploads/:id | DONE | permit |
| resource.upload | POST /api/admin/resources/upload | DONE | owner + multipart + permit |
| resource.delete | DELETE /api/admin/resources/files/:id | DONE | owner + permit |
| bot.create | POST /api/bots | DONE | seller + permit |
| bot.update | PUT/PATCH /api/bots/:id | DONE | owner + permit |
| bot.delete | DELETE /api/bots/:id | DONE | owner + permit |
| post.create | POST /api/posts | DONE | user + permit |
| post.update | PATCH /api/posts/:id | DONE | owner + permit |
| post.delete | DELETE /api/posts/:id | DONE | owner + permit |
| post.react | POST /api/posts/:id/reactions or /upvote | DONE | permit |
| post.bookmark | PUT /api/posts/:id/bookmark | DONE | permit |
| post.report | POST /api/posts/:id/report | DONE | permit + abuse budget |
| review.create | POST /api/bots/:id/reviews | DONE | permit + duplicate/domain check |
| review.update | PATCH /api/bots/:id/reviews/:rid | DONE | owner + permit |
| review.delete | DELETE /api/bots/:id/reviews/:rid | DONE | owner + permit |
| comment.create | POST /api/comments | DONE | permit |
| comment.update | PATCH /api/comments/:id | DONE | owner + permit |
| comment.delete | DELETE /api/comments/:id | DONE | owner + permit |
| comment.react | POST /api/comments/:id/react | DONE | permit |
| seller.follow | PUT /api/sellers/:identifier/follow | DONE | seller id/slug + upsert + permit |
| seller.unfollow | DELETE /api/sellers/:identifier/follow | DONE | seller id/slug + deleteMany + permit |
| profile.update | PUT /api/sellers/me/profile | DONE | seller profile validation + media references + permit |
| verification.submit | POST /api/sellers/me/verification | DONE | eligible seller + pending application + permit |
| verification.cancel | DELETE /api/sellers/me/verification | DONE | pending application cancellation + permit |
| verification.check | POST /api/sellers/me/verification/checks/:kind | DONE | seller request marks one check pending + permit |
| device.revoke | DELETE /api/security/devices/:id | DONE offline | capability gateway dispatch, critical step-up, device/session/access revocation; browser/passkey evidence pending |
| trust.review | PATCH /api/admin/verifications/:id and /:userId/checks/:kind | DONE | server-issued handle, staff policy, one-time consume, WebAuthn step-up |
| posts.moderate | POST/PATCH /api/admin/posts... | DONE | staff role, permit, content policy and audit |
| staff.manage | /api/admin/staff... | DONE | staff role, permit, WebAuthn step-up and audit |

Nếu dispatcher không nhận action/path, response là `UNSUPPORTED_MUTATION` với HTTP 404; không được silently mutate ở route khác.

## 5. Body contracts cho slice đã port

### Device bootstrap

~~~json
{
  "publicKeyJwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "base64url",
    "y": "base64url",
    "ext": false
  },
  "deviceName": "Chrome",
  "platform": "web"
}
~~~

### Permit intent

~~~json
{
  "action": "post.react",
  "method": "POST",
  "path": "/api/posts/post-id/reactions",
  "targetId": "post-id",
  "bodyHash": "64-hex-sha256"
}
~~~

Server phải tự resolve action từ method/path và reject action-route mismatch. targetId chỉ là metadata/binding aid, không phải authority.

### Resource upload and delivery

```text
POST /api/m/<permit>
Internal path: POST /api/admin/resources/upload
Content-Type: multipart/form-data

file: one resource file
```

Resource staging is owner-only. The server generates the storage key and stores
only validated metadata in `ResourceFile`; the client never supplies a path.
The upload limit is 50 MiB per file and 20 files per resource. Supported code,
text, archive, PDF and image extensions must pass extension, declared MIME and
magic-byte checks. Previewable text must be strict UTF-8 without NUL bytes.

```text
GET /api/resources
GET /api/resources/post/:slug
GET /api/resources/:id
GET /api/resources/files/:id/preview
GET /api/resources/files/:id/download
GET /api/resources/files/:id/view
GET /api/admin/resources/files/:id/preview  (owner-only staged preview)
```

`requiresLogin` gates preview/download/view with the current session cookie;
`showSource` gates source preview; `allowDownload` gates downloads. Public
delivery requires an active resource, published post, published version and
active file. Download increments `ResourceFile.downloadCount`.

Resource files are staged through a streamed temporary file and copied to
generated storage by stream. The maintenance worker removes unattached staged
files older than 72 hours after claiming them with the `deleting` state.

### E2EE attachment streaming

The generic legacy-file contract (`POST /api/files/upload` and
`GET /api/files/:fileId`) is retired and is intentionally not registered by
the Fastify runtime. It must not be reintroduced as a compatibility fallback.

E2EE attachment mutations use the E2EE capability-bound routes and accept
ciphertext metadata only. The server validates ciphertext size/digest while
streaming to a mode-0600 final-storage file, writes the SHA-256 digest to
metadata, and removes partial files on failure. E2EE attachment downloads
verify stored size/digest in a transform while streaming; the route does not
materialize ciphertext as a response Buffer.

### Media upload

~~~text
POST /api/m/<permit>
Content-Type: multipart/form-data

file: one image file
usage: post_inline | post_cover | bot_logo | bot_cover |
       bot_demo | pricing_image | resource_image | review_image
~~~

Giới hạn hiện tại:

- 1 file;
- shared multipart parser: at most 8 fields, 10 parts, 256 KiB per field and 50 MiB per file;
- tối đa 8 fields, 10 parts;
- file tối đa 10 MiB;
- JPEG, PNG, GIF, WebP;
- extension, declared MIME và magic bytes phải cùng loại;
- dimensions phải đọc được;
- generated storage key;
- SHA-256 metadata;
- upload tạo status=draft và trả markdown attachment reference.

PATCH media metadata chỉ cho altText tối đa 240 và caption tối đa 500; field lạ bị reject. DELETE bị reject nếu attachment còn reference.

### Bot/post/review/comment

MutationService hiện whitelist field trước khi validate domain. Một số shape chính:

~~~text
bot:
  title, tagline, description, coverImage, gallery, features,
  pricing, status, tags, targetAudience, categorySlug,
  categoryName, version, systemReqs

post:
  title, content, type, category, tags, coverImage,
  linkedBotId, status

review:
  rating, comment, images

comment:
  targetType, targetId, parentId, content

profile:
  bio, contact
~~~

Seller profile write:

```text
PUT /api/sellers/me/profile
```

The mutation is executed through `/api/m/<permit>` with the original path
bound in the permit. Allowed fields are `shopName`, `bio`, `avatar`, `banner`
and `contact`; unknown fields, unsafe image references, unsupported contact
keys and unowned draft media are rejected. The server creates a profile on the
first authenticated seller read, preserves the stable slug, publishes owned
draft image references only after validation and recomputes profile
completeness.

Seller Trust Center reads:

```text
GET /api/sellers/me/trust-status
GET /api/sellers/me/verification
```

Both return the score breakdown, eligibility checklist, current verification
state and ownership checks. Seller mutations are capability-only:

```text
POST /api/m/<permit>  -> POST /api/sellers/me/verification
DELETE /api/m/<permit> -> DELETE /api/sellers/me/verification
POST /api/m/<permit>  -> POST /api/sellers/me/verification/checks/:kind
```

The client can request a check, but cannot submit `verified` or `trusted`
state. Staff approval/rejection is available only through the staff queue and
opaque server-issued handles. `trust.review` is a critical action: the handle
advertises step-up and the gateway rejects consumption without a recent
WebAuthn event.

### Admin Trust queue

```text
GET /api/admin/verifications?status=pending
```

The route derives staff role from the authenticated session and returns `404`
to guests/non-staff. Reviewable rows receive an opaque `actionHandle`; the
browser does not receive an internal action registry key or direct PATCH
authority.

```text
POST /api/m/<handle>
body: { action: request_info | recommend | approve | reject | suspend | revoke | restore,
        decision?: approve | reject, note?: string }
```

The handle is bound to the verification id and private PATCH path. Moderator
recommendations are allowed, while approve/reject/suspend/revoke/restore
require admin or owner policy. `approve` recomputes server-owned user/bot
trust fields and a successful consume is one-time.

Admin check updates use the same gateway with internal path
`PATCH /api/admin/verifications/:userId/checks/:kind` and accept only
`status`, `value`, `method`, and `note`.

### WebAuthn step-up

Registration and authentication challenges are session-bound, single-use and
five-minute TTL. Critical handle authentication resolves the action from the
server-side permit; the client cannot choose a different action. The assertion
updates the authenticator counter and records a short-lived
`webauthn.step_up` security event. The gateway checks that event before
consuming a critical permit.

### Seller follow

The legacy mutation paths are not exposed directly by Fastify. The client requests
an opaque permit for the original method/path and executes the returned capability
endpoint:

```text
PUT /api/sellers/:identifier/follow
DELETE /api/sellers/:identifier/follow
```

`identifier` accepts the seller user id or `SellerProfile.slug`. `PUT` is
idempotent and uses the `(sellerId, followerId)` unique key; `DELETE` is
idempotent and removes zero or one row. The response data is:

```json
{
  "followerCount": 12,
  "isFollowing": true
}
```

The server rejects a non-seller or unknown identifier with `SELLER_NOT_FOUND`
and rejects following the current user with `SELLER_FOLLOW_SELF`. Every request
still requires the session/device/access proof, body digest, server nonce and a
single-use permit; replaying the consumed permit is cloaked as `404`.

Chi tiết min/max và domain invariant phải nằm trong schema/service test; không nới field chỉ vì frontend gửi thêm.

## 6. Error code contract

Các code đã dùng trong Fastify slice:

~~~text
TRANSPORT_REQUIRED
TRANSPORT_NEGOTIATION_REQUIRED
TRANSPORT_KEY_INVALID
TRANSPORT_ENVELOPE_INVALID
TRANSPORT_REQUEST_MISMATCH
TRANSPORT_DECRYPT_FAILED
TRANSPORT_KEY_ROTATED
VALIDATION_FAILED
PAYLOAD_TOO_LARGE
ORIGIN_NOT_ALLOWED
AUTH_REQUIRED
SESSION_INVALID
SESSION_REUSE_DETECTED
ACCESS_TOKEN_INVALID
ACCESS_TOKEN_REQUIRED
ACCESS_EXPIRED
AUTH_BINDING_MISMATCH
DEVICE_BOOTSTRAP_REQUIRED
DEVICE_INVALID
DEVICE_KEY_INVALID
AUTH_KEY_BINDING_MISMATCH
DEVICE_PROOF_REQUIRED
DEVICE_SIGNATURE_INVALID
REQUEST_EXPIRED
REQUEST_METADATA_INVALID
BODY_DIGEST_MISMATCH
REPLAY_DETECTED
IDEMPOTENCY_KEY_INVALID
PROTOCOL_UPGRADE_REQUIRED
ACTION_ROUTE_MISMATCH
ACTION_PERMIT_INVALID
ACTION_PERMIT_SCOPE_MISMATCH
ACTION_BODY_COMMITMENT_REQUIRED
CAPABILITY_BODY_MISMATCH
ACTION_NONCE_INVALID
ACTION_ALREADY_CONSUMED
STEP_UP_REQUIRED
WEBAUTHN_ACTION_INVALID
WEBAUTHN_CHALLENGE_EXPIRED
WEBAUTHN_CHALLENGE_REPLAYED
WEBAUTHN_REGISTRATION_INVALID
WEBAUTHN_AUTHENTICATION_INVALID
WEBAUTHN_CREDENTIAL_INVALID
WEBAUTHN_CREDENTIAL_EXISTS
WEBAUTHN_COUNTER_REPLAYED
VERIFICATION_REVIEW_INPUT_INVALID
VERIFICATION_DECISION_REQUIRED
VERIFICATION_ACTION_INVALID
TRUST_APPROVAL_FORBIDDEN
TRUST_APPROVAL_RECOMMENDATION_REQUIRED
UNSUPPORTED_MUTATION
MEDIA_NOT_FOUND
MEDIA_FORMAT_INVALID
MEDIA_MIME_MISMATCH
MEDIA_DIMENSIONS_INVALID
MEDIA_IN_USE
RESOURCE_FILE_REQUIRED
RESOURCE_FILE_INVALID
RESOURCE_FILE_TOO_LARGE
RESOURCE_FORMAT_INVALID
RESOURCE_MIME_MISMATCH
RESOURCE_MAGIC_MISMATCH
RESOURCE_TEXT_INVALID
RESOURCE_STAGED_NOT_FOUND
RESOURCE_FILE_FORBIDDEN
RESOURCE_VERSION_INVALID
RESOURCE_LICENSE_INVALID
RESOURCE_LOGIN_REQUIRED
RESOURCE_SOURCE_HIDDEN
RESOURCE_PREVIEW_TOO_LARGE
RESOURCE_DOWNLOAD_DISABLED
SELLER_REQUIRED
SELLER_NOT_FOUND
SELLER_FOLLOW_SELF
PROFILE_SHOP_NAME_INVALID
PROFILE_IMAGE_INVALID
PROFILE_CONTACT_INVALID
VERIFICATION_BODY_INVALID
VERIFICATION_NOT_ELIGIBLE
VERIFICATION_STATE_INVALID
VERIFICATION_NOT_PENDING
VERIFICATION_KIND_INVALID
RATE_LIMITED
INTERNAL_ERROR
~~~

Client behavior:

| Error | Client action |
| --- | --- |
| ACCESS_EXPIRED | single-flight renew, retry once |
| SESSION_REUSE_DETECTED | clear memory, explicit login/security alert |
| DEVICE_INVALID/DEVICE_KEY_INVALID | re-register device only after explicit session policy |
| TRANSPORT_KEY_ROTATED | renegotiate transport, retry idempotent request once |
| REPLAY_DETECTED | never blindly retry same signed request |
| ACTION_ALREADY_CONSUMED | refresh intent and show result/state |
| UNSUPPORTED_MUTATION | show unavailable action; do not retry against another API |
| 413/PAYLOAD_TOO_LARGE | reduce upload/payload |

## 7. Route parity matrix — Fastify cutover inventory

| Former surface | Routes/behavior | Fastify implementation | Status |
| --- | --- | --- | --- |
| sellers | /api/sellers/me/profile, PUT/DELETE follow | seller profile/follow modules + action permits | DONE offline; browser/live cutover evidence pending |
| trust | /api/sellers/me/trust-status, verification, checks | trust module + action permits | DONE offline; scheduled lifecycle/production evidence pending |
| admin verification | /api/admin/verifications, PATCH decisions/checks | admin/trust module + WebAuthn | DONE offline; browser/passkey hardware E2E pending |
| resources | /api/resources, /post/:slug, /:id, preview/view/download | modules/resources + storage boundary | DONE offline; object-storage/large-file hardening pending |
| admin resources | upload/delete/preview | modules/resources + capability gateway | DONE offline for owner staging |
| file compatibility | POST /api/files/upload, GET /api/files/:fileId | Removed from Fastify runtime; use media/resource/E2EE contracts | RETIRED; no active frontend call-site remains |
| admin core | overview, moderation, search, cases, sellers, bots, users, comments, analytics, audit, reviews, staff | modules/admin + mutation dispatcher | DONE offline; browser/live cutover evidence pending |
| admin posts | stats, categories, tags, reports, create, status, comments, distribution, versions | modules/admin + mutation dispatcher | DONE offline; scheduled publication runs in maintenance, broader lifecycle reconciliation pending |
| moderation | report review/decision and case workflows | admin content/case services + audit | DONE for current route slice; policy expansion may remain |
| WebAuthn | registration options/verify, authentication options/verify | security step-up plugin | DONE offline; browser/passkey hardware E2E pending |
| client errors | POST /api/client-errors | bounded telemetry endpoint | DONE offline; external telemetry sink/retention pending |
| E2EE | devices, key bundle, conversations, messages, attachments | E2EE plugin; ciphertext-only contract | DONE offline; authorized client/server live E2E pending |
| workers | cleanup/expiry/replay/media/resource jobs | maintenance plugin with DB-backed expiring lock and storage reconciliation | DONE offline; Redis scale-out and live storage evidence pending |

Former route names are inventory only, not permission to expose a direct mutation forever. Mỗi row cần quyết định: giữ compatibility path, route mới versioned, hoặc deprecate với migration note.

## 8. Compatibility rules

- Không đổi success/error envelope trong lúc port.
- Không đổi field name/nullable semantics nếu chưa cập nhật frontend và contract fixture.
- Không để hai API writer cùng ghi một side effect mà không có idempotency.
- Không shadow một mutation critical mà không có duplicate-prevention.
- Khi route chuyển hẳn, frontend base URL/config phải chuyển cùng release đã verify.
