# Opaque browser credentials audit

Updated: 2026-08-21

This is the requirement-by-requirement audit for the opaque credential
contract in the two supplied design notes. It is intentionally separate from
the broader Fastify migration checklist: a passing contract test here proves
the local implementation boundary, not a third-party OAuth, browser or edge
deployment.

## Contract matrix

| Requirement | Current implementation | Evidence |
| --- | --- | --- |
| Production session cookie is `__Host-x` | `authCookieName()` selects `__Host-x` in production; `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain` | `src/core/config.ts`, `src/core/cookies.ts`, opaque credential contract |
| Production OAuth state cookie is `__Host-y` | Same host-only attributes; state is cleared on both successful and failed callback | `src/core/config.ts`, `src/modules/control/control.routes.ts`, OAuth contract |
| Local cookie names are `x` and `y` | Development-only names are selected dynamically at request time | `src/core/config.ts` |
| Credential values are opaque | Exactly 48 random bytes, encoded as exactly 64 base64url characters; no prefix, dot, JWT or JSON | `src/core/crypto.ts`, `src/core/auth.ts`, opaque credential contract |
| Raw session/access/state lookup values are not persisted | `AuthSession`, `AuthAccessToken` and `OAuthState` persist `tokenHash`; raw values exist only where the protocol needs to return/send them | `api/prisma/schema.prisma`, `src/core/auth.ts` |
| Session state is server-owned | User, device, family, generation, idle/absolute expiry, rotation and reuse state are database fields | `src/core/auth.ts`, Prisma schema |
| Access token is short-lived and memory-only in the browser | Opaque DPoP grant is issued with a 60–300 second TTL; browser keeps it in module memory and does not write it to local/session storage or IndexedDB | `src/core/config.ts`, `web/src/lib/security-client.ts` |
| Authorization is sender-constrained | Only `Authorization: DPoP <opaque-token>` is accepted; DPoP ES256 proof includes `ath`, device key and request binding | `src/core/crypto.ts`, `src/core/security.ts`, DPoP contract |
| OAuth uses PKCE/OIDC nonce | State, verifier and nonce are server-side; callback exchanges code server-side and verifies audience, email verification and nonce | `src/core/auth.ts`, OAuth contract |
| OAuth state is one-time | Conditional consume marks state before returning context; reuse/expiry is rejected | `src/core/auth.ts`, opaque credential contract |
| Session rotation and replay detection exist | Family generation rotates with short grace; old credential after grace/reuse revokes family and attached access grants | `src/core/auth.ts`, core contract |
| Silent renewal is automatic but bounded | Browser schedules renewal before expiry, uses a single-flight promise/Web Locks coordinator, retries one expired request once, and stops on security-family failure | `web/src/lib/security-client.ts`, `web/src/lib/fetch-with-timeout.ts` |
| Proxy preserves cookie rotation | Custom Next proxy forwards every `Set-Cookie` value without rewriting host/path/security attributes | `web/server.mjs`, fresh web smoke |
| THB/4 remains separate from auth metadata | Cookie/Authorization/DPoP stay HTTP metadata; business body uses binary THB/4 with CBOR, directional/per-request keys, GCM AAD and sequence/request binding | `src/core/transport.ts`, `src/core/thb4.ts`, `web/src/lib/thb4.ts` |

## Intentional protocol metadata

`tb_session` in the DPoP payload and `x-tb-session` in request metadata are
not credentials and do not contain user ID, email, role, expiry or a token
payload. They are server-issued session binding identifiers signed into each
proof so a valid device proof cannot be attached to a different session. The
raw cookie remains the only session credential presented by the browser, and
the server still resolves it by hash.

The session-cookie lifecycle routes are deliberate exceptions to the access-grant requirement: OAuth callback, onboarding, becoming a seller and device bootstrap establish the device-bound flow, while logout ends the session. The logout handler only needs the session cookie, but the request still traverses the negotiated THB/4 transport gate; it is not a clear-text fallback. The bootstrap/onboarding/become-seller recovery lane is clear-text only because it must recover a stale browser transport, and it remains same-origin/schema-validated with no access-token, permit or business-mutation authority. Protected domain reads/mutations use the full session + DPoP access + device proof boundary; no Bearer or legacy signature fallback exists.

## Negative requirements

The current runtime has no authentication fallback for `donix_token`,
`g_state`, JWT browser sessions, semantic access-token prefixes or plain
`Bearer` access. `document.cookie`/browser storage references that remain in
the web app are UI preferences or drafts, not authentication credentials.

## Verification record

The following current-checkout gates pass after this audit change:

```text
npm.cmd run typecheck:fastify
npm.cmd run test:fastify        # 39/39
git diff --check
```

The broader release command remains:

```text
npm.cmd run verify
```

Still-required live evidence is tracked in
`current-state-2026-08-19.md`: authorized Google OAuth browser E2E,
browser WebAuthn/passkey E2E, Cloudflare assurance at the edge, distributed
Redis atomicity and a fresh cutover/rollback drill. Existing long-running
ports must not be described as serving this newest source until an authorized
fresh restart proves it.
