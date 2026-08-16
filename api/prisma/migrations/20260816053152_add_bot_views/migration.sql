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
    "updatedAt" TEXT NOT NULL
);
INSERT INTO "new_Bot" ("categoryName", "categorySlug", "contactFacebook", "contactMessenger", "contactPhone", "contactTelegram", "contactZalo", "coverImage", "description", "features", "gallery", "id", "priceDaily", "priceHourly", "priceMonthly", "rating", "reviewCount", "sellerAvatar", "sellerId", "sellerJoinedDate", "sellerName", "sellerRating", "sellerSales", "sellerVerified", "slug", "status", "systemReqs", "tagline", "tags", "title", "updatedAt", "version") SELECT "categoryName", "categorySlug", "contactFacebook", "contactMessenger", "contactPhone", "contactTelegram", "contactZalo", "coverImage", "description", "features", "gallery", "id", "priceDaily", "priceHourly", "priceMonthly", "rating", "reviewCount", "sellerAvatar", "sellerId", "sellerJoinedDate", "sellerName", "sellerRating", "sellerSales", "sellerVerified", "slug", "status", "systemReqs", "tagline", "tags", "title", "updatedAt", "version" FROM "Bot";
DROP TABLE "Bot";
ALTER TABLE "new_Bot" RENAME TO "Bot";
CREATE UNIQUE INDEX "Bot_slug_key" ON "Bot"("slug");
CREATE INDEX "Bot_categorySlug_idx" ON "Bot"("categorySlug");
CREATE INDEX "Bot_sellerId_idx" ON "Bot"("sellerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
