import { randomBytes } from 'node:crypto';
import type { Database } from '../../core/database.js';
import { canonicalJson, hash } from '../../core/crypto.js';
import { AppError } from '../../core/errors.js';
import type { StaffContext, StaffRole } from './admin-context.js';

const CASE_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'] as const;
const CASE_TYPES = ['report', 'trust_request', 'bot_approval', 'review_fraud', 'post_moderation'] as const;
const CASE_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
const STAFF_ROLES = ['owner', 'admin', 'moderator'] as const;
type CaseStatus = (typeof CASE_STATUSES)[number];
type AuditDatabase = Pick<Database, 'user' | 'adminAuditLog'>;

function now(): string {
  return new Date().toISOString();
}

function shortId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

function boundedText(value: unknown, label: string, max: number, required = false): string | null {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw new AppError('ADMIN_INPUT_REQUIRED', `${label} is required.`, 400);
  if (result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new AppError('ADMIN_INPUT_INVALID', `${label} is invalid.`, 400);
  return result || null;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeStaffRole(value: string | null | undefined): StaffRole | null {
  const role = value?.trim().toLowerCase();
  return role && STAFF_ROLES.includes(role as StaffRole) ? role as StaffRole : null;
}

function isRootOwner(email: string): boolean {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(ownerEmail && email.trim().toLowerCase() === ownerEmail);
}

function toStaffRow(row: {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  appointedBy: string | null;
  invitedBy: string | null;
}, user: { id: string; name: string; email: string; avatar: string; joinedDate: string }) {
  const root = isRootOwner(user.email);
  return { ...row, role: root ? 'owner' : (normalizeStaffRole(row.role) ?? row.role), isRootOwner: root, user };
}

export class AdminWriteService {
  constructor(private readonly db: Database) {}

  async createCase(input: Record<string, unknown>, actor: StaffContext) {
    const type = (boundedText(input.type, 'Case type', 40) ?? 'report').toLowerCase();
    const priority = (boundedText(input.priority, 'Priority', 20) ?? 'medium').toLowerCase();
    if (!CASE_TYPES.includes(type as (typeof CASE_TYPES)[number])) throw new AppError('ADMIN_CASE_TYPE_INVALID', 'Case type is invalid.', 400);
    if (!CASE_PRIORITIES.includes(priority as (typeof CASE_PRIORITIES)[number])) throw new AppError('ADMIN_CASE_PRIORITY_INVALID', 'Case priority is invalid.', 400);
    const targetId = boundedText(input.targetId, 'Target', 200, true)!;
    const targetName = boundedText(input.targetName, 'Target name', 240, true)!;
    const reason = boundedText(input.reason, 'Reason', 500, true)!;
    const details = boundedText(input.details, 'Details', 5_000);
    const timestamp = now();
    const item = await this.db.adminCase.create({
      data: {
        id: shortId('case'),
        reference: `TB-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
        type,
        targetId,
        targetName,
        reason,
        priority,
        details,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
    await this.recordAudit(actor, 'case.created', 'case', item.id, { after: item });
    return this.readCase(item.id);
  }

  async assignCase(idInput: unknown, assigneeInput: unknown, actor: StaffContext) {
    const id = boundedText(idInput, 'Case ID', 160, true)!;
    const existing = await this.readCase(id);
    const assignee = boundedText(assigneeInput, 'Assignee', 160) || null;
    if (assignee) {
      const staff = await this.db.staffMember.findFirst({
        where: { userId: assignee, isActive: true, role: { in: [...STAFF_ROLES] } },
        select: { userId: true },
      });
      if (!staff) throw new AppError('ADMIN_CASE_ASSIGNEE_INVALID', 'Case assignee must be an active staff member.', 400);
    }
    if (existing.assignedTo === assignee) return existing;
    if (existing.assignedTo && existing.assignedTo !== assignee && actor.role === 'moderator') throw new AppError('ADMIN_CASE_REASSIGN_FORBIDDEN', 'A moderator cannot reassign another staff member\'s case.', 403);
    const result = await this.db.adminCase.updateMany({
      where: { id, assignedTo: existing.assignedTo },
      data: { assignedTo: assignee, status: assignee && existing.status === 'open' ? 'investigating' : existing.status, updatedAt: now() },
    });
    if (result.count !== 1) throw new AppError('ADMIN_CASE_CONFLICT', 'The case changed before this operation completed.', 409);
    const updated = await this.db.adminCase.findUniqueOrThrow({ where: { id } });
    await this.recordAudit(actor, 'case.assigned', 'case', id, { before: existing, after: updated });
    return this.readCase(id);
  }

  async updateCase(idInput: unknown, input: Record<string, unknown>, actor: StaffContext) {
    const id = boundedText(idInput, 'Case ID', 160, true)!;
    const existing = await this.readCase(id);
    const status = input.status === undefined ? existing.status : boundedText(input.status, 'Status', 30);
    if (!status || !CASE_STATUSES.includes(status as CaseStatus)) throw new AppError('ADMIN_CASE_STATUS_INVALID', 'Case status is invalid.', 400);
    const note = boundedText(input.note, 'Note', 1_000);
    const reason = input.reason === undefined ? existing.reason : boundedText(input.reason, 'Reason', 500, true)!;
    const notes = [...existing.notes, ...(note ? [`${now()} — ${note}`] : [])];
    const resolved = status === 'resolved' || status === 'dismissed';
    const updated = await this.db.adminCase.update({
      where: { id },
      data: { status, reason, notes: JSON.stringify(notes), updatedAt: now(), resolvedAt: resolved ? now() : null, resolvedBy: resolved ? actor.userId : null },
    });
    await this.recordAudit(actor, `case.${status}`, 'case', id, { before: existing, after: updated, reason: input.reason === undefined ? undefined : boundedText(input.reason, 'Reason', 500) ?? undefined });
    return this.readCase(id);
  }

  async appointStaff(input: Record<string, unknown>, actor: StaffContext) {
    if (actor.role === 'moderator') throw new AppError('STAFF_MANAGE_FORBIDDEN', 'Moderator cannot manage staff.', 403);
    const userId = boundedText(input.userId, 'User ID', 200);
    const email = boundedText(input.email, 'Email', 320);
    if ((userId && email) || (!userId && !email)) throw new AppError('STAFF_TARGET_REQUIRED', 'Provide exactly one userId or email.', 400);
    const target = userId
      ? await this.db.user.findUnique({ where: { id: userId } })
      : await this.db.user.findUnique({ where: { email: email!.toLowerCase() } });
    if (!target) throw new AppError('STAFF_TARGET_NOT_FOUND', 'Account was not found.', 404);
    const role = this.parseStaffRole(input.role);
    this.assertCanManageRole(actor, role);
    this.assertNotRootOwner(target.email);
    const existing = await this.db.staffMember.findUnique({ where: { userId: target.id } });
    const existingRole = normalizeStaffRole(existing?.role);
    if (existing && !existingRole) throw new AppError('STAFF_RECORD_INVALID', 'The staff record has an invalid role.', 409);
    if (existingRole === 'owner') throw new AppError('STAFF_OWNER_PROTECTED', 'The root owner is protected.', 403);
    if (existingRole) this.assertCanManageExisting(actor, existingRole);
    const timestamp = now();
    const updated = await this.db.$transaction(async (tx) => {
      const staff = existing
        ? await tx.staffMember.update({ where: { userId: target.id }, data: { role, isActive: true, appointedBy: actor.userId, updatedAt: timestamp } })
        : await tx.staffMember.create({ data: { id: `staff-${target.id}`, userId: target.id, role, isActive: true, createdAt: timestamp, updatedAt: timestamp, appointedBy: actor.userId, invitedBy: actor.userId } });
      await this.recordAudit(actor, 'staff.appointed', 'staff', target.id, { before: existing, after: staff, reason: boundedText(input.reason, 'Reason', 1_000) ?? undefined }, tx);
      return staff;
    });
    return toStaffRow(updated, target);
  }

  async updateStaff(targetIdInput: unknown, input: Record<string, unknown>, actor: StaffContext) {
    if (actor.role === 'moderator') throw new AppError('STAFF_MANAGE_FORBIDDEN', 'Moderator cannot manage staff.', 403);
    const targetId = boundedText(targetIdInput, 'User ID', 200, true)!;
    if (targetId === actor.userId) throw new AppError('STAFF_SELF_CHANGE_FORBIDDEN', 'You cannot change your own staff access.', 403);
    const target = await this.db.user.findUnique({ where: { id: targetId } });
    if (!target) throw new AppError('STAFF_TARGET_NOT_FOUND', 'Account was not found.', 404);
    this.assertNotRootOwner(target.email);
    const existing = await this.db.staffMember.findUnique({ where: { userId: target.id } });
    const existingRole = normalizeStaffRole(existing?.role);
    if (!existing || !existingRole) throw new AppError('STAFF_NOT_FOUND', 'The account is not an active staff record.', 404);
    if (existingRole === 'owner') throw new AppError('STAFF_OWNER_PROTECTED', 'The root owner is protected.', 403);
    this.assertCanManageExisting(actor, existingRole);
    if (input.isActive !== undefined && typeof input.isActive !== 'boolean') throw new AppError('STAFF_ACTIVE_INVALID', 'isActive must be boolean.', 400);
    const nextRole = input.role === undefined ? existingRole : this.parseStaffRole(input.role);
    this.assertCanManageRole(actor, nextRole);
    const nextIsActive = input.isActive === undefined ? existing.isActive : input.isActive;
    if (nextRole === existingRole && nextIsActive === existing.isActive) return toStaffRow(existing, target);
    const updated = await this.db.$transaction(async (tx) => {
      const staff = await tx.staffMember.update({ where: { userId: target.id }, data: { role: nextRole, isActive: nextIsActive, updatedAt: now(), ...(nextRole !== existingRole ? { appointedBy: actor.userId } : {}) } });
      await this.recordAudit(actor, 'staff.updated', 'staff', target.id, { before: existing, after: staff, reason: boundedText(input.reason, 'Reason', 1_000) ?? undefined }, tx);
      return staff;
    });
    return toStaffRow(updated, target);
  }

  async deactivateStaff(targetId: unknown, reason: unknown, actor: StaffContext) {
    return this.updateStaff(targetId, { isActive: false, reason }, actor);
  }

  private async readCase(id: string) {
    const item = await this.db.adminCase.findUnique({ where: { id } });
    if (!item) throw new AppError('ADMIN_CASE_NOT_FOUND', 'Admin case was not found.', 404);
    return { ...item, evidence: parseJson<unknown[]>(item.evidence, []), notes: parseJson<unknown[]>(item.notes, []) };
  }

  private parseStaffRole(value: unknown): 'admin' | 'moderator' {
    if (typeof value !== 'string') throw new AppError('STAFF_ROLE_INVALID', 'Staff role must be admin or moderator.', 400);
    const role = normalizeStaffRole(value);
    if (!role || role === 'owner') throw new AppError('STAFF_ROLE_INVALID', 'Staff role must be admin or moderator.', 400);
    return role;
  }

  private assertCanManageRole(actor: StaffContext, role: StaffRole): void {
    if (actor.role === 'moderator') throw new AppError('STAFF_MANAGE_FORBIDDEN', 'Moderator cannot manage staff.', 403);
    if (actor.role === 'admin' && role !== 'moderator') throw new AppError('STAFF_ROLE_FORBIDDEN', 'Admin can only manage moderator access.', 403);
  }

  private assertCanManageExisting(actor: StaffContext, role: StaffRole): void {
    if (role === 'owner') throw new AppError('STAFF_OWNER_PROTECTED', 'The root owner is protected.', 403);
    if (actor.role === 'moderator') throw new AppError('STAFF_MANAGE_FORBIDDEN', 'Moderator cannot manage staff.', 403);
    if (actor.role === 'admin' && role !== 'moderator') throw new AppError('STAFF_ROLE_FORBIDDEN', 'Admin cannot change higher-level staff.', 403);
  }

  private assertNotRootOwner(email: string): void {
    if (isRootOwner(email)) throw new AppError('STAFF_OWNER_PROTECTED', 'The root owner is protected.', 403);
  }

  private async recordAudit(actor: StaffContext, action: string, targetType: string, targetId: string | undefined, payload: { before?: unknown; after?: unknown; reason?: string; caseId?: string } = {}, db: AuditDatabase = this.db): Promise<void> {
    const user = await db.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
    const previous = await db.adminAuditLog.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { eventHash: true } });
    const createdAt = now();
    const beforeData = payload.before === undefined ? null : JSON.stringify(payload.before);
    const afterData = payload.after === undefined ? null : JSON.stringify(payload.after);
    const previousHash = previous?.eventHash ?? '';
    const eventHash = hash(canonicalJson({ previousHash, actorId: actor.userId, actorRole: actor.role, action, targetType, targetId: targetId ?? null, caseId: payload.caseId ?? null, reason: payload.reason ?? null, beforeData, afterData, createdAt }));
    await db.adminAuditLog.create({ data: { id: shortId('audit'), actorId: actor.userId, actorName: user?.name ?? 'Staff', actorRole: actor.role, action, targetType, targetId: targetId ?? null, caseId: payload.caseId ?? null, reason: payload.reason ?? null, beforeData, afterData, createdAt, previousHash, eventHash } });
  }
}
