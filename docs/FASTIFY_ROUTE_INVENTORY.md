# Fastify route inventory

Route coverage is checked against the active frontend source and the runtime Fastify route table.

```powershell
npm.cmd run inventory:fastify -- --check
```

The checker:

- scans `web/src` for active `/api/...` call sites;
- infers the HTTP method from the call site (including the server-driven admin action helper);
- boots `buildApp()` and reads the registered Fastify route table;
- resolves protected mutations through `actionForPath()` and the opaque `/api/m/:cap` gateway;
- fails with a non-zero exit code when an active call site is neither a direct route nor a registered capability action.

Baseline verified on 2026-08-20:

| Surface | Count/result |
|---|---:|
| Active frontend references | 82 |
| Runtime Fastify route declarations | 88 |
| Capability actions observed | 29 |
| Missing active references | 0 |

## Routing policy

Reads and public/auth bootstrap endpoints are direct Fastify routes. Protected writes are intentionally not exposed as public domain mutation routes; the browser requests a server-issued permit/handle and executes through:

```text
POST /api/i
        ↓
opaque permit / server handle
        ↓
/api/m/:cap
        ↓
device proof + body commitment + nonce + authorization
        ↓
MutationService.dispatch()
```

The inventory therefore treats a mutation as covered when `actionForPath(method, path)` resolves to an action that is dispatched by `MutationService`.

## Retired legacy routes

The following routes are intentionally not reintroduced. The active web client has no call site for them and the Fastify not-found boundary keeps them unavailable:

- `/api/files/upload`
- `/api/files/:fileId`
- `/api/community/posts`
- `/api/posts/pinned`
- `/api/posts/rendered/:slug`
- `/api/posts/:slug/related`
- `/api/categories`

Their replacements are the unified media/resource routes and the unified post read surface. Post detail includes related content in its response; it is not a second endpoint.

## Adding a route

When adding a frontend API call:

1. Add or port the Fastify route, or add an explicit `SecurityAction` and `MutationService.dispatch()` branch for a protected mutation.
2. Keep path parameters bounded by a Fastify JSON Schema.
3. Run `npm.cmd run inventory:fastify -- --check`.
4. Add a focused contract test for authorization, response shape and the relevant replay/permit behavior.

The inventory is a coverage gate, not proof of an authenticated browser OAuth, WebAuthn or production upstream deployment. Those still require a separately authorized live smoke.
