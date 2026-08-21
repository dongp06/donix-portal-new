import { decodeCBOR, type CBORType } from '@levischuck/tiny-cbor';

export const THB4_MAGIC = 'THB4';
export const THB4_VERSION = 4;
export const THB4_ALGORITHM = 1;
export const THB4_HEADER_BYTES = 64;
export const THB4_CONTENT_TYPE = 'application/x-thb';
export const THB4_FLAG_CBOR = 1 << 0;
export const THB4_FLAG_COMPRESSED = 1 << 1;
export const THB4_FLAG_ERROR = 1 << 2;
export const THB4_FLAG_CRITICAL = 1 << 3;
export const THB4_FLAG_SIGNED = 1 << 4;
export const THB4_ALLOWED_FLAGS =
  THB4_FLAG_CBOR |
  THB4_FLAG_COMPRESSED |
  THB4_FLAG_ERROR |
  THB4_FLAG_CRITICAL |
  THB4_FLAG_SIGNED;
export const THB4_MAX_CIPHERTEXT_BYTES = 70 * 1024 * 1024 + 16;

export type Thb4Kind = 'request' | 'response';

export type Thb4Frame = {
  kind: Thb4Kind;
  algorithm: number;
  flags: number;
  wireKid: Buffer;
  requestId: string;
  requestIdBytes: Buffer;
  nonce: Buffer;
  sequence: bigint;
  ciphertext: Buffer;
  header: Buffer;
};

function fail(message: string): never {
  throw new Error(message);
}

function isUnsafeMapKey(value: string): boolean {
  return value === '__proto__' || value === 'constructor' || value === 'prototype';
}

export function wireKidFromBase64Url(value: string): Buffer {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(value)) {
    return fail('THB/4 wire key id is invalid.');
  }
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const result = Buffer.from(`${normalized}=`, 'base64');
  if (result.length !== 8) return fail('THB/4 wire key id must be 8 bytes.');
  return result;
}

export function wireKidToBase64Url(value: Buffer): string {
  if (value.length !== 8) return fail('THB/4 wire key id must be 8 bytes.');
  return value.toString('base64url');
}

export function uuidToBytes(value: string): Buffer {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    return fail('THB/4 request id must be a UUID.');
  }
  return Buffer.from(value.replaceAll('-', ''), 'hex');
}

export function bytesToUuid(value: Buffer): string {
  if (value.length !== 16) return fail('THB/4 request id must be 16 bytes.');
  const hex = value.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function encodeHeader(input: {
  kind: Thb4Kind;
  flags: number;
  wireKid: Buffer;
  requestId: string;
  nonce: Buffer;
  sequence: bigint | number;
  ciphertextLength: number;
}): Buffer {
  if (input.wireKid.length !== 8) return fail('THB/4 wire key id must be 8 bytes.');
  const requestId = uuidToBytes(input.requestId);
  if (input.nonce.length !== 12) return fail('THB/4 nonce must be 12 bytes.');
  if (!Number.isInteger(input.flags) || input.flags < 0 || (input.flags & ~THB4_ALLOWED_FLAGS) !== 0) {
    return fail('THB/4 flags are invalid.');
  }
  if (!Number.isInteger(input.ciphertextLength) || input.ciphertextLength < 16 || input.ciphertextLength > THB4_MAX_CIPHERTEXT_BYTES) {
    return fail('THB/4 ciphertext length is invalid.');
  }
  const sequence = BigInt(input.sequence);
  if (sequence < 0n || sequence > 0xffff_ffff_ffff_ffffn) return fail('THB/4 sequence is invalid.');

  const header = Buffer.alloc(THB4_HEADER_BYTES);
  header.write(THB4_MAGIC, 0, 'ascii');
  header.writeUInt8(THB4_VERSION, 4);
  header.writeUInt8(input.kind === 'request' ? 0 : 1, 5);
  header.writeUInt8(THB4_ALGORITHM, 6);
  header.writeUInt8(input.flags, 7);
  input.wireKid.copy(header, 8);
  requestId.copy(header, 16);
  input.nonce.copy(header, 32);
  header.writeBigUInt64BE(sequence, 44);
  header.writeUInt32BE(input.ciphertextLength, 52);
  return header;
}

export function encodeFrame(input: {
  kind: Thb4Kind;
  flags: number;
  wireKid: Buffer;
  requestId: string;
  nonce: Buffer;
  sequence: bigint | number;
  ciphertext: Buffer;
}): Buffer {
  const header = encodeHeader({
    ...input,
    ciphertextLength: input.ciphertext.length,
  });
  return Buffer.concat([header, input.ciphertext]);
}

export function decodeFrame(value: Buffer): Thb4Frame {
  if (!Buffer.isBuffer(value) || value.length < THB4_HEADER_BYTES + 16) {
    return fail('THB/4 frame is incomplete.');
  }
  if (value.toString('ascii', 0, 4) !== THB4_MAGIC) return fail('THB/4 magic is invalid.');
  if (value.readUInt8(4) !== THB4_VERSION) return fail('THB/4 version is invalid.');
  const kindValue = value.readUInt8(5);
  if (kindValue !== 0 && kindValue !== 1) return fail('THB/4 frame kind is invalid.');
  const algorithm = value.readUInt8(6);
  if (algorithm !== THB4_ALGORITHM) return fail('THB/4 algorithm is invalid.');
  const flags = value.readUInt8(7);
  if ((flags & ~THB4_ALLOWED_FLAGS) !== 0) return fail('THB/4 flags are invalid.');
  if (!value.subarray(56, 64).every((byte) => byte === 0)) return fail('THB/4 reserved bytes are not zero.');
  const ciphertextLength = value.readUInt32BE(52);
  if (ciphertextLength < 16 || ciphertextLength > THB4_MAX_CIPHERTEXT_BYTES) return fail('THB/4 ciphertext length is invalid.');
  if (value.length !== THB4_HEADER_BYTES + ciphertextLength) return fail('THB/4 frame length does not match its header.');

  const header = Buffer.from(value.subarray(0, THB4_HEADER_BYTES));
  const requestIdBytes = Buffer.from(header.subarray(16, 32));
  return {
    kind: kindValue === 0 ? 'request' : 'response',
    algorithm,
    flags,
    wireKid: Buffer.from(header.subarray(8, 16)),
    requestId: bytesToUuid(requestIdBytes),
    requestIdBytes,
    nonce: Buffer.from(header.subarray(32, 44)),
    sequence: header.readBigUInt64BE(44),
    ciphertext: Buffer.from(value.subarray(THB4_HEADER_BYTES)),
    header,
  };
}

function toCborValue(value: unknown): CBORType {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === 'bigint') return value;
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map((item) => toCborValue(item));
  if (typeof value === 'object') {
    const map = new Map<string, CBORType>();
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (isUnsafeMapKey(key)) return fail('THB/4 CBOR map key is reserved.');
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) map.set(key, toCborValue(item));
    }
    return map;
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
    const result: Record<string, unknown> = {};
    for (const [key, item] of value.entries()) {
      if (typeof key !== 'string') return fail('THB/4 CBOR map key is invalid.');
      if (isUnsafeMapKey(key)) return fail('THB/4 CBOR map key is reserved.');
      result[key] = fromCborValue(item);
    }
    return result;
  }
  return fail('THB/4 CBOR payload contains an unsupported value.');
}

export function encodeCbor(value: unknown): Buffer {
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

export function decodeCbor(value: Buffer): unknown {
  // tiny-cbor validates byteLength but does not account for a Node Buffer's
  // slab byteOffset. Copy into an exact Uint8Array before decoding.
  const bytes = new Uint8Array(value.length);
  bytes.set(value);
  return fromCborValue(decodeCBOR(bytes));
}
