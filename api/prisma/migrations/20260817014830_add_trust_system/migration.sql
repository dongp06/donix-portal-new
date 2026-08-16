-- CreateTable
CREATE TABLE "SellerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT,
    "avatar" TEXT,
    "banner" TEXT,
    "contact" TEXT NOT NULL DEFAULT '{}',
    "profileCompleteness" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "submittedAt" TEXT NOT NULL,
    "reviewedAt" TEXT,
    "reviewedBy" TEXT,
    "expiresAt" TEXT,
    CONSTRAINT "TrustVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "TrustEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "views" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "version" TEXT NOT NULL DEFAULT 'v1.0.0',
    "systemReqs" TEXT NOT NULL DEFAULT '',
    "updatedAt" TEXT NOT NULL,
    "sellerSlug" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Bot" ("categoryName", "categorySlug", "contactFacebook", "contactMessenger", "contactPhone", "contactTelegram", "contactZalo", "coverImage", "description", "features", "gallery", "id", "priceDaily", "priceHourly", "priceMonthly", "rating", "reviewCount", "sellerAvatar", "sellerId", "sellerJoinedDate", "sellerName", "sellerRating", "sellerSales", "sellerVerified", "slug", "status", "systemReqs", "tagline", "tags", "title", "updatedAt", "version") SELECT "categoryName", "categorySlug", "contactFacebook", "contactMessenger", "contactPhone", "contactTelegram", "contactZalo", "coverImage", "description", "features", "gallery", "id", "priceDaily", "priceHourly", "priceMonthly", "rating", "reviewCount", "sellerAvatar", "sellerId", "sellerJoinedDate", "sellerName", "sellerRating", "sellerSales", "sellerVerified", "slug", "status", "systemReqs", "tagline", "tags", "title", "updatedAt", "version" FROM "Bot";
DROP TABLE "Bot";
ALTER TABLE "new_Bot" RENAME TO "Bot";
CREATE UNIQUE INDEX "Bot_slug_key" ON "Bot"("slug");
CREATE INDEX "Bot_categorySlug_idx" ON "Bot"("categorySlug");
CREATE INDEX "Bot_sellerId_idx" ON "Bot"("sellerId");
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
    "contact" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'new',
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "trustScoreUpdatedAt" TEXT
);
INSERT INTO "new_User" ("avatar", "bio", "contact", "email", "googleId", "id", "isVerified", "joinedDate", "name", "role") SELECT "avatar", "bio", "contact", "email", "googleId", "id", "isVerified", "joinedDate", "name", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "SellerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_slug_key" ON "SellerProfile"("slug");

-- CreateIndex
CREATE INDEX "TrustVerification_userId_idx" ON "TrustVerification"("userId");

-- CreateIndex
CREATE INDEX "TrustVerification_status_idx" ON "TrustVerification"("status");

-- CreateIndex
CREATE INDEX "TrustEvent_userId_idx" ON "TrustEvent"("userId");
