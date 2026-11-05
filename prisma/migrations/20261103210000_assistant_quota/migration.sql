-- Additive quota metadata only: existing business/customer rows are untouched.
CREATE TABLE "AssistantQuotaBucket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actorKey" TEXT NOT NULL,
  "window" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "requests" INTEGER NOT NULL DEFAULT 0 CHECK ("requests" >= 0),
  "tokens" INTEGER NOT NULL DEFAULT 0 CHECK ("tokens" >= 0)
);
CREATE UNIQUE INDEX "AssistantQuotaBucket_scope_window_key" ON "AssistantQuotaBucket"("companyProfileId", "actorKey", "window", "windowStart");
CREATE INDEX "AssistantQuotaBucket_companyProfileId_windowStart_idx" ON "AssistantQuotaBucket"("companyProfileId", "windowStart");
ALTER TABLE "AssistantQuotaBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantQuotaBucket" FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_quota_tenant ON "AssistantQuotaBucket" USING ("companyProfileId" = app_current_tenant_id()) WITH CHECK ("companyProfileId" = app_current_tenant_id());
