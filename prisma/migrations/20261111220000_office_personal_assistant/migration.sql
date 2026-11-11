ALTER TABLE "OfficeMember" ADD COLUMN "workProfile" TEXT NOT NULL DEFAULT 'GENERAL', ADD COLUMN "assistantEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OfficeMember" ADD CONSTRAINT "OfficeMember_workProfile_check" CHECK ("workProfile" IN ('GENERAL','PURCHASING'));
CREATE TABLE "OfficeAssistantTurn" (
 "id" TEXT PRIMARY KEY, "companyProfileId" TEXT NOT NULL, "memberId" TEXT NOT NULL,
 "conversationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "question" TEXT NOT NULL,
 "answer" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'pending',
 "sources" JSONB, "diagnostics" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE,
 FOREIGN KEY ("companyProfileId","memberId") REFERENCES "OfficeMember"("companyProfileId","id") ON DELETE RESTRICT,
 CONSTRAINT "OfficeAssistantTurn_status_check" CHECK ("status" IN ('pending','completed','partial','error'))
);
CREATE INDEX "OfficeAssistantTurn_owner_conversation_idx" ON "OfficeAssistantTurn"("companyProfileId","memberId","conversationId","createdAt");
ALTER TABLE "OfficeAssistantTurn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficeAssistantTurn" FORCE ROW LEVEL SECURITY;
CREATE POLICY personal_office_isolation ON "OfficeAssistantTurn"
USING ("companyProfileId"=current_setting('app.current_tenant_id',true) AND "memberId"=current_setting('app.current_office_member_id',true))
WITH CHECK ("companyProfileId"=current_setting('app.current_tenant_id',true) AND "memberId"=current_setting('app.current_office_member_id',true));
