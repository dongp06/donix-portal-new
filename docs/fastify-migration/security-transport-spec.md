# Security and transport specification

## 1. Security position

Security là defense-in-depth, không phải một lớp obfuscation duy nhất. Browser phải được giả định là có thể quan sát JavaScript, DOM, request và plaintext cần để render/execute. Điều cần bảo vệ là authority và domain decision ở server:

- session/access/device binding;
- permission và ownership;
- trust/fraud/pricing/RBAC;
- action issuance và replay state;
- private storage và audit;
- WebAuthn step-up cho action critical.

Transport encryption bảo vệ nội dung trên wire khỏi người không có client key tương ứng; nó không tạo vùng thực thi bí mật trong browser. Obfuscation chỉ tăng chi phí reverse engineering.

## 2. Version và boundary

| Layer | Version | Hiện trạng |
| --- | ---: | --- |
| Application security protocol | 3 | Fastify SecurityService kiểm tra x-tb-protocol |
| Encrypted HTTP transport | 4 | ECDH-P256 + HKDF-SHA256 + AES-256-GCM |
| Action policy | tsp-3 | Lưu trong ActionPermit.policyVersion |
| Access scheme | DPoP opaque token | Đang dùng; token bị bind bằng public JWK trong proof |
| DPoP | RFC 9449-style ES256 proof | `typ=dpop+jwt`, `ath`, `htm`, `htu`, `iat`, `jti` và binding claims được verify ở Fastify |

Production luôn cần TLS/HSTS ở edge dù transport v4 được bật.

## 3. Transport v4

### 3.1 Negotiation

Client gọi clear-text endpoint duy nhất:

~~~text
GET /api/transport/config
~~~

Response data gồm:

~~~json
{
  "protocolVersion": 4,
  "algorithm": 1,
  "kid": "thb-transport-...",
  "publicKeyJwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "...",
    "y": "..."
  }
}
~~~

Request đã negotiate gửi:

| Header | Ý nghĩa |
| --- | --- |
| x-tb-transport | Client implementation có thể gửi version/mode theo client contract |
| x-tb-transport-key | Base64url của client public JWK |
| x-tb-transport-kid | Phải khớp server kid |
| x-tb-transport-request | Request id dùng trong AAD |
| x-tb-transport-mode | `encrypted` khi request body là THB/4 frame; `response-only` khi không có body |
| x-tb-transport-sequence | Monotonic uint64 transport sequence |
| Content-Type | `application/x-thb` cho request frame |

Khi enforceTransport=true, mutation/private security paths cần transport context; thiếu sẽ trả 426 với x-tb-transport-required: v4. Một allowlist GET/HEAD hẹp gồm health/bootstrap/auth-me, public catalog/read routes, media và resource streams được phép clear-text để native browser consumers (img/download/anonymous probes) không bị gãy. Có thêm một recovery lane POST rất hẹp cho device bootstrap, onboarding, become-seller và client-error reporting: các route này vẫn kiểm tra Origin, session cookie/route policy và schema, nhưng không cấp access token, permit hay quyền mutation domain. Access-token issuance/renewal, logout, admin, E2EE, permit, upload và mọi business mutation vẫn yêu cầu transport v4; không được mở rộng fallback bằng cách thêm route tùy tiện.

### 3.2 KDF và THB/4 binary frame

Client/server tạo ECDH shared secret bằng P-256. Symmetric key:

~~~text
HKDF-SHA256(
  ikm = ECDH shared secret,
  salt = "thuebot-transport-v1",
  root info = "thuebot-transport-root:" + wireKidHex,
  length = 32
)
directionalKey = HKDF-SHA256(rootKey, "thuebot-transport-direction-v1", "thuebot-transport-direction:" + direction + ":" + wireKidHex)
requestKey = HKDF-SHA256(directionalKey, "thuebot-transport-request-v1", "thuebot-transport-request:" + requestId + ":" + sequence)
~~~

Mỗi message dùng nonce 12 bytes mới. AES-256-GCM authentication data là toàn bộ 64-byte header. Header layout cố định:

~~~text
0..3   magic = THB4
4      version = 4
5      kind = 0 request / 1 response
6      algorithm = 1
7      flags
8..15  wireKid (8 raw bytes)
16..31 requestId (UUID, 16 raw bytes)
32..43 nonce (12 raw bytes)
44..51 sequence (uint64 big-endian)
52..55 ciphertext length (uint32 big-endian)
56..63 reserved (zero)
64..EOF ciphertext + 16-byte GCM tag
~~~

CBOR payload được mã hóa trước khi đóng frame. JSON response của Fastify được decode thành CBOR map; binary response giữ raw bytes. `kid` debug đầy đủ chỉ tồn tại trong negotiation JSON; wire chỉ chứa `wireKid` 8 byte. Map key `__proto__`, `constructor` và `prototype` bị reject khi encode/decode ở Fastify, browser client và Next SSR để không mở prototype-pollution boundary qua payload.

Flags hiện tại:

| Bit | Ý nghĩa |
| ---: | --- |
| 0 | CBOR payload |
| 1 | compressed (reserved for a later negotiated implementation) |
| 2 | error response |
| 3 | critical |
| 4 | signed response |

Request/response dùng directional key khác nhau (`c2s` và `s2c`) và derive per-request key từ `requestId + sequence`. Header được đưa vào GCM AAD nên sửa kind, key id, request id, nonce, sequence hoặc ciphertext length đều làm xác thực thất bại.

Response bytes dùng payload=bytes và chỉ forward các header allowlist: content-disposition, cache-control, x-content-type-options và x-tb-ciphertext-sha256.

Không log plaintext, envelope ciphertext đầy đủ hoặc private JWK. THB_TRANSPORT_PRIVATE_JWK phải là secret của environment; nếu bỏ trống, process tạo ephemeral server key và client phải negotiate lại sau restart.

## 4. Session và access grant

### 4.1 Session cookie

Production cookie:

~~~text
__Host-x=<opaque random token>
Secure; HttpOnly; SameSite=Lax; Path=/
~~~

Local HTTP mặc định dùng `x`. Database chỉ lưu SHA-256 token hash. Cookie raw không được log hoặc persist vào frontend storage.

Credential contract bắt buộc, áp dụng giống nhau cho session cookie, OAuth state
cookie và access grant: server tạo đúng 48 random bytes rồi encode base64url,
tức đúng 64 ký tự trong allowlist `[A-Za-z0-9_-]`. Parser phải reject mọi giá
trị khác độ dài, có dấu chấm, semantic prefix (`tb_`, `sess_`, `at_`, `state_`),
JWT hoặc JSON trước khi thực hiện database lookup. Đây là một shape guard bổ
sung; tính opaque vẫn đến từ entropy và việc database chỉ lưu hash.

Runtime chỉ đọc đúng tên cookie theo môi trường: production chỉ chấp nhận
`__Host-x`, còn local dùng `x`; không có fallback sang cookie legacy.

Default policy:

| Setting | Default | Constraint |
| --- | ---: | --- |
| access token TTL | 180 seconds | 60–300 seconds |
| idle session TTL | 7 days | không vượt absolute |
| absolute session TTL | 30 days | silent renew không kéo dài |
| rotation grace | 8 seconds | tối đa 60 seconds |
| request clock skew | 90 seconds | ngoài window bị reject |
| nonce retention | 2 minutes | duplicate nonce/replay bị reject |
| renewal challenge | 30 seconds | one-time |

Session record thuộc một family và generation:

~~~text
family SF
  generation 10: sid-A -> rotated/revoked
  generation 11: sid-B -> current
~~~

Renewal tạo token mới, revoke access tokens của session cũ và giữ replacedBy/rotatedFrom/graceUntil. Cookie cũ chỉ được resolve trong grace path của renewal. Dùng lại sau grace hoặc reuseDetected sẽ revoke cả family và access tokens liên quan.

### 4.2 Access token

Access grant là opaque random 48-byte token không có semantic prefix. Client chỉ giữ trong memory. Database lưu tokenHash và binding:

~~~text
userId
sessionId
deviceId
keyThumbprint
audience = thuebot-api
scopes
issuedAt
expiresAt
revokedAt
~~~

Header hiện tại:

~~~text
Authorization: DPoP <opaque-access-token>
DPoP: <compact-serialized-ES256-proof>
~~~

DPoP proof phải chứa public JWK không có private `d`, `ath` đúng bằng base64url(SHA-256(access token)), method/URL đúng request, `iat` trong clock window, `jti` chưa dùng và các claim `tb_*` bind session/device/request/body/permit. SecurityService luôn yêu cầu session cookie, DPoP access token, proof và binding match; không nhận Bearer hoặc proof chữ ký legacy.

`tb_session` và `x-tb-session` là binding metadata để proof không thể bị ghép
giữa hai session; chúng không phải cookie value, access credential hay payload
chứa user/role/email. Raw session credential vẫn chỉ đi trong HttpOnly cookie,
database chỉ dùng `tokenHash`, còn generation/family/expiry vẫn server-side.

## 5. Device identity và proof

### 5.1 Registration

Browser tạo ECDSA P-256 key pair. Private key nên là non-exportable WebCrypto key khi runtime hỗ trợ; server chỉ nhận public JWK:

~~~http
POST /api/bootstrap
Content-Type: application/json
~~~

~~~json
{
  "publicKeyJwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "...",
    "y": "..."
  },
  "deviceName": "Chrome Windows",
  "platform": "web"
}
~~~

Device fingerprint là hash của canonical public JWK. Một fingerprint không được bind sang user khác. Revoke device phải revoke các session/access grant liên quan.

### 5.2 Request headers

Protected request dùng các header sau:

| Header | Bắt buộc | Nội dung |
| --- | --- | --- |
| x-tb-protocol | Có | application protocol, hiện là 3 |
| x-tb-session | Có | current session id |
| x-tb-device | Có | registered device id |
| x-tb-time | Có | Unix milliseconds |
| x-tb-nonce | Có | request nonce, 16–160 chars |
| x-tb-request | Có | request id, 8–160 chars |
| x-tb-body-sha256 | Có | SHA-256 của canonical request body |
| x-tb-idempotency | Có | client idempotency key, 8–160 chars |
| DPoP | Có | compact JWT, ES256, public JWK trùng device fingerprint |
| Authorization | Có với protected access | `DPoP <opaque access grant>` |
| x-tb-permit | Có với mutation permit | opaque action permit |
| x-tb-server-nonce | Có với permit/renew | server challenge/permit nonce |
| x-tb-sequence | Tùy chọn | monotonic device sequence; chỉ nhận số an toàn dương |

DPoP payload dùng các claim chuẩn và binding riêng:

~~~text
typ=dpop+jwt; alg=ES256
htm=HTTP method; htu=absolute request URL
iat; jti; ath=base64url(SHA256(ACCESS_TOKEN))
tb_device; tb_session; tb_request; tb_time; tb_nonce
tb_sequence; tb_body_sha256; tb_idempotency
tb_permit=SHA256(PERMIT); tb_server_nonce
~~~

bodyDigest là SHA-256 của canonical JSON: object key được sort, array giữ thứ tự, undefined bị bỏ. Multipart được normalize thành sorted parts trước khi verify.

### 5.3 Verify order

Fastify security pipeline:

~~~text
resolve session
  -> protocol version
  -> resolve access token
  -> user/session/device/audience binding
  -> required headers and clock skew
  -> device lookup and revocation
  -> body digest
   -> DPoP ES256 signature and access-token ath
  -> nonce/request replay insert
  -> optional sequence update
   -> action mapping, risk score, permit consume
~~~

Một failure không được fallback sang cookie-only, Bearer hoặc legacy signature authorization. Error code phải giữ nguyên để client biết cần renew, re-register device, retry idempotent hay login lại.

### 5.4 Google authorization-code flow

Browser bắt đầu ở `GET /api/auth/google/start?returnTo=/profile`. Fastify tạo state, PKCE S256 verifier và OIDC nonce; chỉ state hash, verifier, nonce, return path và expiry được lưu trong `OAuthState`. Cookie state (`__Host-y` production, `y` local) là HttpOnly và được so sánh constant-time với callback state.

Callback chỉ nhận `code` + `state`, consume state một lần bằng conditional update, exchange code server-side với `GOOGLE_CLIENT_SECRET`, verify ID token audience/email/nonce rồi tạo session cookie. Không nhận Google ID/access token từ browser và không lưu Google token. OAuth state cookie cũng dùng đúng opaque 48-byte contract, được hash để lookup và clear ngay cả khi callback thất bại.

## 6. Silent renewal

Flow chuẩn:

~~~text
POST /api/auth/renew/challenge
  -> session + device proof, không cần access token
  -> one-time challenge, TTL 30s

POST /api/auth/renew
  -> cùng session/device proof + x-tb-server-nonce
  -> consume challenge
  -> rotate session nếu current
  -> issue access grant mới
  -> Set-Cookie token mới nếu có rotation
~~~

Client giữ access token trong RAM và dùng single-flight coordinator để tránh nhiều tab cùng renew. Khi nhận ACCESS_EXPIRED, chỉ retry original request một lần sau renew. Không loop vô hạn.

Nếu server trả SESSION_REUSE_DETECTED, SESSION_INVALID, DEVICE_INVALID hoặc security family đã revoke:

~~~text
clear in-memory token
clear cookies via server response
stop silent retry
force explicit login/re-auth
~~~

## 7. Action permit/capability

Client không được tự tạo authority bằng action/target payload. Client xin permit qua:

~~~text
POST /api/i
{
  "action": "...",
  "method": "POST|PUT|PATCH|DELETE",
  "path": "/api/...",
  "targetId": "...",
  "bodyHash": "64 hex chars"
}
~~~

Server tự resolve action từ method/path, reject mismatch và lưu hash của opaque token. Response có intentId, endpoint /api/m/<permit>, serverNonce, expiry, requiresStepUp.

Permit phải bind:

- userId;
- deviceId;
- action;
- internal method/path;
- bodyHash nếu policy yêu cầu;
- serverNonce;
- policyVersion;
- expiry và maxUses.

Current TTL:

| Policy | TTL |
| --- | ---: |
| critical device.revoke/staff.manage | 10 seconds |
| create/delete/review/trust.review | 15 seconds |
| các action khác | 30 seconds |

Gateway resolve opaque capability trước, verify HTTP method, sau đó verify request và consume permit bằng conditional update. Reuse/expired/invalid capability trả 404 để không lộ topology; deception.probe được ghi telemetry.

Permit opacity không thay thế authorization. MutationService vẫn phải kiểm owner/role/domain invariant.

## 8. Authorization và step-up

Authentication tạo principal trusted; authorization mới resolve:

- buyer/seller role;
- staffRole owner/admin/moderator;
- object ownership;
- action policy và quota;
- trust/verification state;
- risk state.

Owner phải derive server-side từ OWNER_EMAIL hoặc staff record; không trust role/email từ body hay access token tự khai báo.

Fastify current action policy đánh dấu device.revoke và staff.manage là critical. Contract tests đã xác nhận gateway enforce step-up cho cả hai và revoke device invalidates its sessions/access grants; browser/passkey hardware evidence vẫn còn trước production cutover:

~~~text
valid session/device/access proof
  + WebAuthn assertion for exact action/target/body
  + short critical grant
  + audit event
~~~

Không dùng silent renewal để authorize promote staff, approve trust, ban vĩnh viễn hoặc đổi security configuration.

## 9. CSRF, origin và abuse control

Fastify reject mutation nếu Origin tồn tại nhưng không nằm trong CORS_ORIGINS; production (hoặc `TB_REQUIRE_MUTATION_ORIGIN=true`) cũng reject mutation bị thiếu Origin. Dev/native compatibility có thể tắt cờ này, nhưng vẫn phải qua device proof ở protected routes. Các nguyên tắc còn lại:

- allowlist exact scheme/host, không dùng wildcard credentials;
- kiểm tra Origin/Host theo route class;
- SameSite cookie policy;
- không có GET side effect;
- rate-limit global và action/user/device/target budget;
- idempotency cho mutation có side effect;
- không log DPoP/cookie/access token/body plaintext hoặc private JWK.

Rate-limit plugin là L1. Risk score hiện dùng security events gần đây để cộng điểm cho signature failure, replay, rate limit, deception probe và session reuse; cần thay/tiếp tục mở rộng bằng risk engine thật trước khi dùng để silently challenge production user.

## 10. Security event tối thiểu

Event types hiện hoặc phải giữ:

~~~text
protocol.downgrade
device.dpop_failed
request.replay
session.reuse_detected
deception.probe
device.revoked
rate_limited
webauthn.step_up_failed
webauthn.step_up_succeeded
action.permit_issued
action.permit_consumed
action.permit_rejected
~~~

Metadata phải được truncate/sanitize. Không lưu raw token, private key, WebAuthn clientDataJSON đầy đủ hoặc E2EE plaintext trong telemetry.

## 11. Known browser limits

HttpOnly ngăn JavaScript đọc raw cookie nhưng không ngăn same-origin XSS gửi request trong quyền của user. Non-exportable key làm việc lấy private key khó hơn, không bảo vệ được browser đã bị instrument. DPoP/device proof làm token bị copy khó replay từ thiết bị khác, không biến UI runtime thành trusted computing base.
