import {
  decodeCbor,
  decodeFrame,
  encodeCbor,
  encodeFrame,
  encodeHeader,
  THB4_CONTENT_TYPE,
  wireKidFromBase64Url,
} from "./thb4";

export type DeviceState = {
  deviceId: string;
  sessionId: string;
  publicKeyJwk?: JsonWebKey;
  privateKey?: CryptoKey;
  sequence: number;
  /** Server-issued honey capability; no legitimate client flow ever sends it. */
  canary?: string;
  /** Per-browser transport key. It is separate from the signing identity. */
  transportPublicKeyJwk?: JsonWebKey;
  transportPrivateKey?: CryptoKey;
  transportServerPublicKeyJwk?: JsonWebKey;
  transportKid?: string;
  transportSequence?: number;
  sessionGeneration?: number;
};

type BootstrapResponse = {
  success?: boolean;
  data?: {
    deviceId: string;
    sessionId: string;
    protocolVersion: number;
    lastSequence?: number;
    sessionGeneration?: number;
    canary?: string;
  };
  error?: string;
  code?: string;
};

type SessionProbeResponse = {
  success?: boolean;
  data?: {
    authenticated?: boolean;
  };
};

const DB_NAME = "thuebot-security-v1";
const STORE_NAME = "device";
const STATE_KEY = "current";
// TSP signing protocol remains v3; transport envelopes are negotiated as v4.
const PROTOCOL_VERSION = "3";
const TRANSPORT_VERSION = 4;
const TRANSPORT_ALGORITHM = 1;
const TRANSPORT_CONFIG_PATH = "/api/transport/config";
const TRANSPORT_KEY_HEADER = "X-TB-Transport-Key";
const TRANSPORT_KID_HEADER = "X-TB-Transport-Kid";
const TRANSPORT_REQUEST_HEADER = "X-TB-Transport-Request";
const TRANSPORT_SEQUENCE_HEADER = "X-TB-Transport-Sequence";
const TRANSPORT_MODE_HEADER = "X-TB-Transport-Mode";
const TRANSPORT_SALT = new TextEncoder().encode("thuebot-transport-v1");
const TRANSPORT_DIRECTION_SALT = new TextEncoder().encode("thuebot-transport-direction-v1");
const TRANSPORT_REQUEST_SALT = new TextEncoder().encode("thuebot-transport-request-v1");
const TRANSPORT_ROOT_INFO = "thuebot-transport-root:";
const THB4_TAG_BYTES = 16;
const THB4_FLAG_CBOR = 1;
const MAX_SEQUENCE = 2_000_000_000;
const TRANSPORT_CONFIG_TIMEOUT_MS = 5_000;
const BOOTSTRAP_PROBE_TIMEOUT_MS = 8_000;
const TRANSPORT_REQUEST_TIMEOUT_MS = 15_000;
const ACCESS_GRANT_PATH = "/api/auth/access";
const ACCESS_RENEW_PATH = "/api/auth/renew";
const ACCESS_RENEW_CHALLENGE_PATH = "/api/auth/renew/challenge";
const ACCESS_RENEWAL_WINDOW_MS = 45_000;
const AUTH_CHANNEL_NAME = "thuebot-auth-v1";
// A transport sequence is persisted as a high-water mark in small blocks.
// This keeps reloads/restarts safe while avoiding an IndexedDB write for every
// API request.
const TRANSPORT_SEQUENCE_BLOCK_SIZE = 32;
const MAX_TRANSPORT_SEQUENCE = Number.MAX_SAFE_INTEGER - 1;
const PROOF_SEQUENCE_BLOCK_SIZE = 32;
let statePromise: Promise<DeviceState | null> | null = null;
let transportConfigPromise: Promise<TransportConfig | null> | null = null;
let transportStatePromise: Promise<DeviceState | null> | null = null;
let transportResetPromise: Promise<void> | null = null;
let accessGrantPromise: Promise<AccessGrant | null> | null = null;
let accessGrant: AccessGrant | null = null;
const handleStepUpCache = new Map<string, number>();

let dbPromise: Promise<IDBDatabase> | null = null;
let stateWriteChain: Promise<void> = Promise.resolve();
let transportSequenceOwner: DeviceState | null = null;
let transportSequenceNext = 0;
let transportSequenceLimit = -1;
let transportSequenceReservation: Promise<void> | null = null;
let proofSequenceOwner: DeviceState | null = null;
let proofSequenceNext = 0;
let proofSequenceLimit = -1;
let proofSequenceReservation: Promise<void> | null = null;

type DirectionalTransportKeys = {
  fingerprint: string;
  c2s: CryptoKey;
  s2c: CryptoKey;
};

// ECDH and the session-level HKDF stages are invariant across requests. Keep
// only the derived directional HKDF keys in memory; the per-request HKDF and
// AES-GCM key are still derived for every frame.
let directionalTransportKeys: DirectionalTransportKeys | null = null;

type AccessGrant = {
  token: string;
  expiresAt: string;
  expiresInMs: number;
  deviceId: string;
  sessionId: string;
  sessionGeneration: number;
};

export type OpaqueActionHandle = {
  endpoint: string;
  serverNonce: string;
  expiresAt: string;
  expiresInMs: number;
  requiresStepUp: boolean;
};

type TransportConfig = {
  protocolVersion: number;
  algorithm: number;
  kid: string;
  wireKid: string;
  publicKeyJwk: JsonWebKey;
};

function isUsableTransportJwk(value: JsonWebKey | undefined): value is JsonWebKey {
  if (!value || value.kty !== "EC" || value.crv !== "P-256") return false;
  if (typeof value.x !== "string" || typeof value.y !== "string") return false;
  return (
    /^[A-Za-z0-9_-]{20,100}={0,2}$/.test(value.x) &&
    /^[A-Za-z0-9_-]{20,100}={0,2}$/.test(value.y)
  );
}

function normalizeTransportJwk(value: JsonWebKey): JsonWebKey {
  return {
    ...value,
    kty: "EC",
    crv: "P-256",
    x: value.x?.replace(/=+$/g, ""),
    y: value.y?.replace(/=+$/g, ""),
  };
}

function browserAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  );
}

function storageAvailable(): boolean {
  return browserAvailable() && typeof indexedDB !== "undefined";
}

type AuthChannelMessage =
  | {
      type: "session-rotated";
      deviceId: string;
      sessionId: string;
      sessionGeneration: number;
    }
  | { type: "auth-reset"; deviceId?: string };

let deviceStateMemory: DeviceState | null = null;
let renewalTimer: number | null = null;
let authChannel: BroadcastChannel | null = null;

function getAuthChannel(): BroadcastChannel | null {
  if (!browserAvailable() || typeof BroadcastChannel === "undefined") return null;
  if (authChannel) return authChannel;
  authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
  authChannel.onmessage = (event: MessageEvent<AuthChannelMessage>) => {
    const message = event.data;
    if (!message || message.type === "auth-reset") {
      if (!message?.deviceId || message.deviceId === deviceStateMemory?.deviceId) {
        accessGrant = null;
        clearRenewalTimer();
      }
      return;
    }
    if (
      message.deviceId !== deviceStateMemory?.deviceId ||
      !Number.isSafeInteger(message.sessionGeneration)
    ) {
      return;
    }
    const currentGeneration = deviceStateMemory.sessionGeneration ?? 0;
    if (message.sessionGeneration < currentGeneration) return;
    deviceStateMemory.sessionId = message.sessionId;
    deviceStateMemory.sessionGeneration = message.sessionGeneration;
    void writeState(deviceStateMemory).catch(() => undefined);
    if (
      accessGrant &&
      (accessGrant.sessionId !== message.sessionId ||
        accessGrant.sessionGeneration < message.sessionGeneration)
    ) {
      accessGrant = null;
      clearRenewalTimer();
    }
  };
  return authChannel;
}

function broadcastAuth(message: AuthChannelMessage): void {
  getAuthChannel()?.postMessage(message);
}

function clearRenewalTimer(): void {
  if (renewalTimer !== null && browserAvailable()) {
    window.clearTimeout(renewalTimer);
  }
  renewalTimer = null;
}

function scheduleAccessRenewal(grant: AccessGrant): void {
  if (!browserAvailable()) return;
  clearRenewalTimer();
  const expiresAt = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expiresAt)) return;
  const delay = Math.max(5_000, expiresAt - Date.now() - ACCESS_RENEWAL_WINDOW_MS);
  renewalTimer = window.setTimeout(() => {
    renewalTimer = null;
    void ensureAccessToken().catch(() => undefined);
  }, delay);
}

async function withRenewalCoordinator<T>(work: () => Promise<T>): Promise<T> {
  if (!browserAvailable()) return work();
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (locks) {
    return locks.request("thuebot-auth-renew", { mode: "exclusive" }, work);
  }
  return work();
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        dbPromise = null;
      };
      resolve(request.result);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Security storage unavailable."));
  });
  dbPromise = promise;
  void promise.catch(() => {
    if (dbPromise === promise) dbPromise = null;
  });
  return promise;
}

async function readState(): Promise<DeviceState | null> {
  if (!storageAvailable()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(STATE_KEY);
    request.onsuccess = () =>
      resolve((request.result as DeviceState | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("Security storage read failed."));
  });
}

async function writeState(state: DeviceState): Promise<void> {
  if (!storageAvailable()) return;
  const operation = async () => {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put(state, STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Security storage write failed."));
    });
  };
  const scheduled = stateWriteChain.catch(() => undefined).then(operation);
  // IndexedDB is persistence for recovery, not the live authentication
  // primitive. A transient quota/lock/version error must not make every API
  // request fail; keep the state in memory and retry persistence later.
  stateWriteChain = scheduled.catch(() => undefined);
  await stateWriteChain;
}

async function clearState(): Promise<void> {
  if (!storageAvailable()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Security storage cleanup failed."));
    });
  } catch {
    // Account switching still clears the in-memory identity. Persistence can
    // be retried on the next successful storage operation.
  }
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const value = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(value);
  return value;
}

async function loadTransportConfig(): Promise<TransportConfig | null> {
  if (!browserAvailable()) return null;
  if (!transportConfigPromise) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), TRANSPORT_CONFIG_TIMEOUT_MS);
    const request = fetch(TRANSPORT_CONFIG_PATH, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as {
          success?: boolean;
          data?: TransportConfig;
        } | null;
        if (!response.ok || !json?.success || !json.data) return null;
        if (
          json.data.protocolVersion !== TRANSPORT_VERSION ||
          json.data.algorithm !== TRANSPORT_ALGORITHM ||
          !json.data.kid ||
          !/^[A-Za-z0-9_-]{11}$/.test(json.data.wireKid) ||
          !isUsableTransportJwk(json.data.publicKeyJwk)
        )
          return null;
        return { ...json.data, publicKeyJwk: normalizeTransportJwk(json.data.publicKeyJwk) };
      })
      .catch(() => null)
      .finally(() => window.clearTimeout(timeoutId));
    transportConfigPromise = request;
    // Do not cache a temporary API/network failure forever. A tab that opened
    // during a restart must be able to negotiate again without a hard reload.
    void request.then((result) => {
      if (!result && transportConfigPromise === request) transportConfigPromise = null;
    });
  }
  return transportConfigPromise;
}

async function ensureTransportStateUncached(): Promise<DeviceState | null> {
  if (!browserAvailable()) return null;
  const state = deviceStateMemory ?? (await readState().catch(() => null)) ?? {
    deviceId: "",
    sessionId: "",
    sequence: 0,
    transportSequence: 0,
  };
  const config = await loadTransportConfig();
  if (!config) return null;

  const serverChanged =
    state.transportKid !== config.wireKid ||
    !isUsableTransportJwk(state.transportServerPublicKeyJwk);
  let dirty = false;
  if (
    !state.transportPrivateKey ||
    !isUsableTransportJwk(state.transportPublicKeyJwk) ||
    serverChanged
  ) {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    )) as CryptoKeyPair;
    state.transportPrivateKey = pair.privateKey;
    state.transportPublicKeyJwk = await crypto.subtle.exportKey(
      "jwk",
      pair.publicKey,
    );
    directionalTransportKeys = null;
    dirty = true;
  }
  if (JSON.stringify(state.transportServerPublicKeyJwk) !== JSON.stringify(config.publicKeyJwk)) {
    state.transportServerPublicKeyJwk = config.publicKeyJwk;
    dirty = true;
  }
  if (state.transportKid !== config.wireKid) {
    state.transportKid = config.wireKid;
    dirty = true;
  }
  if (!Number.isSafeInteger(state.transportSequence) || (state.transportSequence ?? 0) < 0) {
    state.transportSequence = 0;
    dirty = true;
  }
  if (dirty) await writeState(state);
  deviceStateMemory = state;
  return state;
}

/**
 * Negotiation is shared by every request in a tab. Without a single-flight
 * guard, a page that mounts several providers at once can generate multiple
 * ECDH identities and let the last IndexedDB write invalidate requests that
 * were signed by the previous identity.
 */
async function ensureTransportState(): Promise<DeviceState | null> {
  if (!browserAvailable()) return null;
  if (transportResetPromise) await transportResetPromise.catch(() => undefined);
  if (transportStatePromise) return transportStatePromise;
  const pending = ensureTransportStateUncached();
  transportStatePromise = pending;
  void pending.finally(() => {
    if (transportStatePromise === pending) transportStatePromise = null;
  }).catch(() => undefined);
  return pending;
}

/**
 * Drop only the negotiated transport material. Authentication/device state is
 * retained, so a stale tab can recover from an API restart or a partial
 * transport header without forcing a login or weakening the request to plain
 * HTTP.
 */
export async function resetTransportNegotiation(): Promise<void> {
  if (transportResetPromise) return transportResetPromise;
  const pending = (async () => {
    // Let an in-flight negotiation finish before removing its material. This
    // prevents a late IndexedDB write from restoring the stale key we are
    // trying to discard.
    if (transportStatePromise) await transportStatePromise.catch(() => undefined);
    if (transportSequenceReservation) await transportSequenceReservation.catch(() => undefined);
    transportConfigPromise = null;
    directionalTransportKeys = null;
    transportSequenceOwner = null;
    transportSequenceNext = 0;
    transportSequenceLimit = -1;
    const state = deviceStateMemory ?? (await readState().catch(() => null));
    if (!state) return;
    delete state.transportPrivateKey;
    delete state.transportPublicKeyJwk;
    delete state.transportServerPublicKeyJwk;
    delete state.transportKid;
    await writeState(state).catch(() => undefined);
  })();
  transportResetPromise = pending;
  try {
    await pending;
  } finally {
    if (transportResetPromise === pending) transportResetPromise = null;
  }
}

/** Used by security bootstrap/step-up flows that must not start device setup recursively. */
export async function transportFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const state = await ensureTransportState();
  if (!state) {
    throw new Error("Encrypted API transport negotiation failed.");
  }
  return transportFetchWithState(state, input, init);
}

function wireKidHex(state: DeviceState): string {
  if (!state.transportKid) throw new Error("Transport key negotiation is unavailable.");
  return Array.from(wireKidFromBase64Url(state.transportKid), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function hkdfBits(
  input: ArrayBuffer,
  salt: Uint8Array<ArrayBufferLike>,
  info: Uint8Array<ArrayBufferLike>,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", input, "HKDF", false, ["deriveBits"]);
  return hkdfBitsFromKey(key, salt, info);
}

async function hkdfBitsFromKey(
  key: CryptoKey,
  salt: Uint8Array<ArrayBufferLike>,
  info: Uint8Array<ArrayBufferLike>,
): Promise<ArrayBuffer> {
  const safeSalt = new Uint8Array(new ArrayBuffer(salt.byteLength));
  safeSalt.set(salt);
  const safeInfo = new Uint8Array(new ArrayBuffer(info.byteLength));
  safeInfo.set(info);
  return crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: safeSalt, info: safeInfo },
    key,
    256,
  );
}

function transportKeyFingerprint(state: DeviceState): string {
  const client = state.transportPublicKeyJwk;
  const server = state.transportServerPublicKeyJwk;
  return [
    state.transportKid ?? "",
    client?.kty ?? "",
    client?.crv ?? "",
    client?.x ?? "",
    client?.y ?? "",
    server?.kty ?? "",
    server?.crv ?? "",
    server?.x ?? "",
    server?.y ?? "",
  ].join(":");
}

async function directionalKeysFor(
  state: DeviceState,
): Promise<DirectionalTransportKeys> {
  const fingerprint = transportKeyFingerprint(state);
  if (directionalTransportKeys?.fingerprint === fingerprint) {
    return directionalTransportKeys;
  }
  if (
    !state.transportPrivateKey ||
    !state.transportServerPublicKeyJwk ||
    !state.transportKid
  ) {
    throw new Error("Transport key negotiation is unavailable.");
  }
  const serverPublicKey = await crypto.subtle.importKey(
    "jwk",
    state.transportServerPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = await crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPublicKey },
    state.transportPrivateKey,
    256,
  );
  const sharedKey = await crypto.subtle.importKey(
    "raw",
    shared,
    "HKDF",
    false,
    ["deriveBits"],
  );
  const wire = wireKidHex(state);
  const root = await hkdfBitsFromKey(
    sharedKey,
    TRANSPORT_SALT,
    new TextEncoder().encode(`${TRANSPORT_ROOT_INFO}${wire}`),
  );
  const rootKey = await crypto.subtle.importKey(
    "raw",
    root,
    "HKDF",
    false,
    ["deriveBits"],
  );
  const c2sBits = await hkdfBitsFromKey(
    rootKey,
    TRANSPORT_DIRECTION_SALT,
    new TextEncoder().encode(`thuebot-transport-direction:c2s:${wire}`),
  );
  const s2cBits = await hkdfBitsFromKey(
    rootKey,
    TRANSPORT_DIRECTION_SALT,
    new TextEncoder().encode(`thuebot-transport-direction:s2c:${wire}`),
  );
  directionalTransportKeys = {
    fingerprint,
    c2s: await crypto.subtle.importKey("raw", c2sBits, "HKDF", false, ["deriveBits"]),
    s2c: await crypto.subtle.importKey("raw", s2cBits, "HKDF", false, ["deriveBits"]),
  };
  return directionalTransportKeys;
}

async function deriveBinaryTransportKey(
  state: DeviceState,
  requestId: string,
  sequence: number,
  direction: "c2s" | "s2c",
): Promise<CryptoKey> {
  const directional = await directionalKeysFor(state);
  const keyBytes = await hkdfBitsFromKey(
    directional[direction],
    TRANSPORT_REQUEST_SALT,
    new TextEncoder().encode(`thuebot-transport-request:${requestId}:${sequence}`),
  );
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function nextTransportSequence(state: DeviceState): Promise<number> {
  if (transportSequenceOwner !== state) {
    transportSequenceOwner = state;
    transportSequenceNext = 0;
    transportSequenceLimit = -1;
  }
  if (transportSequenceNext > transportSequenceLimit) {
    if (!transportSequenceReservation) {
      transportSequenceReservation = reserveTransportSequence(state).finally(() => {
        transportSequenceReservation = null;
      });
    }
    try {
      await transportSequenceReservation;
    } catch {
      // IndexedDB can be unavailable in private mode, after a browser
      // upgrade, or while another tab is closing the database. Use a fresh
      // per-tab high-water block rather than making the whole API unusable.
      reserveInMemoryTransportSequence(state);
    }
  }
  const sequence = transportSequenceNext;
  transportSequenceNext += 1;
  return sequence;
}

function reserveInMemoryTransportSequence(state: DeviceState): void {
  const random = new Uint32Array(2);
  crypto.getRandomValues(random);
  const randomBase = (BigInt(random[0] ?? 0) * BigInt(2 ** 21)) + BigInt(random[1] ?? 0);
  const persisted = Number.isSafeInteger(state.transportSequence) ? Number(state.transportSequence) : 0;
  const base = Math.max(persisted, Number(randomBase % BigInt(MAX_TRANSPORT_SEQUENCE - TRANSPORT_SEQUENCE_BLOCK_SIZE)));
  if (base >= MAX_TRANSPORT_SEQUENCE - 1) throw new Error("Transport sequence space exhausted.");
  transportSequenceNext = base + 1;
  transportSequenceLimit = Math.min(MAX_TRANSPORT_SEQUENCE, base + TRANSPORT_SEQUENCE_BLOCK_SIZE);
  state.transportSequence = transportSequenceLimit;
}

async function reserveTransportSequence(state: DeviceState): Promise<void> {
  if (!storageAvailable()) {
    reserveInMemoryTransportSequence(state);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);
    let start = 0;
    let limit = 0;
    request.onsuccess = () => {
      const persisted = request.result as DeviceState | undefined;
      const persistedSequence = Number.isSafeInteger(persisted?.transportSequence)
        ? Number(persisted?.transportSequence)
        : 0;
      const localSequence = Number.isSafeInteger(state.transportSequence)
        ? Number(state.transportSequence)
        : 0;
      const base = Math.max(persistedSequence, localSequence);
      if (base >= MAX_TRANSPORT_SEQUENCE) {
        reject(new Error("Transport sequence space exhausted."));
        return;
      }
      start = base + 1;
      limit = Math.min(MAX_TRANSPORT_SEQUENCE, base + TRANSPORT_SEQUENCE_BLOCK_SIZE);
      const nextState: DeviceState = {
        ...(persisted ?? state),
        ...state,
        transportSequence: limit,
      };
      state.transportSequence = limit;
      store.put(nextState, STATE_KEY);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Security sequence reservation failed."));
    transaction.oncomplete = () => {
      transportSequenceNext = start;
      transportSequenceLimit = limit;
      resolve();
    };
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Security sequence reservation failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Security sequence reservation aborted."));
  });
}

/**
 * Proof sequence numbers are a lightweight replay/ordering signal. Reserve
 * them in IndexedDB blocks just like transport sequences so signing a burst
 * of requests does not turn every request into a synchronous storage write.
 */
async function nextProofSequence(state: DeviceState): Promise<number> {
  if (proofSequenceOwner !== state) {
    proofSequenceOwner = state;
    proofSequenceNext = 0;
    proofSequenceLimit = -1;
  }
  if (proofSequenceNext > proofSequenceLimit) {
    if (!proofSequenceReservation) {
      proofSequenceReservation = reserveProofSequence(state).finally(() => {
        proofSequenceReservation = null;
      });
    }
    try {
      await proofSequenceReservation;
    } catch {
      reserveInMemoryProofSequence(state);
    }
  }
  const sequence = proofSequenceNext;
  proofSequenceNext += 1;
  return sequence;
}

function reserveInMemoryProofSequence(state: DeviceState): void {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const persisted = Number.isSafeInteger(state.sequence) ? state.sequence : 0;
  const randomBase = Number((BigInt(random[0] ?? 0) % BigInt(MAX_SEQUENCE - PROOF_SEQUENCE_BLOCK_SIZE)));
  const base = Math.max(persisted, randomBase);
  if (base >= MAX_SEQUENCE - 1) throw new Error("Security sequence space exhausted.");
  proofSequenceNext = base + 1;
  proofSequenceLimit = Math.min(MAX_SEQUENCE, base + PROOF_SEQUENCE_BLOCK_SIZE);
  state.sequence = proofSequenceLimit;
}

async function reserveProofSequence(state: DeviceState): Promise<void> {
  if (!storageAvailable()) {
    reserveInMemoryProofSequence(state);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);
    let start = 0;
    let limit = 0;
    request.onsuccess = () => {
      const persisted = request.result as DeviceState | undefined;
      const persistedSequence = Number.isSafeInteger(persisted?.sequence) ? (persisted?.sequence ?? 0) : 0;
      const localSequence = Number.isSafeInteger(state.sequence) ? state.sequence : 0;
      const base = Math.max(persistedSequence, localSequence);
      if (base >= MAX_SEQUENCE) {
        reject(new Error("Security sequence space exhausted."));
        return;
      }
      start = base + 1;
      limit = Math.min(MAX_SEQUENCE, base + PROOF_SEQUENCE_BLOCK_SIZE);
      const nextState: DeviceState = { ...(persisted ?? state), ...state, sequence: limit };
      state.sequence = limit;
      store.put(nextState, STATE_KEY);
    };
    request.onerror = () => reject(request.error ?? new Error("Security sequence reservation failed."));
    transaction.oncomplete = () => {
      proofSequenceNext = start;
      proofSequenceLimit = limit;
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("Security sequence reservation failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Security sequence reservation aborted."));
  });
}

function binaryTransportHeaders(
  state: DeviceState,
  requestId: string,
  sequence: number,
  mode: "encrypted" | "response-only",
): Headers {
  if (!state.transportKid || !state.transportPublicKeyJwk) {
    throw new Error("Transport key negotiation is unavailable.");
  }
  const headers = new Headers();
  headers.set("X-TB-Transport", String(TRANSPORT_VERSION));
  headers.set(TRANSPORT_KID_HEADER, state.transportKid);
  headers.set(
    TRANSPORT_KEY_HEADER,
    base64Url(new TextEncoder().encode(JSON.stringify(state.transportPublicKeyJwk))),
  );
  headers.set(TRANSPORT_REQUEST_HEADER, requestId);
  headers.set(TRANSPORT_SEQUENCE_HEADER, String(sequence));
  headers.set(TRANSPORT_MODE_HEADER, mode);
  return headers;
}

async function encryptBinaryRequest(
  state: DeviceState,
  value: unknown,
  requestId: string,
  sequence: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!state.transportKid) throw new Error("Transport key negotiation is unavailable.");
  const wireKid = wireKidFromBase64Url(state.transportKid);
  const nonce = randomBytes(12);
  const plaintext = encodeCbor(value);
  const header = encodeHeader({
    kind: "request",
    flags: THB4_FLAG_CBOR,
    wireKid,
    requestId,
    nonce,
    sequence,
    ciphertextLength: plaintext.length + THB4_TAG_BYTES,
  });
  const key = await deriveBinaryTransportKey(state, requestId, sequence, "c2s");
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: header },
    key,
    plaintext,
  );
  return encodeFrame({
    kind: "request",
    flags: THB4_FLAG_CBOR,
    wireKid,
    requestId,
    nonce,
    sequence,
    ciphertext: new Uint8Array(encrypted),
  });
}

async function prepareTransportRequest(
  state: DeviceState,
  input: RequestInfo | URL,
  init: RequestInit,
  requestId: string,
): Promise<{ init: RequestInit; requestId: string; sequence: number }> {
  const headers = new Headers(init.headers);
  const contentType = headers.get("Content-Type") || "";
  const sequence = await nextTransportSequence(state);
  let body = init.body;
  let mode: "encrypted" | "response-only" = "response-only";
  if (typeof body === "string" && contentType.toLowerCase().includes("json")) {
    body = await encryptBinaryRequest(state, JSON.parse(body), requestId, sequence);
    headers.set("Content-Type", THB4_CONTENT_TYPE);
    headers.set("Accept", THB4_CONTENT_TYPE);
    mode = "encrypted";
  }
  const negotiated = binaryTransportHeaders(state, requestId, sequence, mode);
  negotiated.forEach((value, key) => headers.set(key, value));
  return {
    requestId,
    sequence,
    init: { ...init, body, headers },
  };
}

function bytesEqual(left: Uint8Array<ArrayBufferLike>, right: Uint8Array<ArrayBufferLike>): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

async function decryptBinaryResponse(
  state: DeviceState,
  frame: ReturnType<typeof decodeFrame>,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await deriveBinaryTransportKey(state, frame.requestId, frame.sequence, "s2c");
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: frame.nonce, additionalData: frame.header },
      key,
      frame.ciphertext,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error("THB/4 response failed authentication.");
  }
}

/** Decode a THB/4 response and preserve the original Response contract. */
export async function decryptTransportResponse(
  response: Response,
  expected?: { requestId?: string; sequence?: number },
): Promise<Response> {
  if (!browserAvailable()) return response;
  if (response.headers.get("X-TB-Transport") !== "binary") return response;
  let frame: ReturnType<typeof decodeFrame>;
  try {
    frame = decodeFrame(new Uint8Array(await response.arrayBuffer()));
  } catch {
    throw new Error("THB/4 response frame is invalid.");
  }
  if (frame.kind !== "response" || frame.algorithm !== TRANSPORT_ALGORITHM) {
    throw new Error("THB/4 response frame kind is invalid.");
  }
  if (expected?.requestId && frame.requestId !== expected.requestId) {
    throw new Error("THB/4 response request id mismatch.");
  }
  if (expected?.sequence !== undefined && frame.sequence !== expected.sequence) {
    throw new Error("THB/4 response sequence mismatch.");
  }
  const state = await ensureTransportState();
  if (!state?.transportKid) throw new Error("Transport key negotiation is unavailable.");
  if (!bytesEqual(frame.wireKid, wireKidFromBase64Url(state.transportKid))) {
    throw new Error("THB/4 transport key rotated.");
  }
  const plaintext = await decryptBinaryResponse(state, frame);
  const headers = new Headers();
  for (const name of ["content-disposition", "cache-control", "x-content-type-options", "x-tb-ciphertext-sha256"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  const originalContentType = response.headers.get("X-TB-Transport-Content-Type");
  const isCbor = (frame.flags & THB4_FLAG_CBOR) !== 0;
  headers.set(
    "Content-Type",
    originalContentType || (isCbor ? "application/json; charset=utf-8" : "application/octet-stream"),
  );
  if (isCbor) {
    let decoded: unknown;
    try {
      decoded = decodeCbor(plaintext);
    } catch {
      throw new Error("THB/4 CBOR response is invalid.");
    }
    return new Response(JSON.stringify(decoded), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return new Response(plaintext.slice().buffer, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function transportFetchWithState(
  state: DeviceState,
  input: RequestInfo | URL,
  init: RequestInit = {},
  allowTransportRecovery = true,
): Promise<Response> {
  try {
    const requestId = crypto.randomUUID();
    const prepared = await prepareTransportRequest(state, input, init, requestId);
    const controller = new AbortController();
    const externalSignal = prepared.init.signal;
    const abortExternal = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", abortExternal, { once: true });
    }
    const timeoutId = window.setTimeout(() => controller.abort(), TRANSPORT_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(input, { ...prepared.init, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortExternal);
    }
    const decoded = await decryptTransportResponse(response, {
      requestId: prepared.requestId,
      sequence: prepared.sequence,
    });
    if (
      allowTransportRecovery &&
      (decoded.status === 400 || decoded.status === 409 || decoded.status === 426)
    ) {
      const errorBody = await decoded.clone().json().catch(() => null) as {
        code?: unknown;
      } | null;
      if (isTransportRecoveryCode(errorBody?.code)) {
        await resetTransportNegotiation();
        const refreshed = await ensureTransportState();
        if (refreshed) return transportFetchWithState(refreshed, input, init, false);
      }
    }
    return decoded;
  } catch (error) {
    // Recovery must also cover failures before fetch() (for example a stale
    // or malformed cached JWK) and authenticated-response failures after an
    // API restart. The retry never weakens the request to clear text.
    const message = error instanceof Error ? error.message : String(error);
    if (
      allowTransportRecovery &&
      (/transport (?:key )?negotiation|transport key rotated|THB\/4 response failed authentication|THB\/4 transport key rotated/i.test(message))
    ) {
      await resetTransportNegotiation();
      const refreshed = await ensureTransportState();
      if (refreshed) return transportFetchWithState(refreshed, input, init, false);
    }
    throw error;
  }
}

function isTransportRecoveryCode(value: unknown): boolean {
  return value === "TRANSPORT_REQUIRED" ||
    value === "TRANSPORT_NEGOTIATION_REQUIRED" ||
    value === "TRANSPORT_KEY_ROTATED" ||
    value === "TRANSPORT_SEQUENCE_REPLAYED" ||
    value === "TRANSPORT_REPLAYED";
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return base64Url(digest);
}

async function sha256Bytes(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function base64Url(bytes: ArrayBuffer | Uint8Array<ArrayBufferLike>): string {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomToken(bytes = 24): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

function pathOf(input: RequestInfo | URL): { url: URL; path: string } {
  const url =
    input instanceof Request
      ? new URL(input.url)
      : new URL(String(input), window.location.href);
  return { url, path: url.pathname };
}

function capabilityFromPath(path: string): string | null {
  const match = path.match(/^\/api\/m\/([^/]+)$/);
  return match?.[1] ?? null;
}

function capabilityFromEndpoint(endpoint: string): { token: string; path: string } {
  const url = new URL(endpoint, window.location.href);
  if (url.origin !== window.location.origin) {
    throw new Error("Action handle origin is invalid.");
  }
  const token = capabilityFromPath(url.pathname);
  if (!token) throw new Error("Action handle is invalid.");
  return { token, path: url.pathname };
}

const PUBLIC_MUTATION_PATHS = new Set([
  "/api/auth/onboarding",
  "/api/auth/become-seller",
  ACCESS_GRANT_PATH,
  ACCESS_RENEW_PATH,
  ACCESS_RENEW_CHALLENGE_PATH,
  "/api/auth/logout",
  "/api/bootstrap",
  "/api/security/webauthn/registration/verify",
  "/api/security/webauthn/authentication/verify",
  "/api/client-errors",
]);

// Keep login/session recovery usable when a tab has lost its negotiated
// transport material. These paths are still same-origin, credentialed calls;
// every business mutation and every access-token operation stays on THB/4.
const CLEAR_TEXT_FALLBACK_MUTATION_PATHS = new Set([
  "/api/bootstrap",
  "/api/auth/onboarding",
  "/api/auth/become-seller",
  "/api/client-errors",
]);

function isMutationMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function needsServerPermit(method: string, path: string): boolean {
  return isMutationMethod(method) && !PUBLIC_MUTATION_PATHS.has(path);
}

/**
 * Authenticated reads still need a sender-constrained proof when they expose
 * staff, E2EE, or security state. Public reads intentionally remain cleartext
 * JSON so anonymous pages and native image consumers do not need a device.
 */
function needsDeviceProof(method: string, path: string): boolean {
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return false;
  return path.startsWith('/api/admin/') ||
    path.startsWith('/api/e2ee/') ||
    path === '/api/security/devices' ||
    path === '/api/security/webauthn/registration/options' ||
    path === '/api/security/webauthn/registration/verify';
}

function isSkipped(path: string, method: string): boolean {
  return (
    !path.startsWith("/api/") ||
    path === TRANSPORT_CONFIG_PATH ||
    (isMutationMethod(method) && CLEAR_TEXT_FALLBACK_MUTATION_PATHS.has(path))
  );
}

function isTransportOptionalRead(path: string, method: string): boolean {
  if (!['GET', 'HEAD'].includes(method.toUpperCase())) return false;
  if (path === '/api/health' || path === '/api/bootstrap' || path === '/api/auth/me') return true;
  if (path === '/api/bots' || path === '/api/bots/categories' || /^\/api\/bots\/[^/]+(?:\/reviews)?$/.test(path)) return true;
  if (path === '/api/posts' || path === '/api/posts/categories' || path === '/api/posts/tags') return true;
  if (/^\/api\/posts\/slug\/[^/]+$/.test(path) || /^\/api\/posts\/(?!me$|saved$)[^/]+$/.test(path)) return true;
  if (path === '/api/sellers/lookup' || /^\/api\/sellers\/[^/]+(?:\/follow)?$/.test(path)) return true;
  if (path === '/api/comments') return true;
  if (path === '/api/resources' || /^\/api\/resources\/post\/[^/]+$/.test(path) || /^\/api\/resources\/[^/]+$/.test(path)) return true;
  if (/^\/api\/resources\/files\/[^/]+\/(?:preview|download|view)$/.test(path)) return true;
  if (/^\/api\/media\/[^/]+$/.test(path)) return true;
  return false;
}

async function bodyHash(body: BodyInit | null | undefined): Promise<string> {
  if (body === undefined || body === null) return sha256Hex("");
  if (body instanceof FormData) {
    const parts: Array<Record<string, unknown>> = [];
    const fieldIndexes = new Map<string, number>();
    for (const [name, value] of body.entries()) {
      const index = fieldIndexes.get(name) ?? 0;
      fieldIndexes.set(name, index + 1);
      if (typeof value === "string") {
        parts.push({ name, index, kind: "field", value });
      } else {
        parts.push({
          name,
          index,
          kind: "file",
          filename: value.name,
          mimeType: value.type,
          size: value.size,
          sha256: await sha256Bytes(await value.arrayBuffer()),
        });
      }
    }
    parts.sort((left, right) => {
      const leftName = String(left.name);
      const rightName = String(right.name);
      return (
        (leftName < rightName ? -1 : leftName > rightName ? 1 : 0) ||
        Number(left.index) - Number(right.index)
      );
    });
    return sha256Hex(canonicalJson(parts));
  }
  if (typeof body === "string") {
    try {
      return sha256Hex(canonicalJson(JSON.parse(body)));
    } catch {
      return sha256Hex(body);
    }
  }
  if (body instanceof URLSearchParams) return sha256Hex(body.toString());
  // Multipart bodies are handled by the upload-specific server limits. A
  // JSON mutation never reaches this branch.
  return sha256Hex("");
}

function isUsableSigningJwk(value: JsonWebKey | undefined): value is JsonWebKey {
  if (!value || value.kty !== "EC" || value.crv !== "P-256" || "d" in value) return false;
  if (typeof value.x !== "string" || typeof value.y !== "string") return false;
  return (
    /^[A-Za-z0-9_-]{20,100}={0,2}$/.test(value.x) &&
    /^[A-Za-z0-9_-]{20,100}={0,2}$/.test(value.y)
  );
}

function emptyDeviceState(): DeviceState {
  return {
    deviceId: "",
    sessionId: "",
    sequence: 0,
    transportSequence: 0,
  };
}

async function loadDeviceState(): Promise<DeviceState> {
  return deviceStateMemory ?? (await readState().catch(() => null)) ?? emptyDeviceState();
}

function normalizeSigningJwk(value: JsonWebKey): JsonWebKey {
  return {
    ...value,
    kty: "EC",
    crv: "P-256",
    x: value.x?.replace(/=+$/g, ""),
    y: value.y?.replace(/=+$/g, ""),
  };
}

async function generateSigningKey(state: DeviceState): Promise<void> {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  state.privateKey = pair.privateKey;
  state.publicKeyJwk = normalizeSigningJwk(
    await crypto.subtle.exportKey("jwk", pair.publicKey),
  );
}

async function bootstrap(
  state: DeviceState | null,
): Promise<DeviceState | null> {
  if (!browserAvailable()) return null;
  let current = state;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // Do not attempt device registration for an anonymous browser.  The
    // GET bootstrap endpoint is intentionally a non-sensitive session probe;
    // it returns { authenticated: false } instead of making the browser send
    // a guaranteed 401 POST and polluting the console on public pages.
    // Bootstrap GET is an anonymous-safe read and is also used by native
    // browser consumers. Keep both bootstrap legs outside the transport path:
    // enrollment is bound to the HttpOnly session cookie and the submitted
    // public key, while all business mutations remain transport-protected.
    const sessionProbeController = new AbortController();
    const sessionProbeTimeout = window.setTimeout(
      () => sessionProbeController.abort(),
      BOOTSTRAP_PROBE_TIMEOUT_MS,
    );
    let sessionProbe: Response;
    try {
      sessionProbe = await fetch("/api/bootstrap", {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: sessionProbeController.signal,
      });
    } finally {
      window.clearTimeout(sessionProbeTimeout);
    }
    const sessionProbeJson = (await sessionProbe.json().catch(() => null)) as SessionProbeResponse | null;
    if (
      sessionProbe.ok &&
      sessionProbeJson?.success &&
      sessionProbeJson.data?.authenticated === false
    ) {
      return null;
    }
    if (!sessionProbe.ok || !sessionProbeJson?.success) return null;

    if (!current) {
      // Rebuild the complete transport state after an account switch. A
      // signing key alone is not enough for protected API requests, so the
      // ECDH transport state is restored separately after the session probe.
      current = await ensureTransportState();
      if (!current) return null;
    }

    if (!current.privateKey || !isUsableSigningJwk(current.publicKeyJwk)) {
      // IndexedDB can retain a partially-written object after a browser
      // upgrade or interrupted account switch. Regenerate only an unbound
      // local identity; a bound identity must never be silently replaced.
      if (current.deviceId && !isUsableSigningJwk(current.publicKeyJwk)) return null;
      delete current.privateKey;
      delete current.publicKeyJwk;
      await generateSigningKey(current);
      await writeState(current).catch(() => undefined);
    } else {
      current.publicKeyJwk = normalizeSigningJwk(current.publicKeyJwk);
    }
    const bootstrapController = new AbortController();
    const bootstrapTimeout = window.setTimeout(() => bootstrapController.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch("/api/bootstrap", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          publicKeyJwk: current.publicKeyJwk,
          deviceName: navigator.userAgent.slice(0, 100),
          platform: navigator.platform,
        }),
        signal: bootstrapController.signal,
      });
    } finally {
      window.clearTimeout(bootstrapTimeout);
    }
    const json = (await response.json().catch(() => null)) as BootstrapResponse | null;
    if (response.ok && json?.success && json.data) {
      current.deviceId = json.data.deviceId;
      current.sessionId = json.data.sessionId;
      current.sessionGeneration =
        typeof json.data.sessionGeneration === "number"
          ? json.data.sessionGeneration
          : current.sessionGeneration ?? 0;
      if (typeof json.data.canary === "string" && json.data.canary.length > 0) {
        current.canary = json.data.canary;
      }
      const serverSequence =
        typeof json.data.lastSequence === "number" &&
        Number.isSafeInteger(json.data.lastSequence)
          ? Math.min(MAX_SEQUENCE, Math.max(0, json.data.lastSequence))
          : 0;
      if (
        !Number.isSafeInteger(current.sequence) ||
        current.sequence < 0 ||
        current.sequence > MAX_SEQUENCE
      ) {
        current.sequence = 0;
      }
      current.sequence = Math.max(current.sequence, serverSequence);
      await writeState(current);
      deviceStateMemory = current;
      return current;
    }
    // A device identity is intentionally bound to its original account. If a
    // browser switches accounts, the old signing key must not be rebound. The
    // safe recovery is to discard the local identity and register a fresh key
    // once. Keep this retry narrow: other 403 responses are auth/security
    // failures and must not silently rotate the device identity.
    if (
      response.status === 403 &&
      attempt === 0 &&
      json?.code === "DEVICE_KEY_BOUND_TO_OTHER_ACCOUNT"
    ) {
      current = null;
      deviceStateMemory = null;
      await clearState();
      continue;
    }
    if (
      response.status === 400 &&
      attempt === 0 &&
      !current.deviceId &&
      json?.code === "VALIDATION_FAILED"
    ) {
      // A pre-existing browser key can be malformed even though the outer
      // IndexedDB record is readable. Retry once with a fresh P-256 key so a
      // transient client-state corruption does not strand login onboarding.
      delete current.privateKey;
      delete current.publicKeyJwk;
      await generateSigningKey(current);
      await writeState(current).catch(() => undefined);
      continue;
    }
    return null;
  }
  return null;
}

export async function ensureDevice(): Promise<DeviceState | null> {
  if (!browserAvailable()) return null;
  getAuthChannel();
  if (!statePromise) {
    const pending = (async () => {
      // Device enrollment is intentionally allowed to use the protected
      // session-cookie recovery lane even if transport config is temporarily
      // unavailable. The transport is hydrated again after enrollment; a
      // protected request still refuses to proceed without it.
      const transportState = await ensureTransportState();
      const baseState = transportState ?? (await loadDeviceState());
      const enrolled = await bootstrap(baseState);
      if (!enrolled) return null;
      const hydrated = await ensureTransportState();
      return hydrated ?? enrolled;
    })()
      .catch(() => null);
    statePromise = pending;
    // A failed bootstrap is normally transient (API restart, temporary DB
    // lock, or a just-expired session). Never memoize the null result forever.
    void pending.then((result) => {
      if (!result && statePromise === pending) statePromise = null;
    });
  }
  return statePromise;
}

/**
 * Access grants intentionally live only in this module's memory. A reload
 * keeps the non-exportable device key but must mint a fresh grant from the
 * HttpOnly session cookie and a new device proof.
 */
export async function ensureAccessToken(
  stateInput?: DeviceState | null,
): Promise<AccessGrant | null> {
  return ensureAccessTokenInternal(stateInput, false);
}

export async function renewAccessToken(): Promise<AccessGrant | null> {
  accessGrant = null;
  clearRenewalTimer();
  return ensureAccessTokenInternal(undefined, true);
}

async function latestDeviceState(
  stateInput?: DeviceState | null,
): Promise<DeviceState | null> {
  return stateInput ?? deviceStateMemory ?? (await ensureDevice());
}

async function ensureAccessTokenInternal(
  stateInput: DeviceState | null | undefined,
  forceRenew: boolean,
): Promise<AccessGrant | null> {
  if (!browserAvailable()) return null;
  const currentState = await latestDeviceState(stateInput);
  if (!currentState) return null;
  if (
    !forceRenew &&
    accessGrant &&
    accessGrant.deviceId === currentState.deviceId &&
    accessGrant.sessionId === currentState.sessionId &&
    Date.parse(accessGrant.expiresAt) - Date.now() > ACCESS_RENEWAL_WINDOW_MS
  ) {
    scheduleAccessRenewal(accessGrant);
    return accessGrant;
  }
  if (accessGrantPromise) return accessGrantPromise;

  accessGrantPromise = withRenewalCoordinator(async () => {
    const state = await latestDeviceState(currentState);
    if (!state) return null;
    if (
      !forceRenew &&
      accessGrant &&
      accessGrant.deviceId === state.deviceId &&
      accessGrant.sessionId === state.sessionId &&
      Date.parse(accessGrant.expiresAt) - Date.now() > ACCESS_RENEWAL_WINDOW_MS
    ) {
      scheduleAccessRenewal(accessGrant);
      return accessGrant;
    }
    const hasCurrentGrant =
      Boolean(accessGrant) && accessGrant?.sessionId === state.sessionId;
    const path = forceRenew || hasCurrentGrant
      ? ACCESS_RENEW_PATH
      : ACCESS_GRANT_PATH;
    const body = JSON.stringify({});
    const digest = await bodyHash(body);
    const idempotencyKey = `${path === ACCESS_RENEW_PATH ? "renew" : "access"}-${crypto.randomUUID()}`;
    const serverNonce = path === ACCESS_RENEW_PATH
      ? await issueRenewalChallenge(state)
      : "";
    if (path === ACCESS_RENEW_PATH && !serverNonce) {
      accessGrant = null;
      clearRenewalTimer();
      return null;
    }
    const headers = await signedHeaders(
      state,
      "POST",
      path,
      digest,
      idempotencyKey,
      "",
      serverNonce ?? "",
    );
    headers.set("Content-Type", "application/json");
    const response = await transportFetchWithState(state, path, {
      method: "POST",
      credentials: "include",
      headers,
      body,
    });
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: {
        token?: string;
        expiresAt?: string;
        expiresInMs?: number;
        deviceId?: string;
        sessionId?: string;
        sessionGeneration?: number;
      };
    } | null;
    if (
      !response.ok ||
      !json?.success ||
      typeof json.data?.token !== "string" ||
      typeof json.data.expiresAt !== "string" ||
      json.data.deviceId !== state.deviceId ||
      typeof json.data.sessionId !== "string"
    ) {
      accessGrant = null;
      clearRenewalTimer();
      return null;
    }
    const nextGeneration = Number.isSafeInteger(json.data.sessionGeneration)
      ? Number(json.data.sessionGeneration)
      : state.sessionGeneration ?? 0;
    const sessionChanged =
      state.sessionId !== json.data.sessionId ||
      (state.sessionGeneration ?? 0) !== nextGeneration;
    state.sessionId = json.data.sessionId;
    state.sessionGeneration = nextGeneration;
    deviceStateMemory = state;
    await writeState(state);
    if (sessionChanged) {
      broadcastAuth({
        type: "session-rotated",
        deviceId: state.deviceId,
        sessionId: state.sessionId,
        sessionGeneration: nextGeneration,
      });
    }
    accessGrant = {
      token: json.data.token,
      expiresAt: json.data.expiresAt,
      expiresInMs: Number(json.data.expiresInMs ?? 0),
      deviceId: json.data.deviceId,
      sessionId: json.data.sessionId,
      sessionGeneration: nextGeneration,
    };
    scheduleAccessRenewal(accessGrant);
    return accessGrant;
  })
    .catch(() => {
      accessGrant = null;
      clearRenewalTimer();
      return null;
    })
    .finally(() => {
      accessGrantPromise = null;
    });
  return accessGrantPromise;
}

/** Return the server-side device id used by signed mutation requests. */
export async function currentSecurityDeviceId(): Promise<string | null> {
  return (await ensureDevice())?.deviceId ?? null;
}

async function issueRenewalChallenge(state: DeviceState): Promise<string | null> {
  const body = JSON.stringify({});
  const digest = await bodyHash(body);
  const idempotencyKey = `renew-challenge-${crypto.randomUUID()}`;
  const headers = await signedHeaders(
    state,
    "POST",
    ACCESS_RENEW_CHALLENGE_PATH,
    digest,
    idempotencyKey,
  );
  headers.set("Content-Type", "application/json");
  const response = await transportFetchWithState(
    state,
    ACCESS_RENEW_CHALLENGE_PATH,
    {
      method: "POST",
      credentials: "include",
      headers,
      body,
    },
  );
  const json = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: { challenge?: string; expiresAt?: string };
  } | null;
  return response.ok && json?.success && typeof json.data?.challenge === "string"
    ? json.data.challenge
    : null;
}

async function signedHeaders(
  state: DeviceState,
  method: string,
  path: string,
  digest: string,
  idempotencyKey: string,
  permit = "",
  serverNonce = "",
  accessToken = "",
): Promise<Headers> {
  if (!state.privateKey || !state.deviceId || !state.sessionId) {
    throw new Error("Device security bootstrap failed.");
  }
  const timestamp = String(Date.now());
  const nonce = randomToken(18);
  const request = crypto.randomUUID();
  const sequence = String(await nextProofSequence(state));
  const permitHash = permit ? await sha256Hex(permit) : "";
  const accessTokenHash = accessToken ? await sha256Base64Url(accessToken) : "";
  const proofUrl = new URL(path, window.location.origin);
  proofUrl.search = "";
  proofUrl.hash = "";
  const dpopHeader = base64Url(
    new TextEncoder().encode(
      JSON.stringify({ typ: "dpop+jwt", alg: "ES256", jwk: state.publicKeyJwk }),
    ),
  );
  const dpopPayload = base64Url(
    new TextEncoder().encode(
      JSON.stringify({
        jti: request,
        htm: method.toUpperCase(),
        htu: proofUrl.toString(),
        iat: Math.floor(Date.now() / 1_000),
        ...(accessTokenHash ? { ath: accessTokenHash } : {}),
        ...(serverNonce ? { nonce: serverNonce } : {}),
        tb_device: state.deviceId,
        tb_session: state.sessionId,
        tb_request: request,
        tb_time: timestamp,
        tb_nonce: nonce,
        tb_sequence: sequence,
        tb_body_sha256: digest,
        tb_idempotency: idempotencyKey,
        tb_permit: permitHash,
        tb_server_nonce: serverNonce,
      }),
    ),
  );
  const dpopSigningInput = `${dpopHeader}.${dpopPayload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    state.privateKey,
    new TextEncoder().encode(dpopSigningInput),
  );
  const headers = new Headers();
  headers.set("X-TB-Protocol", PROTOCOL_VERSION);
  headers.set("X-TB-Device", state.deviceId);
  headers.set("X-TB-Session", state.sessionId);
  headers.set("X-TB-Request", request);
  headers.set("X-TB-Time", timestamp);
  headers.set("X-TB-Nonce", nonce);
  headers.set("X-TB-Sequence", sequence);
  headers.set("X-TB-Body-SHA256", digest);
  headers.set("X-TB-Idempotency", idempotencyKey);
  headers.set("DPoP", `${dpopSigningInput}.${base64Url(signature)}`);
  if (accessToken) headers.set("Authorization", `DPoP ${accessToken}`);
  if (permit) headers.set("X-TB-Permit", permit);
  if (serverNonce) headers.set("X-TB-Server-Nonce", serverNonce);
  return headers;
}

async function issuePermit(
  state: DeviceState,
  method: string,
  path: string,
  digest: string,
  accessToken: string,
): Promise<{
  endpoint: string;
  permit: string;
  serverNonce: string;
  requiresStepUp?: boolean;
} | null> {
  const permitBody = JSON.stringify({
    method,
    path,
    bodyHash: digest,
  });
  const permitDigest = await bodyHash(permitBody);
  const key = `intent-${randomToken(16)}`;
  const headers = await signedHeaders(
    state,
    "POST",
    "/api/i",
    permitDigest,
    key,
    "",
    "",
    accessToken,
  );
  headers.set("Content-Type", "application/json");
  const response = await transportFetchWithState(state, "/api/i", {
    method: "POST",
    credentials: "include",
    headers,
    body: permitBody,
  });
  const json = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: {
      endpoint: string;
      permit: string;
      serverNonce: string;
      expiresInMs?: number;
      requiresStepUp?: boolean;
    };
  } | null;
  if (
    !response.ok ||
    !json?.success ||
    !json.data?.endpoint ||
    !json.data.permit ||
    !json.data.serverNonce
  )
    return null;
  return json.data;
}

/**
 * Critical step-up for a server-issued opaque handle. The browser receives
 * only the passkey challenge; the private action registry key stays server
 * side.
 */
export async function ensureWebAuthnStepUpForHandle(
  endpoint: string,
): Promise<boolean> {
  if (!browserAvailable()) return false;
  const { token } = capabilityFromEndpoint(endpoint);
  const cachedUntil = handleStepUpCache.get(token) ?? 0;
  if (cachedUntil > Date.now()) return true;
  try {
    const optionsResponse = await transportFetch(
      `/api/security/webauthn/authentication/options?handle=${encodeURIComponent(token)}`,
      { credentials: "include", headers: { Accept: "application/json" } },
    );
    const optionsJson = (await optionsResponse.json().catch(() => null)) as {
      success?: boolean;
      data?: { options?: unknown };
    } | null;
    if (
      !optionsResponse.ok ||
      !optionsJson?.success ||
      !optionsJson.data?.options
    )
      return false;
    const { startAuthentication } = await import("@simplewebauthn/browser");
    const response = await startAuthentication({
      optionsJSON: optionsJson.data.options as Parameters<
        typeof startAuthentication
      >[0]["optionsJSON"],
    });
    const verifyResponse = await transportFetch(
      "/api/security/webauthn/authentication/verify",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: token, response }),
      },
    );
    const verifyJson = (await verifyResponse.json().catch(() => null)) as {
      success?: boolean;
    } | null;
    if (!verifyResponse.ok || !verifyJson?.success) return false;
    handleStepUpCache.set(token, Date.now() + 90_000);
    return true;
  } catch {
    return false;
  }
}

export async function secureRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<{ input: RequestInfo | URL; init: RequestInit }> {
  if (!browserAvailable()) return { input, init };
  const { url, path } = pathOf(input);
  const method = (
    init.method || (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  if (url.origin !== window.location.origin || isSkipped(path, method)) {
    return {
      input,
      init: { ...init, credentials: init.credentials ?? "include" },
    };
  }
  if (isTransportOptionalRead(path, method)) {
    return {
      input,
      init: { ...init, credentials: init.credentials ?? "include" },
    };
  }
  const transportState = await ensureTransportState();
  if (!transportState) {
    throw new Error("Encrypted API transport negotiation failed.");
  }
  const digest = await bodyHash(init.body);
  const inputHeaders = new Headers(init.headers);
  if (
    path === ACCESS_GRANT_PATH ||
    path === ACCESS_RENEW_PATH ||
    path === ACCESS_RENEW_CHALLENGE_PATH
  ) {
    const device = await ensureDevice();
    if (!device) throw new Error("Device security bootstrap failed.");
    const idempotencyKey =
      inputHeaders.get("X-TB-Idempotency") ??
      `access-${crypto.randomUUID()}`;
    const headers = await signedHeaders(
      device,
      method,
      path,
      digest,
      idempotencyKey,
    );
    inputHeaders.forEach((value, key) => {
      if (
        !key.toLowerCase().startsWith("x-tb-") &&
        key.toLowerCase() !== "authorization" &&
        key.toLowerCase() !== "dpop"
      )
        headers.set(key, value);
    });
    headers.set("X-TB-Idempotency", idempotencyKey);
    const transportRequestId = headers.get("X-TB-Request") ?? crypto.randomUUID();
    const prepared = await prepareTransportRequest(
      device,
      input,
      { ...init, credentials: init.credentials ?? "include", headers },
      transportRequestId,
    );
    return {
      input,
      init: {
        ...init,
        credentials: init.credentials ?? "include",
        body: prepared.init.body,
        headers: prepared.init.headers,
      },
    };
  }
  const capability = capabilityFromPath(path);
  const permitRequired = Boolean(capability) || needsServerPermit(method, path);
  const proofRequired = permitRequired || needsDeviceProof(method, path);
  let state = transportState;
  let accessToken = "";
  let permit: {
    endpoint: string;
    permit: string;
    serverNonce: string;
    requiresStepUp?: boolean;
  } | null = null;
  if (proofRequired) {
    const device = await ensureDevice();
    if (!device) {
      throw new Error("Device security bootstrap failed.");
    }
    state = device;
    const grant = await ensureAccessToken(state);
    if (!grant) throw new Error("API access grant could not be issued.");
    accessToken = grant.token;
    if (permitRequired && !capability) {
      permit = await issuePermit(state, method, path, digest, accessToken);
      if (!permit) throw new Error("Server action permit could not be issued.");
      if (
        permit.requiresStepUp &&
        !(await ensureWebAuthnStepUpForHandle(permit.endpoint))
      ) {
        throw new Error("Thao tác này cần xác nhận bằng passkey/WebAuthn.");
      }
    } else if (permitRequired && capability) {
      const serverNonce = inputHeaders.get("X-TB-Server-Nonce") ?? "";
      if (!serverNonce) {
        throw new Error("Server action handle nonce is missing.");
      }
      permit = { endpoint: path, permit: capability, serverNonce };
    }
  }
  const idempotencyKey =
    inputHeaders.get("X-TB-Idempotency") ??
    `${method.toLowerCase()}-${crypto.randomUUID()}`;
  const signedPath = permit?.endpoint ?? path;
  const headers = proofRequired
    ? await signedHeaders(
        state,
        method,
        signedPath,
        digest,
        idempotencyKey,
        permit?.permit,
        permit?.serverNonce,
        accessToken,
      )
    : new Headers();
  inputHeaders.forEach((value, key) => {
    if (
      !key.toLowerCase().startsWith("x-tb-") &&
      key.toLowerCase() !== "authorization" &&
      key.toLowerCase() !== "dpop"
    )
      headers.set(key, value);
  });
  if (proofRequired) headers.set("X-TB-Idempotency", idempotencyKey);
  if (proofRequired && accessToken) {
    headers.set("Authorization", `DPoP ${accessToken}`);
  }
  const transportRequestId =
    headers.get("X-TB-Request") ?? crypto.randomUUID();
  const prepared = await prepareTransportRequest(
    state,
    input,
    {
      ...init,
      headers,
    },
    transportRequestId,
  );
  const nextInit: RequestInit = {
    ...init,
    credentials: init.credentials ?? "include",
    body: prepared.init.body,
    headers: prepared.init.headers,
  };
  return { input: permit?.endpoint ?? input, init: nextInit };
}

export function resetSecurityClient(): void {
  const deviceId = deviceStateMemory?.deviceId;
  statePromise = null;
  transportConfigPromise = null;
  transportStatePromise = null;
  directionalTransportKeys = null;
  transportSequenceOwner = null;
  transportSequenceNext = 0;
  transportSequenceLimit = -1;
  transportSequenceReservation = null;
  proofSequenceOwner = null;
  proofSequenceNext = 0;
  proofSequenceLimit = -1;
  proofSequenceReservation = null;
  accessGrantPromise = null;
  accessGrant = null;
  deviceStateMemory = null;
  clearRenewalTimer();
  broadcastAuth({ type: "auth-reset", deviceId });
  handleStepUpCache.clear();
}
