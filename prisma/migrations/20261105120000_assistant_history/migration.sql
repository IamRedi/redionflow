-- Additive private admin history. No customer-data backfill, reset or deletion.
CREATE TABLE "AssistantConversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "adminId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "clientContext" JSONB,
  "contextUnverified" BOOLEAN NOT NULL DEFAULT false,
  "contextRedacted" BOOLEAN NOT NULL DEFAULT false,
  "contextTruncated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AssistantConversation_owner_id_key" ON "AssistantConversation"("companyProfileId","adminId","id");
CREATE INDEX "AssistantConversation_owner_time_idx" ON "AssistantConversation"("companyProfileId","adminId","lastRunAt","id");

CREATE TABLE "AssistantRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "adminId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "clientMessageId" TEXT,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'running' CHECK ("status" IN ('running','completed','partial','error','cancelled','rejected')),
  "model" TEXT,
  "finishReason" TEXT,
  "errorCode" TEXT,
  "httpStatus" INTEGER,
  "inputTokens" INTEGER CHECK ("inputTokens" >= 0),
  "outputTokens" INTEGER CHECK ("outputTokens" >= 0),
  "totalTokens" INTEGER CHECK ("totalTokens" >= 0),
  "diagnostics" JSONB,
  "diagnosticsRedacted" BOOLEAN NOT NULL DEFAULT false,
  "diagnosticsTruncated" BOOLEAN NOT NULL DEFAULT false,
  "questionRedacted" BOOLEAN NOT NULL DEFAULT false,
  "answerRedacted" BOOLEAN NOT NULL DEFAULT false,
  "answerTruncated" BOOLEAN NOT NULL DEFAULT false,
  "traceTruncated" BOOLEAN NOT NULL DEFAULT false,
  "traceBytes" INTEGER NOT NULL DEFAULT 0 CHECK ("traceBytes" >= 0),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AssistantRun_conversation_owner_fkey" FOREIGN KEY ("companyProfileId","adminId","conversationId") REFERENCES "AssistantConversation"("companyProfileId","adminId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AssistantRun_owner_id_key" ON "AssistantRun"("companyProfileId","adminId","id");
CREATE UNIQUE INDEX "AssistantRun_owner_message_key" ON "AssistantRun"("companyProfileId","adminId","clientMessageId");
CREATE INDEX "AssistantRun_conversation_time_idx" ON "AssistantRun"("companyProfileId","adminId","conversationId","startedAt","id");
CREATE UNIQUE INDEX "AssistantRun_one_running_per_conversation" ON "AssistantRun"("companyProfileId","adminId","conversationId") WHERE "status"='running';

CREATE TABLE "AssistantToolTrace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "adminId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "toolCallId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "step" INTEGER,
  "status" TEXT NOT NULL CHECK ("status" IN ('ok','error','rejected')),
  "input" JSONB,
  "result" JSONB,
  "evidence" JSONB,
  "redacted" BOOLEAN NOT NULL DEFAULT false,
  "truncated" BOOLEAN NOT NULL DEFAULT false,
  "originalBytes" INTEGER NOT NULL DEFAULT 0 CHECK ("originalBytes" >= 0),
  "storedBytes" INTEGER NOT NULL DEFAULT 0 CHECK ("storedBytes" >= 0),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationMs" INTEGER CHECK ("durationMs" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantToolTrace_run_owner_fkey" FOREIGN KEY ("companyProfileId","adminId","runId") REFERENCES "AssistantRun"("companyProfileId","adminId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AssistantToolTrace_run_call_key" ON "AssistantToolTrace"("companyProfileId","adminId","runId","toolCallId");
CREATE INDEX "AssistantToolTrace_run_time_idx" ON "AssistantToolTrace"("companyProfileId","adminId","runId","createdAt","id");

-- A tenant setting alone is insufficient: transcripts are private to their admin.
ALTER TABLE "AssistantConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantConversation" FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_conversation_owner ON "AssistantConversation" FOR ALL
USING ("companyProfileId" = app_current_tenant_id() AND "adminId" = current_setting('app.assistant_admin_id',true))
WITH CHECK ("companyProfileId" = app_current_tenant_id() AND "adminId" = current_setting('app.assistant_admin_id',true));
ALTER TABLE "AssistantRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_run_owner ON "AssistantRun" FOR ALL
USING ("companyProfileId" = app_current_tenant_id() AND "adminId" = current_setting('app.assistant_admin_id',true))
WITH CHECK ("companyProfileId" = app_current_tenant_id() AND "adminId" = current_setting('app.assistant_admin_id',true));
ALTER TABLE "AssistantToolTrace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantToolTrace" FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_trace_owner ON "AssistantToolTrace" FOR ALL
USING ("companyProfileId" = app_current_tenant_id() AND "adminId" = current_setting('app.assistant_admin_id',true))
WITH CHECK ("companyProfileId" = app_current_tenant_id() AND "adminId" = current_setting('app.assistant_admin_id',true));

-- Actor IDs remain historical on account removal, but cannot be forged/reassigned.
CREATE FUNCTION bk_assistant_history_owner_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."companyProfileId" IS DISTINCT FROM OLD."companyProfileId" OR NEW."adminId" IS DISTINCT FROM OLD."adminId") THEN
    RAISE EXCEPTION 'Assistant history ownership cannot be reassigned' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id=NEW."adminId" AND "companyProfileId"=NEW."companyProfileId" AND role='ADMIN') THEN
    RAISE EXCEPTION 'Assistant history owner mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bk_assistant_history_owner_guard() FROM PUBLIC;
CREATE TRIGGER assistant_history_owner_guard BEFORE INSERT OR UPDATE OF "companyProfileId","adminId" ON "AssistantConversation"
FOR EACH ROW EXECUTE FUNCTION bk_assistant_history_owner_guard();
