-- Canonical office identity reuses existing logins; no new credentials/accounts.
CREATE TABLE "OfficeMember" (
 "id" TEXT PRIMARY KEY, "companyProfileId" TEXT NOT NULL,
 "userId" TEXT, "workerId" TEXT, "title" TEXT NOT NULL DEFAULT '',
 "enabled" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT "OfficeMember_identity_check" CHECK ("userId" IS NOT NULL OR "workerId" IS NOT NULL),
 FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE,
 FOREIGN KEY ("companyProfileId","userId") REFERENCES "User"("companyProfileId","id") ON DELETE RESTRICT,
 FOREIGN KEY ("companyProfileId","workerId") REFERENCES "Worker"("companyProfileId","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "OfficeMember_companyProfileId_id_key" ON "OfficeMember"("companyProfileId","id");
CREATE UNIQUE INDEX "OfficeMember_companyProfileId_userId_key" ON "OfficeMember"("companyProfileId","userId");
CREATE UNIQUE INDEX "OfficeMember_companyProfileId_workerId_key" ON "OfficeMember"("companyProfileId","workerId");
-- Preserve every previous office principal and all historical references.
INSERT INTO "OfficeMember" ("id","companyProfileId","userId")
SELECT DISTINCT u."id",u."companyProfileId",u."id" FROM "User" u
JOIN (
 SELECT "ownerId" AS id FROM "OfficeTask" UNION SELECT "createdById" FROM "OfficeTask"
 UNION SELECT "senderId" FROM "OfficeThread" UNION SELECT "recipientId" FROM "OfficeThread"
 UNION SELECT "senderId" FROM "OfficeMessage"
) used ON used.id=u.id;
ALTER TABLE "OfficeTask" DROP CONSTRAINT "OfficeTask_companyProfileId_ownerId_fkey";
ALTER TABLE "OfficeTask" ADD CONSTRAINT "OfficeTask_companyProfileId_ownerId_fkey" FOREIGN KEY ("companyProfileId","ownerId") REFERENCES "OfficeMember"("companyProfileId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeTask" DROP CONSTRAINT "OfficeTask_companyProfileId_createdById_fkey";
ALTER TABLE "OfficeTask" ADD CONSTRAINT "OfficeTask_companyProfileId_createdById_fkey" FOREIGN KEY ("companyProfileId","createdById") REFERENCES "OfficeMember"("companyProfileId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeThread" DROP CONSTRAINT "OfficeThread_companyProfileId_senderId_fkey";
ALTER TABLE "OfficeThread" ADD CONSTRAINT "OfficeThread_companyProfileId_senderId_fkey" FOREIGN KEY ("companyProfileId","senderId") REFERENCES "OfficeMember"("companyProfileId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeThread" DROP CONSTRAINT "OfficeThread_companyProfileId_recipientId_fkey";
ALTER TABLE "OfficeThread" ADD CONSTRAINT "OfficeThread_companyProfileId_recipientId_fkey" FOREIGN KEY ("companyProfileId","recipientId") REFERENCES "OfficeMember"("companyProfileId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeMessage" DROP CONSTRAINT "OfficeMessage_companyProfileId_senderId_fkey";
ALTER TABLE "OfficeMessage" ADD CONSTRAINT "OfficeMessage_companyProfileId_senderId_fkey" FOREIGN KEY ("companyProfileId","senderId") REFERENCES "OfficeMember"("companyProfileId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficeMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OfficeMember" USING ("companyProfileId" = current_setting('app.current_tenant_id',true)) WITH CHECK ("companyProfileId" = current_setting('app.current_tenant_id',true));
