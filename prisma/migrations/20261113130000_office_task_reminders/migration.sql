-- Additive only: no change to tasks, attendance, inventory or permissions.
CREATE TABLE "OfficeTaskReminder" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyProfileId" TEXT NOT NULL,
 "taskId" TEXT NOT NULL,
 "memberId" TEXT NOT NULL,
 "remindAt" TIMESTAMP(3) NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL,
 "claimId" TEXT,
 "leaseUntil" TIMESTAMP(3),
 "sentAt" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "OfficeTaskReminder_company_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "OfficeTaskReminder_task_fkey" FOREIGN KEY ("companyProfileId","taskId") REFERENCES "OfficeTask"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "OfficeTaskReminder_member_fkey" FOREIGN KEY ("companyProfileId","memberId") REFERENCES "OfficeMember"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "OfficeTaskReminder_shape" CHECK (
   "status" IN ('PENDING','SENT','CANCELLED','NO_DEVICE','FAILED') AND "attempts" BETWEEN 0 AND 3
   AND (("claimId" IS NULL AND "leaseUntil" IS NULL) OR ("claimId" IS NOT NULL AND "leaseUntil" IS NOT NULL))
 )
);
CREATE UNIQUE INDEX "OfficeTaskReminder_companyProfileId_taskId_memberId_key" ON "OfficeTaskReminder"("companyProfileId","taskId","memberId");
CREATE INDEX "OfficeTaskReminder_companyProfileId_status_nextAttemptAt_idx" ON "OfficeTaskReminder"("companyProfileId","status","nextAttemptAt");
ALTER TABLE "OfficeTaskReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficeTaskReminder" FORCE ROW LEVEL SECURITY;
CREATE POLICY private_office_tenant ON "OfficeTaskReminder"
 USING ("companyProfileId"=app_current_tenant_id()) WITH CHECK ("companyProfileId"=app_current_tenant_id());
