-- Private worker and site documents stored in the database when no Supabase
-- Storage is configured (AL-Steel runs on Railway Postgres only).
CREATE TABLE "ManagedFile" (
  "id" TEXT NOT NULL,
  "companyProfileId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagedFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManagedFile_scope_check" CHECK ("scope" IN ('worker-assets', 'baustelle-documents')),
  CONSTRAINT "ManagedFile_size_check" CHECK (octet_length("data") > 0 AND octet_length("data") <= 20000000 AND "size" = octet_length("data"))
);
CREATE UNIQUE INDEX "ManagedFile_scope_entityId_fileName_key" ON "ManagedFile"("scope", "entityId", "fileName");
CREATE INDEX "ManagedFile_companyProfileId_scope_entityId_idx" ON "ManagedFile"("companyProfileId", "scope", "entityId");
ALTER TABLE "ManagedFile" ADD CONSTRAINT "ManagedFile_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ManagedFile" FORCE ROW LEVEL SECURITY;
CREATE POLICY managed_file_tenant ON "ManagedFile" USING ("companyProfileId" = app_current_tenant_id()) WITH CHECK ("companyProfileId" = app_current_tenant_id());
