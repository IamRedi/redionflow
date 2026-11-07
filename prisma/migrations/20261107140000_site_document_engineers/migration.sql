-- Empty, additive permission grants. No existing person or business row is elevated.
ALTER TABLE "Baustelle" ADD COLUMN "documentAccessRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "loginPinHash" TEXT;
CREATE OR REPLACE FUNCTION public.bk_revoke_changed_credentials() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE changed boolean;
BEGIN
 IF TG_TABLE_NAME = 'User' THEN
  changed := NEW."passwordHash" IS DISTINCT FROM OLD."passwordHash"
   OR NEW."loginPinHash" IS DISTINCT FROM OLD."loginPinHash"
   OR NEW.role IS DISTINCT FROM OLD.role OR NEW."isActive" IS DISTINCT FROM OLD."isActive"
   OR NEW."isOwner" IS DISTINCT FROM OLD."isOwner" OR NEW."companyProfileId" IS DISTINCT FROM OLD."companyProfileId";
 ELSE
  changed := NEW."loginCodeHash" IS DISTINCT FROM OLD."loginCodeHash"
   OR NEW."loginCode" IS DISTINCT FROM OLD."loginCode" OR NEW.status IS DISTINCT FROM OLD.status;
 END IF;
 NEW."sessionEpoch" := GREATEST(NEW."sessionEpoch", OLD."sessionEpoch" + CASE WHEN changed THEN 1 ELSE 0 END);
 RETURN NEW;
END $$;
CREATE TABLE "SiteDocumentEngineer" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "baustelleId" TEXT NOT NULL,
 "workerId" TEXT NOT NULL,
 "grantedByUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SiteDocumentEngineer_site_fkey" FOREIGN KEY ("companyProfileId","baustelleId") REFERENCES "Baustelle"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "SiteDocumentEngineer_worker_fkey" FOREIGN KEY ("companyProfileId","workerId") REFERENCES "Worker"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "SiteDocumentEngineer_grantedBy_fkey" FOREIGN KEY ("companyProfileId","grantedByUserId") REFERENCES "User"("companyProfileId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SiteDocumentEngineer_companyProfileId_baustelleId_workerId_key" ON "SiteDocumentEngineer"("companyProfileId","baustelleId","workerId");
CREATE INDEX "SiteDocumentEngineer_companyProfileId_workerId_idx" ON "SiteDocumentEngineer"("companyProfileId","workerId");
ALTER TABLE "SiteDocumentEngineer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteDocumentEngineer" FORCE ROW LEVEL SECURITY;
CREATE POLICY site_document_engineer_tenant ON "SiteDocumentEngineer"
 USING ("companyProfileId"=app_current_tenant_id()) WITH CHECK ("companyProfileId"=app_current_tenant_id());
