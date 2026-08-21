import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { join, relative, resolve, isAbsolute } from 'node:path';
import type { FastifyRequest } from 'fastify';
import { AuthService, type AuthSessionContext } from '../../core/auth.js';
import { sessionTokenFromRequest } from '../../core/crypto.js';
import { apiRoot, type Database } from '../../core/database.js';
import { AppError, isUniqueConstraintError } from '../../core/errors.js';

export const E2EE_PROTOCOL = 'signal-pqxdh-v1' as const;
const SIGNAL_DEVICE_MIN = 1;
const SIGNAL_DEVICE_MAX = 127;
const SIGNAL_REGISTRATION_MIN = 1;
const SIGNAL_REGISTRATION_MAX = 16_383;
const SIGNAL_ID_MAX = 2_147_483_647;
const MAX_PREKEY_POOL = 100;
export const E2EE_MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

type SignalBundle = {
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

type SignalPreKey = { id: number; public_key: string };
type JsonObject = Record<string, unknown>;

const SIGNAL_BUNDLE_FIELDS = new Set([
  'registration_id', 'device_id', 'pre_key_id', 'pre_key_public',
  'signed_pre_key_id', 'signed_pre_key_public', 'signed_pre_key_signature',
  'identity_key', 'kyber_pre_key_id', 'kyber_pre_key_public', 'kyber_pre_key_signature',
]);
const DEVICE_FIELDS = new Set(['deviceId', 'bundle', 'preKeys']);
const CONVERSATION_FIELDS = new Set(['recipientUserId', 'recipientDeviceIds', 'recipientDeviceId']);
const MESSAGE_FIELDS = new Set(['protocolVersion', 'recipientDeviceId', 'clientMessageId', 'message']);
const ATTACHMENT_FIELDS = new Set(['mimeType', 'encryptedFileKey', 'nonce', 'ciphertextSha256']);

function now(): string {
  return new Date().toISOString();
}

function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string') {
    if (!required) return '';
    throw new AppError('E2EE_FIELD_REQUIRED', `${label} is required.`, 400);
  }
  const result = value.trim();
  if (!result && required) throw new AppError('E2EE_FIELD_REQUIRED', `${label} is required.`, 400);
  if (result.length > max || /\p{Cc}/u.test(result)) throw new AppError('E2EE_FIELD_INVALID', `${label} is invalid.`, 400);
  return result;
}

function inputObject(input: unknown): JsonObject {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('E2EE_PAYLOAD_INVALID', 'E2EE payload must be an object.', 400);
  const value = input as JsonObject;
  if (Object.keys(value).some((key) => /private|secret|plaintext|plainText|messageText/i.test(key))) {
    throw new AppError('E2EE_PRIVATE_MATERIAL_REJECTED', 'Private keys and plaintext never belong in the E2EE API.', 403);
  }
  return value;
}

function assertAllowedFields(value: JsonObject, allowed: ReadonlySet<string>, label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new AppError('E2EE_FIELDS_INVALID', `${label} contains unsupported fields: ${unknown.join(', ')}.`, 400);
}

function publicMaterial(value: unknown, label: string, max = 32_000): string {
  const result = text(value, label, max);
  if (!/^[\x20-\x7e]+$/.test(result)) throw new AppError('E2EE_MATERIAL_INVALID', `${label} contains invalid key material.`, 400);
  return result;
}

function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new AppError('E2EE_INTEGER_INVALID', `${label} is invalid.`, 400);
  }
  return value;
}

function base64Material(value: unknown, label: string, max = 16_000, exactLength?: number): string {
  const result = publicMaterial(value, label, max);
  if (!/^[A-Za-z0-9+/]+$/.test(result)) throw new AppError('E2EE_BASE64_INVALID', `${label} must be unpadded base64.`, 400);
  if (exactLength !== undefined && result.length !== exactLength) throw new AppError('E2EE_WIRE_LENGTH_INVALID', `${label} has an invalid Signal wire length.`, 400);
  return result;
}

function parseJsonObject(value: unknown, label: string): JsonObject {
  let candidate = value;
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate) as unknown; } catch { throw new AppError('E2EE_JSON_INVALID', `${label} is not valid JSON.`, 400); }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new AppError('E2EE_OBJECT_REQUIRED', `${label} must be an object.`, 400);
  return candidate as JsonObject;
}

function parseSignalBundle(value: unknown): SignalBundle {
  const raw = parseJsonObject(value, 'bundle');
  const unknown = Object.keys(raw).filter((key) => !SIGNAL_BUNDLE_FIELDS.has(key));
  if (unknown.length) throw new AppError('E2EE_BUNDLE_FIELDS_INVALID', `Unsupported Signal bundle fields: ${unknown.join(', ')}.`, 400);
  const preKeyId = raw.pre_key_id === null || raw.pre_key_id === undefined ? null : integer(raw.pre_key_id, 'bundle.pre_key_id', 1, SIGNAL_ID_MAX);
  const preKeyPublic = raw.pre_key_public === null || raw.pre_key_public === undefined ? null : base64Material(raw.pre_key_public, 'bundle.pre_key_public', 16_000, 44);
  if ((preKeyId === null) !== (preKeyPublic === null)) throw new AppError('E2EE_PREKEY_PAIR_INVALID', 'bundle.pre_key_id and bundle.pre_key_public must be paired.', 400);
  return {
    registration_id: integer(raw.registration_id, 'bundle.registration_id', SIGNAL_REGISTRATION_MIN, SIGNAL_REGISTRATION_MAX),
    device_id: integer(raw.device_id, 'bundle.device_id', SIGNAL_DEVICE_MIN, SIGNAL_DEVICE_MAX),
    pre_key_id: preKeyId,
    pre_key_public: preKeyPublic,
    signed_pre_key_id: integer(raw.signed_pre_key_id, 'bundle.signed_pre_key_id', 1, SIGNAL_ID_MAX),
    signed_pre_key_public: base64Material(raw.signed_pre_key_public, 'bundle.signed_pre_key_public', 16_000, 44),
    signed_pre_key_signature: base64Material(raw.signed_pre_key_signature, 'bundle.signed_pre_key_signature', 16_000, 86),
    identity_key: base64Material(raw.identity_key, 'bundle.identity_key', 16_000, 44),
    kyber_pre_key_id: integer(raw.kyber_pre_key_id, 'bundle.kyber_pre_key_id', 1, SIGNAL_ID_MAX),
    kyber_pre_key_public: base64Material(raw.kyber_pre_key_public, 'bundle.kyber_pre_key_public', 32_000, 2_092),
    kyber_pre_key_signature: base64Material(raw.kyber_pre_key_signature, 'bundle.kyber_pre_key_signature', 16_000, 86),
  };
}

function parsePreKeyPool(value: unknown, bundle: SignalBundle): SignalPreKey[] {
  const raw = value === undefined ? [] : value;
  if (!Array.isArray(raw) || raw.length > MAX_PREKEY_POOL) throw new AppError('E2EE_PREKEY_POOL_INVALID', `preKeys must contain at most ${MAX_PREKEY_POOL} public keys.`, 400);
  const result = raw.map((item, index) => {
    const row = parseJsonObject(item, `preKeys[${index}]`);
    if (Object.keys(row).some((field) => !['id', 'public_key'].includes(field))) throw new AppError('E2EE_PREKEY_FIELDS_INVALID', `preKeys[${index}] contains unsupported fields.`, 400);
    return { id: integer(row.id, `preKeys[${index}].id`, 1, SIGNAL_ID_MAX), public_key: base64Material(row.public_key, `preKeys[${index}].public_key`, 16_000, 44) };
  });
  if (bundle.pre_key_id !== null && bundle.pre_key_public !== null && !result.some((row) => row.id === bundle.pre_key_id)) result.push({ id: bundle.pre_key_id, public_key: bundle.pre_key_public });
  const unique = new Map<number, SignalPreKey>();
  for (const row of result) {
    const existing = unique.get(row.id);
    if (existing && existing.public_key !== row.public_key) throw new AppError('E2EE_PREKEY_ID_COLLISION', 'A pre-key id was published with different public material.', 409);
    unique.set(row.id, row);
  }
  return [...unique.values()].sort((left, right) => left.id - right.id);
}

export class EncryptedAttachmentStorage {
  private readonly root: string;

  constructor() {
    this.root = resolve(apiRoot(), process.env.MEDIA_STORAGE_DIR?.trim() || 'storage/media');
    mkdirSync(this.root, { recursive: true });
  }

  save(buffer: Buffer): { storageKey: string; sizeBytes: number; ciphertextSha256: string } {
    if (!buffer.length) throw new AppError('E2EE_ATTACHMENT_EMPTY', 'Encrypted attachment is empty.', 400);
    if (buffer.length > E2EE_MAX_ATTACHMENT_SIZE) throw new AppError('E2EE_ATTACHMENT_TOO_LARGE', 'Encrypted attachment is too large.', 413);
    const date = new Date();
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const directory = join(this.root, 'e2ee', year, month);
    mkdirSync(directory, { recursive: true });
    const storageKey = `e2ee/${year}/${month}/${randomUUID()}.bin`;
    writeFileSync(this.resolveKey(storageKey), buffer, { flag: 'wx', mode: 0o600 });
    return { storageKey, sizeBytes: buffer.length, ciphertextSha256: createHash('sha256').update(buffer).digest('hex') };
  }

  async saveFile(sourcePath: string): Promise<{ storageKey: string; sizeBytes: number; ciphertextSha256: string }> {
    let sourceSize: number;
    try {
      const source = statSync(sourcePath);
      if (!source.isFile()) throw new Error('source is not a file');
      sourceSize = source.size;
    } catch {
      throw new AppError('E2EE_ATTACHMENT_REQUIRED', 'Encrypted attachment is required.', 400);
    }
    if (!sourceSize) throw new AppError('E2EE_ATTACHMENT_EMPTY', 'Encrypted attachment is empty.', 400);
    if (sourceSize > E2EE_MAX_ATTACHMENT_SIZE) throw new AppError('E2EE_ATTACHMENT_TOO_LARGE', 'Encrypted attachment is too large.', 413);
    const date = new Date();
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const directory = join(this.root, 'e2ee', year, month);
    mkdirSync(directory, { recursive: true });
    const storageKey = `e2ee/${year}/${month}/${randomUUID()}.bin`;
    const finalPath = this.resolveKey(storageKey);
    const partialPath = `${finalPath}.part`;
    const digest = createHash('sha256');
    let copiedBytes = 0;
    const verifier = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        copiedBytes += chunk.length;
        if (copiedBytes > E2EE_MAX_ATTACHMENT_SIZE) {
          callback(new AppError('E2EE_ATTACHMENT_TOO_LARGE', 'Encrypted attachment is too large.', 413));
          return;
        }
        digest.update(chunk);
        callback(null, chunk);
      },
      flush(callback) {
        if (copiedBytes !== sourceSize) {
          callback(new AppError('E2EE_ATTACHMENT_CHANGED', 'Encrypted attachment changed while it was being uploaded.', 409));
          return;
        }
        callback();
      },
    });
    try {
      await pipeline(createReadStream(sourcePath), verifier, createWriteStream(partialPath, { flags: 'wx', mode: 0o600 }));
      const ciphertextSha256 = digest.digest('hex');
      await rename(partialPath, finalPath);
      return { storageKey, sizeBytes: copiedBytes, ciphertextSha256 };
    } catch (error) {
      if (existsSync(partialPath)) unlinkSync(partialPath);
      if (existsSync(finalPath)) unlinkSync(finalPath);
      throw error;
    }
  }

  read(storageKey: string): Buffer {
    const path = this.resolveKey(storageKey);
    if (!existsSync(path)) throw new AppError('E2EE_ATTACHMENT_NOT_FOUND', 'Encrypted attachment was not found.', 404);
    return readFileSync(path);
  }

  open(storageKey: string, expectedSizeBytes: number, expectedSha256: string): { sizeBytes: number; stream: NodeJS.ReadableStream } {
    const path = this.resolveKey(storageKey);
    if (!existsSync(path) || !/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new AppError('E2EE_ATTACHMENT_NOT_FOUND', 'Encrypted attachment was not found.', 404);
    let sizeBytes: number;
    try {
      const stat = statSync(path);
      if (!stat.isFile()) throw new Error('not a file');
      sizeBytes = stat.size;
    } catch {
      throw new AppError('E2EE_ATTACHMENT_NOT_FOUND', 'Encrypted attachment was not found.', 404);
    }
    if (sizeBytes !== expectedSizeBytes) throw new AppError('E2EE_ATTACHMENT_CORRUPTED', 'Encrypted attachment integrity check failed.', 409);
    const digest = createHash('sha256');
    let copiedBytes = 0;
    const verifier = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        copiedBytes += chunk.length;
        digest.update(chunk);
        callback(null, chunk);
      },
      flush(callback) {
        if (copiedBytes !== expectedSizeBytes || digest.digest('hex') !== expectedSha256.toLowerCase()) {
          callback(new AppError('E2EE_ATTACHMENT_CORRUPTED', 'Encrypted attachment integrity check failed.', 409));
          return;
        }
        callback();
      },
    });
    const source = createReadStream(path);
    source.once('error', (error) => verifier.destroy(error as Error));
    source.pipe(verifier);
    return { sizeBytes, stream: verifier };
  }

  remove(storageKey: string): void {
    const path = this.resolveKey(storageKey);
    if (existsSync(path)) unlinkSync(path);
  }

  private resolveKey(storageKey: string): string {
    const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
    const candidate = resolve(this.root, normalized);
    const relativePath = relative(this.root, candidate);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) throw new AppError('E2EE_STORAGE_KEY_INVALID', 'Storage key is invalid.', 400);
    return candidate;
  }
}

export class E2eeService {
  constructor(private readonly db: Database, private readonly auth: AuthService, private readonly storage: EncryptedAttachmentStorage) {}

  private async requireSession(request: FastifyRequest): Promise<AuthSessionContext> {
    const token = sessionTokenFromRequest(request);
    const session = token ? await this.auth.resolveSession(token) : null;
    if (!session) throw new AppError('AUTH_REQUIRED', 'Authentication is required.', 401);
    return session;
  }

  private async currentDevice(session: AuthSessionContext) {
    if (!session.deviceId) throw new AppError('DEVICE_BOOTSTRAP_REQUIRED', 'Register this device before using E2EE.', 412);
    const device = await this.db.deviceIdentity.findFirst({ where: { id: session.deviceId, userId: session.userId, revokedAt: null } });
    if (!device) throw new AppError('DEVICE_INVALID', 'The current device is not valid.', 401);
    return device;
  }

  async publishDeviceKeys(request: FastifyRequest, input: unknown) {
    const session = await this.requireSession(request);
    const body = inputObject(input);
    assertAllowedFields(body, DEVICE_FIELDS, 'Device key payload');
    const device = await this.currentDevice(session);
    const requestedDeviceId = text(body.deviceId, 'deviceId', 160, false);
    if (requestedDeviceId && requestedDeviceId !== device.id) throw new AppError('E2EE_DEVICE_SCOPE_MISMATCH', 'Keys must belong to the current device.', 403);
    const bundle = parseSignalBundle(body.bundle);
    const prekeys = parsePreKeyPool(body.preKeys, bundle);
    const conflicting = await this.db.e2eeDeviceKey.findFirst({ where: { userId: session.userId, signalDeviceId: bundle.device_id, NOT: { deviceId: device.id } }, select: { id: true } });
    if (conflicting) throw new AppError('E2EE_SIGNAL_DEVICE_ID_IN_USE', 'Signal device number is already registered for another device.', 409);
    const timestamp = now();
    const existing = await this.db.e2eeDeviceKey.findFirst({ where: { userId: session.userId, deviceId: device.id } });
    const data = {
      signalDeviceId: bundle.device_id,
      registrationId: bundle.registration_id,
      identityPublicKey: bundle.identity_key,
      signedPrekeyId: bundle.signed_pre_key_id,
      signedPrekeyPublic: bundle.signed_pre_key_public,
      signedPrekeySignature: bundle.signed_pre_key_signature,
      kyberPrekeyId: bundle.kyber_pre_key_id,
      kyberPrekeyPublic: bundle.kyber_pre_key_public,
      kyberPrekeySignature: bundle.kyber_pre_key_signature,
      protocolVersion: E2EE_PROTOCOL,
      rotatedAt: timestamp,
      revokedAt: null,
    };
    const key = existing
      ? await this.db.e2eeDeviceKey.update({ where: { id: existing.id }, data })
      : await this.db.e2eeDeviceKey.create({ data: { id: `e2ee-key-${randomUUID()}`, userId: session.userId, deviceId: device.id, createdAt: timestamp, ...data } });
    for (const prekey of prekeys) {
      await this.db.e2eeOneTimePrekey.upsert({ where: { deviceKeyId_preKeyId: { deviceKeyId: key.id, preKeyId: prekey.id } }, create: { id: `e2ee-prekey-${randomUUID()}`, deviceKeyId: key.id, preKeyId: prekey.id, publicKey: prekey.public_key, createdAt: timestamp }, update: { publicKey: prekey.public_key, usedAt: null } });
    }
    return { protocolVersion: E2EE_PROTOCOL, deviceId: device.id, keyId: key.id, signalDeviceId: key.signalDeviceId, registrationId: key.registrationId, publishedAt: timestamp, oneTimePrekeysAccepted: prekeys.length };
  }

  async ownDevices(request: FastifyRequest) {
    const session = await this.requireSession(request);
    const devices = await this.db.e2eeDeviceKey.findMany({ where: { userId: session.userId, revokedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, deviceId: true, signalDeviceId: true, registrationId: true, protocolVersion: true, createdAt: true, rotatedAt: true } });
    return { protocolVersion: E2EE_PROTOCOL, userId: session.userId, devices };
  }

  async keyBundle(request: FastifyRequest, userId: string) {
    await this.requireSession(request);
    const normalizedUserId = text(userId, 'userId', 160);
    const keys = await this.db.e2eeDeviceKey.findMany({ where: { userId: normalizedUserId, protocolVersion: E2EE_PROTOCOL, revokedAt: null }, orderBy: { createdAt: 'asc' } });
    const devices: Array<{ deviceId: string; signalDeviceId: number; protocolVersion: string; bundle: SignalBundle }> = [];
    for (const key of keys) {
      const available = await this.db.e2eeOneTimePrekey.findFirst({ where: { deviceKeyId: key.id, usedAt: null }, orderBy: { createdAt: 'asc' } });
      let oneTimePrekey: { id: number; publicKey: string } | null = null;
      if (available) {
        const claimed = await this.db.e2eeOneTimePrekey.updateMany({ where: { id: available.id, usedAt: null }, data: { usedAt: now() } });
        if (claimed.count === 1) oneTimePrekey = { id: available.preKeyId, publicKey: available.publicKey };
      }
      devices.push({
        deviceId: key.deviceId,
        signalDeviceId: key.signalDeviceId,
        protocolVersion: key.protocolVersion,
        bundle: {
          registration_id: key.registrationId,
          device_id: key.signalDeviceId,
          pre_key_id: oneTimePrekey?.id ?? null,
          pre_key_public: oneTimePrekey?.publicKey ?? null,
          signed_pre_key_id: key.signedPrekeyId,
          signed_pre_key_public: key.signedPrekeyPublic,
          signed_pre_key_signature: key.signedPrekeySignature,
          identity_key: key.identityPublicKey,
          kyber_pre_key_id: key.kyberPrekeyId,
          kyber_pre_key_public: key.kyberPrekeyPublic,
          kyber_pre_key_signature: key.kyberPrekeySignature,
        },
      });
    }
    return { protocolVersion: E2EE_PROTOCOL, userId: normalizedUserId, devices };
  }

  async createConversation(request: FastifyRequest, input: unknown) {
    const session = await this.requireSession(request);
    const body = inputObject(input);
    assertAllowedFields(body, CONVERSATION_FIELDS, 'Conversation payload');
    await this.currentDevice(session);
    const recipientUserId = text(body.recipientUserId, 'recipientUserId', 160);
    if (recipientUserId === session.userId) throw new AppError('E2EE_SELF_CONVERSATION', 'A conversation needs another user.', 400);
    const senderKeys = await this.db.e2eeDeviceKey.findMany({ where: { userId: session.userId, protocolVersion: E2EE_PROTOCOL, revokedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!senderKeys.length) throw new AppError('E2EE_KEYS_REQUIRED', 'Publish E2EE keys first.', 412);
    const requested = body.recipientDeviceIds === undefined ? [] : body.recipientDeviceIds;
    if (!Array.isArray(requested) || requested.length > 127) throw new AppError('E2EE_RECIPIENT_DEVICES_INVALID', 'recipientDeviceIds must be an array of at most 127 device ids.', 400);
    const single = text(body.recipientDeviceId, 'recipientDeviceId', 160, false);
    const recipientIds = [...new Set([...requested.map((value, index) => text(value, `recipientDeviceIds[${index}]`, 160)), ...(single ? [single] : [])])];
    const recipientKeys = await this.db.e2eeDeviceKey.findMany({ where: { userId: recipientUserId, protocolVersion: E2EE_PROTOCOL, revokedAt: null, ...(recipientIds.length ? { deviceId: { in: recipientIds } } : {}) }, orderBy: { createdAt: 'asc' } });
    if (!recipientKeys.length) throw new AppError('E2EE_RECIPIENT_NOT_FOUND', 'The recipient has no active E2EE device.', 404);
    if (recipientIds.length && recipientKeys.length !== recipientIds.length) throw new AppError('E2EE_RECIPIENT_DEVICE_NOT_FOUND', 'One or more recipient E2EE devices are not active.', 404);
    const membersByDevice = new Map<string, { userId: string; deviceId: string; signalDeviceId: number }>();
    for (const key of [...senderKeys, ...recipientKeys]) membersByDevice.set(key.deviceId, { userId: key.userId, deviceId: key.deviceId, signalDeviceId: key.signalDeviceId });
    const timestamp = now();
    const conversation = await this.db.$transaction(async (tx) => {
      const created = await tx.e2eeConversation.create({ data: { id: `e2ee-conv-${randomUUID()}`, createdBy: session.userId, protocolVersion: E2EE_PROTOCOL, createdAt: timestamp, updatedAt: timestamp } });
      await tx.e2eeConversationMember.createMany({ data: [...membersByDevice.values()].map((member) => ({ id: `e2ee-member-${randomUUID()}`, conversationId: created.id, userId: member.userId, deviceId: member.deviceId, joinedAt: timestamp })) });
      return created;
    });
    return { conversationId: conversation.id, protocolVersion: conversation.protocolVersion, members: [...membersByDevice.values()], createdAt: conversation.createdAt };
  }

  async listConversations(request: FastifyRequest) {
    const session = await this.requireSession(request);
    const rows = await this.db.e2eeConversation.findMany({ where: { members: { some: { userId: session.userId, revokedAt: null } } }, orderBy: { updatedAt: 'desc' }, include: { members: { select: { userId: true, deviceId: true, joinedAt: true, revokedAt: true } } } });
    return rows.map((row) => ({ id: row.id, protocolVersion: row.protocolVersion, createdAt: row.createdAt, updatedAt: row.updatedAt, members: row.members }));
  }

  private async requireConversationMember(request: FastifyRequest, conversationId: string, deviceSpecific = false) {
    const session = await this.requireSession(request);
    const device = deviceSpecific ? await this.currentDevice(session) : null;
    const member = await this.db.e2eeConversationMember.findFirst({ where: { conversationId, userId: session.userId, deviceId: device?.id, revokedAt: null } });
    if (!member) throw new AppError('E2EE_CONVERSATION_NOT_FOUND', 'Conversation not found.', 404);
    return { session, member, device };
  }

  async messages(request: FastifyRequest, conversationId: string, limitInput?: string) {
    await this.requireConversationMember(request, conversationId);
    const parsed = Number(limitInput ?? 50);
    const limit = Number.isSafeInteger(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;
    const rows = await this.db.e2eeMessage.findMany({ where: { conversationId, protocolVersion: E2EE_PROTOCOL, messageType: { in: [2, 3] } }, orderBy: { createdAt: 'asc' }, take: limit, select: { id: true, conversationId: true, senderDeviceId: true, recipientDeviceId: true, protocolVersion: true, messageType: true, ciphertext: true, clientMessageId: true, createdAt: true, deliveredAt: true } });
    return rows.map((row) => ({ id: row.id, conversationId: row.conversationId, senderDeviceId: row.senderDeviceId, recipientDeviceId: row.recipientDeviceId, protocolVersion: row.protocolVersion, message: { message_type: row.messageType, ciphertext: row.ciphertext }, clientMessageId: row.clientMessageId, createdAt: row.createdAt, deliveredAt: row.deliveredAt }));
  }

  async sendMessage(request: FastifyRequest, conversationId: string, input: unknown) {
    const { session, member, device } = await this.requireConversationMember(request, conversationId, true);
    if (!device || member.deviceId !== device.id) throw new AppError('E2EE_DEVICE_NOT_MEMBER', 'The message device is not a conversation member.', 403);
    const body = inputObject(input);
    assertAllowedFields(body, MESSAGE_FIELDS, 'Signal message payload');
    const protocolVersion = text(body.protocolVersion, 'protocolVersion', 32);
    if (protocolVersion !== E2EE_PROTOCOL) throw new AppError('E2EE_PROTOCOL_UNSUPPORTED', 'Unsupported E2EE protocol version.', 400);
    const messageInput = inputObject(body.message);
    if (Object.keys(messageInput).some((field) => !['message_type', 'ciphertext'].includes(field))) throw new AppError('E2EE_MESSAGE_FIELDS_INVALID', 'Signal message contains unsupported fields.', 400);
    const messageType = integer(messageInput.message_type, 'message.message_type', 2, 3) as 2 | 3;
    const ciphertext = base64Material(messageInput.ciphertext, 'message.ciphertext', 4_000_000);
    const clientMessageId = text(body.clientMessageId, 'clientMessageId', 200);
    const recipientDeviceId = text(body.recipientDeviceId, 'recipientDeviceId', 160);
    if (recipientDeviceId === device.id) throw new AppError('E2EE_SELF_MESSAGE', 'A Signal message cannot target the sender device.', 400);
    const recipient = await this.db.e2eeConversationMember.findFirst({ where: { conversationId, deviceId: recipientDeviceId, revokedAt: null } });
    if (!recipient) throw new AppError('E2EE_RECIPIENT_NOT_MEMBER', 'The recipient device is not in this conversation.', 400);
    try {
      const message = await this.db.$transaction(async (tx) => {
        const created = await tx.e2eeMessage.create({ data: { id: `e2ee-msg-${randomUUID()}`, conversationId, senderDeviceId: device.id, recipientDeviceId, protocolVersion, messageType, header: JSON.stringify({ message_type: messageType }), ciphertext, clientMessageId, createdAt: now() } });
        await tx.e2eeConversation.update({ where: { id: conversationId }, data: { updatedAt: created.createdAt } });
        return created;
      });
      return { id: message.id, conversationId: message.conversationId, senderDeviceId: message.senderDeviceId, recipientDeviceId: message.recipientDeviceId, protocolVersion: message.protocolVersion, message: { message_type: message.messageType, ciphertext: message.ciphertext }, clientMessageId: message.clientMessageId, createdAt: message.createdAt };
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new AppError('E2EE_MESSAGE_DUPLICATE', 'clientMessageId was already accepted.', 409);
      throw error;
    }
  }

  async uploadAttachment(request: FastifyRequest, conversationId: string, input: unknown, file?: Buffer | string) {
    const { session, member, device } = await this.requireConversationMember(request, conversationId, true);
    if (!device || member.deviceId !== device.id) throw new AppError('E2EE_DEVICE_NOT_MEMBER', 'The attachment device is not a conversation member.', 403);
    if (!file || (typeof file !== 'string' && !file.length)) throw new AppError('E2EE_ATTACHMENT_REQUIRED', 'Encrypted attachment is required.', 400);
    const body = inputObject(input);
    assertAllowedFields(body, ATTACHMENT_FIELDS, 'Encrypted attachment payload');
    const mimeType = publicMaterial(body.mimeType ?? 'application/octet-stream', 'mimeType', 120);
    const encryptedFileKey = publicMaterial(body.encryptedFileKey, 'encryptedFileKey', 8_000);
    const nonce = publicMaterial(body.nonce, 'nonce', 1_000);
    const declaredHash = publicMaterial(body.ciphertextSha256, 'ciphertextSha256', 128).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(declaredHash)) throw new AppError('E2EE_ATTACHMENT_DIGEST_INVALID', 'ciphertextSha256 must be a SHA-256 hex digest.', 400);
    const stored = typeof file === 'string' ? await this.storage.saveFile(file) : this.storage.save(file);
    if (stored.ciphertextSha256 !== declaredHash) {
      this.storage.remove(stored.storageKey);
      throw new AppError('E2EE_ATTACHMENT_DIGEST_MISMATCH', 'Ciphertext digest does not match the upload.', 409);
    }
    try {
      const attachment = await this.db.e2eeAttachment.create({ data: { id: `e2ee-attachment-${randomUUID()}`, conversationId, ownerUserId: session.userId, storageKey: stored.storageKey, mimeType, sizeBytes: stored.sizeBytes, ciphertextSha256: stored.ciphertextSha256, encryptedFileKey, nonce, createdAt: now() } });
      await this.db.e2eeConversation.update({ where: { id: conversationId }, data: { updatedAt: attachment.createdAt } });
      return { attachmentId: attachment.id, conversationId, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, ciphertextSha256: attachment.ciphertextSha256, encryptedFileKey: attachment.encryptedFileKey, nonce: attachment.nonce, createdAt: attachment.createdAt };
    } catch (error) {
      this.storage.remove(stored.storageKey);
      throw error;
    }
  }

  async downloadAttachment(request: FastifyRequest, attachmentId: string) {
    const normalizedId = text(attachmentId, 'attachmentId', 200);
    const attachment = await this.db.e2eeAttachment.findUnique({ where: { id: normalizedId } });
    if (!attachment?.conversationId) throw new AppError('E2EE_ATTACHMENT_NOT_FOUND', 'Attachment not found.', 404);
    await this.requireConversationMember(request, attachment.conversationId);
    const buffer = this.storage.read(attachment.storageKey);
    const digest = createHash('sha256').update(buffer).digest('hex');
    if (digest !== attachment.ciphertextSha256) throw new AppError('E2EE_ATTACHMENT_CORRUPTED', 'Encrypted attachment integrity check failed.', 409);
    return { attachment, buffer };
  }

  async streamAttachment(request: FastifyRequest, attachmentId: string) {
    const normalizedId = text(attachmentId, 'attachmentId', 200);
    const attachment = await this.db.e2eeAttachment.findUnique({ where: { id: normalizedId } });
    if (!attachment?.conversationId) throw new AppError('E2EE_ATTACHMENT_NOT_FOUND', 'Attachment not found.', 404);
    await this.requireConversationMember(request, attachment.conversationId);
    const opened = this.storage.open(attachment.storageKey, attachment.sizeBytes, attachment.ciphertextSha256);
    return { attachment, sizeBytes: opened.sizeBytes, stream: opened.stream };
  }
}
