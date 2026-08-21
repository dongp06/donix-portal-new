import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { AuthService } from '../src/core/auth.js';
import { bodyDigest, canonicalJson, hash } from '../src/core/crypto.js';
import { dpopHeaders } from './security-test-helpers.js';
import { AUTH_COOKIE } from '../src/core/config.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

test('Fastify admin writes use opaque permits, role policy, audit and replay protection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-admin-write-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const previousOwnerEmail = process.env.OWNER_EMAIL;
  const ownerId = `fastify-owner-${randomUUID()}`;
  const targetId = `fastify-target-${randomUUID()}`;
  const ownerEmail = `${ownerId}@example.test`;
  process.env.OWNER_EMAIL = ownerEmail;
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = keys.publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const timestamp = new Date().toISOString();
  const deviceId = `dev-${randomUUID()}`;
  let sequence = 0;
  const app = await buildApp({ db, enforceTransport: false, logger: false });

  await db.user.create({ data: { id: ownerId, name: 'Fastify Owner', email: ownerEmail, avatar: '', role: 'buyer', joinedDate: timestamp.slice(0, 10) } });
  await db.user.create({ data: { id: targetId, name: 'Fastify Staff Target', email: `${targetId}@example.test`, avatar: '', role: 'buyer', joinedDate: timestamp.slice(0, 10) } });
  await db.deviceIdentity.create({ data: { id: deviceId, userId: ownerId, publicKey: JSON.stringify(publicKeyJwk), fingerprint, createdAt: timestamp, lastSeenAt: timestamp } });
  const auth = new AuthService(db);
  const session = await auth.createSession(ownerId, deviceId);
  const cookie = `${AUTH_COOKIE}=${session.token}`;

  const signedHeaders = (path: string, body: unknown, accessToken = '', options: { method?: string; permit?: string; serverNonce?: string } = {}) => {
    sequence += 1;
    return dpopHeaders({
      privateKey: keys.privateKey,
      publicKeyJwk,
      cookieToken: session.token,
      deviceId,
      sessionId: session.session.id,
      sequence,
      path,
      body,
      accessToken,
      method: options.method,
      permit: options.permit,
      serverNonce: options.serverNonce,
    });
  };

  const issuePermit = async (accessToken: string, action: string, method: string, path: string, body: unknown) => {
    const intent = { action, method, path, bodyHash: bodyDigest(body) };
    const response = await app.inject({ method: 'POST', url: '/api/i', headers: signedHeaders('/api/i', intent, accessToken), payload: JSON.stringify(intent) });
    assert.equal(response.statusCode, 200);
    return jsonBody(response).data as Record<string, unknown>;
  };

  try {
    const accessResponse = await app.inject({ method: 'POST', url: '/api/auth/access', headers: signedHeaders('/api/auth/access', {}), payload: '{}' });
    assert.equal(accessResponse.statusCode, 200);
    const accessToken = String((jsonBody(accessResponse).data as Record<string, unknown>).token);

    const publicDiagnostic = await app.inject({ method: 'GET', url: '/api/security/request' });
    assert.equal(publicDiagnostic.statusCode, 401);
    const diagnostic = await app.inject({ method: 'GET', url: '/api/security/request', headers: signedHeaders('/api/security/request', undefined, accessToken, { method: 'GET' }) });
    assert.equal(diagnostic.statusCode, 200);
    const diagnosticData = jsonBody(diagnostic).data as Record<string, unknown>;
    assert.equal(diagnosticData.sessionId, session.session.id);
    assert.equal(diagnosticData.deviceId, deviceId);

    const caseBody = { type: 'report', targetId: 'post-test', targetName: 'Test post', reason: 'Needs review', priority: 'high' };
    const casePermit = await issuePermit(accessToken, 'moderation.write', 'POST', '/api/admin/cases', caseBody);
    assert.equal(casePermit.requiresStepUp, false);
    const created = await app.inject({ method: 'POST', url: String(casePermit.endpoint), headers: signedHeaders(String(casePermit.endpoint), caseBody, accessToken, { permit: String(casePermit.endpoint).split('/').pop(), serverNonce: String(casePermit.serverNonce) }), payload: JSON.stringify(caseBody) });
    assert.equal(created.statusCode, 200);
    const createdCase = jsonBody(created).data as Record<string, unknown>;
    assert.equal(createdCase.status, 'open');
    assert.ok(String(createdCase.id));

    const staffRead = await app.inject({ method: 'GET', url: '/api/admin/staff', headers: signedHeaders('/api/admin/staff', undefined, accessToken, { method: 'GET' }) });
    assert.equal(staffRead.statusCode, 200);
    assert.ok(Array.isArray((jsonBody(staffRead).data)));

    const assignBody = { assignee: ownerId };
    const assignPermit = await issuePermit(accessToken, 'moderation.write', 'POST', `/api/admin/cases/${createdCase.id}/assign`, assignBody);
    const assigned = await app.inject({ method: 'POST', url: String(assignPermit.endpoint), headers: signedHeaders(String(assignPermit.endpoint), assignBody, accessToken, { permit: String(assignPermit.endpoint).split('/').pop(), serverNonce: String(assignPermit.serverNonce) }), payload: JSON.stringify(assignBody) });
    assert.equal(assigned.statusCode, 200);
    assert.equal((jsonBody(assigned).data as Record<string, unknown>).assignedTo, ownerId);

    const updateBody = { status: 'resolved', note: 'Reviewed by owner' };
    const updatePermit = await issuePermit(accessToken, 'moderation.write', 'PATCH', `/api/admin/cases/${createdCase.id}`, updateBody);
    const updated = await app.inject({ method: 'PATCH', url: String(updatePermit.endpoint), headers: signedHeaders(String(updatePermit.endpoint), updateBody, accessToken, { method: 'PATCH', permit: String(updatePermit.endpoint).split('/').pop(), serverNonce: String(updatePermit.serverNonce) }), payload: JSON.stringify(updateBody) });
    assert.equal(updated.statusCode, 200);
    assert.equal((jsonBody(updated).data as Record<string, unknown>).status, 'resolved');

    const staffBody = { userId: targetId, role: 'moderator', reason: 'Content moderation coverage' };
    const staffPermit = await issuePermit(accessToken, 'staff.manage', 'POST', '/api/admin/staff', staffBody);
    assert.equal(staffPermit.requiresStepUp, true);
    const withoutStepUp = await app.inject({ method: 'POST', url: String(staffPermit.endpoint), headers: signedHeaders(String(staffPermit.endpoint), staffBody, accessToken, { permit: String(staffPermit.endpoint).split('/').pop(), serverNonce: String(staffPermit.serverNonce) }), payload: JSON.stringify(staffBody) });
    assert.equal(withoutStepUp.statusCode, 412);
    assert.equal(jsonBody(withoutStepUp).code, 'STEP_UP_REQUIRED');

    await db.securityEvent.create({ data: { id: `evt-${randomUUID()}`, userId: ownerId, deviceId, eventType: 'webauthn.step_up', action: 'staff.manage', riskScore: 0, metadata: '{}', createdAt: new Date().toISOString() } });
    const appointed = await app.inject({ method: 'POST', url: String(staffPermit.endpoint), headers: signedHeaders(String(staffPermit.endpoint), staffBody, accessToken, { permit: String(staffPermit.endpoint).split('/').pop(), serverNonce: String(staffPermit.serverNonce) }), payload: JSON.stringify(staffBody) });
    assert.equal(appointed.statusCode, 200);
    assert.equal((await db.staffMember.findUnique({ where: { userId: targetId } }))?.role, 'moderator');

    const replay = await app.inject({ method: 'POST', url: String(staffPermit.endpoint), headers: signedHeaders(String(staffPermit.endpoint), staffBody, accessToken, { permit: String(staffPermit.endpoint).split('/').pop(), serverNonce: String(staffPermit.serverNonce) }), payload: JSON.stringify(staffBody) });
    assert.equal(replay.statusCode, 404);

    const revokedDeviceId = `dev-${randomUUID()}`;
    await db.deviceIdentity.create({
      data: {
        id: revokedDeviceId,
        userId: ownerId,
        publicKey: JSON.stringify(publicKeyJwk),
        fingerprint: `${fingerprint}-revoked`,
        createdAt: timestamp,
        lastSeenAt: timestamp,
      },
    });
    const revokedDeviceSession = await auth.createSession(ownerId, revokedDeviceId);
    const devicePermit = await issuePermit(accessToken, 'device.revoke', 'DELETE', `/api/security/devices/${revokedDeviceId}`, {});
    assert.equal(devicePermit.requiresStepUp, true);
    const deviceEndpoint = String(devicePermit.endpoint);
    const devicePermitToken = deviceEndpoint.split('/').pop()!;
    const withoutDeviceStepUp = await app.inject({
      method: 'DELETE',
      url: deviceEndpoint,
      headers: signedHeaders(deviceEndpoint, {}, accessToken, { method: 'DELETE', permit: devicePermitToken, serverNonce: String(devicePermit.serverNonce) }),
      payload: '{}',
    });
    assert.equal(withoutDeviceStepUp.statusCode, 412);
    assert.equal(jsonBody(withoutDeviceStepUp).code, 'STEP_UP_REQUIRED');

    await db.securityEvent.create({ data: { id: `evt-${randomUUID()}`, userId: ownerId, deviceId, eventType: 'webauthn.step_up', action: 'device.revoke', riskScore: 0, metadata: '{}', createdAt: new Date().toISOString() } });
    const revoked = await app.inject({
      method: 'DELETE',
      url: deviceEndpoint,
      headers: signedHeaders(deviceEndpoint, {}, accessToken, { method: 'DELETE', permit: devicePermitToken, serverNonce: String(devicePermit.serverNonce) }),
      payload: '{}',
    });
    assert.equal(revoked.statusCode, 200);
    assert.equal((jsonBody(revoked).data), true);
    assert.ok((await db.deviceIdentity.findUnique({ where: { id: revokedDeviceId } }))?.revokedAt);
    assert.ok((await db.authSession.findUnique({ where: { id: revokedDeviceSession.session.id } }))?.revokedAt);
    const auditCount = await db.adminAuditLog.count({ where: { actorId: ownerId } });
    assert.equal(auditCount >= 4, true);
  } finally {
    await app.close();
    await db.$disconnect();
    if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = previousOwnerEmail;
    await rm(directory, { recursive: true, force: true });
  }
});
