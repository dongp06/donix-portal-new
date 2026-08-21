type JsonSchema = Record<string, unknown>;

const nullableString = { type: ['string', 'null'] } as const;
const stringArray = { type: 'array', items: { type: 'string' } } as const;

const reactionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['emoji', 'count', 'reactedByMe'],
  properties: {
    emoji: { type: 'string', minLength: 1, maxLength: 32 },
    count: { type: 'integer', minimum: 0 },
    reactedByMe: { type: 'boolean' },
  },
} as const;

const publicCommentProperties = {
  id: { type: 'string' },
  targetType: { type: 'string', enum: ['post', 'bot'] },
  targetId: { type: 'string' },
  parentId: nullableString,
  authorId: nullableString,
  authorName: { type: 'string' },
  authorAvatar: { type: 'string' },
  content: { type: 'string' },
  reactions: { type: 'array', items: reactionSchema },
  reactionCount: { type: 'integer', minimum: 0 },
  isOwn: { type: 'boolean' },
  createdAt: { type: 'string' },
} as const;

// Comment creation only permits one reply level. Keeping that invariant in
// the response schema prevents a future ORM object from being serialized as
// an arbitrary recursive payload.
const publicCommentReplySchema = {
  type: 'object',
  additionalProperties: false,
  required: [...Object.keys(publicCommentProperties), 'replies'],
  properties: {
    ...publicCommentProperties,
    replies: { type: 'array', maxItems: 0, items: { type: 'object', additionalProperties: false } },
  },
} as const;

export function successWithSchema(data: JsonSchema): JsonSchema {
  return {
    type: 'object',
    required: ['success', 'data'],
    additionalProperties: false,
    properties: { success: { const: true }, data },
  };
}

export const publicResourceFileSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'originalName', 'mimeType', 'sizeBytes', 'sizeLabel', 'sha256', 'previewable', 'downloadCount'],
  properties: {
    id: { type: 'string' },
    originalName: { type: 'string' },
    mimeType: { type: 'string' },
    sizeBytes: { type: 'integer', minimum: 0 },
    sizeLabel: { type: 'string' },
    sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    previewable: { type: 'boolean' },
    downloadCount: { type: 'integer', minimum: 0 },
    language: { type: 'string' },
  },
};

export const publicResourceVersionSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'version', 'changelog', 'publishedAt', 'files'],
  properties: {
    id: { type: 'string' },
    version: { type: 'string' },
    changelog: { type: 'string' },
    publishedAt: nullableString,
    files: { type: 'array', items: publicResourceFileSchema },
  },
};

export const publicResourceSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'description', 'license', 'allowDownload', 'showSource', 'requiresLogin', 'currentVersion'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    license: { type: 'string' },
    allowDownload: { type: 'boolean' },
    showSource: { type: 'boolean' },
    requiresLogin: { type: 'boolean' },
    currentVersion: publicResourceVersionSchema,
    versions: { type: 'array', items: publicResourceVersionSchema },
    postSlug: { type: 'string' },
    postTitle: { type: 'string' },
    postExcerpt: { type: 'string' },
    postCoverImage: nullableString,
    authorName: { type: 'string' },
    authorAvatar: { type: 'string' },
    publishedAt: nullableString,
  },
};

export const publicBotSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'slug', 'title', 'tagline', 'description', 'categorySlug', 'categoryName', 'seller', 'coverImage', 'gallery', 'features', 'pricing', 'status', 'rating', 'reviewCount', 'views', 'tags', 'targetAudience', 'version', 'systemReqs', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    title: { type: 'string' },
    tagline: { type: 'string' },
    description: { type: 'string' },
    categorySlug: { type: 'string' },
    categoryName: { type: 'string' },
    seller: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'avatar', 'rating', 'reputation', 'totalSales', 'isTrusted', 'verificationState', 'joinedDate'],
      properties: {
        id: { type: 'string' }, name: { type: 'string' }, avatar: { type: 'string' },
        rating: { type: 'number' }, reputation: { type: 'number' }, totalSales: { type: 'integer', minimum: 0 },
        isTrusted: { type: 'boolean' }, verificationState: { type: 'string' }, trustedUntil: { type: 'string' },
        joinedDate: { type: 'string' }, slug: { type: 'string' },
        contact: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    coverImage: { type: 'string' },
    gallery: stringArray,
    features: stringArray,
    pricing: {
      type: 'object', additionalProperties: false, required: ['monthlyPrice', 'pricingImages'],
      properties: { monthlyPrice: { type: 'number' }, pricingDescription: { type: 'string' }, pricingImages: stringArray },
    },
    status: { type: 'string' }, rating: { type: 'number' }, reviewCount: { type: 'integer', minimum: 0 }, views: { type: 'integer', minimum: 0 },
    tags: stringArray, targetAudience: stringArray, version: { type: 'string' }, systemReqs: { type: 'string' },
    pricingUpdatedAt: { type: 'string' }, updatedAt: { type: 'string' },
  },
};

export const publicReviewSchema: JsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['id', 'userId', 'userName', 'userAvatar', 'rating', 'comment', 'images', 'createdAt', 'isOwn'],
  properties: {
    id: { type: 'string' }, userId: { type: 'string' }, userName: { type: 'string' }, userAvatar: { type: 'string' },
    rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string' }, images: stringArray,
    createdAt: { type: 'string' }, isOwn: { type: 'boolean' },
  },
};

export const publicPostSchema: JsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['id', 'slug', 'title', 'excerpt', 'type', 'status', 'category', 'categoryName', 'coverImage', 'author', 'tags', 'views', 'commentsCount', 'reactionCount', 'bookmarkCount', 'reportCount', 'isPinned', 'isFeatured', 'commentsLocked', 'readTimeMinutes', 'createdAt', 'updatedAt', 'isOwn', 'reactions'],
  properties: {
    id: { type: 'string' }, slug: { type: 'string' }, title: { type: 'string' }, excerpt: { type: 'string' }, content: { type: 'string' },
    type: { type: 'string' }, status: { type: 'string' }, category: { type: 'string' }, categoryName: { type: 'string' },
    coverImage: nullableString, linkedBotId: nullableString,
    author: {
      type: 'object', additionalProperties: false,
      required: ['id', 'name', 'avatar', 'role', 'isTrusted', 'isOfficial', 'verificationState'],
      properties: {
        id: nullableString, name: { type: 'string' }, avatar: { type: 'string' }, role: { type: 'string' }, slug: { type: 'string' }, tier: { type: 'string' }, trustScore: { type: 'number' },
        isTrusted: { type: 'boolean' }, isOfficial: { type: 'boolean' }, officialRole: nullableString, verificationState: { type: 'string' }, trustedAt: nullableString, trustedUntil: nullableString,
      },
    },
    tags: stringArray, views: { type: 'integer', minimum: 0 }, commentsCount: { type: 'integer', minimum: 0 }, reactionCount: { type: 'integer', minimum: 0 }, bookmarkCount: { type: 'integer', minimum: 0 }, reportCount: { type: 'integer', minimum: 0 },
    isPinned: { type: 'boolean' }, isFeatured: { type: 'boolean' }, commentsLocked: { type: 'boolean' }, answerCommentId: nullableString, readTimeMinutes: { type: 'integer', minimum: 1 },
    createdAt: { type: 'string' }, updatedAt: { type: 'string' }, publishedAt: nullableString, scheduledAt: nullableString, isOwn: { type: 'boolean' }, isBookmarked: { type: 'boolean' },
    reactions: { type: 'array', items: reactionSchema },
    resource: publicResourceSchema,
  },
};

export const publicPostListSchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['items', 'pagination', 'categories', 'trendingTags'],
  properties: {
    items: { type: 'array', items: publicPostSchema },
    pagination: { type: 'object', additionalProperties: false, required: ['page', 'limit', 'total', 'totalPages', 'hasMore'], properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' }, hasMore: { type: 'boolean' } } },
    categories: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['slug', 'name', 'count'], properties: { slug: { type: 'string' }, name: { type: 'string' }, count: { type: 'integer' } } } },
    trendingTags: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tag', 'count'], properties: { tag: { type: 'string' }, count: { type: 'integer' } } } },
  },
};

export const publicCommentSchema: JsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['id', 'targetType', 'targetId', 'parentId', 'authorId', 'authorName', 'authorAvatar', 'content', 'reactions', 'reactionCount', 'isOwn', 'createdAt', 'replies'],
  properties: {
    ...publicCommentProperties,
    replies: { type: 'array', items: publicCommentReplySchema },
  },
};

const trustEventDetailSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    version: { type: 'integer' },
    reason: { type: 'string', maxLength: 200 },
    kind: { type: 'string', maxLength: 80 },
    status: { type: 'string', maxLength: 40 },
    action: { type: 'string', maxLength: 80 },
    actorId: { type: 'string', maxLength: 160 },
    actorRole: { type: 'string', maxLength: 40 },
    note: { type: 'string', maxLength: 1_000 },
    verificationId: { type: 'string', maxLength: 160 },
    trustedUntil: { type: 'string' },
    from: { type: ['string', 'number', 'boolean', 'null'] },
    to: { type: ['string', 'number', 'boolean', 'null'] },
  },
} as const;

export const botCategorySchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'slug', 'name', 'icon', 'description', 'count'],
  properties: { id: { type: 'string' }, slug: { type: 'string' }, name: { type: 'string' }, icon: { type: 'string' }, description: { type: 'string' }, count: { type: 'integer', minimum: 0 } },
};

export const postCategorySchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['slug', 'name'], properties: { slug: { type: 'string' }, name: { type: 'string' }, count: { type: 'integer', minimum: 0 } },
};

export const publicSellerProfileSchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['user', 'bots', 'posts', 'trustEvents', 'reviews', 'reviewSummary'],
  properties: {
    user: {
      type: 'object', additionalProperties: false,
      required: ['id', 'name', 'avatar', 'role', 'joinedDate', 'contact', 'trustScore', 'tier', 'slug', 'verificationState', 'isTrusted', 'basicVerifiedCount', 'basicVerifiedTotal', 'followerCount', 'isFollowing'],
      properties: {
        id: { type: 'string' }, name: { type: 'string' }, avatar: { type: 'string' }, role: { type: 'string' }, bio: nullableString, joinedDate: { type: 'string' }, contact: { type: 'object', additionalProperties: { type: 'string' } }, trustScore: { type: 'number' }, tier: { type: 'string' }, slug: { type: 'string' }, verifiedAt: nullableString, verificationState: { type: 'string' }, trustedAt: nullableString, trustedUntil: nullableString, isTrusted: { type: 'boolean' }, basicVerifiedCount: { type: 'integer' }, basicVerifiedTotal: { type: 'integer' }, followerCount: { type: 'integer', minimum: 0 }, isFollowing: { type: 'boolean' },
      },
    },
    bots: { type: 'array', items: publicBotSchema }, posts: { type: 'array', items: publicPostSchema },
    trustEvents: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'type', 'createdAt'], properties: { id: { type: 'string' }, type: { type: 'string' }, detail: trustEventDetailSchema, createdAt: { type: 'string' } } } },
    reviews: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'userName', 'userAvatar', 'rating', 'date', 'comment', 'images', 'botId', 'botTitle'], properties: { id: { type: 'string' }, userName: { type: 'string' }, userAvatar: { type: 'string' }, rating: { type: 'integer' }, date: { type: 'string' }, comment: { type: 'string' }, images: stringArray, botId: { type: 'string' }, botTitle: { type: 'string' } } } },
    reviewSummary: { type: 'object', additionalProperties: false, required: ['total', 'average', 'distribution'], properties: { total: { type: 'integer' }, average: { type: 'number' }, distribution: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'integer' } } } },
  },
};

export const sellerLookupSchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['query', 'matches'],
  properties: {
    query: { type: 'string' },
    matches: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'name', 'shopName', 'avatar', 'profilePath', 'trustScore', 'tier', 'rating', 'reviewCount', 'botCount', 'joinedDate', 'verified', 'isTrusted', 'verificationStatus', 'basicVerifiedCount', 'basicVerifiedTotal', 'matchType', 'exactMatch', 'verificationChecks', 'riskStatus', 'riskMessage'], properties: { id: { type: 'string' }, name: { type: 'string' }, shopName: { type: 'string' }, avatar: { type: 'string' }, slug: { type: 'string' }, profilePath: { type: 'string' }, trustScore: { type: 'number' }, tier: { type: 'string' }, rating: { type: ['number', 'null'] }, reviewCount: { type: 'integer' }, botCount: { type: 'integer' }, joinedDate: { type: 'string' }, verified: { type: 'boolean' }, isTrusted: { type: 'boolean' }, verificationStatus: { type: 'string' }, verifiedAt: { type: 'string' }, trustedUntil: { type: 'string' }, basicVerifiedCount: { type: 'integer' }, basicVerifiedTotal: { type: 'integer' }, matchType: { type: 'string' }, exactMatch: { type: 'boolean' }, verificationChecks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'label', 'status'], properties: { kind: { type: 'string' }, label: { type: 'string' }, status: { type: 'string' }, provided: { type: 'boolean' }, value: { type: 'string' }, method: { type: 'string' }, verifiedAt: { type: 'string' }, expiresAt: { type: 'string' } } } }, riskStatus: { type: 'string' }, riskMessage: { type: 'string' } } } },
  },
};

export const sellerFollowSchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['followerCount', 'isFollowing'], properties: { followerCount: { type: 'integer', minimum: 0 }, isFollowing: { type: 'boolean' } },
};

export const trustCheckSchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['kind', 'label', 'status', 'provided'],
  properties: { kind: { type: 'string' }, label: { type: 'string' }, status: { type: 'string' }, provided: { type: 'boolean' }, value: { type: 'string' }, method: { type: 'string' }, verifiedAt: { type: 'string' }, expiresAt: { type: 'string' } },
};

export const trustChecklistSchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['key', 'label', 'passed', 'current', 'required', 'category', 'automated', 'blocking'],
  properties: { key: { type: 'string' }, label: { type: 'string' }, passed: { type: 'boolean' }, current: { type: 'string' }, required: { type: 'string' }, category: { type: 'string' }, automated: { type: 'boolean' }, blocking: { type: 'boolean' } },
};

export const trustSummarySchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['status', 'state', 'isTrusted', 'basicVerifiedCount', 'basicVerifiedTotal', 'checks', 'checklist', 'score', 'tier'],
  properties: {
    status: { type: 'object', additionalProperties: false, required: ['status', 'canCancel'], properties: { status: { type: 'string' }, submittedAt: { type: 'string' }, reviewedAt: { type: 'string' }, expiresAt: { type: 'string' }, note: { type: 'string' }, canCancel: { type: 'boolean' }, recommendation: { type: 'string', enum: ['approve', 'reject'] } } },
    state: { type: 'string' }, isTrusted: { type: 'boolean' }, trustedAt: { type: 'string' }, trustedUntil: { type: 'string' }, basicVerifiedCount: { type: 'integer' }, basicVerifiedTotal: { type: 'integer' },
    checks: { type: 'array', items: trustCheckSchema }, checklist: { type: 'array', items: trustChecklistSchema },
    score: { type: 'object', additionalProperties: false, required: ['score', 'breakdown'], properties: { score: { type: 'integer' }, updatedAt: { type: 'string' }, breakdown: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'label', 'weight', 'value', 'score'], properties: { key: { type: 'string' }, label: { type: 'string' }, weight: { type: 'integer' }, value: { type: 'number' }, score: { type: 'integer' } } } } } },
    tier: { type: 'string' },
  },
};

export const sellerProfileSchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'userId', 'shopName', 'slug', 'contact', 'profileCompleteness'],
  properties: { id: { type: 'string' }, userId: { type: 'string' }, shopName: { type: 'string' }, slug: { type: 'string' }, bio: { type: 'string' }, avatar: { type: 'string' }, banner: { type: 'string' }, contact: { type: 'object', additionalProperties: { type: 'string' } }, profileCompleteness: { type: 'integer', minimum: 0, maximum: 100 } },
};

export const e2eeDeviceBodySchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['bundle'],
  properties: {
    deviceId: { type: 'string', minLength: 1, maxLength: 160 },
    bundle: { type: 'object', additionalProperties: false, required: ['registration_id', 'device_id', 'signed_pre_key_id', 'signed_pre_key_public', 'signed_pre_key_signature', 'identity_key', 'kyber_pre_key_id', 'kyber_pre_key_public', 'kyber_pre_key_signature'], properties: { registration_id: { type: 'integer', minimum: 1, maximum: 16383 }, device_id: { type: 'integer', minimum: 1, maximum: 127 }, pre_key_id: { type: ['integer', 'null'] }, pre_key_public: { type: ['string', 'null'], maxLength: 16000 }, signed_pre_key_id: { type: 'integer', minimum: 1 }, signed_pre_key_public: { type: 'string', maxLength: 16000 }, signed_pre_key_signature: { type: 'string', maxLength: 16000 }, identity_key: { type: 'string', maxLength: 16000 }, kyber_pre_key_id: { type: 'integer', minimum: 1 }, kyber_pre_key_public: { type: 'string', maxLength: 32000 }, kyber_pre_key_signature: { type: 'string', maxLength: 16000 } } },
    preKeys: { type: 'array', maxItems: 100, items: { type: 'object', additionalProperties: false, required: ['id', 'public_key'], properties: { id: { type: 'integer', minimum: 1 }, public_key: { type: 'string', maxLength: 16000 } } } },
  },
};

export const e2eeConversationBodySchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['recipientUserId'], properties: { recipientUserId: { type: 'string', minLength: 1, maxLength: 160 }, recipientDeviceId: { type: 'string', minLength: 1, maxLength: 160 }, recipientDeviceIds: { type: 'array', maxItems: 127, items: { type: 'string', minLength: 1, maxLength: 160 } } },
};

export const e2eeMessageBodySchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['protocolVersion', 'recipientDeviceId', 'clientMessageId', 'message'], properties: { protocolVersion: { type: 'string', maxLength: 32 }, recipientDeviceId: { type: 'string', minLength: 1, maxLength: 160 }, clientMessageId: { type: 'string', minLength: 1, maxLength: 200 }, message: { type: 'object', additionalProperties: false, required: ['message_type', 'ciphertext'], properties: { message_type: { type: 'integer', enum: [2, 3] }, ciphertext: { type: 'string', minLength: 1, maxLength: 4_000_000, pattern: '^[A-Za-z0-9+/]+$' } } } },
};

export const e2eeAttachmentBodySchema: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['encryptedFileKey', 'nonce', 'ciphertextSha256'], properties: { mimeType: { type: 'string', maxLength: 120 }, encryptedFileKey: { type: 'string', minLength: 1, maxLength: 8_000 }, nonce: { type: 'string', minLength: 1, maxLength: 1_000 }, ciphertextSha256: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' } },
};

const webauthnCredentialDescriptorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'id'],
  properties: {
    type: { const: 'public-key' },
    id: { type: 'string', minLength: 1, maxLength: 1024 },
    transports: { type: 'array', maxItems: 8, items: { type: 'string', enum: ['ble', 'hybrid', 'internal', 'nfc', 'usb'] } },
  },
} as const;

const webauthnPublicKeyParameterSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'alg'],
  properties: { type: { const: 'public-key' }, alg: { type: 'integer' } },
} as const;

export const webauthnOptionsSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['challenge'],
  properties: {
    challenge: { type: 'string', minLength: 1, maxLength: 1024 },
    rp: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', maxLength: 255 }, name: { type: 'string', minLength: 1, maxLength: 256 } } },
    user: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', minLength: 1, maxLength: 1024 }, name: { type: 'string', minLength: 1, maxLength: 320 }, displayName: { type: 'string', maxLength: 320 } } },
    rpId: { type: 'string', minLength: 1, maxLength: 255 },
    allowCredentials: { type: 'array', maxItems: 64, items: webauthnCredentialDescriptorSchema },
    excludeCredentials: { type: 'array', maxItems: 64, items: webauthnCredentialDescriptorSchema },
    pubKeyCredParams: { type: 'array', maxItems: 32, items: webauthnPublicKeyParameterSchema },
    timeout: { type: 'integer', minimum: 1, maximum: 600_000 },
    userVerification: { type: 'string', enum: ['required', 'preferred', 'discouraged'] },
    authenticatorSelection: { type: 'object', additionalProperties: false, properties: { authenticatorAttachment: { type: 'string', enum: ['platform', 'cross-platform'] }, residentKey: { type: 'string', enum: ['discouraged', 'preferred', 'required'] }, requireResidentKey: { type: 'boolean' }, userVerification: { type: 'string', enum: ['required', 'preferred', 'discouraged'] } } },
    attestation: { type: 'string', enum: ['none', 'indirect', 'direct', 'enterprise'] },
    attestationFormats: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 80 } },
    hints: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 80 } },
    extensions: { type: 'object', additionalProperties: true },
  },
};

export const webauthnResponseSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'rawId', 'response', 'type', 'clientExtensionResults'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 1024 },
    rawId: { type: 'string', minLength: 1, maxLength: 2048 },
    type: { const: 'public-key' },
    authenticatorAttachment: { type: ['string', 'null'], enum: ['platform', 'cross-platform', null] },
    clientExtensionResults: { type: 'object', additionalProperties: true },
    response: {
      type: 'object',
      additionalProperties: false,
      required: ['clientDataJSON'],
      properties: {
        clientDataJSON: { type: 'string', minLength: 1, maxLength: 16_384 },
        attestationObject: { type: 'string', maxLength: 65_536 },
        authenticatorData: { type: 'string', maxLength: 16_384 },
        signature: { type: 'string', maxLength: 16_384 },
        userHandle: { type: ['string', 'null'], maxLength: 2048 },
        transports: { type: 'array', maxItems: 8, items: { type: 'string', enum: ['ble', 'hybrid', 'internal', 'nfc', 'usb'] } },
        publicKey: { type: 'string', maxLength: 16_384 },
        publicKeyAlgorithm: { type: 'integer' },
      },
    },
  },
};
