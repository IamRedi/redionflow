CREATE TABLE "OfficeArtwork" (
 "memberId" TEXT PRIMARY KEY,
 "companyProfileId" TEXT NOT NULL,
 "data" BYTEA,
 "version" INTEGER NOT NULL DEFAULT 1,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE,
 FOREIGN KEY ("companyProfileId","memberId") REFERENCES "OfficeMember"("companyProfileId","id") ON DELETE CASCADE,
 CONSTRAINT "OfficeArtwork_size_check" CHECK ("data" IS NULL OR octet_length("data") BETWEEN 1 AND 180000),
 CONSTRAINT "OfficeArtwork_version_check" CHECK ("version">0)
);
CREATE INDEX "OfficeArtwork_companyProfileId_idx" ON "OfficeArtwork"("companyProfileId");
CREATE UNIQUE INDEX "OfficeArtwork_companyProfileId_memberId_key" ON "OfficeArtwork"("companyProfileId","memberId");
ALTER TABLE "OfficeArtwork" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficeArtwork" FORCE ROW LEVEL SECURITY;
-- Decoration is visible to authorized office visitors in the same company.
-- The application additionally checks current room visibility on every read.
CREATE POLICY office_artwork_read ON "OfficeArtwork" FOR SELECT
 USING ("companyProfileId"=current_setting('app.current_tenant_id',true));
CREATE POLICY office_artwork_insert ON "OfficeArtwork" FOR INSERT
 WITH CHECK ("companyProfileId"=current_setting('app.current_tenant_id',true) AND "memberId"=current_setting('app.current_office_member_id',true));
CREATE POLICY office_artwork_update ON "OfficeArtwork" FOR UPDATE
 USING ("companyProfileId"=current_setting('app.current_tenant_id',true) AND "memberId"=current_setting('app.current_office_member_id',true))
 WITH CHECK ("companyProfileId"=current_setting('app.current_tenant_id',true) AND "memberId"=current_setting('app.current_office_member_id',true));
-- Reset keeps the row/version and clears only bytes; no application DELETE.
