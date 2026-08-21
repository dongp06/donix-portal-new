import { api } from "@/lib/api-client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { currentSecurityDeviceId } from "@/lib/security-client";

import type { SignalDevice } from "./signal-wasm/thuebot_libsignal_wasm.js";

export const SIGNAL_E2EE_PROTOCOL = "signal-pqxdh-v1" as const;

export type SignalBundle = {
  registration_id: number;
  device_id: number;
  pre_key_id: number | null;
  pre_key_public: string | null;
  signed_pre_key_id: number;
  signed_pre_key_public: string;
  signed_pre_key_signature: string;
  identity_key: string;
  kyber_pre_key_id: number;
  kyber_pre_key_public: string;
  kyber_pre_key_signature: string;
};

export type SignalPreKey = {
  id: number;
  public_key: string;
};

export type SignalMessage = {
  message_type: 2 | 3;
  ciphertext: string;
};

export type E2eeDirectoryDevice = {
  deviceId: string;
  signalDeviceId: number;
  protocolVersion: string;
  bundle: SignalBundle;
};

export type DirectoryResponse = {
  protocolVersion: string;
  userId: string;
  devices: E2eeDirectoryDevice[];
};

export type SignalConversation = {
  id: string;
  protocolVersion: string;
  createdAt: string;
  updatedAt: string;
  members: Array<{
    userId: string;
    deviceId: string;
    joinedAt: string;
    revokedAt: string | null;
  }>;
};

export type StoredSignalMessage = {
  id: string;
  conversationId: string;
  senderDeviceId: string;
  recipientDeviceId: string | null;
  protocolVersion: string;
  message: SignalMessage;
  clientMessageId: string;
  createdAt: string;
  deliveredAt: string | null;
};

export type EncryptedSignalAttachment = {
  ciphertext: Blob;
  encryptedFileKey: string;
  keyMessage: SignalMessage;
  nonce: string;
  ciphertextSha256: string;
  mimeType: string;
  sizeBytes: number;
};

export type SignalAttachmentDescriptor = {
  attachmentId: string;
  mimeType: string;
  sizeBytes: number;
  ciphertextSha256: string;
  encryptedFileKey: string;
  nonce: string;
  createdAt?: string;
};

type OwnDeviceResponse = {
  protocolVersion: string;
  userId: string;
  devices: Array<{
    id: string;
    deviceId: string;
    signalDeviceId: number;
    registrationId: number;
    protocolVersion: string;
    createdAt: string;
    rotatedAt: string | null;
  }>;
};

type StoredSignalDevice = {
  version: 1;
  userName: string;
  securityDeviceId: string;
  signalDeviceId: number;
  wrapKey: CryptoKey;
  iv: ArrayBuffer;
  encryptedSnapshot: ArrayBuffer;
};

const DB_NAME = "thuebot-e2ee-v1";
const STORE_NAME = "devices";
const DB_VERSION = 1;
const MAX_PREKEYS = 100;
const MAX_E2EE_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const RECOVERY_BACKUP_VERSION = 1;
const RECOVERY_KDF_ITERATIONS = 310_000;
const wasmPromise: {
  value: Promise<
    typeof import("./signal-wasm/thuebot_libsignal_wasm.js")
  > | null;
} = { value: null };

function assertBrowser(): void {
  if (
    typeof window === "undefined" ||
    typeof indexedDB === "undefined" ||
    !window.crypto?.subtle
  ) {
    throw new Error(
      "Signal E2EE chỉ chạy trong browser có Web Crypto và IndexedDB.",
    );
  }
}

function openDb(): Promise<IDBDatabase> {
  assertBrowser();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("E2EE storage is unavailable."));
  });
}

async function readStored(key: string): Promise<StoredSignalDevice | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(key);
    request.onsuccess = () =>
      resolve((request.result as StoredSignalDevice | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("E2EE storage read failed."));
  });
}

async function writeStored(
  key: string,
  value: StoredSignalDevice,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("E2EE storage write failed."));
  });
}

function recordKey(userName: string, securityDeviceId: string): string {
  return `${userName}\u0000${securityDeviceId}`;
}

function bytes(value: ArrayBuffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(value);
}

function base64Url(value: ArrayBuffer | Uint8Array<ArrayBufferLike>): string {
  const view = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error("E2EE nonce không hợp lệ.");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    result[index] = binary.charCodeAt(index);
  return result;
}

async function sha256Bytes(
  value: ArrayBuffer | Uint8Array<ArrayBufferLike>,
): Promise<string> {
  const source = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

type RecoveryBackupWire = {
  version: 1;
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

type RecoveryPayload = {
  version: 1;
  protocol: typeof SIGNAL_E2EE_PROTOCOL;
  userName: string;
  securityDeviceId: string;
  snapshot: string;
};

function recoveryCode(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 20 || normalized.length > 256) {
    throw new Error("Recovery key phải dài từ 20 đến 256 ký tự.");
  }
  return normalized;
}

async function recoveryAesKey(
  code: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const password = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    password,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function parseRecoveryBackup(value: string): RecoveryBackupWire {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new Error("Recovery backup không phải JSON hợp lệ.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Recovery backup không hợp lệ.");
  }
  const wire = raw as Record<string, unknown>;
  if (
    wire.version !== RECOVERY_BACKUP_VERSION ||
    wire.kdf !== "PBKDF2-SHA-256" ||
    typeof wire.iterations !== "number" ||
    !Number.isSafeInteger(wire.iterations) ||
    wire.iterations < 100_000 ||
    wire.iterations > 2_000_000 ||
    typeof wire.salt !== "string" ||
    typeof wire.iv !== "string" ||
    typeof wire.ciphertext !== "string"
  ) {
    throw new Error("Recovery backup version hoặc KDF không được hỗ trợ.");
  }
  return wire as unknown as RecoveryBackupWire;
}

async function encryptSnapshot(
  snapshot: string,
  key: string,
  wrapKey: CryptoKey,
): Promise<{ iv: ArrayBuffer; encryptedSnapshot: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(key),
    },
    wrapKey,
    new TextEncoder().encode(snapshot),
  );
  return { iv: iv.slice().buffer as ArrayBuffer, encryptedSnapshot: encrypted };
}

async function decryptSnapshot(
  key: string,
  stored: StoredSignalDevice,
): Promise<string> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(stored.iv),
        additionalData: new TextEncoder().encode(key),
      },
      stored.wrapKey,
      stored.encryptedSnapshot,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error(
      "Không thể mở khóa Signal device state local; dữ liệu có thể đã bị thay đổi.",
    );
  }
}

async function loadWasm() {
  assertBrowser();
  if (!wasmPromise.value) {
    wasmPromise.value = import("./signal-wasm/thuebot_libsignal_wasm.js").then(
      async (module) => {
        const wasmUrl = new URL(
          "./signal-wasm/thuebot_libsignal_wasm_bg.wasm",
          import.meta.url,
        );
        await module.default(wasmUrl);
        return module;
      },
    );
  }
  return wasmPromise.value;
}

async function ownSignalDevices(): Promise<OwnDeviceResponse> {
  return api<OwnDeviceResponse>("/api/e2ee/devices", {
    credentials: "include",
  });
}

async function allocateSignalDeviceId(): Promise<number> {
  const current = await ownSignalDevices();
  const used = new Set(current.devices.map((device) => device.signalDeviceId));
  for (let candidate = 1; candidate <= 127; candidate += 1) {
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Tài khoản đã dùng hết 127 Signal device number.");
}

async function publishPublicMaterial(
  userName: string,
  securityDeviceId: string,
  device: SignalDevice,
): Promise<void> {
  const bundle = JSON.parse(device.bundle_json()) as SignalBundle;
  const preKeys = JSON.parse(device.prekey_pool_json()) as SignalPreKey[];
  if (preKeys.length > MAX_PREKEYS)
    throw new Error("Signal pre-key pool vượt giới hạn client.");
  // This is the only payload sent to the API. The serialized snapshot is
  // deliberately never part of this request.
  await api("/api/e2ee/devices", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({
      deviceId: securityDeviceId,
      bundle,
      preKeys,
    }),
  });
  void userName;
}

async function persistDevice(
  key: string,
  userName: string,
  securityDeviceId: string,
  signalDeviceId: number,
  device: SignalDevice,
  stored?: StoredSignalDevice,
): Promise<void> {
  const wrapKey =
    stored?.wrapKey ??
    (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]));
  const encrypted = await encryptSnapshot(device.snapshot_json(), key, wrapKey);
  await writeStored(key, {
    version: 1,
    userName,
    securityDeviceId,
    signalDeviceId,
    wrapKey,
    ...encrypted,
  });
}

export class ThuebotSignalClient {
  private constructor(
    private readonly storageKey: string,
    private readonly userName: string,
    private readonly securityDeviceId: string,
    private readonly signalDeviceId: number,
    private readonly device: SignalDevice,
  ) {}

  static async open(userName: string): Promise<ThuebotSignalClient> {
    assertBrowser();
    const normalizedUserName = userName.trim();
    if (!normalizedUserName || normalizedUserName.length > 160) {
      throw new Error("Signal user name không hợp lệ.");
    }
    const securityDeviceId = await currentSecurityDeviceId();
    if (!securityDeviceId)
      throw new Error(
        "Cần đăng nhập và đăng ký browser device trước khi dùng E2EE.",
      );
    const key = recordKey(normalizedUserName, securityDeviceId);
    const stored = await readStored(key);
    const wasm = await loadWasm();
    let device: SignalDevice;
    let signalDeviceId: number;
    if (stored) {
      if (
        stored.userName !== normalizedUserName ||
        stored.securityDeviceId !== securityDeviceId
      ) {
        throw new Error("Signal device state scope mismatch.");
      }
      signalDeviceId = stored.signalDeviceId;
      device = wasm.SignalDevice.from_snapshot(
        await decryptSnapshot(key, stored),
      );
    } else {
      signalDeviceId = await allocateSignalDeviceId();
      device = new wasm.SignalDevice(
        normalizedUserName,
        signalDeviceId,
        MAX_PREKEYS,
      );
      await persistDevice(
        key,
        normalizedUserName,
        securityDeviceId,
        signalDeviceId,
        device,
      );
    }
    const client = new ThuebotSignalClient(
      key,
      normalizedUserName,
      securityDeviceId,
      signalDeviceId,
      device,
    );
    await client.publish();
    return client;
  }

  async publish(): Promise<void> {
    await publishPublicMaterial(
      this.userName,
      this.securityDeviceId,
      this.device,
    );
    await this.persist();
  }

  bundle(): SignalBundle {
    return JSON.parse(this.device.bundle_json()) as SignalBundle;
  }

  async processRemoteBundle(
    remoteUserName: string,
    bundle: SignalBundle,
  ): Promise<void> {
    if (bundle.device_id < 1 || bundle.device_id > 127)
      throw new Error("Remote Signal device number is invalid.");
    await this.device.process_bundle_json(
      remoteUserName,
      bundle.device_id,
      JSON.stringify(bundle),
    );
    await this.persist();
  }

  async encrypt(
    remoteUserName: string,
    remoteDeviceId: number,
    plaintext: Uint8Array,
  ): Promise<SignalMessage> {
    const message = JSON.parse(
      await this.device.encrypt_json(remoteUserName, remoteDeviceId, plaintext),
    ) as SignalMessage;
    if (message.message_type !== 2 && message.message_type !== 3)
      throw new Error("Unsupported Signal ciphertext type.");
    await this.persist();
    return message;
  }

  async encryptText(
    remoteUserName: string,
    remoteDeviceId: number,
    plaintext: string,
  ): Promise<SignalMessage> {
    return this.encrypt(
      remoteUserName,
      remoteDeviceId,
      new TextEncoder().encode(plaintext),
    );
  }

  async decrypt(
    remoteUserName: string,
    remoteDeviceId: number,
    message: SignalMessage,
  ): Promise<Uint8Array> {
    const plaintext = await this.device.decrypt_json(
      remoteUserName,
      remoteDeviceId,
      JSON.stringify(message),
    );
    await this.persist();
    return plaintext;
  }

  async decryptText(
    remoteUserName: string,
    remoteDeviceId: number,
    message: SignalMessage,
  ): Promise<string> {
    return new TextDecoder().decode(
      await this.decrypt(remoteUserName, remoteDeviceId, message),
    );
  }

  safetyNumber(
    remoteUserName: string,
    remoteDeviceId: number,
  ): { display: string; scannable: string } {
    return JSON.parse(
      this.device.safety_number_json(remoteUserName, remoteDeviceId),
    ) as { display: string; scannable: string };
  }

  getSignalDeviceId(): number {
    return this.signalDeviceId;
  }

  /**
   * Export an encrypted local recovery blob. The raw Signal snapshot never
   * leaves this function; the caller must keep the recovery code separately.
   * Restores are intentionally scoped to the same Thuebot security device so
   * one Signal identity cannot be cloned onto a second browser device.
   */
  async exportRecoveryBackup(recoveryKey: string): Promise<string> {
    assertBrowser();
    const code = recoveryCode(recoveryKey);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await recoveryAesKey(code, salt, RECOVERY_KDF_ITERATIONS);
    const payload: RecoveryPayload = {
      version: RECOVERY_BACKUP_VERSION,
      protocol: SIGNAL_E2EE_PROTOCOL,
      userName: this.userName,
      securityDeviceId: this.securityDeviceId,
      snapshot: this.device.snapshot_json(),
    };
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(
          `${this.userName}\u0000${this.securityDeviceId}`,
        ),
      },
      key,
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    const wire: RecoveryBackupWire = {
      version: RECOVERY_BACKUP_VERSION,
      kdf: "PBKDF2-SHA-256",
      iterations: RECOVERY_KDF_ITERATIONS,
      salt: base64Url(salt),
      iv: base64Url(iv),
      ciphertext: base64Url(ciphertext),
    };
    return JSON.stringify(wire);
  }

  static async restoreFromRecoveryBackup(
    userName: string,
    recoveryKey: string,
    backup: string,
  ): Promise<ThuebotSignalClient> {
    assertBrowser();
    const normalizedUserName = userName.trim();
    if (!normalizedUserName || normalizedUserName.length > 160) {
      throw new Error("Signal user name không hợp lệ.");
    }
    const securityDeviceId = await currentSecurityDeviceId();
    if (!securityDeviceId)
      throw new Error(
        "Cần đăng nhập và đăng ký browser device trước khi restore E2EE.",
      );
    const wire = parseRecoveryBackup(backup);
    const salt = decodeBase64Url(wire.salt);
    const iv = decodeBase64Url(wire.iv);
    const ciphertext = decodeBase64Url(wire.ciphertext);
    if (
      salt.byteLength !== 16 ||
      iv.byteLength !== 12 ||
      ciphertext.byteLength < 17
    ) {
      throw new Error("Recovery backup có kích thước không hợp lệ.");
    }
    const key = await recoveryAesKey(
      recoveryCode(recoveryKey),
      salt,
      wire.iterations,
    );
    let payload: RecoveryPayload;
    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: new TextEncoder().encode(
            `${normalizedUserName}\u0000${securityDeviceId}`,
          ),
        },
        key,
        ciphertext,
      );
      payload = JSON.parse(
        new TextDecoder().decode(plaintext),
      ) as RecoveryPayload;
    } catch {
      throw new Error("Recovery key không đúng hoặc backup đã bị thay đổi.");
    }
    if (
      payload.version !== RECOVERY_BACKUP_VERSION ||
      payload.protocol !== SIGNAL_E2EE_PROTOCOL ||
      payload.userName !== normalizedUserName ||
      payload.securityDeviceId !== securityDeviceId ||
      typeof payload.snapshot !== "string" ||
      payload.snapshot.length < 100
    ) {
      throw new Error("Recovery backup không thuộc device Signal này.");
    }
    const storageKey = recordKey(normalizedUserName, securityDeviceId);
    if (await readStored(storageKey)) {
      throw new Error(
        "Signal device state hiện tại đã tồn tại; không ghi đè khi restore.",
      );
    }
    const wasm = await loadWasm();
    const device = wasm.SignalDevice.from_snapshot(payload.snapshot);
    const restoredBundle = JSON.parse(device.bundle_json()) as SignalBundle;
    const signalDeviceId = restoredBundle.device_id;
    const client = new ThuebotSignalClient(
      storageKey,
      normalizedUserName,
      securityDeviceId,
      signalDeviceId,
      device,
    );
    await client.persist();
    await client.publish();
    return client;
  }

  async persist(): Promise<void> {
    await persistDevice(
      this.storageKey,
      this.userName,
      this.securityDeviceId,
      this.signalDeviceId,
      this.device,
      (await readStored(this.storageKey)) ?? undefined,
    );
  }

  close(): void {
    this.device.free();
  }
}

export function generateSignalRecoveryKey(): string {
  assertBrowser();
  return base64Url(crypto.getRandomValues(new Uint8Array(48)));
}

export async function fetchSignalKeyBundles(
  userId: string,
): Promise<DirectoryResponse> {
  const normalized = userId.trim();
  if (!normalized) throw new Error("Signal recipient user id is required.");
  return api<DirectoryResponse>(
    `/api/e2ee/users/${encodeURIComponent(normalized)}/key-bundle`,
    { credentials: "include" },
  );
}

export async function createSignalConversation(
  recipientUserId: string,
  recipientDeviceIds?: string[],
): Promise<{
  conversationId: string;
  protocolVersion: string;
  members: Array<{ userId: string; deviceId: string; signalDeviceId: number }>;
  createdAt: string;
}> {
  return api("/api/e2ee/conversations", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({
      recipientUserId,
      ...(recipientDeviceIds ? { recipientDeviceIds } : {}),
    }),
  });
}

export async function sendSignalMessage(input: {
  conversationId: string;
  recipientDeviceId: string;
  clientMessageId: string;
  message: SignalMessage;
}): Promise<unknown> {
  return api(
    `/api/e2ee/conversations/${encodeURIComponent(input.conversationId)}/messages`,
    {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        protocolVersion: SIGNAL_E2EE_PROTOCOL,
        recipientDeviceId: input.recipientDeviceId,
        clientMessageId: input.clientMessageId,
        message: input.message,
      }),
    },
  );
}

export async function listSignalConversations(): Promise<SignalConversation[]> {
  return api<SignalConversation[]>("/api/e2ee/conversations", {
    credentials: "include",
  });
}

export async function fetchSignalMessages(
  conversationId: string,
  limit = 100,
): Promise<StoredSignalMessage[]> {
  const normalized = conversationId.trim();
  if (!normalized) throw new Error("Signal conversation id is required.");
  const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  return api<StoredSignalMessage[]>(
    `/api/e2ee/conversations/${encodeURIComponent(normalized)}/messages?limit=${boundedLimit}`,
    { credentials: "include" },
  );
}

export async function encryptSignalAttachment(
  client: ThuebotSignalClient,
  remoteUserName: string,
  remoteDeviceId: number,
  file: Blob,
): Promise<EncryptedSignalAttachment> {
  assertBrowser();
  if (!(file instanceof Blob))
    throw new Error("Encrypted attachment must be a Blob.");
  if (file.size + 16 > MAX_E2EE_ATTACHMENT_SIZE) {
    throw new Error("Encrypted attachment exceeds the 25 MB limit.");
  }

  const rawFileKey = crypto.getRandomValues(new Uint8Array(32));
  const aesKey = await crypto.subtle.importKey(
    "raw",
    rawFileKey.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    await file.arrayBuffer(),
  );
  const ciphertextBytes = new Uint8Array(encrypted);
  if (ciphertextBytes.byteLength > MAX_E2EE_ATTACHMENT_SIZE) {
    throw new Error("Encrypted attachment exceeds the 25 MB limit.");
  }

  // The file key exists in plaintext only inside this local call. It is
  // immediately wrapped in a Signal/PQXDH/Double-Ratchet message.
  const keyMessage = await client.encrypt(
    remoteUserName,
    remoteDeviceId,
    rawFileKey,
  );
  return {
    ciphertext: new Blob([ciphertextBytes], {
      type: "application/octet-stream",
    }),
    encryptedFileKey: JSON.stringify(keyMessage),
    keyMessage,
    nonce: base64Url(nonce),
    ciphertextSha256: await sha256Bytes(ciphertextBytes.buffer),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: ciphertextBytes.byteLength,
  };
}

export type UploadedSignalAttachment = SignalAttachmentDescriptor;

export async function uploadSignalAttachment(
  conversationId: string,
  attachment: EncryptedSignalAttachment,
): Promise<UploadedSignalAttachment> {
  const normalized = conversationId.trim();
  if (!normalized) throw new Error("Signal conversation id is required.");
  const body = new FormData();
  body.append("file", attachment.ciphertext, "e2ee.bin");
  body.append("mimeType", attachment.mimeType);
  body.append("encryptedFileKey", attachment.encryptedFileKey);
  body.append("nonce", attachment.nonce);
  body.append("ciphertextSha256", attachment.ciphertextSha256);
  const response = await fetchWithTimeout(
    `/api/e2ee/conversations/${encodeURIComponent(normalized)}/attachments`,
    { method: "POST", credentials: "include", body },
    60_000,
  );
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: UploadedSignalAttachment;
    error?: string;
    message?: string | string[];
  } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : Array.isArray(payload?.message)
          ? payload.message.join(" ")
          : payload?.message;
    throw new Error(
      message || `Encrypted attachment upload failed (${response.status}).`,
    );
  }
  return payload.data;
}

export async function downloadSignalAttachment(
  attachmentId: string,
): Promise<ArrayBuffer> {
  const normalized = attachmentId.trim();
  if (!normalized) throw new Error("Signal attachment id is required.");
  const response = await fetchWithTimeout(
    `/api/e2ee/attachments/${encodeURIComponent(normalized)}`,
    { credentials: "include" },
    60_000,
  );
  if (!response.ok)
    throw new Error(
      `Encrypted attachment download failed (${response.status}).`,
    );
  return response.arrayBuffer();
}

export async function decryptSignalAttachment(
  client: ThuebotSignalClient,
  remoteUserName: string,
  remoteDeviceId: number,
  descriptor: Pick<
    SignalAttachmentDescriptor,
    "mimeType" | "ciphertextSha256" | "encryptedFileKey" | "nonce"
  >,
  ciphertext: ArrayBuffer,
): Promise<Blob> {
  assertBrowser();
  const keyMessage = JSON.parse(descriptor.encryptedFileKey) as SignalMessage;
  if (keyMessage.message_type !== 2 && keyMessage.message_type !== 3) {
    throw new Error("Unsupported Signal attachment key message.");
  }
  const rawFileKey = await client.decrypt(
    remoteUserName,
    remoteDeviceId,
    keyMessage,
  );
  if (rawFileKey.byteLength !== 32)
    throw new Error("Signal attachment key has an invalid length.");
  const expectedDigest = descriptor.ciphertextSha256.toLowerCase();
  if (
    !/^[a-f0-9]{64}$/.test(expectedDigest) ||
    (await sha256Bytes(ciphertext)) !== expectedDigest
  ) {
    throw new Error("Encrypted attachment integrity check failed.");
  }
  const iv = decodeBase64Url(descriptor.nonce);
  if (iv.byteLength !== 12)
    throw new Error("E2EE nonce has an invalid length.");
  const aesKey = await crypto.subtle.importKey(
    "raw",
    rawFileKey.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext,
  );
  return new Blob([plaintext], {
    type: descriptor.mimeType || "application/octet-stream",
  });
}
