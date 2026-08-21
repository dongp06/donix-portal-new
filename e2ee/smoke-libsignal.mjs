import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as signal from '../web/src/lib/signal-wasm/thuebot_libsignal_wasm.js';

const wasmPath = new URL(
  '../web/src/lib/signal-wasm/thuebot_libsignal_wasm_bg.wasm',
  import.meta.url,
);
signal.initSync({ module: fs.readFileSync(wasmPath) });

const alice = new signal.SignalDevice('alice', 1, 8);
const bob = new signal.SignalDevice('bob', 1, 8);
const aliceBundle = JSON.parse(alice.bundle_json());
const bobBundle = JSON.parse(bob.bundle_json());

assert.equal(aliceBundle.identity_key.length, 44);
assert.equal(aliceBundle.signed_pre_key_public.length, 44);
assert.equal(aliceBundle.signed_pre_key_signature.length, 86);
assert.equal(aliceBundle.kyber_pre_key_public.length, 2092);
assert.equal(aliceBundle.kyber_pre_key_signature.length, 86);
assert.equal(JSON.parse(alice.prekey_pool_json()).length, 8);

await alice.process_bundle_json('bob', 1, JSON.stringify(bobBundle));
await bob.process_bundle_json('alice', 1, JSON.stringify(aliceBundle));

const initial = JSON.parse(
  await alice.encrypt_json('bob', 1, new TextEncoder().encode('PQXDH initial')),
);
assert.equal(initial.message_type, 3);
assert.equal(
  new TextDecoder().decode(
    await bob.decrypt_json('alice', 1, JSON.stringify(initial)),
  ),
  'PQXDH initial',
);

const second = JSON.parse(
  await alice.encrypt_json('bob', 1, new TextEncoder().encode('ratchet second')),
);
const third = JSON.parse(
  await alice.encrypt_json('bob', 1, new TextEncoder().encode('ratchet third')),
);

// Deliver the newer message first. libsignal must retain and then consume the
// skipped message key when the older message arrives.
assert.equal(
  new TextDecoder().decode(
    await bob.decrypt_json('alice', 1, JSON.stringify(third)),
  ),
  'ratchet third',
);
assert.equal(
  new TextDecoder().decode(
    await bob.decrypt_json('alice', 1, JSON.stringify(second)),
  ),
  'ratchet second',
);

const restoredBob = signal.SignalDevice.from_snapshot(bob.snapshot_json());
const reply = JSON.parse(
  await restoredBob.encrypt_json(
    'alice',
    1,
    new TextEncoder().encode('reply after restore'),
  ),
);
assert.equal(reply.message_type, 2);
assert.equal(
  new TextDecoder().decode(
    await alice.decrypt_json('bob', 1, JSON.stringify(reply)),
  ),
  'reply after restore',
);

const safety = JSON.parse(alice.safety_number_json('bob', 1));
assert.match(safety.display, /\d/);
assert.ok(safety.scannable.length > 0);

console.log(
  JSON.stringify({
    protocol: 'signal-pqxdh-v1',
    initialMessageType: initial.message_type,
    ratchetMessageTypes: [second.message_type, third.message_type, reply.message_type],
    prekeyCount: JSON.parse(alice.prekey_pool_json()).length,
    snapshotRestore: true,
    skippedMessageKey: true,
    safetyNumber: true,
  }),
);

alice.free();
bob.free();
restoredBob.free();
