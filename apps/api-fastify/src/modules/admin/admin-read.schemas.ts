import { successWithSchema } from '../../core/route-schemas.js';

const nullableString = { type: ['string', 'null'] } as const;
const stringArray = { type: 'array', items: { type: 'string', maxLength: 20_000 } } as const;

export const overviewSchema = {
  type: 'object', additionalProperties: false,
  required: ['needsAttention', 'highPriority', 'activityToday', 'marketplace', 'staff', 'generatedAt'],
  properties: {
    needsAttention: { type: 'object', additionalProperties: false, required: ['botApprovals', 'trustRequests', 'reports', 'riskyReviews'], properties: { botApprovals: { type: 'integer' }, trustRequests: { type: 'integer' }, reports: { type: 'integer' }, riskyReviews: { type: 'integer' } } },
    highPriority: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, sourceId: { type: 'string' }, type: { type: 'string' }, targetType: { type: 'string' }, targetId: { type: 'string' }, targetName: { type: 'string' }, reason: { type: 'string' }, details: nullableString, priority: { type: 'string' }, status: { type: 'string' }, assignedTo: nullableString, createdAt: { type: 'string' }, reference: { type: 'string' } } } },
    activityToday: { type: 'object', additionalProperties: false, required: ['botsUpdated', 'sellersJoined', 'reportsCreated', 'postsPending'], properties: { botsUpdated: { type: 'integer' }, sellersJoined: { type: 'integer' }, reportsCreated: { type: 'integer' }, postsPending: { type: 'integer' } } },
    marketplace: { type: 'object', additionalProperties: false, required: ['bots', 'activeBots', 'sellers', 'trustedSellers', 'posts', 'comments'], properties: { bots: { type: 'integer' }, activeBots: { type: 'integer' }, sellers: { type: 'integer' }, trustedSellers: { type: 'integer' }, posts: { type: 'integer' }, comments: { type: 'integer' } } },
    staff: { type: 'object', additionalProperties: false, required: ['total'], properties: { total: { type: 'integer' } } }, generatedAt: { type: 'string' },
  },
};

export const moderationItemSchema = {
  type: 'object', additionalProperties: false,
  required: ['id', 'sourceId', 'type', 'targetType', 'targetId', 'targetName', 'reason', 'priority', 'status', 'createdAt'],
  properties: { id: { type: 'string' }, sourceId: { type: 'string' }, type: { type: 'string' }, targetType: { type: 'string' }, targetId: { type: 'string' }, targetName: { type: 'string' }, reason: { type: 'string' }, details: nullableString, priority: { type: 'string' }, status: { type: 'string' }, assignedTo: nullableString, createdAt: { type: 'string' }, reference: { type: 'string' } },
};

export const searchItemSchema = {
  type: 'object', additionalProperties: false, required: ['type', 'id', 'label', 'description', 'role'], properties: { type: { type: 'string' }, id: { type: 'string' }, label: { type: 'string' }, description: { type: 'string' }, role: nullableString },
};

export const adminCaseSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'reference', 'type', 'targetId', 'targetName', 'reason', 'priority', 'status', 'createdAt', 'updatedAt'],
  properties: { id: { type: 'string' }, reference: { type: 'string' }, type: { type: 'string' }, targetId: { type: 'string' }, targetName: { type: 'string' }, reason: { type: 'string' }, priority: { type: 'string' }, status: { type: 'string' }, assignedTo: nullableString, reporterId: nullableString, details: nullableString, evidence: stringArray, notes: stringArray, createdAt: { type: 'string' }, updatedAt: { type: 'string' }, resolvedAt: nullableString, resolvedBy: nullableString },
};

const adminBotPricingSchema = {
  type: 'object', additionalProperties: false,
  required: ['monthlyPrice', 'description', 'images'],
  properties: { monthlyPrice: { type: 'number' }, description: { type: 'string' }, images: { type: 'array', items: { type: 'string' } } },
} as const;

export const adminBotSchema = {
  type: 'object', additionalProperties: false, required: ['id'],
  properties: {
    id: { type: 'string' }, slug: { type: 'string' }, title: { type: 'string' }, tagline: { type: 'string' }, description: { type: 'string' },
    categorySlug: { type: 'string' }, categoryName: { type: 'string' }, sellerId: { type: 'string' }, sellerName: { type: 'string' }, sellerAvatar: { type: 'string' },
    sellerVerificationState: { type: 'string' }, sellerTrustedUntil: nullableString, sellerJoinedDate: { type: 'string' }, coverImage: { type: 'string' },
    gallery: { type: 'array', items: { type: 'string' } }, features: { type: 'array', items: { type: 'string' } }, monthlyPrice: { type: 'number' },
    pricingDescription: { type: 'string' }, pricingImages: { type: 'array', items: { type: 'string' } }, targetAudience: { type: 'array', items: { type: 'string' } },
    status: { type: 'string' }, rating: { type: 'number' }, reviewCount: { type: 'integer' }, views: { type: 'integer' }, tags: { type: 'array', items: { type: 'string' } },
    version: { type: 'string' }, systemReqs: { type: 'string' }, pricingUpdatedAt: { type: 'string' }, updatedAt: { type: 'string' }, pricing: adminBotPricingSchema,
  },
} as const;

const adminBotSellerSchema = {
  type: ['object', 'null'], additionalProperties: false,
  properties: {
    id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, avatar: { type: 'string' }, verificationState: { type: 'string' },
    trustScore: { type: 'number' }, joinedDate: { type: 'string' }, trustedUntil: nullableString,
    sellerProfile: { type: ['object', 'null'], additionalProperties: false, properties: { slug: { type: 'string' }, shopName: { type: 'string' } } },
  },
} as const;

const adminUserSchema = { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, avatar: { type: 'string' }, role: { type: 'string' }, joinedDate: { type: 'string' }, verificationState: { type: 'string' }, trustScore: { type: 'number' }, trustedAt: nullableString, trustedUntil: nullableString, staffRole: nullableString, botCount: { type: 'integer' }, postCount: { type: 'integer' }, commentCount: { type: 'integer' }, reviewCount: { type: 'integer' } } };
const adminReviewSchema = { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, botId: { type: 'string' }, userId: { type: 'string' }, rating: { type: 'integer' }, comment: { type: 'string' }, images: { type: 'string' }, createdAt: { type: 'string' }, user: adminUserSchema, bot: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, title: { type: 'string' }, sellerName: { type: 'string' }, sellerId: { type: 'string' } } } } };

const sellerProfileAdminSchema = {
  type: ['object', 'null'], additionalProperties: false,
  properties: {
    id: { type: 'string' }, userId: { type: 'string' }, shopName: { type: 'string' }, slug: { type: 'string' }, bio: nullableString,
    avatar: nullableString, banner: nullableString, contact: { type: 'object', additionalProperties: { type: 'string' } }, profileCompleteness: { type: 'integer' }, updatedAt: { type: 'string' },
  },
} as const;

const verificationAdminSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, userId: { type: 'string' }, status: { type: 'string' }, note: nullableString, submittedAt: { type: 'string' }, reviewedAt: nullableString,
    reviewedBy: nullableString, expiresAt: nullableString, trustedAt: nullableString, trustedUntil: nullableString, approvedBy: nullableString,
    verificationVersion: { type: 'integer' }, recommendation: nullableString,
  },
} as const;

const verificationCheckAdminSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, userId: { type: 'string' }, kind: { type: 'string' }, status: { type: 'string' }, value: nullableString, method: nullableString,
    note: nullableString, verifiedAt: nullableString, verifiedBy: nullableString, expiresAt: nullableString, createdAt: { type: 'string' }, updatedAt: { type: 'string' },
  },
} as const;

const trustEventAdminSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, userId: { type: 'string' }, type: { type: 'string' },
    detail: {
      type: 'object', additionalProperties: false,
      properties: {
        version: { type: 'integer' }, reason: { type: 'string', maxLength: 200 }, kind: { type: 'string', maxLength: 80 },
        status: { type: 'string', maxLength: 40 }, action: { type: 'string', maxLength: 80 }, actorId: { type: 'string', maxLength: 160 },
        actorRole: { type: 'string', maxLength: 40 }, note: { type: 'string', maxLength: 1_000 }, verificationId: { type: 'string', maxLength: 160 },
        trustedUntil: { type: 'string' }, from: { type: ['string', 'number', 'boolean', 'null'] }, to: { type: ['string', 'number', 'boolean', 'null'] },
      },
    },
    createdAt: { type: 'string' },
  },
} as const;

export const sellerListSchema = { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, avatar: { type: 'string' }, joinedDate: { type: 'string' }, verificationState: { type: 'string' }, trustScore: { type: 'number' }, trustScoreReady: { type: 'boolean' }, trustedUntil: nullableString, staffRole: nullableString, shop: { type: ['object', 'null'], additionalProperties: false, properties: { name: { type: 'string' }, slug: { type: 'string' }, completeness: { type: 'integer' } } }, botCount: { type: 'integer' }, activeBotCount: { type: 'integer' }, views: { type: 'integer' }, reviewCount: { type: 'integer' }, averageRating: { type: 'number' } } } };
export const sellerDetailSchema = { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, avatar: { type: 'string' }, joinedDate: { type: 'string' }, bio: nullableString, contact: { type: 'object', additionalProperties: { type: 'string' } }, verificationState: { type: 'string' }, trustScore: { type: 'number' }, trustScoreReady: { type: 'boolean' }, trustedAt: nullableString, trustedUntil: nullableString, staffRole: nullableString, shop: sellerProfileAdminSchema, bots: { type: 'array', items: adminBotSchema }, reviews: { type: 'array', items: adminReviewSchema }, verifications: { type: 'array', items: verificationAdminSchema }, verificationChecks: { type: 'array', items: verificationCheckAdminSchema }, trustEvents: { type: 'array', items: trustEventAdminSchema } } };
export const botDetailSchema = { type: 'object', additionalProperties: false, properties: { ...adminBotSchema.properties, seller: { ...adminBotSellerSchema }, reviews: { type: 'array', items: adminReviewSchema } } };
export const staffSchema = { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, userId: { type: 'string' }, role: { type: 'string' }, isActive: { type: 'boolean' }, createdAt: { type: 'string' }, updatedAt: { type: 'string' }, appointedBy: nullableString, invitedBy: nullableString, isRootOwner: { type: 'boolean' }, user: adminUserSchema } } };
export const commentsSchema = { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, targetType: { type: 'string' }, targetId: { type: 'string' }, authorId: nullableString, authorName: { type: 'string' }, authorAvatar: { type: 'string' }, content: { type: 'string' }, createdAt: { type: 'string' }, targetName: { type: 'string' } } } };
const countLabelSchema = { type: 'object', additionalProperties: false, required: ['label', 'count'], properties: { label: { type: 'string' }, count: { type: 'integer' } } } as const;
export const analyticsSchema = { type: 'object', additionalProperties: false, properties: {
  generatedAt: { type: 'string' },
  marketplace: { type: 'object', additionalProperties: false, properties: { bots: { type: 'integer' }, activeBots: { type: 'integer' }, sellers: { type: 'integer' }, trustedSellers: { type: 'integer' }, posts: { type: 'integer' }, comments: { type: 'integer' }, botViews: { type: 'integer' }, postViews: { type: 'integer' } } },
  moderation: { type: 'object', additionalProperties: false, properties: { botApprovals: { type: 'integer' }, trustRequests: { type: 'integer' }, reports: { type: 'integer' }, riskyReviews: { type: 'integer' }, reportsByCategory: { type: 'array', items: countLabelSchema } } },
  trust: { type: 'object', additionalProperties: false, properties: { sellersByState: { type: 'array', items: countLabelSchema } } },
  reviews: { type: 'object', additionalProperties: false, properties: { total: { type: 'integer' }, averageRating: { type: 'number' }, ratings: { type: 'array', items: countLabelSchema } } },
  bots: { type: 'object', additionalProperties: false, properties: { byStatus: { type: 'array', items: countLabelSchema }, topByViews: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, title: { type: 'string' }, sellerName: { type: 'string' }, views: { type: 'integer' }, status: { type: 'string' } } } } } },
  posts: { type: 'object', additionalProperties: false, properties: { byStatus: { type: 'array', items: countLabelSchema } } },
  tracking: { type: 'object', additionalProperties: false, properties: { contactClicks: { type: ['integer', 'null'] }, note: { type: 'string' } } },
} };
export const auditSchema = { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, actorId: { type: 'string' }, actorName: { type: 'string' }, actorRole: { type: 'string' }, action: { type: 'string' }, targetType: { type: 'string' }, targetId: nullableString, caseId: nullableString, reason: nullableString, beforeData: nullableString, afterData: nullableString, createdAt: { type: 'string' }, previousHash: { type: 'string' }, eventHash: { type: 'string' } } } };
export const riskyReviewsSchema = { type: 'array', items: adminReviewSchema };

export const overviewResponse = successWithSchema(overviewSchema);
export const moderationResponse = successWithSchema({ type: 'array', items: moderationItemSchema });
export const searchResponse = successWithSchema({ type: 'array', items: searchItemSchema });
export const casesResponse = successWithSchema({ type: 'array', items: adminCaseSchema });
export const caseResponse = successWithSchema(adminCaseSchema);
export const sellersResponse = successWithSchema(sellerListSchema);
export const sellerResponse = successWithSchema(sellerDetailSchema);
export const botsResponse = successWithSchema({ type: 'array', items: adminBotSchema });
export const botResponse = successWithSchema(botDetailSchema);
export const usersResponse = successWithSchema({ type: 'array', items: adminUserSchema });
export const staffResponse = successWithSchema(staffSchema);
export const commentsResponse = successWithSchema(commentsSchema);
export const analyticsResponse = successWithSchema(analyticsSchema);
export const auditResponse = successWithSchema(auditSchema);
export const riskyReviewsResponse = successWithSchema(riskyReviewsSchema);
