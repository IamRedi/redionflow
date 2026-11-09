-- Access levels and per-place grants (key button). Additive: no existing row
-- changes, so nobody's access changes until the app reads these.
ALTER TABLE "Worker" ADD COLUMN "accessLevel" TEXT;
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_accessLevel_check" CHECK ("accessLevel" IS NULL OR "accessLevel" IN ('BASE','FULL_VIEW'));

CREATE TABLE "AccessGrant" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "place" TEXT NOT NULL,
 "scopeId" TEXT NOT NULL DEFAULT '',
 "workerId" TEXT NOT NULL,
 "level" TEXT NOT NULL,
 "grantedByUserId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AccessGrant_worker_fkey" FOREIGN KEY ("companyProfileId","workerId") REFERENCES "Worker"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "AccessGrant_place_check" CHECK ("place" IN ('site','factory','new_project','fleet_gps','workshop','warehouse','daily_plan','costs','staff')),
 CONSTRAINT "AccessGrant_level_check" CHECK ("level" IN ('view','act')),
 CONSTRAINT "AccessGrant_scope_check" CHECK (char_length("scopeId") <= 64)
);
CREATE UNIQUE INDEX "AccessGrant_companyProfileId_place_scopeId_workerId_key" ON "AccessGrant"("companyProfileId","place","scopeId","workerId");
CREATE INDEX "AccessGrant_companyProfileId_workerId_idx" ON "AccessGrant"("companyProfileId","workerId");
ALTER TABLE "AccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGrant" FORCE ROW LEVEL SECURITY;
CREATE POLICY access_grant_tenant ON "AccessGrant"
 USING ("companyProfileId"=app_current_tenant_id()) WITH CHECK ("companyProfileId"=app_current_tenant_id());
