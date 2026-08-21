import { randomUUID } from 'node:crypto';
import type { Database } from './database.js';
import type { MediaService } from '../modules/media/media.service.js';
import type { TrustService } from '../modules/trust/trust.service.js';
import type { ResourcesService } from '../modules/resources/resources.service.js';

export type MaintenanceResult = {
  expiredTrustedApplications: number;
  securityNonces: number;
  actionPermits: number;
  accessTokens: number;
  webAuthnChallenges: number;
  idempotencyRecords: number;
  stagedResourceFiles: number;
  mediaMissingAttachments: number;
  mediaSizeMismatches: number;
  mediaSha256Mismatches: number;
  mediaChecksumFilesChecked: number;
  mediaChecksumFilesSkipped: number;
  mediaOrphanFiles: number;
  resourceMissingFiles: number;
  resourceSizeMismatches: number;
  resourceSha256Mismatches: number;
  resourceChecksumFilesChecked: number;
  resourceChecksumFilesSkipped: number;
  resourceOrphanFiles: number;
};

type MaintenanceLockStore = {
  create: (args: { data: { id: string; deviceId: null; requestId: string; createdAt: string; expiresAt: string } }) => Promise<unknown>;
  findUnique: (args: { where: { id: string } }) => Promise<{ requestId: string; expiresAt: string } | null>;
  deleteMany: (args: { where: { id: string; requestId?: string } }) => Promise<{ count: number }>;
};

type HeldMaintenanceLock = { owner: string; store: MaintenanceLockStore };

const MAINTENANCE_LOCK_ID = 'maintenance:fastify:global';

function emptyResult(): MaintenanceResult {
  return {
    expiredTrustedApplications: 0,
    securityNonces: 0,
    actionPermits: 0,
    accessTokens: 0,
    webAuthnChallenges: 0,
    idempotencyRecords: 0,
    stagedResourceFiles: 0,
    mediaMissingAttachments: 0,
    mediaSizeMismatches: 0,
    mediaSha256Mismatches: 0,
    mediaChecksumFilesChecked: 0,
    mediaChecksumFilesSkipped: 0,
    mediaOrphanFiles: 0,
    resourceMissingFiles: 0,
    resourceSizeMismatches: 0,
    resourceSha256Mismatches: 0,
    resourceChecksumFilesChecked: 0,
    resourceChecksumFilesSkipped: 0,
    resourceOrphanFiles: 0,
  };
}

type ExpiringRows = { count: number };
type MediaReconciliation = {
  missingAttachments: number;
  sizeMismatches: number;
  sha256Mismatches: number;
  checksumFilesChecked: number;
  checksumFilesSkipped: number;
  removedOrphanFiles: number;
  skippedRecentFiles: number;
};
type ResourceReconciliation = {
  missingResourceFiles: number;
  sizeMismatches: number;
  sha256Mismatches: number;
  checksumFilesChecked: number;
  checksumFilesSkipped: number;
  removedOrphanFiles: number;
  skippedRecentFiles: number;
};

const emptyRows: ExpiringRows = { count: 0 };
const emptyMedia: MediaReconciliation = {
  missingAttachments: 0,
  sizeMismatches: 0,
  sha256Mismatches: 0,
  checksumFilesChecked: 0,
  checksumFilesSkipped: 0,
  removedOrphanFiles: 0,
  skippedRecentFiles: 0,
};
const emptyResources: ResourceReconciliation = {
  missingResourceFiles: 0,
  sizeMismatches: 0,
  sha256Mismatches: 0,
  checksumFilesChecked: 0,
  checksumFilesSkipped: 0,
  removedOrphanFiles: 0,
  skippedRecentFiles: 0,
};

async function safeMaintenanceTask<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch {
    return fallback;
  }
}

function intervalMs(): number {
  const configured = Number(process.env.TB_MAINTENANCE_INTERVAL_MS ?? 60_000);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 10_000), 3_600_000) : 60_000;
}

export class MaintenanceService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly db: Database,
    private readonly trust: TrustService,
    private readonly resources?: ResourcesService,
    private readonly media?: MediaService,
  ) {}

  async runOnce(): Promise<MaintenanceResult> {
    if (this.running) return emptyResult();
    this.running = true;
    const queryRawUnsafe = (this.db as unknown as { $queryRawUnsafe?: (query: string) => Promise<unknown> }).$queryRawUnsafe;
    if (typeof queryRawUnsafe === 'function') {
      try {
        await queryRawUnsafe.call(this.db, 'SELECT 1');
      } catch {
        this.running = false;
        return emptyResult();
      }
    }
    const lock = await this.acquireDistributedLock();
    if (lock === false) {
      this.running = false;
      return emptyResult();
    }
    try {
      const cutoff = new Date().toISOString();
      // SQLite has one writer. Keep maintenance writes serialized and let a
      // failed cleanup be retried on the next pass instead of taking down
      // startup or rejecting unrelated user requests.
      const expiredTrustedApplications = await safeMaintenanceTask(() => this.trust.expireTrustedApplications(), 0);
      await safeMaintenanceTask(() => this.publishScheduledPosts(cutoff), 0);
      const securityNonces = await safeMaintenanceTask(() => this.db.securityNonce.deleteMany({ where: { expiresAt: { lt: cutoff } } }), emptyRows);
      const actionPermits = await safeMaintenanceTask(() => this.db.actionPermit.deleteMany({ where: { expiresAt: { lt: cutoff } } }), emptyRows);
      const accessTokens = await safeMaintenanceTask(() => this.db.authAccessToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }), emptyRows);
      const webAuthnChallenges = await safeMaintenanceTask(() => this.db.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: cutoff } } }), emptyRows);
      const idempotencyRecords = await safeMaintenanceTask(() => this.db.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: cutoff } } }), emptyRows);
      const stagedResourceFiles = await safeMaintenanceTask(() => this.resources?.cleanupStagedFiles() ?? Promise.resolve(0), 0);
      const mediaReconciliation = await safeMaintenanceTask(
        () => typeof this.media?.reconcileStorage === 'function' ? this.media.reconcileStorage() : Promise.resolve(emptyMedia),
        emptyMedia,
      );
      const resourceReconciliation = await safeMaintenanceTask(
        () => typeof this.resources?.reconcileStorage === 'function' ? this.resources.reconcileStorage() : Promise.resolve(emptyResources),
        emptyResources,
      );
      return {
        expiredTrustedApplications,
        securityNonces: securityNonces.count,
        actionPermits: actionPermits.count,
        accessTokens: accessTokens.count,
        webAuthnChallenges: webAuthnChallenges.count,
        idempotencyRecords: idempotencyRecords.count,
        stagedResourceFiles,
        mediaMissingAttachments: mediaReconciliation.missingAttachments,
        mediaSizeMismatches: mediaReconciliation.sizeMismatches,
        mediaSha256Mismatches: mediaReconciliation.sha256Mismatches,
        mediaChecksumFilesChecked: mediaReconciliation.checksumFilesChecked,
        mediaChecksumFilesSkipped: mediaReconciliation.checksumFilesSkipped,
        mediaOrphanFiles: mediaReconciliation.removedOrphanFiles,
        resourceMissingFiles: resourceReconciliation.missingResourceFiles,
        resourceSizeMismatches: resourceReconciliation.sizeMismatches,
        resourceSha256Mismatches: resourceReconciliation.sha256Mismatches,
        resourceChecksumFilesChecked: resourceReconciliation.checksumFilesChecked,
        resourceChecksumFilesSkipped: resourceReconciliation.checksumFilesSkipped,
        resourceOrphanFiles: resourceReconciliation.removedOrphanFiles,
      };
    } finally {
      await this.releaseDistributedLock(lock);
      this.running = false;
    }
  }

  private async acquireDistributedLock(): Promise<HeldMaintenanceLock | null | false> {
    const candidate = this.db.securityNonce as unknown as Partial<MaintenanceLockStore>;
    if (typeof candidate.create !== 'function' || typeof candidate.findUnique !== 'function' || typeof candidate.deleteMany !== 'function') return null;
    const store = candidate as MaintenanceLockStore;
    const owner = randomUUID();
    const expiresAt = new Date(Date.now() + Math.max(intervalMs() * 2, 30_000)).toISOString();
    const create = async (): Promise<boolean> => {
      try {
        await store.create({ data: { id: MAINTENANCE_LOCK_ID, deviceId: null, requestId: owner, createdAt: new Date().toISOString(), expiresAt } });
        return true;
      } catch {
        return false;
      }
    };
    if (await create()) return { owner, store };
    let current: { requestId: string; expiresAt: string } | null = null;
    try {
      current = await store.findUnique({ where: { id: MAINTENANCE_LOCK_ID } });
    } catch {
      return false;
    }
    if (current && Date.parse(current.expiresAt) > Date.now()) return false;
    if (current) {
      try {
        await store.deleteMany({ where: { id: MAINTENANCE_LOCK_ID, requestId: current.requestId } });
      } catch {
        return false;
      }
    }
    return (await create()) ? { owner, store } : false;
  }

  private async releaseDistributedLock(lock: HeldMaintenanceLock | null | false): Promise<void> {
    if (!lock) return;
    await lock.store.deleteMany({ where: { id: MAINTENANCE_LOCK_ID, requestId: lock.owner } }).catch(() => undefined);
  }

  /** Publish scheduled admin posts atomically enough for multiple workers.
   * The conditional update makes a second worker a no-op; resource versions
   * are promoted only after the post wins the state transition. */
  private async publishScheduledPosts(cutoff: string): Promise<number> {
    const database = this.db as unknown as {
      post?: {
        findMany: (args: unknown) => Promise<Array<{ id: string }>>;
        updateMany: (args: unknown) => Promise<{ count: number }>;
      };
      resourceVersion?: { updateMany: (args: unknown) => Promise<unknown> };
    };
    if (!database.post) return 0;
    const candidates = await database.post.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: cutoff }, deletedAt: null },
      select: { id: true },
      take: 100,
    });
    let published = 0;
    for (const candidate of candidates) {
      const result = await database.post.updateMany({
        where: { id: candidate.id, status: 'scheduled', scheduledAt: { lte: cutoff }, deletedAt: null },
        data: { status: 'published', publishedAt: cutoff, updatedAt: cutoff, scheduledAt: null },
      });
      if (result.count !== 1) continue;
      published += 1;
      await database.resourceVersion?.updateMany({
        where: { resource: { postId: candidate.id }, status: { in: ['draft', 'scheduled', 'pending', 'hidden'] } },
        data: { status: 'published', publishedAt: cutoff },
      });
    }
    return published;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs());
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
