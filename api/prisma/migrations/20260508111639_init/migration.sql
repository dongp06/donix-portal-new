-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "navLabel" TEXT
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "readTimeMinutes" INTEGER,
    "stackLabel" TEXT,
    "tagLine" TEXT,
    "codeExample" TEXT,
    "sampleOutput" TEXT,
    "attachments" TEXT,
    "relatedSlugs" TEXT,
    CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");

-- CreateIndex
CREATE INDEX "Post_date_idx" ON "Post"("date");

-- CreateIndex
CREATE INDEX "Post_isPinned_idx" ON "Post"("isPinned");

