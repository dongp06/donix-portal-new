import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { Transform } from 'node:stream';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  TRANSPORT_ALGORITHM,
  TRANSPORT_CONFIG_PATH,
  TRANSPORT_ENVELOPE_CONTENT_TYPE,
  TRANSPORT_VERSION,
} from './config.js';
import { AppError } from './errors.js';
import { base64UrlToBuffer, canonicalJson, header } from './crypto.js';
import {
  THB4_CONTENT_TYPE,
  THB4_FLAG_CBOR,
  THB4_FLAG_ERROR,
  THB4_HEADER_BYTES,
  THB4_MAX_CIPHERTEXT_BYTES,
  bytesToUuid,
  decodeCbor,
  decodeFrame,
  encodeCbor,
  encodeHeader,
  type Thb4Frame,
  uuidToBytes,
  wireKidToBase64Url,
} from './thb4.js';

type JsonRecord = Record<string, unknown>;

export type TransportContext = {
  clientPublicJwk: JsonRecord;
  kid: string;
  wireKid: Buffer;
  requestId: string;
  sequence: bigint;
  encryptedRequest: boolean;
  sequenceAccepted?: boolean;
};

const CLIENT_KEY_HEADER = 'x-tb-transport-key';
const CLIENT_KID_HEADER = 'x-tb-transport-kid';
const REQUEST_ID_HEADER = 'x-tb-transport-request';
const SEQUENCE_HEADER = 'x-tb-transport-sequence';
const MODE_HEADER = 'x-tb-transport-mode';
const KEY_SALT = Buffer.from('thuebot-transport-v1', 'utf8');
const DIRECTION_SALT = Buffer.from('thuebot-transport-direction-v1', 'utf8');
const REQUEST_SALT = Buffer.from('thuebot-transport-request-v1', 'utf8');
const KEY_INFO_PREFIX = 'thuebot-transport-root:';
const STREAM_TAG_BYTES = 16;
const REQUEST_SEQUENCE_WINDOW_MS = 5 * 60_000;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result && result.length <= max ? result : null;
}

function parseSequence(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d{1,20}$/.test(value)) {
    throw new AppError('TRANSPORT_SEQUENCE_INVALID', 'Transport sequence is invalid.', 400);
  }
  try {
    const sequence = BigInt(value);
    if (sequence < 0n || sequence > 0xffff_ffff_ffff_ffffn) throw new Error('range');
    return sequence;
  } catch {
    throw new AppError('TRANSPORT_SEQUENCE_INVALID', 'Transport sequence is invalid.', 400);
  }
}

function deriveKeyId(publicJwk: JsonRecord): string {
  const digest = createHash('sha256').update(canonicalJson(publicJwk), 'utf8').digest('hex').slice(0, 20);
  return `thb-transport-${digest}`;
}

function deriveWireKid(publicJwk: JsonRecord): Buffer {
  return createHash('sha256').update(canonicalJson(publicJwk), 'utf8').digest().subarray(0, 8);
}

function parsePrivateJwk(): JsonRecord | null {
  const raw = process.env.THB_TRANSPORT_PRIVATE_JWK?.trim();
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as JsonRecord;
  } catch {
    throw new Error('THB_TRANSPORT_PRIVATE_JWK must contain valid JSON.');
  }
}

function validateClientKey(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('TRANSPORT_KEY_INVALID', 'Transport public key is invalid.', 400);
  }
  const input = value as JsonRecord;
  if (
    input.kty !== 'EC' ||
    input.crv !== 'P-256' ||
    typeof input.x !== 'string' ||
    typeof input.y !== 'string' ||
    !/^[A-Za-z0-9_-]{20,100}={0,2}$/.test(input.x) ||
    !/^[A-Za-z0-9_-]{20,100}={0,2}$/.test(input.y)
  ) {
    throw new AppError('TRANSPORT_KEY_INVALID', 'Transport public key is invalid.', 400);
  }
  try {
    const key = createPublicKey({
      key: { ...input, x: input.x.replace(/=+$/g, ''), y: input.y.replace(/=+$/g, '') },
      format: 'jwk',
    });
    return key.export({ format: 'jwk' }) as JsonRecord;
  } catch {
    throw new AppError('TRANSPORT_KEY_INVALID', 'Transport public key is invalid.', 400);
  }
}

function sharedSecret(serverPrivateKey: KeyObject, clientPublicJwk: JsonRecord): Buffer {
  const clientPublicKey = createPublicKey({ key: clientPublicJwk, format: 'jwk' });
  return diffieHellman({ privateKey: serverPrivateKey, publicKey: clientPublicKey });
}

type DirectionalTransportKeys = {
  c2s: Buffer;
  s2c: Buffer;
  lastUsedAt: number;
};

function deriveDirectionalKeys(
  serverPrivateKey: KeyObject,
  clientPublicJwk: JsonRecord,
  wireKid: Buffer,
): Omit<DirectionalTransportKeys, 'lastUsedAt'> {
  const wireKidHex = wireKid.toString('hex');
  const shared = sharedSecret(serverPrivateKey, clientPublicJwk);
  const root = Buffer.from(hkdfSync('sha256', shared, KEY_SALT, Buffer.from(`${KEY_INFO_PREFIX}${wireKidHex}`, 'utf8'), 32));
  return {
    c2s: Buffer.from(hkdfSync('sha256', root, DIRECTION_SALT, Buffer.from(`thuebot-transport-direction:c2s:${wireKidHex}`, 'utf8'), 32)),
    s2c: Buffer.from(hkdfSync('sha256', root, DIRECTION_SALT, Buffer.from(`thuebot-transport-direction:s2c:${wireKidHex}`, 'utf8'), 32)),
  };
}

function deriveRequestKey(
  directional: Buffer,
  requestId: string,
  sequence: bigint,
): Buffer {
  return Buffer.from(hkdfSync('sha256', directional, REQUEST_SALT, Buffer.from(`thuebot-transport-request:${requestId}:${sequence.toString()}`, 'utf8'), 32));
}

function readable(value: unknown): value is NodeJS.ReadableStream {
  return Boolean(value && typeof value === 'object' && typeof (value as { pipe?: unknown }).pipe === 'function');
}

function headerNumber(reply: FastifyReply, name: string): number | null {
  const value = reply.getHeader(name);
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export class TransportService {
  private readonly serverPrivateKey: KeyObject;
  private readonly serverPublicJwk: JsonRecord;
  private readonly kid: string;
  private readonly wireKid: Buffer;
  private readonly wireKidText: string;
  private readonly seenRequests = new Map<string, number>();
  private readonly seenSequences = new Map<string, number>();
  private readonly directionalKeyCache = new Map<string, DirectionalTransportKeys>();

  constructor() {
    const configured = parsePrivateJwk();
    if (configured) {
      this.serverPrivateKey = createPrivateKey({ key: configured, format: 'jwk' });
      this.serverPublicJwk = createPublicKey(this.serverPrivateKey).export({ format: 'jwk' }) as JsonRecord;
    } else {
      const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      this.serverPrivateKey = pair.privateKey;
      this.serverPublicJwk = pair.publicKey.export({ format: 'jwk' }) as JsonRecord;
    }
    this.kid = text(process.env.THB_TRANSPORT_KID, 100) || deriveKeyId(this.serverPublicJwk);
    this.wireKid = deriveWireKid(this.serverPublicJwk);
    this.wireKidText = wireKidToBase64Url(this.wireKid);
  }

  config() {
    return {
      protocolVersion: TRANSPORT_VERSION,
      algorithm: TRANSPORT_ALGORITHM,
      kid: this.kid,
      wireKid: this.wireKidText,
      publicKeyJwk: this.serverPublicJwk,
    };
  }

  private requestKey(context: TransportContext, direction: 'c2s' | 's2c'): Buffer {
    const clientKey = createHash('sha256').update(canonicalJson(context.clientPublicJwk), 'utf8').digest('hex');
    const now = Date.now();
    for (const [key, value] of this.directionalKeyCache) {
      if (now - value.lastUsedAt > 10 * 60_000) this.directionalKeyCache.delete(key);
    }
    let keys = this.directionalKeyCache.get(clientKey);
    if (!keys) {
      if (this.directionalKeyCache.size >= 256) {
        const oldest = this.directionalKeyCache.keys().next().value;
        if (oldest) this.directionalKeyCache.delete(oldest);
      }
      keys = { ...deriveDirectionalKeys(this.serverPrivateKey, context.clientPublicJwk, context.wireKid), lastUsedAt: now };
      this.directionalKeyCache.set(clientKey, keys);
    } else {
      keys.lastUsedAt = now;
    }
    return deriveRequestKey(keys[direction], context.requestId, context.sequence);
  }

  attachRequestMetadata(request: FastifyRequest, options: { allowCleartextFallback?: boolean } = {}): void {
    const rawKey = header(request, CLIENT_KEY_HEADER);
    const rawKid = header(request, CLIENT_KID_HEADER);
    const rawRequestId = header(request, REQUEST_ID_HEADER);
    const rawSequence = header(request, SEQUENCE_HEADER);
    const mode = header(request, MODE_HEADER) || '';
    if (!rawKey && !rawKid && !rawRequestId && !rawSequence) return;
    // A partial set of transport headers means the client never completed
    // negotiation.  A complete set with an old wire kid is a different case:
    // the API key rotated (normally after an API restart) and the browser can
    // safely discard its cached transport material and negotiate again.
    if (!rawKey || !rawKid || !rawRequestId || !rawSequence) {
      // Device enrollment is the one authenticated bootstrap operation that
      // may fall back to ordinary JSON over the already protected HTTP/TLS
      // channel. This makes a stale/partially-written browser transport state
      // recoverable without weakening any business mutation route.
      if (options.allowCleartextFallback && !String(request.headers['content-type'] ?? '').toLowerCase().includes(TRANSPORT_ENVELOPE_CONTENT_TYPE)) return;
      throw new AppError('TRANSPORT_NEGOTIATION_REQUIRED', 'Transport key negotiation is required.', 400);
    }
    if (rawKid !== this.wireKidText) {
      throw new AppError('TRANSPORT_KEY_ROTATED', 'Transport key has rotated; retry negotiation.', 400);
    }
    let publicJwk: JsonRecord;
    try {
      publicJwk = validateClientKey(JSON.parse(base64UrlToBuffer(rawKey).toString('utf8')));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('TRANSPORT_KEY_INVALID', 'Transport public key is invalid.', 400);
    }
    try {
      uuidToBytes(rawRequestId);
    } catch {
      throw new AppError('TRANSPORT_REQUEST_ID_INVALID', 'Transport request id is invalid.', 400);
    }
    request.transport = {
      clientPublicJwk: publicJwk,
      kid: this.kid,
      wireKid: Buffer.from(this.wireKid),
      requestId: rawRequestId,
      sequence: parseSequence(rawSequence),
      encryptedRequest: mode === 'encrypted',
    };
  }

  decryptRequestBody(request: FastifyRequest): void {
    const context = request.transport;
    if (!context?.encryptedRequest) return;
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError('TRANSPORT_FRAME_INVALID', 'THB/4 request frame is invalid.', 400);
    }
    let frame: Thb4Frame;
    try {
      frame = decodeFrame(request.body);
    } catch {
      throw new AppError('TRANSPORT_FRAME_INVALID', 'THB/4 request frame is invalid.', 400);
    }
    if (
      frame.kind !== 'request' ||
      frame.algorithm !== TRANSPORT_ALGORITHM ||
      (frame.flags & THB4_FLAG_CBOR) === 0 ||
      !frame.wireKid.equals(context.wireKid) ||
      frame.requestId !== context.requestId ||
      frame.sequence !== context.sequence
    ) {
      throw new AppError('TRANSPORT_REQUEST_MISMATCH', 'Transport request metadata does not match.', 400);
    }
    const plaintext = this.decrypt(frame, context, 'c2s');
    let decoded: unknown;
    try {
      decoded = decodeCbor(plaintext);
    } catch {
      throw new AppError('TRANSPORT_CBOR_INVALID', 'Transport payload is not valid CBOR.', 400);
    }
    this.acceptSequence(context);
    context.sequenceAccepted = true;
    request.body = decoded;
  }

  async encryptOnSend(request: FastifyRequest, reply: FastifyReply, payload: unknown): Promise<unknown> {
    const context = request.transport;
    if (!context || request.method === 'HEAD' || reply.statusCode === 204) return payload;
    if (payload === null || payload === undefined) return payload;
    if (!context.sequenceAccepted) {
      this.acceptSequence(context);
      context.sequenceAccepted = true;
    }

    const contentType = String(reply.getHeader('content-type') || 'application/json; charset=utf-8');
    const isJson = contentType.toLowerCase().includes('json');
    if (readable(payload)) {
      const contentLength = headerNumber(reply, 'content-length');
      // A negotiated transport response must never silently fall back to
      // cleartext merely because a stream omitted Content-Length. Routes that
      // need encrypted streaming must provide a bounded length; otherwise
      // fail closed instead of leaking the payload.
      if (contentLength === null) throw new AppError('TRANSPORT_STREAM_LENGTH_REQUIRED', 'Encrypted streaming responses require a content length.', 500);
      if (contentLength + STREAM_TAG_BYTES > THB4_MAX_CIPHERTEXT_BYTES) throw new AppError('TRANSPORT_STREAM_TOO_LARGE', 'Encrypted streaming response is too large.', 413);
      return this.encryptStreamResponse(request, reply, payload, contentType, contentLength);
    }

    const raw = Buffer.isBuffer(payload)
      ? payload
      : payload instanceof Uint8Array
        ? Buffer.from(payload)
        : Buffer.from(String(payload), 'utf8');
    const plaintext = isJson ? this.encodeJsonResponse(raw) : raw;
    const flags = (isJson ? THB4_FLAG_CBOR : 0) | (reply.statusCode >= 400 ? THB4_FLAG_ERROR : 0);
    const frame = this.encryptFrame(request, plaintext, flags, 's2c');
    this.setBinaryResponseHeaders(reply, contentType, frame.length);
    return frame;
  }

  private encodeJsonResponse(raw: Buffer): Buffer {
    try {
      return encodeCbor(JSON.parse(raw.toString('utf8')));
    } catch {
      throw new AppError('TRANSPORT_JSON_INVALID', 'Transport response is not valid JSON.', 500);
    }
  }

  private encryptStreamResponse(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: NodeJS.ReadableStream,
    contentType: string,
    contentLength: number,
  ): Transform {
    const context = request.transport!;
    const nonce = randomBytes(12);
    const flags = reply.statusCode >= 400 ? THB4_FLAG_ERROR : 0;
    const headerBytes = encodeHeader({
      kind: 'response',
      flags,
      wireKid: context.wireKid,
      requestId: context.requestId,
      nonce,
      sequence: context.sequence,
      ciphertextLength: contentLength + STREAM_TAG_BYTES,
    });
    const key = this.requestKey(context, 's2c');
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(headerBytes);
    let copied = 0;
    let started = false;
    const transform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        try {
          if (!started) {
            this.push(headerBytes);
            started = true;
          }
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          copied += buffer.length;
          this.push(cipher.update(buffer));
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
      flush: (callback) => {
        try {
          if (!started) {
            transform.push(headerBytes);
            started = true;
          }
          if (copied !== contentLength) throw new Error('THB/4 stream length changed while sending.');
          transform.push(cipher.final());
          transform.push(cipher.getAuthTag());
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    });
    payload.on('error', (error) => transform.destroy(error as Error));
    payload.pipe(transform);
    this.setBinaryResponseHeaders(reply, contentType, THB4_HEADER_BYTES + contentLength + STREAM_TAG_BYTES);
    return transform;
  }

  private setBinaryResponseHeaders(reply: FastifyReply, contentType: string, frameLength: number): void {
    reply.header('content-type', THB4_CONTENT_TYPE);
    reply.header('content-length', frameLength);
    reply.header('x-tb-transport', 'binary');
    reply.header('x-tb-transport-content-type', contentType);
    reply.removeHeader('content-encoding');
  }

  private encryptFrame(request: FastifyRequest, plaintext: Buffer, flags: number, direction: 'c2s' | 's2c'): Buffer {
    const context = request.transport!;
    if (plaintext.length + 16 > THB4_MAX_CIPHERTEXT_BYTES) throw new AppError('TRANSPORT_FRAME_TOO_LARGE', 'THB/4 frame is too large.', 413);
    const nonce = randomBytes(12);
    const headerBytes = encodeHeader({
      kind: 'response',
      flags,
      wireKid: context.wireKid,
      requestId: context.requestId,
      nonce,
      sequence: context.sequence,
      ciphertextLength: plaintext.length + 16,
    });
    const key = this.requestKey(context, direction);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(headerBytes);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
    return Buffer.concat([headerBytes, ciphertext]);
  }

  private decrypt(frame: Thb4Frame, context: TransportContext, direction: 'c2s' | 's2c'): Buffer {
    if (!frame.wireKid.equals(this.wireKid)) throw new AppError('TRANSPORT_KEY_ROTATED', 'Transport key has rotated; retry negotiation.', 400);
    if (frame.ciphertext.length < 16 || frame.ciphertext.length > THB4_MAX_CIPHERTEXT_BYTES) throw new AppError('TRANSPORT_CIPHERTEXT_INVALID', 'Transport ciphertext is invalid.', 400);
    const key = this.requestKey(context, direction);
    const authTag = frame.ciphertext.subarray(frame.ciphertext.length - 16);
    const body = frame.ciphertext.subarray(0, frame.ciphertext.length - 16);
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, frame.nonce);
      decipher.setAAD(frame.header);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(body), decipher.final()]);
    } catch {
      throw new AppError('TRANSPORT_DECRYPT_FAILED', 'Transport payload could not be authenticated.', 400);
    }
  }

  private acceptSequence(context: TransportContext): void {
    const clientKey = createHash('sha256').update(canonicalJson(context.clientPublicJwk), 'utf8').digest('hex');
    const seenKey = `${clientKey}:${context.sequence.toString()}:${context.requestId}`;
    const sequenceKey = `${clientKey}:${context.sequence.toString()}`;
    const now = Date.now();
    for (const [key, timestamp] of this.seenRequests) {
      if (now - timestamp > REQUEST_SEQUENCE_WINDOW_MS) this.seenRequests.delete(key);
    }
    for (const [key, timestamp] of this.seenSequences) {
      if (now - timestamp > REQUEST_SEQUENCE_WINDOW_MS) this.seenSequences.delete(key);
    }
    if (this.seenRequests.has(seenKey)) throw new AppError('TRANSPORT_REPLAYED', 'Transport request was replayed.', 409);
    // Requests from multiple tabs and concurrent fetches can arrive out of
    // order. A high-water rejection treats that legitimate reordering as a
    // replay. Track the exact sequence instead: duplicate frames still fail,
    // while distinct reserved sequences remain safe and idempotent.
    if (this.seenSequences.has(sequenceKey)) throw new AppError('TRANSPORT_SEQUENCE_REPLAYED', 'Transport sequence was already used.', 409);
    this.seenRequests.set(seenKey, now);
    this.seenSequences.set(sequenceKey, now);
  }
}

export { TRANSPORT_CONFIG_PATH, TRANSPORT_ENVELOPE_CONTENT_TYPE, bytesToUuid };
