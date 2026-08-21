-- Persist hourly de-duplication records for public detail-page views.
-- Aggregate counters stay on Bot/Post for fast reads and are incremented
-- atomically only after the corresponding event row is inserted.

CREATE TABLE IF NOT EXISTS "BotView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "viewedAt" TEXT NOT NULL,
    CONSTRAINT "BotView_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BotView_botId_viewerKey_windowKey_key" ON "BotView"("botId", "viewerKey", "windowKey");
CREATE INDEX IF NOT EXISTS "BotView_botId_viewedAt_idx" ON "BotView"("botId", "viewedAt");
