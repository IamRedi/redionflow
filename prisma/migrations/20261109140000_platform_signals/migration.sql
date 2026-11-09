-- Signals for the platform team (missing features, bugs, unanswered questions,
-- system errors). Additive; no existing row changes.
CREATE TABLE "PlatformSignal" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "kind" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "details" TEXT NOT NULL DEFAULT '',
 "fingerprint" TEXT NOT NULL,
 "count" INTEGER NOT NULL DEFAULT 1,
 "actorKind" TEXT NOT NULL,
 "actorId" TEXT NOT NULL,
 "actorName" TEXT NOT NULL DEFAULT '',
 "language" TEXT NOT NULL DEFAULT '',
 "source" TEXT NOT NULL DEFAULT 'assistant',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "forwardedAt" TIMESTAMP(3),
 "forwardAttempts" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "PlatformSignal_kind_check" CHECK ("kind" IN ('feature','bug','question','error')),
 CONSTRAINT "PlatformSignal_text_check" CHECK (char_length("title") BETWEEN 1 AND 200 AND char_length("details") <= 2000)
);
CREATE UNIQUE INDEX "PlatformSignal_companyProfileId_fingerprint_key" ON "PlatformSignal"("companyProfileId","fingerprint");
CREATE INDEX "PlatformSignal_companyProfileId_forwardedAt_idx" ON "PlatformSignal"("companyProfileId","forwardedAt");
ALTER TABLE "PlatformSignal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSignal" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_signal_tenant ON "PlatformSignal"
 USING ("companyProfileId"=app_current_tenant_id()) WITH CHECK ("companyProfileId"=app_current_tenant_id());
