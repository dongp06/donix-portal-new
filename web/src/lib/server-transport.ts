import { createCipheriv, createDecipheriv, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { decodeCBOR, type CBORType } from '@levischuck/tiny-cbor';

const THB4_MAGIC = 'THB4';
const THB4_VERSION = 4;
const THB4_ALGORITHM = 1;
const THB4_HEADER_BYTES = 64;
const THB4_CONTENT_TYPE = 'application/x-thb';
const THB4_FLAG_CBOR = 1;
const THB4_ALLOWED_FLAGS = THB4_FLAG_CBOR | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4);
const THB4_MAX_CIPHERTEXT_BYTES = 70 * 1024 * 1024 + 16;
const THB4_TAG_BYTES = 16;
const TRANSPORT_CONFIG_PATH = '/api/transport/config';
const TRANSPORT_KEY_HEADER = 'X-TB-Transport-Key';
const TRANSPORT_KID_HEADER = 'X-TB-Transport-Kid';
const TRANSPORT_REQUEST_HEADER = 'X-TB-Transport-Request';
const TRANSPORT_SEQUENCE_HEADER = 'X-TB-Transport-Sequence';
const TRANSPORT_MODE_HEADER = 'X-TB-Transport-Mode';
const TRANSPORT_VERSION_HEADER = 'X-TB-Transport';
const TRANSPORT_SALT = Buffer.from('thuebot-transport-v1', 'utf8');
const TRANSPORT_DIRECTION_SALT = Buffer.from('thuebot-transport-direction-v1', 'utf8');
const TRANSPORT_REQUEST_SALT = Buffer.from('thuebot-transport-request-v1', 'utf8');
const TRANSPORT_ROOT_INFO = 'thuebot-transport-root:';
const MAX_SEQUENCE = BigInt('18446744073709551615');

type JsonRecord = Record<string, unknown>;

type TransportConfig = {
  protocolVersion: number;
  algorithm: number;
  kid: string;
  wireKid: string;
  publicKeyJwk: JsonWebKey;
};

const clientTransportKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const clientTransportPublicJwk = clientTransportKey.publicKey.export({ format: 'jwk' }) as JsonRecord;
let transportSequence = BigInt(0);
const transportConfigByOrigin = new Map<string, Promise<TransportConfig>>();
const directionalTransportKeys = new Map<string, { c2s: Buffer; s2c: Buffer; lastUsedAt: number }>();

function fail(message: string): never {
  throw new Error(message);
}

function isUnsafeMapKey(value: string): boolean {
  return value === '__proto__' || value === 'constructor' || value === 'prototype';
}

function base64Url(value: Buffer): string {
  return value.toString('base64url');
}

function decodeBase64Url(value: string): Buffer {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return fail('THB/4 base64 value is invalid.');
  return Buffer.from(value, 'base64url');
}

function wireKidFromBase64Url(value: string): Buffer {
  const result = decodeBase64Url(value);
  if (result.length !== 8) return fail('THB/4 wire key id must be 8 bytes.');
  return result;
}

function uuidToBytes(value: string): Buffer {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return fail('THB/4 request id must be a UUID.');
  }
  return Buffer.from(value.replaceAll('-', ''), 'hex');
}

function bytesToUuid(value: Buffer): string {
  if (value.length !== 16) return fail('THB/4 request id must be 16 bytes.');
  const hex = value.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function encodeHeader(input: {
  kind: 'request' | 'response';
  flags: number;
  wireKid: Buffer;
  requestId: string;
  nonce: Buffer;
  sequence: bigint;
  ciphertextLength: number;
}): Buffer {
  if (input.wireKid.length !== 8) return fail('THB/4 wire key id must be 8 bytes.');
  if (input.nonce.length !== 12) return fail('THB/4 nonce must be 12 bytes.');
  if (!Number.isInteger(input.ciphertextLength) || input.ciphertextLength < THB4_TAG_BYTES || input.ciphertextLength > THB4_MAX_CIPHERTEXT_BYTES) {
    return fail('THB/4 ciphertext length is invalid.');
  }
  if (input.sequence < BigInt(0) || input.sequence > MAX_SEQUENCE) return fail('THB/4 sequence is invalid.');
  const header = Buffer.alloc(THB4_HEADER_BYTES);
  header.write(THB4_MAGIC, 0, 'ascii');
  header.writeUInt8(THB4_VERSION, 4);
  header.writeUInt8(input.kind === 'request' ? 0 : 1, 5);
  header.writeUInt8(THB4_ALGORITHM, 6);
  header.writeUInt8(input.flags, 7);
  input.wireKid.copy(header, 8);
  uuidToBytes(input.requestId).copy(header, 16);
  input.nonce.copy(header, 32);
  header.writeBigUInt64BE(input.sequence, 44);
  header.writeUInt32BE(input.ciphertextLength, 52);
  return header;
}

function decodeFrame(value: Buffer): {
  kind: 'request' | 'response';
  flags: number;
  algorithm: number;
  wireKid: Buffer;
  requestId: string;
  nonce: Buffer;
  sequence: bigint;
  ciphertext: Buffer;
  header: Buffer;
} {
  if (!Buffer.isBuffer(value) || value.length < THB4_HEADER_BYTES + THB4_TAG_BYTES) return fail('THB/4 frame is incomplete.');
  if (value.toString('ascii', 0, 4) !== THB4_MAGIC) return fail('THB/4 magic is invalid.');
  if (value.readUInt8(4) !== THB4_VERSION) return fail('THB/4 version is invalid.');
  const kind = value.readUInt8(5);
  if (kind !== 0 && kind !== 1) return fail('THB/4 frame kind is invalid.');
  const algorithm = value.readUInt8(6);
  if (algorithm !== THB4_ALGORITHM) return fail('THB/4 algorithm is invalid.');
  const flags = value.readUInt8(7);
  if ((flags & ~THB4_ALLOWED_FLAGS) !== 0) return fail('THB/4 flags are invalid.');
  for (const byte of value.subarray(56, 64)) if (byte !== 0) return fail('THB/4 reserved bytes are not zero.');
  const ciphertextLength = value.readUInt32BE(52);
  if (ciphertextLength < THB4_TAG_BYTES || ciphertextLength > THB4_MAX_CIPHERTEXT_BYTES) return fail('THB/4 ciphertext length is invalid.');
  if (value.length !== THB4_HEADER_BYTES + ciphertextLength) return fail('THB/4 frame length does not match its header.');
  const header = Buffer.from(value.subarray(0, THB4_HEADER_BYTES));
  return {
    kind: kind === 0 ? 'request' : 'response',
    flags,
    algorithm,
    wireKid: Buffer.from(header.subarray(8, 16)),
    requestId: bytesToUuid(header.subarray(16, 32)),
    nonce: Buffer.from(header.subarray(32, 44)),
    sequence: header.readBigUInt64BE(44),
    ciphertext: Buffer.from(value.subarray(THB4_HEADER_BYTES)),
    header,
  };
}

function toCborValue(value: unknown): CBORType {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value;
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map((item) => toCborValue(item));
  if (typeof value === 'object') {
    const result = new Map<string, CBORType>();
    for (const key of Object.keys(value as JsonRecord).sort()) {
      if (isUnsafeMapKey(key)) return fail('THB/4 CBOR map key is reserved.');
      const item = (value as JsonRecord)[key];
      if (item !== undefined) result.set(key, toCborValue(item));
    }
    return result;
  }
  return fail('THB/4 payload contains an unsupported value.');
}

function fromCborValue(value: CBORType): unknown {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'bigint') {
    if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) return fail('THB/4 CBOR integer is outside the safe range.');
    return Number(value);
  }
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return value.map((item) => fromCborValue(item));
  if (value instanceof Map) {
    const result: JsonRecord = {};
    for (const [key, item] of value.entries()) {
      if (typeof key !== 'string') return fail('THB/4 CBOR map key is invalid.');
      if (isUnsafeMapKey(key)) return fail('THB/4 CBOR map key is reserved.');
      result[key] = fromCborValue(item);
    }
    return result;
  }
  return fail('THB/4 CBOR payload contains an unsupported value.');
}

function encodeCbor(value: unknown): Buffer {
  const chunks: Uint8Array[] = [];
  appendCbor(toCborValue(value), chunks);
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return Buffer.from(result);
}

const CBOR_UINT64_MAX = BigInt('18446744073709551615');

function cborLength(major: number, value: number | bigint): Uint8Array {
  const length = BigInt(value);
  if (length < BigInt(0) || length > CBOR_UINT64_MAX) return fail('THB/4 CBOR length is invalid.');
  if (length < BigInt(24)) return Uint8Array.from([(major << 5) | Number(length)]);
  if (length <= BigInt(0xff)) return Uint8Array.from([(major << 5) | 24, Number(length)]);
  if (length <= BigInt(0xffff)) {
    const result = new Uint8Array(3);
    result[0] = (major << 5) | 25;
    new DataView(result.buffer).setUint16(1, Number(length), false);
    return result;
  }
  if (length <= BigInt(0xffff_ffff)) {
    const result = new Uint8Array(5);
    result[0] = (major << 5) | 26;
    new DataView(result.buffer).setUint32(1, Number(length), false);
    return result;
  }
  const result = new Uint8Array(9);
  result[0] = (major << 5) | 27;
  new DataView(result.buffer).setBigUint64(1, length, false);
  return result;
}

function appendCbor(value: CBORType, chunks: Uint8Array[]): void {
  if (value === null || value === undefined) {
    chunks.push(Uint8Array.from([0xf6]));
    return;
  }
  if (typeof value === 'boolean') {
    chunks.push(Uint8Array.from([value ? 0xf5 : 0xf4]));
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      chunks.push(Uint8Array.from([0xf6]));
      return;
    }
    if (Number.isInteger(value) && Number.isSafeInteger(value)) {
      const integer = BigInt(value);
      chunks.push(cborLength(integer < BigInt(0) ? 1 : 0, integer < BigInt(0) ? -BigInt(1) - integer : integer));
      return;
    }
    const result = new Uint8Array(9);
    result[0] = 0xfb;
    new DataView(result.buffer).setFloat64(1, value, false);
    chunks.push(result);
    return;
  }
  if (typeof value === 'bigint') {
    chunks.push(cborLength(value < BigInt(0) ? 1 : 0, value < BigInt(0) ? -BigInt(1) - value : value));
    return;
  }
  if (typeof value === 'string') {
    const bytes = new TextEncoder().encode(value);
    chunks.push(cborLength(3, bytes.byteLength), bytes);
    return;
  }
  if (value instanceof Uint8Array) {
    const bytes = new Uint8Array(value.byteLength);
    bytes.set(value);
    chunks.push(cborLength(2, bytes.byteLength), bytes);
    return;
  }
  if (Array.isArray(value)) {
    chunks.push(cborLength(4, value.length));
    for (const item of value) appendCbor(item, chunks);
    return;
  }
  if (value instanceof Map) {
    chunks.push(cborLength(5, value.size));
    for (const [key, item] of value.entries()) {
      if (typeof key !== 'string') return fail('THB/4 CBOR map key is invalid.');
      appendCbor(key, chunks);
      appendCbor(item, chunks);
    }
    return;
  }
  return fail('THB/4 CBOR payload contains an unsupported value.');
}

function decodeCbor(value: Buffer): unknown {
  const bytes = new Uint8Array(value.length);
  bytes.set(value);
  return fromCborValue(decodeCBOR(bytes));
}

function directionalKeysFor(config: TransportConfig): { c2s: Buffer; s2c: Buffer; lastUsedAt: number } {
  const fingerprint = `${config.wireKid}:${config.publicKeyJwk.x ?? ''}:${config.publicKeyJwk.y ?? ''}`;
  const cached = directionalTransportKeys.get(fingerprint);
  const now = Date.now();
  if (cached) {
    cached.lastUsedAt = now;
    return cached;
  }
  for (const [key, value] of directionalTransportKeys) {
    if (now - value.lastUsedAt > 10 * 60_000) directionalTransportKeys.delete(key);
  }
  if (directionalTransportKeys.size >= 16) {
    const oldest = directionalTransportKeys.keys().next().value;
    if (oldest) directionalTransportKeys.delete(oldest);
  }
  const shared = diffieHellman({
    privateKey: clientTransportKey.privateKey,
    publicKey: createPublicKey({ key: config.publicKeyJwk as unknown as import('node:crypto').JsonWebKey, format: 'jwk' }),
  });
  const wireKid = wireKidFromBase64Url(config.wireKid);
  const wireKidHex = wireKid.toString('hex');
  const root = Buffer.from(hkdfSync('sha256', shared, TRANSPORT_SALT, Buffer.from(`${TRANSPORT_ROOT_INFO}${wireKidHex}`, 'utf8'), 32));
  const keys = {
    c2s: Buffer.from(hkdfSync('sha256', root, TRANSPORT_DIRECTION_SALT, Buffer.from(`thuebot-transport-direction:c2s:${wireKidHex}`, 'utf8'), 32)),
    s2c: Buffer.from(hkdfSync('sha256', root, TRANSPORT_DIRECTION_SALT, Buffer.from(`thuebot-transport-direction:s2c:${wireKidHex}`, 'utf8'), 32)),
    lastUsedAt: now,
  };
  directionalTransportKeys.set(fingerprint, keys);
  return keys;
}

function deriveTransportKey(config: TransportConfig, requestId: string, sequence: bigint, direction: 'c2s' | 's2c'): Buffer {
  const directional = directionalKeysFor(config)[direction];
  const wireKid = wireKidFromBase64Url(config.wireKid);
  return Buffer.from(hkdfSync('sha256', directional, TRANSPORT_REQUEST_SALT, Buffer.from(`thuebot-transport-request:${requestId}:${sequence.toString()}`, 'utf8'), 32));
}

function nextSequence(): bigint {
  transportSequence = transportSequence >= MAX_SEQUENCE ? BigInt(1) : transportSequence + BigInt(1);
  return transportSequence;
}

async function loadTransportConfig(origin: string): Promise<TransportConfig> {
  let pending = transportConfigByOrigin.get(origin);
  if (!pending) {
    pending = fetch(`${origin}${TRANSPORT_CONFIG_PATH}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }).then(async (response) => {
      const body = await response.json().catch(() => null) as { success?: boolean; data?: TransportConfig } | null;
      const config = body?.data;
      if (!response.ok || !body?.success || !config || config.protocolVersion !== THB4_VERSION || config.algorithm !== THB4_ALGORITHM || !config.kid || !config.publicKeyJwk || !/^[A-Za-z0-9_-]{11}$/.test(config.wireKid)) {
        throw new Error('THB/4 transport configuration is invalid.');
      }
      return config;
    }).catch((error) => {
      transportConfigByOrigin.delete(origin);
      throw error;
    });
    transportConfigByOrigin.set(origin, pending);
  }
  return pending;
}

function encryptRequest(config: TransportConfig, requestId: string, sequence: bigint, body: Buffer, flags: number): Buffer {
  const wireKid = wireKidFromBase64Url(config.wireKid);
  const nonce = randomBytes(12);
  const header = encodeHeader({ kind: 'request', flags, wireKid, requestId, nonce, sequence, ciphertextLength: body.length + THB4_TAG_BYTES });
  const cipher = createCipheriv('aes-256-gcm', deriveTransportKey(config, requestId, sequence, 'c2s'), nonce);
  cipher.setAAD(header);
  return Buffer.concat([header, cipher.update(body), cipher.final(), cipher.getAuthTag()]);
}

function decryptResponse(config: TransportConfig, frame: ReturnType<typeof decodeFrame>): Buffer {
  const expectedKid = wireKidFromBase64Url(config.wireKid);
  if (frame.kind !== 'response' || frame.algorithm !== THB4_ALGORITHM || !frame.wireKid.equals(expectedKid)) return fail('THB/4 response binding is invalid.');
  const authTag = frame.ciphertext.subarray(frame.ciphertext.length - THB4_TAG_BYTES);
  const ciphertext = frame.ciphertext.subarray(0, frame.ciphertext.length - THB4_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', deriveTransportKey(config, frame.requestId, frame.sequence, 's2c'), frame.nonce);
  decipher.setAAD(frame.header);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return fail('THB/4 response failed authentication.');
  }
}

function responseHeaders(response: Response, contentType: string): Headers {
  const headers = new Headers(response.headers);
  for (const name of ['content-length', 'content-encoding', 'x-tb-transport', 'x-tb-transport-content-type']) headers.delete(name);
  headers.set('content-type', contentType);
  return headers;
}

async function decryptTransportResponse(response: Response, config: TransportConfig, requestId: string, sequence: bigint): Promise<Response> {
  if (response.headers.get('x-tb-transport') !== 'binary') return response;
  const frame = decodeFrame(Buffer.from(await response.arrayBuffer()));
  if (frame.requestId !== requestId || frame.sequence !== sequence) return fail('THB/4 response request binding is invalid.');
  const plaintext = decryptResponse(config, frame);
  const originalContentType = response.headers.get('x-tb-transport-content-type') || ((frame.flags & THB4_FLAG_CBOR) !== 0 ? 'application/json; charset=utf-8' : 'application/octet-stream');
  if ((frame.flags & THB4_FLAG_CBOR) !== 0) {
    return new Response(JSON.stringify(decodeCbor(plaintext)), {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders(response, originalContentType),
    });
  }
  return new Response(new Uint8Array(plaintext), {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response, originalContentType),
  });
}

async function transportRecoveryRequired(response: Response): Promise<boolean> {
  if (response.status !== 400 && response.status !== 409 && response.status !== 426) return false;
  const body = await response.clone().json().catch(() => null) as { code?: unknown } | null;
  return body?.code === 'TRANSPORT_REQUIRED'
    || body?.code === 'TRANSPORT_NEGOTIATION_REQUIRED'
    || body?.code === 'TRANSPORT_KEY_ROTATED'
    || body?.code === 'TRANSPORT_SEQUENCE_REPLAYED'
    || body?.code === 'TRANSPORT_REPLAYED';
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * Server-only fetch for Next server components. It negotiates one in-memory
 * ECDH transport identity, sends THB/4 frames, and restores the normal JSON
 * or binary Response contract for callers.
 */
export async function serverTransportFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  allowTransportRecovery = true,
): Promise<Response> {
  const target = requestUrl(input);
  const url = new URL(target, process.env.API_URL || 'http://localhost:3002');
  if (url.pathname === TRANSPORT_CONFIG_PATH) return fetch(url, init);

  const config = await loadTransportConfig(url.origin);
  const requestId = randomUUID();
  const sequence = nextSequence();
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const contentType = headers.get('content-type') || '';
  let body: BodyInit | null | undefined = init.body;
  let mode: 'encrypted' | 'response-only' = 'response-only';
  if (typeof body === 'string' && contentType.toLowerCase().includes('json')) {
    const encryptedBody = encryptRequest(config, requestId, sequence, encodeCbor(JSON.parse(body)), THB4_FLAG_CBOR);
    body = encryptedBody.buffer.slice(encryptedBody.byteOffset, encryptedBody.byteOffset + encryptedBody.byteLength) as ArrayBuffer;
    headers.set('content-type', THB4_CONTENT_TYPE);
    mode = 'encrypted';
  }
  headers.set(TRANSPORT_VERSION_HEADER, String(THB4_VERSION));
  headers.set(TRANSPORT_KEY_HEADER, base64Url(Buffer.from(JSON.stringify(clientTransportPublicJwk), 'utf8')));
  headers.set(TRANSPORT_KID_HEADER, config.wireKid);
  headers.set(TRANSPORT_REQUEST_HEADER, requestId);
  headers.set(TRANSPORT_SEQUENCE_HEADER, sequence.toString());
  headers.set(TRANSPORT_MODE_HEADER, mode);
  if (!headers.has('accept')) headers.set('accept', THB4_CONTENT_TYPE);

  const requestInit: RequestInit = { ...init, method, headers };
  if (body !== undefined) requestInit.body = body;
  const response = await fetch(url, requestInit);
  const decoded = await decryptTransportResponse(response, config, requestId, sequence);
  if (allowTransportRecovery && await transportRecoveryRequired(decoded)) {
    // API restarts rotate the ephemeral server transport key. Drop both the
    // stale config and derived-key cache, then retry exactly once. A second
    // failure is returned to the caller so a persistent protocol fault cannot
    // turn into an unbounded RSC retry loop.
    transportConfigByOrigin.delete(url.origin);
    directionalTransportKeys.clear();
    return serverTransportFetch(input, init, false);
  }
  return decoded;
}
