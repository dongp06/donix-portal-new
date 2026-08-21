# Thuebot E2EE: Signal/libsignal PQXDH + Double Ratchet

Thuebot uses a small browser WASM bridge around the pinned official Signal
`libsignal-protocol` crate. The bridge does not implement a cipher, PQXDH, or
Double Ratchet itself; those operations are delegated to libsignal.

Pinned source:

```text
https://github.com/signalapp/libsignal
rev b056faa6dd02961cff24064c54c089c52e1a0753
```

The pinned revision is the `0.101.0` line and provides the PQXDH/Kyber pre-key
path, Double Ratchet state, skipped-message-key handling, and serialized Signal
session records. The upstream project is AGPL-3.0-only; review the license
before distributing a production build.

## What is and is not E2EE

The API is a ciphertext relay for private conversations. It may authenticate
users, authorize devices, deliver bundles, claim one-time pre-keys, and store
delivery metadata, but it must never receive:

- an identity private key, pre-key private key, Kyber private key, or ratchet
  snapshot;
- message plaintext or a `message_text`/`plaintext` field;
- an unencrypted attachment.

The server stores public Signal material, Signal ciphertext, encrypted file
metadata, and delivery timestamps. A compromised browser deployment can still
replace the JavaScript/WASM and steal local keys; high-assurance clients need a
signed native app or a separately pinned application shell.

## Client lifecycle

`web/src/lib/e2ee-client.ts` owns the browser integration:

1. `ThuebotSignalClient.open(userName)` creates or restores one Signal device
   for the current security device.
2. The WASM bridge creates an identity key, signed pre-key, Kyber pre-key, and
   one-time pre-key pool.
3. Only `bundle_json()` and `prekey_pool_json()` are published to the API.
4. The serialized libsignal snapshot is encrypted with a non-extractable
   browser AES-GCM wrapping key and kept in IndexedDB.
5. `processRemoteBundle()` establishes the asynchronous PQXDH session;
   `encrypt()`/`decrypt()` advance the Double Ratchet and persist the new state
   after every operation.

The snapshot is never included in an API request. Losing the browser storage
loses that device's local Signal state unless the user previously exported an
encrypted recovery blob and kept its recovery key.

The browser client also exposes the complete ciphertext transport helpers:

- `listSignalConversations()` and `fetchSignalMessages()` return metadata and
  Signal envelopes only;
- `encryptSignalAttachment()` encrypts the file locally with a random
  AES-256-GCM key and wraps that key in a Signal message for the recipient;
- `uploadSignalAttachment()` and `downloadSignalAttachment()` move only the
  opaque `.bin` ciphertext; `decryptSignalAttachment()` verifies the digest and
  decrypts locally;
- `generateSignalRecoveryKey()` plus
  `ThuebotSignalClient.exportRecoveryBackup()` create a PBKDF2/AES-GCM
  recovery blob. `restoreFromRecoveryBackup()` accepts it only on the same
  Thuebot security device, preventing accidental cloning of a Signal identity
  onto a second device. The recovery key is never sent to the API.

The recovery blob is a local/exportable artifact, not a server-readable
backup. A product UI still needs to present the key once, require the user to
store it offline, and provide an explicit restore flow.

## Public API contract

All endpoints require an authenticated opaque session. State-changing browser
requests also pass through the existing Thuebot device-signature,
anti-replay, idempotency, and server-issued permit layer.

### Publish a device bundle

```http
POST /api/e2ee/devices
```

The body is public material only:

```json
{
  "deviceId": "security-device-id",
  "bundle": {
    "registration_id": 1234,
    "device_id": 7,
    "pre_key_id": 1,
    "pre_key_public": "...",
    "signed_pre_key_id": 1,
    "signed_pre_key_public": "...",
    "signed_pre_key_signature": "...",
    "identity_key": "...",
    "kyber_pre_key_id": 1,
    "kyber_pre_key_public": "...",
    "kyber_pre_key_signature": "..."
  },
  "preKeys": [{ "id": 1, "public_key": "..." }]
}
```

Signal wire validation is strict: device numbers are `1..127`, registration
IDs are `1..16383`, public X25519/Ed25519 material is unpadded base64 of length
44, signatures are length 86, and the Kyber-1024 public key is length 2092.
Unknown bundle fields are rejected. The API stores the bundle and pre-key
pool, never the corresponding private records.

### Fetch a recipient bundle

```http
GET /api/e2ee/users/:userId/key-bundle
```

The response contains every active device and at most one available one-time
pre-key per device. The selected one-time pre-key is atomically claimed so two
senders cannot receive the same pre-key record. If the pool is empty, the
bundle's `pre_key_id` and `pre_key_public` are `null`; libsignal can still use
the signed pre-key path.

### Create a multi-device conversation

```http
POST /api/e2ee/conversations
```

```json
{
  "recipientUserId": "seller-user-id",
  "recipientDeviceIds": ["optional-specific-device-id"]
}
```

The conversation contains the sender's active Signal devices and the selected
recipient devices. It contains no message content.

### Store and fetch Signal messages

```http
POST /api/e2ee/conversations/:conversationId/messages
GET  /api/e2ee/conversations/:conversationId/messages?limit=50
```

The write body contains only a Signal message envelope:

```json
{
  "protocolVersion": "signal-pqxdh-v1",
  "recipientDeviceId": "security-device-id",
  "clientMessageId": "client-generated-idempotency-key",
  "message": {
    "message_type": 3,
    "ciphertext": "unpadded-base64-signal-bytes"
  }
}
```

`message_type` is restricted to Signal `2` (Whisper/Double Ratchet) and `3`
(PreKey/PQXDH). The ciphertext is validated as unpadded base64 and is stored
as opaque bytes; the API does not parse or decrypt it. `clientMessageId` is
unique within a conversation, so retrying a successful send cannot create a
second message.

### Encrypted attachments

```http
POST /api/e2ee/conversations/:conversationId/attachments
GET  /api/e2ee/attachments/:attachmentId
```

The browser encrypts the file before upload and sends the ciphertext SHA-256,
encrypted file key, and nonce as metadata. The storage service validates only
size and digest, writes an opaque `.bin` object outside the public web root,
and returns ciphertext on download. It never inspects image/file contents.

## Local WASM build

The official npm package is a Node native addon and must not be imported into
Next.js browser code. Build the browser package from the official Rust crate:

```powershell
winget install Google.Protobuf
cargo install wasm-pack
$env:PROTOC = (Get-Command protoc).Source
npm run e2ee:wasm:build -- --Release
```

The generated package is written to `web/src/lib/signal-wasm/` and is tracked
as the browser release artifact. Rust build cache under `e2ee/wasm/target/` is
ignored. Do not hand-edit generated JS/WASM files.

## Verification

The repository checks the API contract with
`apps/api-fastify/test/e2ee-files.contract.test.ts`.
and exercises the WASM bridge with a Node smoke test covering initial PQXDH,
out-of-order/skipped keys, reply, snapshot restore, and pre-key pool export.
These checks prove the local protocol and persistence boundary; they do not
prove a live browser chat UI or production CDN/service deployment until a fresh
authorized runtime is launched and a real conversation is exercised.
