CREATE TABLE "CompanyChatMessage" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorKey" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyChatMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompanyChatMessage_body_length" CHECK (char_length("body") BETWEEN 1 AND 1500 AND char_length("authorName") BETWEEN 1 AND 160 AND char_length("authorKey") BETWEEN 1 AND 180),
    CONSTRAINT "CompanyChatMessage_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanyChatMessage_companyProfileId_authorKey_requestId_key" ON "CompanyChatMessage"("companyProfileId","authorKey","requestId");
CREATE UNIQUE INDEX "CompanyChatMessage_companyProfileId_seq_key" ON "CompanyChatMessage"("companyProfileId","seq");
CREATE INDEX "CompanyChatMessage_companyProfileId_createdAt_idx" ON "CompanyChatMessage"("companyProfileId","createdAt");
CREATE TABLE "CompanyChatReader" (
    "companyProfileId" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "lastReadSeq" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyChatReader_pkey" PRIMARY KEY ("companyProfileId","actorKey"),
    CONSTRAINT "CompanyChatReader_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "CompanyChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyChatMessage" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CompanyChatReader" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyChatReader" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_chat_message_tenant ON "CompanyChatMessage" USING ("companyProfileId" = current_setting('app.current_tenant_id',true)) WITH CHECK ("companyProfileId" = current_setting('app.current_tenant_id',true));
CREATE POLICY company_chat_reader_tenant ON "CompanyChatReader" USING ("companyProfileId" = current_setting('app.current_tenant_id',true)) WITH CHECK ("companyProfileId" = current_setting('app.current_tenant_id',true));
