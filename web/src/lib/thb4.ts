import { decodeCBOR, type CBORType } from "@levischuck/tiny-cbor";

export const THB4_MAGIC = "THB4";
export const THB4_VERSION = 4;
export const THB4_ALGORITHM = 1;
export const THB4_HEADER_BYTES = 64;
export const THB4_CONTENT_TYPE = "application/x-thb";
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

export type Thb4Kind = "request" | "response";

export type Thb4Frame = {
  kind: Thb4Kind;
  algorithm: number;
  flags: number;
  wireKid: Uint8Array<ArrayBuffer>;
  requestId: string;
  requestIdBytes: Uint8Array<ArrayBuffer>;
  nonce: Uint8Array<ArrayBuffer>;
  sequence: number;
  ciphertext: Uint8Array<ArrayBuffer>;
  header: Uint8Array<ArrayBuffer>;
};

function fail(message: string): never {
  throw new Error(message);
}

function isUnsafeMapKey(value: string): boolean {
  return value === "__proto__" || value === "constructor" || value === "prototype";
}

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (typeof value !== "string") return fail("THB/4 base64 value is invalid.");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const result = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  return result;
}

export function base64Url(value: ArrayBuffer | Uint8Array<ArrayBufferLike>): string {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function wireKidFromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const result = decodeBase64Url(value);
  if (result.length !== 8) return fail("THB/4 wire key id must be 8 bytes.");
  return result;
}

export function uuidToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    return fail("THB/4 request id must be a UUID.");
  }
  const hex = value.replaceAll("-", "");
  const result = new Uint8Array(new ArrayBuffer(16));
  for (let index = 0; index < 16; index += 1) result[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return result;
}

export function bytesToUuid(value: Uint8Array<ArrayBufferLike>): string {
  if (value.length !== 16) return fail("THB/4 request id must be 16 bytes.");
  const hex = Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function encodeHeader(input: {
  kind: Thb4Kind;
  flags: number;
  wireKid: Uint8Array<ArrayBufferLike>;
  requestId: string;
  nonce: Uint8Array<ArrayBufferLike>;
  sequence: number | bigint;
  ciphertextLength: number;
}): Uint8Array<ArrayBuffer> {
  if (input.wireKid.length !== 8) return fail("THB/4 wire key id must be 8 bytes.");
  const requestId = uuidToBytes(input.requestId);
  if (input.nonce.length !== 12) return fail("THB/4 nonce must be 12 bytes.");
  if (!Number.isInteger(input.flags) || input.flags < 0 || (input.flags & ~THB4_ALLOWED_FLAGS) !== 0) return fail("THB/4 flags are invalid.");
  if (!Number.isInteger(input.ciphertextLength) || input.ciphertextLength < 16 || input.ciphertextLength > THB4_MAX_CIPHERTEXT_BYTES) return fail("THB/4 ciphertext length is invalid.");
  const sequence = BigInt(input.sequence);
  if (sequence < BigInt(0) || sequence > BigInt("18446744073709551615")) return fail("THB/4 sequence is invalid.");

  const header = new Uint8Array(new ArrayBuffer(THB4_HEADER_BYTES));
  header.set(new TextEncoder().encode(THB4_MAGIC), 0);
  header[4] = THB4_VERSION;
  header[5] = input.kind === "request" ? 0 : 1;
  header[6] = THB4_ALGORITHM;
  header[7] = input.flags;
  header.set(input.wireKid, 8);
  header.set(requestId, 16);
  header.set(input.nonce, 32);
  new DataView(header.buffer).setBigUint64(44, sequence, false);
  new DataView(header.buffer).setUint32(52, input.ciphertextLength, false);
  return header;
}

export function encodeFrame(input: {
  kind: Thb4Kind;
  flags: number;
  wireKid: Uint8Array<ArrayBufferLike>;
  requestId: string;
  nonce: Uint8Array<ArrayBufferLike>;
  sequence: number | bigint;
  ciphertext: Uint8Array<ArrayBufferLike>;
}): Uint8Array<ArrayBuffer> {
  const header = encodeHeader({ ...input, ciphertextLength: input.ciphertext.length });
  const result = new Uint8Array(new ArrayBuffer(header.length + input.ciphertext.length));
  result.set(header, 0);
  result.set(input.ciphertext, header.length);
  return result;
}

export function decodeFrame(value: Uint8Array<ArrayBufferLike>): Thb4Frame {
  if (value.length < THB4_HEADER_BYTES + 16) return fail("THB/4 frame is incomplete.");
  const header = new Uint8Array(value.slice(0, THB4_HEADER_BYTES));
  const magic = new TextDecoder().decode(header.slice(0, 4));
  if (magic !== THB4_MAGIC) return fail("THB/4 magic is invalid.");
  if (header[4] !== THB4_VERSION) return fail("THB/4 version is invalid.");
  if (header[5] !== 0 && header[5] !== 1) return fail("THB/4 frame kind is invalid.");
  if (header[6] !== THB4_ALGORITHM) return fail("THB/4 algorithm is invalid.");
  const flags = header[7];
  if ((flags & ~THB4_ALLOWED_FLAGS) !== 0) return fail("THB/4 flags are invalid.");
  for (let index = 56; index < 64; index += 1) if (header[index] !== 0) return fail("THB/4 reserved bytes are not zero.");
  const view = new DataView(header.buffer);
  const ciphertextLength = view.getUint32(52, false);
  if (ciphertextLength < 16 || ciphertextLength > THB4_MAX_CIPHERTEXT_BYTES) return fail("THB/4 ciphertext length is invalid.");
  if (value.length !== THB4_HEADER_BYTES + ciphertextLength) return fail("THB/4 frame length does not match its header.");
  const requestIdBytes = new Uint8Array(header.slice(16, 32));
  return {
    kind: header[5] === 0 ? "request" : "response",
    algorithm: header[6],
    flags,
    wireKid: new Uint8Array(header.slice(8, 16)),
    requestId: bytesToUuid(requestIdBytes),
    requestIdBytes,
    nonce: new Uint8Array(header.slice(32, 44)),
    sequence: Number(view.getBigUint64(44, false)),
    ciphertext: new Uint8Array(value.slice(THB4_HEADER_BYTES)),
    header,
  };
}

function toCborValue(value: unknown): CBORType {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map((item) => toCborValue(item));
  if (typeof value === "object") {
    const map = new Map<string, CBORType>();
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (isUnsafeMapKey(key)) return fail("THB/4 CBOR map key is reserved.");
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) map.set(key, toCborValue(item));
    }
    return map;
  }
  return fail("THB/4 payload contains an unsupported value.");
}

function fromCborValue(value: CBORType): unknown {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") {
    if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) return fail("THB/4 CBOR integer is outside the safe range.");
    return Number(value);
  }
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Array.isArray(value)) return value.map((item) => fromCborValue(item));
  if (value instanceof Map) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of value.entries()) {
      if (typeof key !== "string") return fail("THB/4 CBOR map key is invalid.");
      if (isUnsafeMapKey(key)) return fail("THB/4 CBOR map key is reserved.");
      result[key] = fromCborValue(item);
    }
    return result;
  }
  return fail("THB/4 CBOR payload contains an unsupported value.");
}

export function encodeCbor(value: unknown): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  appendCbor(toCborValue(value), chunks);
  const result = new Uint8Array(new ArrayBuffer(chunks.reduce((total, chunk) => total + chunk.byteLength, 0)));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

const CBOR_UINT64_MAX = BigInt("18446744073709551615");

function cborLength(major: number, value: number | bigint): Uint8Array<ArrayBuffer> {
  const length = BigInt(value);
  if (length < BigInt(0) || length > CBOR_UINT64_MAX) return fail("THB/4 CBOR length is invalid.");
  if (length < BigInt(24)) return Uint8Array.from([(major << 5) | Number(length)]) as Uint8Array<ArrayBuffer>;
  if (length <= BigInt(0xff)) return Uint8Array.from([(major << 5) | 24, Number(length)]) as Uint8Array<ArrayBuffer>;
  if (length <= BigInt(0xffff)) {
    const result = new Uint8Array(new ArrayBuffer(3));
    result[0] = (major << 5) | 25;
    new DataView(result.buffer).setUint16(1, Number(length), false);
    return result;
  }
  if (length <= BigInt(0xffff_ffff)) {
    const result = new Uint8Array(new ArrayBuffer(5));
    result[0] = (major << 5) | 26;
    new DataView(result.buffer).setUint32(1, Number(length), false);
    return result;
  }
  const result = new Uint8Array(new ArrayBuffer(9));
  result[0] = (major << 5) | 27;
  new DataView(result.buffer).setBigUint64(1, length, false);
  return result;
}

function appendCbor(value: CBORType, chunks: Uint8Array[]): void {
  if (value === null || value === undefined) {
    chunks.push(Uint8Array.from([0xf6]) as Uint8Array<ArrayBuffer>);
    return;
  }
  if (typeof value === "boolean") {
    chunks.push(Uint8Array.from([value ? 0xf5 : 0xf4]) as Uint8Array<ArrayBuffer>);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      chunks.push(Uint8Array.from([0xf6]) as Uint8Array<ArrayBuffer>);
      return;
    }
    if (Number.isInteger(value) && Number.isSafeInteger(value)) {
      const integer = BigInt(value);
      chunks.push(cborLength(integer < BigInt(0) ? 1 : 0, integer < BigInt(0) ? -BigInt(1) - integer : integer));
      return;
    }
    const result = new Uint8Array(new ArrayBuffer(9));
    result[0] = 0xfb;
    new DataView(result.buffer).setFloat64(1, value, false);
    chunks.push(result);
    return;
  }
  if (typeof value === "bigint") {
    chunks.push(cborLength(value < BigInt(0) ? 1 : 0, value < BigInt(0) ? -BigInt(1) - value : value));
    return;
  }
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    chunks.push(cborLength(3, bytes.byteLength), bytes);
    return;
  }
  if (value instanceof Uint8Array) {
    const bytes = new Uint8Array(new ArrayBuffer(value.byteLength));
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
      if (typeof key !== "string") return fail("THB/4 CBOR map key is invalid.");
      appendCbor(key, chunks);
      appendCbor(item, chunks);
    }
    return;
  }
  return fail("THB/4 CBOR payload contains an unsupported value.");
}

export function decodeCbor(value: Uint8Array<ArrayBufferLike>): unknown {
  const bytes = new Uint8Array(new ArrayBuffer(value.byteLength));
  bytes.set(value);
  return fromCborValue(decodeCBOR(bytes));
}
