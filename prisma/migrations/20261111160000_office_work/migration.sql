-- CreateTable
CREATE TABLE "OfficeCategory" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "OfficeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeTask" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueDate" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "OfficeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeThread" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "senderReadAt" TIMESTAMP(3),
    "recipientReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeMessage" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeAttachment" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "dataBytes" BYTEA NOT NULL,

    CONSTRAINT "OfficeAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficeCategory_companyProfileId_id_key" ON "OfficeCategory"("companyProfileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeCategory_companyProfileId_name_key" ON "OfficeCategory"("companyProfileId", "name");

-- CreateIndex
CREATE INDEX "OfficeTask_companyProfileId_ownerId_archivedAt_idx" ON "OfficeTask"("companyProfileId", "ownerId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeTask_companyProfileId_id_key" ON "OfficeTask"("companyProfileId", "id");

-- CreateIndex
CREATE INDEX "OfficeThread_companyProfileId_senderId_updatedAt_idx" ON "OfficeThread"("companyProfileId", "senderId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfficeThread_companyProfileId_recipientId_updatedAt_idx" ON "OfficeThread"("companyProfileId", "recipientId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeThread_companyProfileId_id_key" ON "OfficeThread"("companyProfileId", "id");

-- CreateIndex
CREATE INDEX "OfficeMessage_companyProfileId_threadId_createdAt_idx" ON "OfficeMessage"("companyProfileId", "threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeMessage_companyProfileId_id_key" ON "OfficeMessage"("companyProfileId", "id");

-- CreateIndex
CREATE INDEX "OfficeAttachment_companyProfileId_messageId_idx" ON "OfficeAttachment"("companyProfileId", "messageId");

-- AddForeignKey
ALTER TABLE "OfficeCategory" ADD CONSTRAINT "OfficeCategory_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeTask" ADD CONSTRAINT "OfficeTask_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeTask" ADD CONSTRAINT "OfficeTask_companyProfileId_ownerId_fkey" FOREIGN KEY ("companyProfileId", "ownerId") REFERENCES "User"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeTask" ADD CONSTRAINT "OfficeTask_companyProfileId_createdById_fkey" FOREIGN KEY ("companyProfileId", "createdById") REFERENCES "User"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeTask" ADD CONSTRAINT "OfficeTask_companyProfileId_categoryId_fkey" FOREIGN KEY ("companyProfileId", "categoryId") REFERENCES "OfficeCategory"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeThread" ADD CONSTRAINT "OfficeThread_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeThread" ADD CONSTRAINT "OfficeThread_companyProfileId_senderId_fkey" FOREIGN KEY ("companyProfileId", "senderId") REFERENCES "User"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeThread" ADD CONSTRAINT "OfficeThread_companyProfileId_recipientId_fkey" FOREIGN KEY ("companyProfileId", "recipientId") REFERENCES "User"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMessage" ADD CONSTRAINT "OfficeMessage_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMessage" ADD CONSTRAINT "OfficeMessage_companyProfileId_threadId_fkey" FOREIGN KEY ("companyProfileId", "threadId") REFERENCES "OfficeThread"("companyProfileId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMessage" ADD CONSTRAINT "OfficeMessage_companyProfileId_senderId_fkey" FOREIGN KEY ("companyProfileId", "senderId") REFERENCES "User"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeAttachment" ADD CONSTRAINT "OfficeAttachment_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeAttachment" ADD CONSTRAINT "OfficeAttachment_companyProfileId_messageId_fkey" FOREIGN KEY ("companyProfileId", "messageId") REFERENCES "OfficeMessage"("companyProfileId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Private office records only; no production, attendance or official documents are rewritten.
ALTER TABLE "OfficeCategory" ADD CONSTRAINT "OfficeCategory_shape" CHECK (length(name) BETWEEN 1 AND 100);
ALTER TABLE "OfficeTask" ADD CONSTRAINT "OfficeTask_shape" CHECK (
 kind IN ('NOTE','PERSONAL','COMPANY') AND status IN ('TODO','DOING','DONE') AND priority IN ('NORMAL','HIGH')
 AND length(title) BETWEEN 1 AND 160 AND length(body)<=8000 AND version>0
 AND ((kind='COMPANY' AND "categoryId" IS NOT NULL) OR (kind<>'COMPANY' AND "categoryId" IS NULL AND "ownerId"="createdById"))
 AND ("dueDate" IS NULL OR "dueDate" ~ '^\d{4}-\d{2}-\d{2}$')
);
ALTER TABLE "OfficeThread" ADD CONSTRAINT "OfficeThread_shape" CHECK ("senderId"<>"recipientId" AND length(subject) BETWEEN 1 AND 160);
ALTER TABLE "OfficeMessage" ADD CONSTRAINT "OfficeMessage_shape" CHECK (length(body)<=10000);
ALTER TABLE "OfficeAttachment" ADD CONSTRAINT "OfficeAttachment_shape" CHECK (size>0 AND size<=5000000 AND octet_length("dataBytes")=size AND sha256 ~ '^[0-9a-f]{64}$' AND length("fileName") BETWEEN 1 AND 255);
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['OfficeCategory','OfficeTask','OfficeThread','OfficeMessage','OfficeAttachment'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY private_office_tenant ON %I USING ("companyProfileId"=app_current_tenant_id()) WITH CHECK ("companyProfileId"=app_current_tenant_id())',t);
 END LOOP;
END $$;
