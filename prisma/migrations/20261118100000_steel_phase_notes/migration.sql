CREATE UNIQUE INDEX "SteelSiteTask_companyProfileId_id_key" ON "SteelSiteTask"("companyProfileId","id");
CREATE TABLE "SteelPhaseNote" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyProfileId" TEXT NOT NULL,
 "taskId" TEXT NOT NULL,
 "entryKey" TEXT NOT NULL,
 "text" TEXT NOT NULL,
 "authorKey" TEXT NOT NULL,
 "authorName" TEXT NOT NULL,
 "writtenAt" TIMESTAMP(3),
 "legacy" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SteelPhaseNote_text_length" CHECK (length("text") > 0 AND ("legacy" OR length("text") <= 500)),
 CONSTRAINT "SteelPhaseNote_companyProfileId_taskId_fkey" FOREIGN KEY ("companyProfileId","taskId") REFERENCES "SteelSiteTask"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SteelPhaseNote_taskId_entryKey_key" ON "SteelPhaseNote"("taskId","entryKey");
CREATE INDEX "SteelPhaseNote_companyProfileId_taskId_createdAt_id_idx" ON "SteelPhaseNote"("companyProfileId","taskId","createdAt","id");
ALTER TABLE "SteelPhaseNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SteelPhaseNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY steel_phase_note_tenant ON "SteelPhaseNote" USING ("companyProfileId" = app_current_tenant_id()) WITH CHECK ("companyProfileId" = app_current_tenant_id());
