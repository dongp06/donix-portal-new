-- Marketplace cleanup: drop wallet/rental/license, provider→seller, buyer/seller roles, ForumPost.authorId

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- User: bỏ walletBalance, đổi role renter→buyer / provider→seller
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "joinedDate" TEXT NOT NULL,
    "contact" TEXT
);
INSERT INTO "new_User" ("avatar", "bio", "contact", "email", "googleId", "id", "isVerified", "joinedDate", "name", "role")
SELECT "avatar", "bio", "contact", "email", "googleId", "id", "isVerified", "joinedDate", "name",
  CASE WHEN "role" = 'renter' THEN 'buyer' WHEN "role" = 'provider' THEN 'seller' ELSE "role" END
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Bot: provider* → seller*, bỏ totalRentals/activeRentals/licenseType
CREATE TABLE "new_Bot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerAvatar" TEXT NOT NULL,
    "sellerRating" REAL NOT NULL DEFAULT 0,
    "sellerSales" INTEGER NOT NULL DEFAULT 0,
    "sellerVerified" BOOLEAN NOT NULL DEFAULT false,
    "sellerJoinedDate" TEXT NOT NULL,
    "contactZalo" TEXT,
    "contactTelegram" TEXT,
    "contactPhone" TEXT,
    "contactMessenger" TEXT,
    "contactFacebook" TEXT,
    "coverImage" TEXT NOT NULL,
    "gallery" TEXT NOT NULL DEFAULT '[]',
    "features" TEXT NOT NULL DEFAULT '[]',
    "priceHourly" INTEGER NOT NULL DEFAULT 0,
    "priceDaily" INTEGER NOT NULL DEFAULT 0,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'online',
    "rating" REAL NOT NULL DEFAULT 5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "version" TEXT NOT NULL DEFAULT 'v1.0.0',
    "systemReqs" TEXT NOT NULL DEFAULT '',
    "updatedAt" TEXT NOT NULL
);
INSERT INTO "new_Bot" ("categoryName", "categorySlug", "contactFacebook", "contactMessenger", "contactPhone", "contactTelegram", "contactZalo", "coverImage", "description", "features", "gallery", "id", "priceDaily", "priceHourly", "priceMonthly", "rating", "reviewCount", "sellerAvatar", "sellerId", "sellerJoinedDate", "sellerName", "sellerRating", "sellerSales", "sellerVerified", "slug", "status", "systemReqs", "tagline", "tags", "title", "updatedAt", "version")
SELECT "categoryName", "categorySlug", "contactFacebook", "contactMessenger", "contactPhone", "contactTelegram", "contactZalo", "coverImage", "description", "features", "gallery", "id", "priceDaily", "priceHourly", "priceMonthly", "rating", "reviewCount", "providerAvatar", "providerId", "providerJoinedDate", "providerName", "providerRating", "providerSales", "providerVerified", "slug", "status", "systemReqs", "tagline", "tags", "title", "updatedAt", "version"
FROM "Bot";
DROP TABLE "Bot";
ALTER TABLE "new_Bot" RENAME TO "Bot";
CREATE UNIQUE INDEX "Bot_slug_key" ON "Bot"("slug");
CREATE INDEX "Bot_categorySlug_idx" ON "Bot"("categorySlug");
CREATE INDEX "Bot_sellerId_idx" ON "Bot"("sellerId");

-- ForumPost: thêm authorId (nullable, khóa ngoại tới User)
CREATE TABLE "new_ForumPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL DEFAULT 'Người mua',
    "category" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ForumPost" ("authorAvatar", "authorName", "authorRole", "category", "commentsCount", "content", "createdAt", "excerpt", "id", "isPinned", "tags", "title", "upvotes")
SELECT "authorAvatar", "authorName", "authorRole", "category", "commentsCount", "content", "createdAt", "excerpt", "id", "isPinned", "tags", "title", "upvotes"
FROM "ForumPost";
DROP TABLE "ForumPost";
ALTER TABLE "new_ForumPost" RENAME TO "ForumPost";
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");
CREATE INDEX "ForumPost_category_idx" ON "ForumPost"("category");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

