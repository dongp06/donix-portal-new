-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'renter',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "joinedDate" TEXT NOT NULL,
    "contact" TEXT
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerAvatar" TEXT NOT NULL,
    "providerRating" REAL NOT NULL DEFAULT 0,
    "providerSales" INTEGER NOT NULL DEFAULT 0,
    "providerVerified" BOOLEAN NOT NULL DEFAULT false,
    "providerJoinedDate" TEXT NOT NULL,
    "contactZalo" TEXT,
    "contactTelegram" TEXT,
    "contactPhone" TEXT,
    "coverImage" TEXT NOT NULL,
    "gallery" TEXT NOT NULL DEFAULT '[]',
    "features" TEXT NOT NULL DEFAULT '[]',
    "priceHourly" INTEGER NOT NULL DEFAULT 0,
    "priceDaily" INTEGER NOT NULL DEFAULT 0,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'online',
    "totalRentals" INTEGER NOT NULL DEFAULT 0,
    "activeRentals" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "licenseType" TEXT NOT NULL DEFAULT 'key',
    "version" TEXT NOT NULL DEFAULT 'v1.0.0',
    "systemReqs" TEXT NOT NULL DEFAULT '',
    "updatedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL DEFAULT 'Khách thuê',
    "category" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isPinned" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_slug_key" ON "Bot"("slug");

-- CreateIndex
CREATE INDEX "Bot_categorySlug_idx" ON "Bot"("categorySlug");

-- CreateIndex
CREATE INDEX "Bot_providerId_idx" ON "Bot"("providerId");

