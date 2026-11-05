-- Additive and isolated: no operational, company, inventory or uploaded-file row changes.
CREATE TABLE "BaumdienstDemoImageGeneration" (
  "id" TEXT PRIMARY KEY,
  "workspaceKey" TEXT NOT NULL REFERENCES "BaumdienstDemoWorkspace"("key") ON DELETE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "actorKey" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "style" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('pending','ready','error')),
  "errorCode" TEXT,
  "data" BYTEA CHECK ("data" IS NULL OR octet_length("data") <= 180000),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "BaumdienstDemoImageGeneration_ready_data" CHECK (("status" = 'ready') = ("data" IS NOT NULL))
);
CREATE INDEX "BaumdienstDemoImageGeneration_cache_idx" ON "BaumdienstDemoImageGeneration"("workspaceKey","fingerprint","startedAt");
ALTER TABLE "BaumdienstDemoImageGeneration" ENABLE ROW LEVEL SECURITY;
