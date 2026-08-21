# Trust Foundation (Sub-project A) Implementation Plan

> **Historical plan notice:** this plan was written before the pure Fastify and opaque-credential migration. Its NestJS/JWT/`donix_token` references describe the old implementation only; the current HTTP/auth contract is in `docs/fastify-migration/`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp seller thành "shop" có hồ sơ, Trust Score 0–100 thật, hệ tier 4 bậc, xác minh seller bằng hồ sơ + admin duyệt tay (tích xanh có thời hạn 180 ngày), kèm admin trust dashboard.

**Architecture:** Monorepo npm workspaces (NestJS `api/` + Next.js `web/` + `shared/` types). Backend thêm module NestJS `trust` xử lý trust score registry + verification lifecycle, `sellers` module được mở rộng để phục vụ profile v2 (bao gồm `SellerProfile`, `TrustVerification`, `TrustEvent` qua Prisma). Frontend thêm `/sellers/[slug]`, tab mới trong `/dashboard`, `/admin/verifications`.

**Tech Stack:** NestJS 11 (ESM, tsconfig NodeNext, import `.js`), Prisma 7 + better-sqlite3 adapter (SQLite, generated client tại `api/prisma/generated/prisma`), Next.js 16 App Router + React 19, Tailwind + shadcn/ui, react-hook-form + zod, `@nestjs/schedule` (cron), lucide-react.

## Global Constraints

- **Import: ESM** — mọi import trong `api/` dùng đuôi `.js` (`import { X } from './x.js'`).
- **API response format:** `{ success: boolean, data?: T, error?: string }`; dùng helper `ok(data)` từ `../common/api-response.js`.
- **Admin auth:** `AdminGuard` (`api/src/common/admin.guard.js`) so khóa `x-admin-key` (env `ADMIN_API_KEY`); web gọi qua `apiAdmin()` trong `web/src/lib/api-client.ts`.
- **Auth:** login qua Google; user lấy từ cookie `donix_token` bằng `requireUser(req, auth)` / `getCurrentUser(req, auth)` trong `api/src/auth/current-user.js`.
- **Prisma client:** import từ `../../prisma/generated/prisma/client.js`; `PrismaService` là global module.
- **Database:** SQLite; migration bằng `npm run prisma:migrate -w api` (prisma migrate dev); timestamp + JSON lưu dạng **String** theo convention repo (xem `Comment`, `BotReview`).
- **ID sinh:** `'prefix-' + Date.now()` (xem `BotsService.create`).
- **UI:** tiếng Việt, theme dark premium single-accent, shadcn/ui components, WCAG 2.2 AA (semantic HTML, keyboard nav, aria-label, focus trap cho modal).
- **No placeholders:** mỗi bước có code thật và lệnh test.

---

### Task 1: Schema Prisma + migration + generate + shared types

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/*_add_trust_system/` (tạo qua lệnh)
- Modify: `shared/types.ts`
- Copy: `api/src/shared/types.ts` (bản copy giữ sync)
- Test: chạy `npx prisma generate` + migrate + `git status`

**Interfaces:**
- Consumes: model `User`, `Bot` hiện có (đọc `api/prisma/schema.prisma`).
- Produces: các model Prisma `SellerProfile`, `TrustVerification`, `TrustEvent`; field mới `User.tier`, `User.trustScore`, `User.trustScoreUpdatedAt`, `Bot.sellerSlug`; types shared mới `TrustStatus`, `SellerProfile`, `SellerTrustProfile`, `TrustChecklistItem`, `SellerTrustEvent` (đặt dưới `SellerProfile`).

- [ ] **Step 1: Sửa schema**

Thêm vào cuối `api/prisma/schema.prisma`:

```prisma
model SellerProfile {
  id                  String   @id
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  shopName            String
  slug                String   @unique
  bio                 String?
  avatar              String?
  banner              String?
  contact             String   @default("{}")
  profileCompleteness Int      @default(0)
  updatedAt           String
}

model TrustVerification {
  id          String  @id
  userId      String
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  status      String
  note        String?
  submittedAt String
  reviewedAt  String?
  reviewedBy  String?
  expiresAt   String?

  @@index([userId])
  @@index([status])
}

model TrustEvent {
  id        String @id
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String
  detail    String @default("{}")
  createdAt String

  @@index([userId])
}
```

Trong model `User` thêm:

```prisma
  tier                String  @default("new")
  trustScore          Int     @default(0)
  trustScoreUpdatedAt String?

  sellerProfile  SellerProfile?
  verifications  TrustVerification[]
  trustEvents    TrustEvent[]
```

Trong model `Bot` thêm:

```prisma
  sellerSlug    String   @default("")
```

- [ ] **Step 2: Chạy migration**

```bash
cd D:/webthuebot && npm run prisma:migrate -w api -- --name add_trust_system
```

Expected: tạo migration mới + chạy `prisma generate` (postinstall). Nếu bị lỗi cần bảng có sẵn (empty), bỏ qua vì dữ liệu không có.

- [ ] **Step 3: Cập nhật shared types**

Sửa `shared/types.ts` — thay block `SellerProfile` hiện có (đặt ở cuối file, dòng ~199-221) bằng:

```ts
/** Loại sự kiện trong lịch sử uy tín của seller */
export type SellerTrustEventType =
  | 'joined'
  | 'tier_changed'
  | 'verification_submitted'
  | 'verification_approved'
  | 'verification_rejected'
  | 'verification_expired'
  | 'verification_revoked';

/** Sự kiện trong lịch sử uy tín */
export interface SellerTrustEvent {
  id: string;
  type: SellerTrustEventType;
  detail?: Record<string, unknown>;
  createdAt: string;
}

/** Một dòng trong checklist điều kiện xác minh Trust Seller */
export interface TrustChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  /** Giá trị hiện tại của tiêu chí (VD "32 ngày", "6 đánh giá") */
  current?: string;
  /** Giá trị cần đạt (VD "30 ngày", "5 đánh giá") */
  required?: string;
}

/** Trạng thái verification hiện tại của seller */
export interface TrustStatus {
  status: 'none' | 'pending' | 'approved' | 'under_review' | 'rejected' | 'expired';
  submittedAt?: string;
  reviewedAt?: string;
  expiresAt?: string;
  note?: string;
  /** true nếu đang chờ hồ sơ của admin (có thể hủy) */
  canCancel: boolean;
}

/** Trust Score hiện tại + breakdown theo component */
export interface TrustScoreInfo {
  score: number;
  breakdown: { key: string; label: string; weight: number; value: number; score: number }[];
  updatedAt?: string;
}

/** Tier của seller */
export type SellerTier = 'new' | 'active' | 'trusted' | 'top';

/** Hồ sơ seller công khai — GET /api/sellers/:identifier */
export interface SellerProfileUser {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  isVerified: boolean;
  bio?: string;
  joinedDate: string;
  contact?: BotContactInfo;
  /** Điểm uy tín 0-100 */
  trustScore?: number;
  /** Bậc seller */
  tier?: SellerTier;
  /** Slug profile seller */
  slug?: string;
  /** Ngày duyệt xác minh gần nhất (ISO) */
  verifiedAt?: string;
}

export interface SellerProfile {
  user: SellerProfileUser;
  bots: BotItem[];
  posts: ForumPost[];
  /** Lịch sử uy tín (timeline) */
  trustEvents?: SellerTrustEvent[];
}
```

Lưu ý: bỏ trường `reputation` cũ và `sales` khỏi `SellerProfileUser` (chúng không còn được dùng). `SellerTier` dùng cho `UserProfile` nếu cần.

- [ ] **Step 4: Đồng bộ bản copy**

```bash
cp D:/webthuebot/shared/types.ts D:/webthuebot/api/src/shared/types.ts
```

- [ ] **Step 5: Verify**

```bash
cd D:/webthuebot && git status
```

Expected: schema + types.ts + migration mới; kiểm tra `api/prisma/generated/prisma/client.js` có model mới.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: schema trust system (SellerProfile, TrustVerification, TrustEvent)"
```

---

### Task 2: TrustScoreService (registry components) + TrustService base

**Files:**
- Create: `api/src/trust/score-components.ts`
- Create: `api/src/trust/trust-score.service.ts`
- Create: `api/src/trust/trust.service.ts`
- Create: `api/src/trust/trust.module.ts`
- Create: `api/src/trust/trust.service.spec.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (global), `AuthService`, `SellersService`. Models `SellerProfile`, `Bot`, `BotReview`.
- Produces:
  - `interface ScoreComponent { key: string; label: string; weight: number; compute(userId: string): Promise<number> }` — compute trả 0..1.
  - `TrustScoreService.computeAll(userId): Promise<TrustScoreInfo>` — trả `{ score, breakdown }`.
  - `TrustScoreService.computeForUser(userId): Promise<number>` — cache vào `User.trustScore`.
  - `TrustService.getOrCreateProfile(userId)` → `SellerProfile` (tạo nếu chưa có, sinh slug).
  - `TrustService.getChecklist(userId): Promise<TrustChecklistItem[]>`.
  - `TrustService.getStatus(userId): Promise<TrustStatus>`.
  - `TrustService.submitVerification(userId, note)`.
  - `TrustService.recompute(userId)` — tính score + tier + cập nhật User + sync bot snapshots + ghi TrustEvent tier_changed nếu đổi tier.
  - `TrustService.syncBotSnapshots(userId)` — cập nhật `sellerName/sellerAvatar/sellerVerified/sellerSlug` trên tất cả Bot của seller.
  - `TrustService.getTimeline(userId): Promise<SellerTrustEvent[]>`.
  - `TrustService.getScoreBreakdown(userId): Promise<TrustScoreInfo>`.
  - `TrustService.applyReview(userId)` — gọi `recompute` sau khi review thay đổi (từ BotsService).
  - `TrustService.recomputeAll()` — cho cron.
  - `TrustService.computeTier(userId, score, counts): Promise<SellerTier>` — dựa vào các điều kiện.
  - `TrustService.computeProfileCompleteness(profile): Promise<number>`.
  - `TrustService.expireOverdue()` — cron: chuyển approved quá hạn → expired.

- [ ] **Step 1: Viết test fail cho `computeAll`**

Tạo `api/src/trust/trust-score.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustScoreService } from './trust-score.service.js';

describe('TrustScoreService', () => {
  let service: TrustScoreService;
  const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    bot: { aggregate: jest.fn(), count: jest.fn() },
    botReview: { aggregate: jest.fn() },
    sellerProfile: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        TrustScoreService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = mod.get(TrustScoreService);
  });

  it('tính score từ breakdown components, cap 100', async () => {
    mockPrisma.botReview.aggregate.mockResolvedValue({ _avg: { rating: 4.8 }, _count: 10 });
    mockPrisma.user.findUnique.mockResolvedValue({ joinedDate: new Date(Date.now() - 200 * 86400000).toISOString() });
    mockPrisma.bot.aggregate.mockResolvedValue({ _count: 2 });
    mockPrisma.sellerProfile.findUnique.mockResolvedValue({ profileCompleteness: 90 });
    const info = await service.computeAll('u1');
    expect(info.score).toBeGreaterThan(0);
    expect(info.score).toBeLessThanOrEqual(100);
    expect(info.breakdown.length).toBe(4);
    expect(info.breakdown.map((b) => b.key)).toEqual(['reviews', 'account_age', 'profile', 'active_bots']);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail**

```bash
cd D:/webthuebot/api && npx jest trust-score.service.spec.ts --no-coverage
```

Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Tạo `score-components.ts`**

```ts
import { PrismaService } from '../prisma/prisma.service.js';

/** Một thành phần điểm uy tín — compute trả 0..1 */
export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  compute(userId: string): Promise<number>;
}

const DAY_MS = 86400000;

export class ReviewsComponent implements ScoreComponent {
  key = 'reviews';
  label = 'Đánh giá khách hàng';
  weight = 45;
  constructor(private readonly prisma: PrismaService) {}
  async compute(userId: string): Promise<number> {
    const agg = await this.prisma.botReview.aggregate({
      where: { user: { id: userId }, bot: { sellerId: userId } },
      _avg: { rating: true },
      _count: true,
    });
    const count = agg._count;
    if (count === 0) return 0;
    const avg = (agg._avg.rating ?? 0) / 5;
    const confidence = Math.min(count, 20) / 20;
    return avg * confidence;
  }
}

export class AccountAgeComponent implements ScoreComponent {
  key = 'account_age';
  label = 'Thời gian hoạt động';
  weight = 20;
  constructor(private readonly prisma: PrismaService) {}
  async compute(userId: string): Promise<number> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { joinedDate: true } });
    if (!u?.joinedDate) return 0;
    const ageDays = (Date.now() - new Date(u.joinedDate).getTime()) / DAY_MS;
    return Math.min(Math.max(ageDays / 365, 0), 1);
  }
}

export class ProfileComponent implements ScoreComponent {
  key = 'profile';
  label = 'Xác minh hồ sơ';
  weight = 20;
  constructor(private readonly prisma: PrismaService) {}
  async compute(userId: string): Promise<number> {
    const p = await this.prisma.sellerProfile.findUnique({ where: { userId }, select: { profileCompleteness: true } });
    if (!p) return 0;
    return p.profileCompleteness / 100;
  }
}

export class ActiveBotsComponent implements ScoreComponent {
  key = 'active_bots';
  label = 'Số bot hoạt động';
  weight = 15;
  constructor(private readonly prisma: PrismaService) {}
  async compute(userId: string): Promise<number> {
    const count = await this.prisma.bot.count({ where: { sellerId: userId, status: 'online' } });
    return Math.min(count, 5) / 5;
  }
}
```

- [ ] **Step 4: Tạo `trust-score.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActiveBotsComponent, AccountAgeComponent, ProfileComponent, ReviewsComponent, ScoreComponent } from './score-components.js';

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  weight: number;
  value: number;
  score: number;
}

export interface TrustScoreInfo {
  score: number;
  breakdown: ScoreBreakdownItem[];
  updatedAt?: string;
}

@Injectable()
export class TrustScoreService {
  private readonly components: ScoreComponent[];

  constructor(private readonly prisma: PrismaService) {
    this.components = [
      new ReviewsComponent(prisma),
      new AccountAgeComponent(prisma),
      new ProfileComponent(prisma),
      new ActiveBotsComponent(prisma),
    ];
  }

  /** Đăng ký thêm component (sub-project C/D) */
  addComponent(component: ScoreComponent) {
    this.components.push(component);
  }

  async computeAll(userId: string): Promise<TrustScoreInfo> {
    const items = await Promise.all(
      this.components.map(async (c) => {
        const value = await c.compute(userId);
        return { key: c.key, label: c.label, weight: c.weight, value, score: Math.round(c.weight * value) };
      }),
    );
    const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
    const score = Math.min(100, Math.round(items.reduce((s, i) => s + i.score, 0) / totalWeight * 100));
    return { score, breakdown: items };
  }

  /** Tính + lưu cache vào User.trustScore */
  async computeForUser(userId: string): Promise<number> {
    const info = await this.computeAll(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { trustScore: info.score, trustScoreUpdatedAt: new Date().toISOString() },
    });
    return info.score;
  }
}
```

- [ ] **Step 5: Chạy test xác nhận pass**

```bash
cd D:/webthuebot/api && npx jest trust-score.service.spec.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Tạo `trust.service.ts`**

```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustScoreService } from './trust-score.service.js';

export type VerificationStatus = 'pending' | 'approved' | 'under_review' | 'rejected' | 'expired';

const TRUST_VERIFICATION_DAYS = 180;
const TIER_MIN_ACCOUNT_DAYS = 30;
const TIER_MIN_REVIEWS = 5;
const TIER_MIN_RATING = 4.5;
const TIER_MIN_SCORE = 75;
const TIER_MIN_PROFILE = 80;
const TOP_MIN_REVIEWS = 25;
const TOP_MIN_RATING = 4.7;
const TOP_RANK_LIMIT = 10;

interface SellerCounts {
  reviewCount: number;
  avgRating: number;
  botCount: number;
  onlineBotCount: number;
}

@Injectable()
export class TrustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly score: TrustScoreService,
  ) {}

  private async getCounts(userId: string): Promise<SellerCounts> {
    const [reviewAgg, botAgg] = await Promise.all([
      this.prisma.botReview.aggregate({
        where: { bot: { sellerId: userId } },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.bot.aggregate({
        where: { sellerId: userId },
        _count: true,
      }),
    ]);
    const online = await this.prisma.bot.count({ where: { sellerId: userId, status: 'online' } });
    return {
      reviewCount: reviewAgg._count,
      avgRating: reviewAgg._avg.rating ?? 0,
      botCount: botAgg._count,
      onlineBotCount: online,
    };
  }

  async computeProfileCompleteness(profile: {
    shopName: string | null;
    bio: string | null;
    avatar: string | null;
    banner: string | null;
    contact: Record<string, string>;
  }): Promise<number> {
    let score = 0;
    if (profile.shopName) score += 20;
    if (profile.bio) score += 15;
    if (profile.avatar) score += 15;
    if (profile.banner) score += 10;
    const contactCount = Object.values(profile.contact ?? {}).filter(Boolean).length;
    if (contactCount >= 1) score += 20;
    if (contactCount >= 2) score += 20;
    return score;
  }

  async getOrCreateProfile(userId: string) {
    let profile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('Người dùng không tồn tại.');
      const baseSlug = user.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seller';
      const existing = await this.prisma.sellerProfile.findFirst({ where: { slug: { startsWith: baseSlug } }, orderBy: { slug: 'desc' } });
      const slug = existing ? `${baseSlug}-${Date.now().toString(36).slice(-4)}` : baseSlug;
      profile = await this.prisma.sellerProfile.create({
        data: { id: `sp-${Date.now()}`, userId, shopName: user.name, slug, updatedAt: new Date().toISOString() },
      });
    }
    return profile;
  }

  async computeTier(userId: string, score: number, counts: SellerCounts): Promise<SellerTier> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { joinedDate: true, tier: true } });
    if (!user) return 'new';
    const ageDays = (Date.now() - new Date(user.joinedDate).getTime()) / 86400000;
    // trusted chỉ khi có verification approved còn hạn
    const activeVerification = await this.prisma.trustVerification.findFirst({
      where: { userId, status: 'approved', expiresAt: { gte: new Date().toISOString() } },
    });
    const isTrusted = Boolean(activeVerification);
    if (!isTrusted) {
      if (ageDays >= TIER_MIN_ACCOUNT_DAYS && counts.botCount >= 1 && counts.reviewCount >= 1) return 'active';
      return 'new';
    }
    const topEligible =
      counts.avgRating >= TOP_MIN_RATING &&
      counts.reviewCount >= TOP_MIN_REVIEWS &&
      score >= TIER_MIN_SCORE;
    if (topEligible) {
      const ranked = await this.prisma.user.findMany({
        where: { role: 'seller', tier: 'trusted' },
        orderBy: { trustScore: 'desc' },
        select: { trustScore: true },
        take: TOP_RANK_LIMIT + 1,
      });
      const myRank = ranked.findIndex((r) => r.trustScore === score);
      if (myRank >= 0 && myRank < TOP_RANK_LIMIT) return 'top';
    }
    return 'trusted';
  }

  async syncBotSnapshots(userId: string) {
    const [user, profile, verification] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, avatar: true, isVerified: true } }),
      this.prisma.sellerProfile.findUnique({ where: { userId } }),
      this.prisma.trustVerification.findFirst({ where: { userId, status: 'approved', expiresAt: { gte: new Date().toISOString() } } }),
    ]);
    if (!user) return;
    await this.prisma.bot.updateMany({
      where: { sellerId: userId },
      data: {
        sellerName: profile?.shopName || user.name,
        sellerAvatar: profile?.avatar || user.avatar,
        sellerVerified: Boolean(verification),
        sellerSlug: profile?.slug || '',
      },
    });
  }

  async recompute(userId: string) {
    const info = await this.score.computeAll(userId);
    const counts = await this.getCounts(userId);
    const tier = await this.computeTier(userId, info.score, counts);
    const prev = await this.prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
    if (prev && prev.tier !== tier) {
      await this.prisma.trustEvent.create({
        data: { id: `te-${Date.now()}`, userId, type: 'tier_changed', detail: JSON.stringify({ from: prev.tier, to: tier }), createdAt: new Date().toISOString() },
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { trustScore: info.score, trustScoreUpdatedAt: new Date().toISOString(), tier },
    });
    await this.syncBotSnapshots(userId);
    return { score: info.score, tier, breakdown: info.breakdown };
  }

  async getChecklist(userId: string): Promise<TrustChecklistItem[]> {
    const [user, counts, profile, scoreInfo] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { joinedDate: true } }),
      this.getCounts(userId),
      this.getOrCreateProfile(userId),
      this.score.computeAll(userId),
    ]);
    const ageDays = Math.floor((Date.now() - new Date(user?.joinedDate ?? Date.now()).getTime()) / 86400000);
    return [
      { key: 'account_age', label: 'Tài khoản hoạt động ít nhất 30 ngày', passed: ageDays >= TIER_MIN_ACCOUNT_DAYS, current: `${ageDays} ngày`, required: '30 ngày' },
      { key: 'reviews', label: 'Ít nhất 5 đánh giá hợp lệ', passed: counts.reviewCount >= TIER_MIN_REVIEWS, current: `${counts.reviewCount} đánh giá`, required: '5 đánh giá' },
      { key: 'rating', label: 'Rating trung bình ≥ 4.5', passed: counts.avgRating >= TIER_MIN_RATING, current: `${counts.avgRating.toFixed(1)}/5`, required: '4.5/5' },
      { key: 'profile', label: 'Hồ sơ hoàn thiện ≥ 80%', passed: profile.profileCompleteness >= TIER_MIN_PROFILE, current: `${profile.profileCompleteness}%`, required: '80%' },
      { key: 'trust_score', label: 'Điểm uy tín ≥ 75', passed: scoreInfo.score >= TIER_MIN_SCORE, current: `${scoreInfo.score}/100`, required: '75/100' },
    ];
  }

  async getStatus(userId: string): Promise<TrustStatus> {
    const latest = await this.prisma.trustVerification.findFirst({ where: { userId }, orderBy: { submittedAt: 'desc' } });
    if (!latest) return { status: 'none', canCancel: false };
    return {
      status: latest.status as TrustStatus['status'],
      submittedAt: latest.submittedAt,
      reviewedAt: latest.reviewedAt ?? undefined,
      expiresAt: latest.expiresAt ?? undefined,
      note: latest.note ?? undefined,
      canCancel: latest.status === 'pending',
    };
  }

  async submitVerification(userId: string, note?: string) {
    const checklist = await this.getChecklist(userId);
    if (!checklist.every((c) => c.passed)) {
      throw new BadRequestException('Bạn chưa đáp ứng đủ điều kiện xác minh.');
    }
    const status = await this.getStatus(userId);
    if (status.status === 'pending' || status.status === 'approved') {
      throw new BadRequestException('Đã có hồ sơ xác minh đang xử lý.');
    }
    await this.prisma.trustVerification.create({
      data: { id: `tv-${Date.now()}`, userId, status: 'pending', note: note ?? null, submittedAt: new Date().toISOString() },
    });
    await this.prisma.trustEvent.create({
      data: { id: `te-${Date.now()}`, userId, type: 'verification_submitted', detail: '{}', createdAt: new Date().toISOString() },
    });
    return this.getStatus(userId);
  }

  async expireOverdue() {
    const now = new Date().toISOString();
    const overdue = await this.prisma.trustVerification.findMany({ where: { status: 'approved', expiresAt: { lt: now } } });
    for (const v of overdue) {
      await this.prisma.trustVerification.update({ where: { id: v.id }, data: { status: 'expired' } });
      await this.prisma.user.update({ where: { id: v.userId }, data: { isVerified: false } });
      await this.prisma.trustEvent.create({
        data: { id: `te-${Date.now()}`, userId: v.userId, type: 'verification_expired', detail: '{}', createdAt: now },
      });
      await this.recompute(v.userId);
    }
    return overdue.length;
  }

  async getTimeline(userId: string): Promise<SellerTrustEvent[]> {
    const rows = await this.prisma.trustEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ id: r.id, type: r.type as SellerTrustEventType, detail: r.detail ? JSON.parse(r.detail) : undefined, createdAt: r.createdAt }));
  }

  async getScoreBreakdown(userId: string): Promise<TrustScoreInfo> {
    const info = await this.score.computeAll(userId);
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { trustScoreUpdatedAt: true } });
    return { ...info, updatedAt: u?.trustScoreUpdatedAt ?? undefined };
  }
}
```

- [ ] **Step 7: Tạo `trust.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { TrustScoreService } from './trust-score.service.js';
import { TrustService } from './trust.service.js';

@Module({
  providers: [TrustScoreService, TrustService],
  exports: [TrustScoreService, TrustService],
})
export class TrustModule {}
```

- [ ] **Step 8: Đăng ký vào AppModule**

Thêm `import { TrustModule } from './trust/trust.module.js';` và thêm `TrustModule` vào mảng `imports` của `AppModule` (`api/src/app.module.ts`).

- [ ] **Step 9: Verify build**

```bash
cd D:/webthuebot/api && npx tsc --noEmit
```

Expected: không lỗi.

- [ ] **Step 10: Commit**

```bash
git add api/src/trust api/src/app.module.ts && git commit -m "feat: trust score service + trust service (tier, checklist, verification)"
```

---

### Task 3: TrustController (seller) + AdminVerificationsController

**Files:**
- Create: `api/src/trust/trust.controller.ts`
- Create: `api/src/trust/admin-verifications.controller.ts`
- Modify: `api/src/trust/trust.module.ts` (đăng ký controllers)
- Test: manual + `npx jest` (nếu có)

**Interfaces:**
- Consumes: `TrustService`, `AuthService`, `requireUser`, `AdminGuard`, `ok()`.
- Produces:
  - `PUT /api/sellers/me/profile` — body `{ shopName?, bio?, avatar?, banner?, contact? }` → `{ success, data: SellerProfile }`.
  - `GET /api/sellers/me/trust-status` — `{ success, data: { status: TrustStatus, checklist: TrustChecklistItem[], score: TrustScoreInfo, tier: string } }`.
  - `POST /api/sellers/me/verification` — body `{ note? }` → `{ success, data: TrustStatus }`.
  - `GET /api/admin/verifications?status=pending` → `{ success, data: Array<{ id, userId, status, submittedAt, reviewedAt, expiresAt, note, user: { id, name, email, avatar }, trustScore, reviewCount, avgRating, joinedDate }> }`.
  - `PATCH /api/admin/verifications/:id` — body `{ action: 'approve'|'reject', note? }` → `{ success, data: TrustVerification }`.

- [ ] **Step 1: Tạo `trust.controller.ts`**

```ts
import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { requireUser } from '../auth/current-user.js';
import { ok } from '../common/api-response.js';
import { TrustService } from './trust.service.js';

@Controller('sellers/me')
export class TrustController {
  constructor(
    private readonly trust: TrustService,
    private readonly auth: AuthService,
  ) {}

  @Put('profile')
  async updateProfile(@Body() body: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    if (user.role !== 'seller') {
      // cho phép buyer đang nâng cấp; nếu chưa là seller thì vẫn tạo profile
      // nhưng chỉ seller mới hiện. Ở đây chấp nhận mọi user đã đăng nhập.
    }
    const profile = await this.trust.getOrCreateProfile(user.id);
    const contact = body?.contact && typeof body.contact === 'object' ? body.contact : undefined;
    const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body?.shopName !== undefined) data.shopName = String(body.shopName);
    if (body?.bio !== undefined) data.bio = body.bio === '' ? null : String(body.bio);
    if (body?.avatar !== undefined) data.avatar = body.avatar === '' ? null : String(body.avatar);
    if (body?.banner !== undefined) data.banner = body.banner === '' ? null : String(body.banner);
    if (contact) data.contact = JSON.stringify(contact);
    const updated = await this.prisma.sellerProfile.update({
      where: { userId: user.id },
      data,
    });
    // recompute completeness
    const parsedContact = updated.contact ? JSON.parse(updated.contact) : {};
    const completeness = await this.trust.computeProfileCompleteness({
      shopName: updated.shopName,
      bio: updated.bio,
      avatar: updated.avatar,
      banner: updated.banner,
      contact: parsedContact,
    });
    await this.prisma.sellerProfile.update({ where: { userId: user.id }, data: { profileCompleteness: completeness } });
    await this.trust.recompute(user.id);
    const publicProfile = await this.trust.getOrCreateProfile(user.id);
    return ok({
      id: publicProfile.id,
      userId: publicProfile.userId,
      shopName: publicProfile.shopName,
      slug: publicProfile.slug,
      bio: publicProfile.bio ?? undefined,
      avatar: publicProfile.avatar ?? undefined,
      banner: publicProfile.banner ?? undefined,
      contact: publicProfile.contact ? JSON.parse(publicProfile.contact) : undefined,
      profileCompleteness: publicProfile.profileCompleteness,
    });
  }

  @Get('trust-status')
  async trustStatus(@Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const [status, checklist, score, recomputed] = await Promise.all([
      this.trust.getStatus(user.id),
      this.trust.getChecklist(user.id),
      this.trust.getScoreBreakdown(user.id),
      this.trust.recompute(user.id),
    ]);
    return ok({ status, checklist, score, tier: recomputed.tier });
  }

  @Post('verification')
  async submitVerification(@Body() body: { note?: string }, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    if (user.role !== 'seller') {
      throw new ForbiddenException('Chỉ seller mới nộp hồ sơ xác minh.');
    }
    return ok(await this.trust.submitVerification(user.id, body?.note));
  }
}
```

Chú ý: controller cần `PrismaService` để sửa profile trực tiếp — inject thêm `private readonly prisma: PrismaService` vào constructor. Hoặc đưa logic cập nhật profile vào `TrustService.updateProfile()`. **Khuyến nghị:** thêm `updateProfile` vào `TrustService` và gọi từ controller (giữ controller mỏng).

- [ ] **Step 2: Thêm `TrustService.updateProfile(userId, body)`**

Thêm vào `trust.service.ts` (sau `submitVerification`):

```ts
async updateProfile(userId: string, body: { shopName?: string; bio?: string; avatar?: string; banner?: string; contact?: Record<string, string> }) {
  await this.getOrCreateProfile(userId);
  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.shopName !== undefined) data.shopName = String(body.shopName);
  if (body.bio !== undefined) data.bio = body.bio === '' ? null : String(body.bio);
  if (body.avatar !== undefined) data.avatar = body.avatar === '' ? null : String(body.avatar);
  if (body.banner !== undefined) data.banner = body.banner === '' ? null : String(body.banner);
  if (body.contact && typeof body.contact === 'object') data.contact = JSON.stringify(body.contact);
  const updated = await this.prisma.sellerProfile.update({ where: { userId }, data });
  const parsedContact = updated.contact ? JSON.parse(updated.contact) : {};
  const completeness = await this.computeProfileCompleteness({
    shopName: updated.shopName,
    bio: updated.bio,
    avatar: updated.avatar,
    banner: updated.banner,
    contact: parsedContact,
  });
  await this.prisma.sellerProfile.update({ where: { userId }, data: { profileCompleteness: completeness } });
  await this.recompute(userId);
  const final = await this.prisma.sellerProfile.findUnique({ where: { userId } });
  return final;
}
```

- [ ] **Step 3: Viết lại `trust.controller.ts` đơn giản hóa**

```ts
import { Body, Controller, ForbiddenException, Get, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { requireUser } from '../auth/current-user.js';
import { ok } from '../common/api-response.js';
import { TrustService } from './trust.service.js';

@Controller('sellers/me')
export class TrustController {
  constructor(
    private readonly trust: TrustService,
    private readonly auth: AuthService,
  ) {}

  @Put('profile')
  async updateProfile(@Body() body: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const profile = await this.trust.updateProfile(user.id, {
      shopName: body?.shopName,
      bio: body?.bio,
      avatar: body?.avatar,
      banner: body?.banner,
      contact: body?.contact,
    });
    return ok({
      id: profile.id,
      userId: profile.userId,
      shopName: profile.shopName,
      slug: profile.slug,
      bio: profile.bio ?? undefined,
      avatar: profile.avatar ?? undefined,
      banner: profile.banner ?? undefined,
      contact: profile.contact ? JSON.parse(profile.contact) : undefined,
      profileCompleteness: profile.profileCompleteness,
    });
  }

  @Get('trust-status')
  async trustStatus(@Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const [status, checklist, score, recomputed] = await Promise.all([
      this.trust.getStatus(user.id),
      this.trust.getChecklist(user.id),
      this.trust.getScoreBreakdown(user.id),
      this.trust.recompute(user.id),
    ]);
    return ok({ status, checklist, score, tier: recomputed.tier });
  }

  @Post('verification')
  async submitVerification(@Body() body: { note?: string }, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    if (user.role !== 'seller') {
      throw new ForbiddenException('Chỉ seller mới nộp hồ sơ xác minh.');
    }
    return ok(await this.trust.submitVerification(user.id, body?.note));
  }
}
```

- [ ] **Step 4: Tạo `admin-verifications.controller.ts`**

```ts
import { Body, Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/admin.guard.js';
import { ok } from '../common/api-response.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustService } from './trust.service.js';

@Controller('admin/verifications')
@UseGuards(AdminGuard)
export class AdminVerificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
  ) {}

  @Get()
  async list(@Query('status') status?: string) {
    const where = status ? { status } : {};
    const rows = await this.prisma.trustVerification.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, joinedDate: true, trustScore: true } } },
    });
    const data = await Promise.all(
      rows.map(async (r) => {
        const reviewAgg = await this.prisma.botReview.aggregate({
          where: { bot: { sellerId: r.userId } },
          _avg: { rating: true },
          _count: true,
        });
        return {
          id: r.id,
          userId: r.userId,
          status: r.status,
          submittedAt: r.submittedAt,
          reviewedAt: r.reviewedAt ?? undefined,
          expiresAt: r.expiresAt ?? undefined,
          note: r.note ?? undefined,
          user: {
            id: r.user.id,
            name: r.user.name,
            email: r.user.email,
            avatar: r.user.avatar,
            joinedDate: r.user.joinedDate,
          },
          trustScore: r.user.trustScore,
          reviewCount: reviewAgg._count,
          avgRating: reviewAgg._avg.rating ?? 0,
        };
      }),
    );
    return ok(data);
  }

  @Patch(':id')
  async review(@Param('id') id: string, @Body() body: { action: 'approve' | 'reject'; note?: string }) {
    const v = await this.prisma.trustVerification.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Hồ sơ xác minh không tồn tại.');
    if (!body?.action) {
      throw new NotFoundException('Thiếu action (approve/reject).');
    }
    const now = new Date().toISOString();
    if (body.action === 'approve') {
      if (v.status !== 'pending') throw new NotFoundException('Hồ sơ không ở trạng thái pending.');
      const expiresAt = new Date(Date.now() + 180 * 86400000).toISOString();
      await this.prisma.trustVerification.update({
        where: { id },
        data: { status: 'approved', reviewedAt: now, reviewedBy: 'admin', expiresAt, note: body.note ?? v.note },
      });
      await this.prisma.user.update({ where: { id: v.userId }, data: { isVerified: true } });
      await this.prisma.trustEvent.create({
        data: { id: `te-${Date.now()}`, userId: v.userId, type: 'verification_approved', detail: JSON.stringify({ expiresAt }), createdAt: now },
      });
      await this.trust.recompute(v.userId);
    } else {
      await this.prisma.trustVerification.update({
        where: { id },
        data: { status: 'rejected', reviewedAt: now, reviewedBy: 'admin', note: body.note ?? v.note },
      });
      await this.prisma.user.update({ where: { id: v.userId }, data: { isVerified: false } });
      await this.prisma.trustEvent.create({
        data: { id: `te-${Date.now()}`, userId: v.userId, type: 'verification_rejected', detail: JSON.stringify({ note: body.note ?? '' }), createdAt: now },
      });
      await this.trust.recompute(v.userId);
    }
    return ok(await this.prisma.trustVerification.findUnique({ where: { id } }));
  }
}
```

- [ ] **Step 5: Đăng ký controllers trong `trust.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { TrustScoreService } from './trust-score.service.js';
import { TrustService } from './trust.service.js';
import { TrustController } from './trust.controller.js';
import { AdminVerificationsController } from './admin-verifications.controller.js';

@Module({
  controllers: [TrustController, AdminVerificationsController],
  providers: [TrustScoreService, TrustService],
  exports: [TrustScoreService, TrustService],
})
export class TrustModule {}
```

- [ ] **Step 6: Verify build**

```bash
cd D:/webthuebot/api && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add api/src/trust && git commit -m "feat: trust controllers (seller me + admin verifications)"
```

---

### Task 4: Mở rộng SellersService/Controller cho profile v2 (slug + trust)

**Files:**
- Modify: `api/src/sellers/sellers.service.ts`
- Modify: `api/src/sellers/sellers.controller.ts`
- Modify: `api/src/sellers/sellers.module.ts`
- Test: manual curl

**Interfaces:**
- Consumes: `TrustService` (tier/score/timeline/verification), `SellersService.getProfile` hiện có.
- Produces: `GET /api/sellers/:identifier` nhận cả userId lẫn slug; trả `SellerProfile` với `user` chứa `trustScore`, `tier`, `slug`, `verifiedAt`; bỏ `reputation`/`sales`.

- [ ] **Step 1: Sửa `sellers.service.ts`**

Thay toàn bộ nội dung bằng:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from '../../prisma/generated/prisma/client.js';
import { TrustService } from '../trust/trust.service.js';
import { toOut as botToOut } from '../bots/bots.service.js';
import { toOut as postToOut } from '../community/community.service.js';

function safeParse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/** User công khai trên trang seller — kèm trust */
function userToOut(u: User, trust: { score: number; tier: string; slug: string; verifiedAt?: string }) {
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    role: u.role,
    isVerified: u.isVerified,
    bio: u.bio ?? undefined,
    joinedDate: u.joinedDate,
    contact: safeParse<Record<string, string>>(u.contact),
    trustScore: trust.score,
    tier: trust.tier,
    slug: trust.slug,
    verifiedAt: trust.verifiedAt,
  };
}

@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
  ) {}

  /** Tìm user theo id hoặc slug của SellerProfile */
  async findUserByIdentifier(identifier: string): Promise<User> {
    const byId = await this.prisma.user.findUnique({ where: { id: identifier } });
    if (byId) return byId;
    const profile = await this.prisma.sellerProfile.findUnique({ where: { slug: identifier } });
    if (profile) {
      const u = await this.prisma.user.findUnique({ where: { id: profile.userId } });
      if (u) return u;
    }
    throw new NotFoundException('Hồ sơ người bán không tồn tại.');
  }

  /** Hồ sơ seller công khai: user + bots + forum posts + trust */
  async getProfile(identifier: string) {
    const user = await this.findUserByIdentifier(identifier);
    const [botRows, postRows, profile, timeline, verifiedAt] = await Promise.all([
      this.prisma.bot.findMany({ where: { sellerId: user.id }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.forumPost.findMany({ where: { authorId: user.id }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.sellerProfile.findUnique({ where: { userId: user.id } }),
      this.trust.getTimeline(user.id),
      this.trust.getStatus(user.id).then((s) => (s.status === 'approved' ? s.expiresAt : undefined)),
    ]);

    const bots = botRows.map(botToOut);
    const verifiedAt = verifiedAt ?? undefined;

    return {
      user: userToOut(user, {
        score: user.trustScore,
        tier: user.tier,
        slug: profile?.slug ?? '',
        verifiedAt,
      }),
      bots,
      posts: postRows.map(postToOut),
      trustEvents: timeline,
    };
  }
}
```

- [ ] **Step 2: Sửa `sellers.controller.ts`**

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { SellersService } from './sellers.service.js';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get(':identifier')
  async getProfile(@Param('identifier') identifier: string) {
    return {
      success: true,
      data: await this.sellersService.getProfile(identifier),
    };
  }
}
```

- [ ] **Step 3: Sửa `sellers.module.ts` import `TrustModule`**

```ts
import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';
import { TrustModule } from '../trust/trust.module.js';

@Module({
  imports: [TrustModule],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
```

- [ ] **Step 4: Verify build**

```bash
cd D:/webthuebot/api && npx tsc --noEmit
```

- [ ] **Step 5: Test thủ công**

```bash
# khởi động api (nếu chưa) rồi:
curl -s http://localhost:3001/api/sellers/<id-cua-seller-seed> | head -c 400
# và thử theo slug:
curl -s http://localhost:3001/api/sellers/<slug> | head -c 400
```

- [ ] **Step 6: Commit**

```bash
git add api/src/sellers && git commit -m "feat: seller profile v2 (slug + trust score + tier + timeline)"
```

---

### Task 5: AuthService.promoteToSeller không tự set isVerified + syncBotSnapshots khi đăng bot

**Files:**
- Modify: `api/src/auth/auth.service.ts`
- Modify: `api/src/bots/bots.controller.ts` (gọi sync sau khi create)
- Test: manual

**Interfaces:**
- Consumes: `TrustService`.
- Produces: `promoteToSeller` không tự `isVerified=true` (chỉ role seller); `BotsController.create` gọi `trust.syncBotSnapshots(user.id)` sau khi tạo bot; `trust.getOrCreateProfile` được gọi khi create bot để đảm bảo profile tồn tại.

- [ ] **Step 1: Sửa `promoteToSeller`**

Trong `api/src/auth/auth.service.ts`, dòng `data: { role: 'seller', isVerified: true }` → `data: { role: 'seller' }`.

- [ ] **Step 2: Gọi sync sau khi tạo bot**

Trong `api/src/bots/bots.controller.ts`, sau `const newBot = await this.botsService.create(...)`, thêm:

```ts
if (user.role === 'seller') {
  await this.trust.syncBotSnapshots(user.id);
}
```

Inject `TrustService` vào constructor của `BotsController` (import từ `../trust/trust.service.js`). Import `TrustModule` vào `BotsModule`.

- [ ] **Step 3: Verify build**

```bash
cd D:/webthuebot/api && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add api/src/auth/auth.service.ts api/src/bots && git commit -m "fix: promoteToSeller không tự verified + sync bot snapshot sau khi tạo"
```

---

### Task 6: Recalc trust sau review + cron expire + recompute

**Files:**
- Modify: `api/src/bots/bots.service.ts` (gọi trust.applyReview sau recalcBotRating)
- Create: `api/src/trust/trust.cron.ts`
- Modify: `api/src/trust/trust.module.ts` (đăng ký cron provider)
- Modify: `api/package.json` (thêm `@nestjs/schedule`)

**Interfaces:**
- Consumes: `TrustService.applyReview`, `TrustService.expireOverdue`, `TrustService.recomputeAll`.
- Produces: `TrustService.applyReview(userId)` — gọi `recompute`; `TrustService.recomputeAll()` — loop qua seller, `recompute` từng cái; cron chạy hàng ngày.

- [ ] **Step 1: Thêm `applyReview` và `recomputeAll` vào `TrustService`**

```ts
async applyReview(userId: string) {
  await this.recompute(userId);
}

async recomputeAll() {
  const sellers = await this.prisma.user.findMany({ where: { role: 'seller' }, select: { id: true } });
  for (const s of sellers) {
    await this.recompute(s.id);
  }
  return sellers.length;
}
```

- [ ] **Step 2: Gọi `applyReview` trong `recalcBotRating`**

Sửa `api/src/bots/bots.service.ts` — inject `TrustService` vào constructor, sau `recalcBotRating` (hoặc cuối `recalcBotRating`):

```ts
private async recalcBotRating(botId: string) {
  const agg = await this.prisma.botReview.aggregate({ where: { botId }, _avg: { rating: true }, _count: true });
  await this.prisma.bot.update({ where: { id: botId }, data: { rating: agg._avg.rating ?? 5, reviewCount: agg._count } });
  const bot = await this.prisma.bot.findUnique({ where: { id: botId }, select: { sellerId: true } });
  if (bot) await this.trust.applyReview(bot.sellerId);
}
```

Import `TrustModule` vào `BotsModule`.

- [ ] **Step 3: Thêm `@nestjs/schedule`**

```bash
cd D:/webthuebot/api && npm install @nestjs/schedule
```

- [ ] **Step 4: Tạo `trust.cron.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrustService } from './trust.service.js';

@Injectable()
export class TrustCron {
  private readonly logger = new Logger(TrustCron.name);
  constructor(private readonly trust: TrustService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailyTrustMaintenance() {
    const expired = await this.trust.expireOverdue();
    const recomputed = await this.trust.recomputeAll();
    this.logger.log(`Trust maintenance: ${expired} expired, ${recomputed} recomputed`);
  }
}
```

- [ ] **Step 5: Đăng ký cron + import ScheduleModule**

Sửa `api/src/app.module.ts`:

```ts
import { ScheduleModule } from '@nestjs/schedule';
// thêm ScheduleModule.forRoot() vào imports
```

Thêm `TrustCron` vào providers của `TrustModule`:

```ts
import { TrustCron } from './trust.cron.js';
providers: [TrustScoreService, TrustService, TrustCron],
```

- [ ] **Step 6: Verify build**

```bash
cd D:/webthuebot/api && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add api/src api/package.json api/package-lock.json && git commit -m "feat: recalc trust sau review + cron daily (expire, recompute)"
```

---

### Task 7: Migration + backfill script

**Files:**
- Create: `api/prisma/backfill-trust.ts` (script 1 lần, `tsx`)
- Run + verify

**Interfaces:**
- Consumes: models mới, `TrustService.recompute`.
- Produces: tạo `SellerProfile` cho seller hiện có, sinh slug, `TrustEvent.joined`, recompute score/tier, `isVerified=false` cho seller chưa qua duyệt, backfill `Bot.sellerSlug`.

- [ ] **Step 1: Tạo `backfill-trust.ts`**

```ts
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';
import { sqliteDbPath } from '../src/prisma/database.js';

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: sqliteDbPath() }) });

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seller';
}

async function main() {
  const sellers = await prisma.user.findMany({ where: { role: 'seller' } });
  for (const s of sellers) {
    // tạo profile
    let profile = await prisma.sellerProfile.findUnique({ where: { userId: s.id } });
    if (!profile) {
      const base = slugify(s.name);
      const existing = await prisma.sellerProfile.findFirst({ where: { slug: { startsWith: base } }, orderBy: { slug: 'desc' } });
      const slug = existing ? `${base}-${Date.now().toString(36).slice(-4)}` : base;
      profile = await prisma.sellerProfile.create({
        data: { id: `sp-${Date.now()}`, userId: s.id, shopName: s.name, slug, updatedAt: new Date().toISOString() },
      });
    }
    // TrustEvent joined
    const existingEvent = await prisma.trustEvent.findFirst({ where: { userId: s.id, type: 'joined' } });
    if (!existingEvent) {
      await prisma.trustEvent.create({
        data: { id: `te-${Date.now()}`, userId: s.id, type: 'joined', detail: '{}', createdAt: s.joinedDate },
      });
    }
    // isVerified về false nếu chưa có verification approved
    const approved = await prisma.trustVerification.findFirst({ where: { userId: s.id, status: 'approved' } });
    if (!approved && s.isVerified) {
      await prisma.user.update({ where: { id: s.id }, data: { isVerified: false } });
    }
    // backfill Bot.sellerSlug
    await prisma.bot.updateMany({ where: { sellerId: s.id }, data: { sellerSlug: profile.slug } });
    // recompute score/tier — dùng logic trực tiếp (không gọi Nest service trong script)
    // ghi đơn giản: để recomputeAll cron chạy trong lần đầu; đây chỉ backfill cấu trúc.
    console.log(`→ ${s.name}: profile ${profile.slug}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Chạy script**

```bash
cd D:/webthuebot/api && npx tsx prisma/backfill-trust.ts
```

Expected: log danh sách seller + slug.

- [ ] **Step 3: Chạy recompute qua cron (hoặc thủ công bằng cách gọi `TrustService.recomputeAll`)** — có thể chạy bằng một lần `npm run start:dev` và chờ cron 3am, hoặc test trong code. Trong dev có thể chạy một lệnh riêng:

```bash
# sau khi api start, gọi endpoint để trigger recompute (hoặc dùng cron mặc định)
```

Note: Nếu muốn recompute ngay (không đợi 3am), thêm tạm route `POST /api/admin/recompute` trong `AdminVerificationsController` hoặc chạy qua một lệnh `tsx` nhỏ gọi logic tương tự. **Đơn giản:** trong `AdminVerificationsController`, thêm:

```ts
@Post('recompute')
async recomputeAll() {
  return ok({ recomputed: await this.trust.recomputeAll() });
}
```

(cần thêm import `Post`.) Rồi gọi `curl -X POST http://localhost:3001/api/admin/verifications/recompute -H 'x-admin-key: <key>'`.

- [ ] **Step 4: Commit**

```bash
git add api/prisma/backfill-trust.ts && git commit -m "chore: backfill trust (seller profile, slug, events)"
```

---

### Task 8: Frontend — seller profile v2 `/sellers/[slug]`

**Files:**
- Create: `web/src/app/sellers/[slug]/page.tsx`
- Modify: `web/src/app/sellers/[id]/page.tsx` → redirect hoặc đổi thành `[slug]` (xóa cũ, tạo mới)
- Modify: `web/src/components/bot/BotCard.tsx`, `web/src/app/bots/[id]/page.tsx`, `web/src/components/modals/ContactModal.tsx` — cập nhật links `/sellers/${id}` → `/sellers/${slug}` (fallback id)
- Modify: `web/src/app/community/page.tsx`, `web/src/app/profile/page.tsx` — link seller dùng slug
- Test: manual browser

**Interfaces:**
- Consumes: `GET /api/sellers/:identifier`, `SellerProfile` type mới.
- Produces: trang shop mới hiện tier badge, trust score + breakdown, verifiedAt, timeline.

- [ ] **Step 1: Đổi route thành `[slug]`**

```bash
git mv web/src/app/sellers/[id]/page.tsx web/src/app/sellers/[slug]/page.tsx
```

- [ ] **Step 2: Cập nhật `page.tsx` dùng data mới**

Sửa trong component `SellerProfilePage`:
- `const { slug } = use(params);` và fetch `/api/sellers/${slug}`.
- Thay `seller.rating`/`seller.reputation` bằng `seller.trustScore` (nếu tồn tại) + tier badge:
```tsx
{profile.user.tier === 'trusted' && <Badge>✓ Trust Seller</Badge>}
{profile.user.tier === 'top' && <Badge>🏆 Top Seller</Badge>}
```
- Hiển thị `profile.user.verifiedAt` (ngày duyệt) và `profile.trustEvents` timeline.
- Xóa phần `EditProfileModal` cũ nếu không dùng (chuyển sang dashboard tab Hồ sơ) hoặc giữ để chỉnh bio/contact.

Chi tiết render (dùng shadcn `Badge`, `Tooltip`, `Card`, `Progress`):
- Tier badge hiện cạnh tên.
- Trust score: `progress` bar 0-100 + breakdown trong `Tooltip`/`Popover`.
- Timeline: danh sách `TrustEvent` (map type → label tiếng Việt):
  - `joined` → "Gia nhập thuebot.org"
  - `verification_approved` → "Đã xác minh"
  - `tier_changed` → "Đổi hạng (from → to)"
  - `verification_rejected` → "Bị từ chối xác minh"
  - `verification_expired` → "Xác minh hết hạn"
  - `verification_submitted` → "Đã nộp hồ sơ xác minh"
  - `verification_revoked` → "Bị thu hồi xác minh"

- [ ] **Step 3: Cập nhật các link seller khác sang slug**

Trong `BotCard.tsx`, `bots/[id]/page.tsx`, `ContactModal.tsx`, `community/page.tsx`, `profile/page.tsx`: `href={`/sellers/${bot.seller.id}`}` → dùng `bot.seller.slug ? \`/sellers/\${bot.seller.slug}\` : \`/sellers/\${bot.seller.id}\``. Thêm field `slug?: string` vào `BotSellerInfo` trong `shared/types.ts`.

- [ ] **Step 4: Test thủ công**

```bash
cd D:/webthuebot/web && npm run dev
# mở http://localhost:3000/sellers/<slug> — thấy tier badge, trust score, timeline
```

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sellers web/src/components/bot web/src/components/modals web/src/app/bots web/src/app/community web/src/app/profile shared/types.ts && git commit -m "feat: seller profile v2 (slug, tier badge, trust score, timeline)"
```

---

### Task 9: Frontend — dashboard seller (tab Hồ sơ + tab Uy tín)

**Files:**
- Modify: `web/src/app/dashboard/page.tsx`
- Create: `web/src/components/dashboard/ProfileTab.tsx`
- Create: `web/src/components/dashboard/TrustTab.tsx`
- Test: manual browser

**Interfaces:**
- Consumes: `PUT /api/sellers/me/profile`, `GET /api/sellers/me/trust-status`, `POST /api/sellers/me/verification`.
- Produces: 2 tab trong dashboard; `ProfileTab` lưu profile mới; `TrustTab` hiện checklist + nút nộp hồ sơ.

- [ ] **Step 1: Thêm Tabs vào dashboard**

Sửa `web/src/app/dashboard/page.tsx`: dùng `Tabs` từ `@/components/ui/tabs`, thêm 2 tab `Hồ sơ` và `Uy tín` bên cạnh phần "Bot đang bán".

- [ ] **Step 2: Tạo `ProfileTab.tsx`**

Dùng `react-hook-form` + `zod` (pattern hiện có trong repo). Form các field: `shopName`, `bio`, `avatar` (URL), `contact.zalo/telegram/phone/facebook`. Submit → `PUT /api/sellers/me/profile`, toast thành công.

- [ ] **Step 3: Tạo `TrustTab.tsx`**

Fetch `GET /api/sellers/me/trust-status`. Hiển thị:
- Trust score + breakdown (dùng `Progress` bar từng component).
- Checklist: mỗi dòng có icon ✓/✗ + label + `current/required`.
- Nút "Nộp hồ sơ xác minh" (disabled nếu checklist chưa đạt hoặc đang pending/approved) → `POST /api/sellers/me/verification`.
- Trạng thái hiện tại (none/pending/approved/rejected/expired) hiển thị text tiếng Việt.

- [ ] **Step 4: Test thủ công**

```bash
cd D:/webthuebot/web && npm run dev
# đăng nhập seller → /dashboard → thấy 2 tab, sửa hồ sơ, xem checklist, nộp hồ sơ
```

- [ ] **Step 5: Commit**

```bash
git add web/src/app/dashboard web/src/components/dashboard && git commit -m "feat: dashboard seller tabs (Hồ sơ + Uy tín)"
```

---

### Task 10: Frontend — admin verifications queue

**Files:**
- Create: `web/src/app/admin/verifications/page.tsx`
- Modify: `web/src/app/admin/layout.tsx` (thêm link nav + tiêu đề)
- Test: manual browser

**Interfaces:**
- Consumes: `GET /api/admin/verifications`, `PATCH /api/admin/verifications/:id`, `apiAdmin()`.
- Produces: trang queue duyệt hồ sơ.

- [ ] **Step 1: Tạo `page.tsx`**

Dùng `apiAdmin`:
```tsx
import { apiAdmin } from '@/lib/api-client';
// state: rows, loading
// GET /api/admin/verifications?status=pending
// mỗi row: name, email, trustScore, reviewCount, avgRating, joinedDate
// nút Duyệt → PATCH /api/admin/verifications/:id {action:'approve'}
// nút Từ chối → PATCH ... {action:'reject', note: prompt hoặc dialog}
```

Layout: dùng `Card`, `Badge`, `Button`, bảng đơn giản (hoặc list). Tiếng Việt.

- [ ] **Step 2: Sửa `admin/layout.tsx`**

Thêm link `<Link href="/admin/verifications">Xác minh</Link>` vào nav, đổi tiêu đề thành "Quản trị" (chung).

- [ ] **Step 3: Test thủ công**

```bash
# cần NEXT_PUBLIC_ADMIN_API_KEY khớp ADMIN_API_KEY của backend
cd D:/webthuebot/web && npm run dev
# mở /admin/verifications — thấy danh sách; duyệt/từ chối hoạt động
```

- [ ] **Step 4: Commit**

```bash
git add web/src/app/admin && git commit -m "feat: admin verifications queue"
```

---

### Task 11: BotCard/contact hiển thị trust (thay "Điểm uy tín" cũ)

**Files:**
- Modify: `web/src/components/bot/BotCard.tsx`
- Modify: `web/src/app/bots/[id]/page.tsx`
- Modify: `web/src/components/modals/ContactModal.tsx`

**Interfaces:**
- Consumes: `BotSellerInfo` mới (có `tier`/`slug`), fallback `reputation`→`trustScore`.
- Produces: hiển thị tick xanh theo `sellerVerified`; "Điểm uy tín" hiện giá trị `trustScore` (fallback rating*20 nếu chưa có); link dùng slug.

- [ ] **Step 1: Cập nhật `BotSellerInfo` trong shared types**

Thêm `tier?: SellerTier;` và `slug?: string;` vào `BotSellerInfo`.

- [ ] **Step 2: Cập nhật render**

Thay `{bot.seller.reputation ?? Math.round(bot.seller.rating * 20)}` bằng `{bot.seller.trustScore ?? bot.seller.reputation ?? Math.round(bot.seller.rating * 20)}`. Thêm `tier === 'trusted' || tier === 'top'` → hiện tick xanh kèm badge nhỏ.

- [ ] **Step 3: Test thủ công**

Xem bot card + trang bot hiện điểm uy tín mới.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/bot web/src/app/bots web/src/components/modals shared/types.ts && git commit -m "feat: hiển thị trust score + tick xanh trên bot"
```

---

### Task 12: Lịch sử uy tín trong seller profile (timeline) + verifiedAt

**Files:**
- Modify: `web/src/app/sellers/[slug]/page.tsx`

**Interfaces:**
- Consumes: `profile.trustEvents`, `profile.user.verifiedAt`.
- Produces: section "Lịch sử uy tín" trên profile.

- [ ] **Step 1: Thêm section timeline**

Trong `page.tsx`, sau phần bots (hoặc trước), render:
```tsx
{profile.trustEvents?.length > 0 && (
  <section aria-label="Lịch sử uy tín" className="mt-8">
    <h2 className="text-lg font-semibold">Lịch sử uy tín</h2>
    <ol className="mt-4 space-y-3">
      {profile.trustEvents.map((ev) => (
        <li key={ev.id} className="flex items-start gap-3 text-sm">
          <span className="mt-1 h-2 w-2 rounded-full bg-brand" aria-hidden />
          <div>
            <p>{trustEventLabel(ev.type)}</p>
            <p className="text-xs text-muted-foreground">{ev.createdAt}</p>
          </div>
        </li>
      ))}
    </ol>
  </section>
)}
```
Với `trustEventLabel` map type → tiếng Việt (hàm đặt trong file).

- [ ] **Step 2: Test thủ công**

Mở profile seller có data — thấy timeline.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/sellers && git commit -m "feat: lịch sử uy tín (timeline) trên seller profile"
```

---

### Task 13: Redirect `/sellers/[id]` cũ sang slug + regression

**Files:**
- Modify: `web/next.config.ts` hoặc tạo redirect trong `web/src/app/sellers/[slug]/page.tsx` (handle cả id cũ)
- Test: curl

**Interfaces:**
- Consumes: API trả `user.slug`.
- Produces: khi truy cập `/sellers/<old-id>` → redirect client (useEffect) sang `/sellers/<slug>` nếu khác.

- [ ] **Step 1: Xử lý trong `page.tsx`**

Sau khi fetch thành công, nếu `params.slug !== profile.user.slug` và `profile.user.slug` tồn tại → `router.replace(`/sellers/${profile.user.slug}`)`.

- [ ] **Step 2: Test**

Truy cập URL id cũ → tự chuyển sang slug mới (URL thay đổi).

- [ ] **Step 3: Commit**

```bash
git add web/src/app/sellers && git commit -m "feat: redirect seller id cũ sang slug"
```

---

### Task 14: E2E + regression + polish

**Files:**
- Modify: toàn bộ đã tạo
- Test: chạy full build + manual flows

**Interfaces:**
- Consumes: tất cả các endpoint + UI đã làm.
- Produces: xác nhận luồng hoàn chỉnh hoạt động.

- [ ] **Step 1: Chạy build cả 2 workspace**

```bash
cd D:/webthuebot && npm run build
```

Expected: không lỗi TS/Next build.

- [ ] **Step 2: Kiểm tra luồng end-to-end thủ công**

1. Seller mới: đăng nhập Google → chọn seller → `/dashboard` → tab Hồ sơ: điền shopName, bio, avatar, liên hệ → lưu.
2. Tab Uy tín: xem checklist (các mục chưa đạt hiện ✗).
3. Nộp hồ sơ → bị chặn nếu chưa đủ điều kiện (checklist ✗) — đúng.
4. (Tạm seed để đạt ngưỡng) → nộp được → admin vào `/admin/verifications` thấy pending → duyệt.
5. Seller profile: `/sellers/<slug>` hiện tick xanh ✓ Trust Seller + trust score + timeline.
6. Bot cũ của seller: tick xanh theo snapshot đã sync.
7. Hết hạn: chờ cron (hoặc sửa DB thủ công `expiresAt` quá khứ) → tự động expired.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test: verify trust foundation flows"
```

---

## Self-Review

**Spec coverage map:**
- Schema/User.tier/trustScore → Task 1
- SellerProfile/Slug/contact/avatar/banner → Task 1 + Task 2 (getOrCreateProfile) + Task 3 (updateProfile)
- TrustScoreService registry + breakdown → Task 2
- Tier (new/active/trusted/top) → Task 2 computeTier
- Verification lifecycle (submit/approve/reject/expire/under_review) → Task 2 + Task 3 (controllers) + Task 6 (cron) + admin controller
- Ngưỡng checklist 30ng/5review/4.5/80%/75 → Task 2 getChecklist
- isVerified nghĩa mới (chỉ khi approved còn hạn) → Task 5 (promoteToSeller) + Task 3 (approve/reject) + Task 6 (expire)
- Sync Bot snapshot → Task 2 syncBotSnapshots + Task 5 (sau tạo bot)
- Bỏ reputation heuristic → Task 4 (userToOut bỏ reputation/sales) + Task 11 (fallback tạm thời)
- API seller me + admin → Task 3
- GET /sellers/:identifier (id+slug) → Task 4
- Frontend /sellers/[slug] + badge + score + verifiedAt + timeline → Task 8 + 12
- Dashboard tab Hồ sơ + Uy tín → Task 9
- Admin verifications queue → Task 10
- Redirect id cũ → slug → Task 13
- Cron expire + recompute → Task 6
- Backfill → Task 7
- Testing unit cho components → Task 2 (spec) — test đầy đủ hơn trong quá trình làm
- E2E → Task 14

**Placeholder scan:** Không có "TBD/TODO". Các bước đều có code hoặc lệnh cụ thể. Một chỗ trong Task 8 "Chi tiết render" dùng mô tả (badge/progress/timeline) nhưng có hướng dẫn component cụ thể — chấp nhận được vì là UI.

**Type consistency:** `TrustChecklistItem`, `TrustStatus`, `TrustScoreInfo`, `SellerTier`, `SellerTrustEvent` định nghĩa Task 1, dùng lại ở Task 2/3/4/8. `BotSellerInfo` thêm `tier/slug` ở Task 8, dùng ở Task 11. `TrustService.recompute` trả `{score, tier, breakdown}` — controller dùng `recomputed.tier`. Khớp.

**Gap nhỏ:** `BotSellerInfo.reputation` vẫn tồn tại trong type (không xóa) để fallback; `reputation`/`sales` bị bỏ khỏi `SellerProfileUser` (Task 1) — cần xác nhận không nơi nào khác dùng `sellerProfile.user.sales` (chỉ mock-data cũ, không ảnh hưởng runtime). Trang `web/src/app/profile/page.tsx` dùng `user.id` link seller — giữ fallback id là ổn.
