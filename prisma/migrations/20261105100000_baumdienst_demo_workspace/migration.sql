-- Additive, demo-profile-owned storage. No operational table is modified.
-- No relation to CompanyProfile: the existing nightly demo reset must retain
-- shared workshop history, attachments and stable logical site photo keys.
CREATE TABLE "BaumdienstDemoWorkspace" (
  "key" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "BaumdienstDemoFile" (
  "id" TEXT PRIMARY KEY,
  "workspaceKey" TEXT NOT NULL REFERENCES "BaumdienstDemoWorkspace"("key") ON DELETE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('asset','site','document')),
  "target" TEXT NOT NULL,
  "jobId" TEXT,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL CHECK ("bytes" > 0 AND "bytes" <= 1000000),
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BaumdienstDemoFile_workspaceKey_kind_target_createdAt_idx" ON "BaumdienstDemoFile"("workspaceKey","kind","target","createdAt");
CREATE TABLE "BaumdienstDemoMutation" (
  "id" TEXT PRIMARY KEY,
  "workspaceKey" TEXT NOT NULL REFERENCES "BaumdienstDemoWorkspace"("key") ON DELETE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BaumdienstDemoMutation_workspaceKey_createdAt_idx" ON "BaumdienstDemoMutation"("workspaceKey","createdAt");
-- Dedicated demo DB owner can access these; ordinary tenant roles have no policy.
ALTER TABLE "BaumdienstDemoWorkspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BaumdienstDemoFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BaumdienstDemoMutation" ENABLE ROW LEVEL SECURITY;
