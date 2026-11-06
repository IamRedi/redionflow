-- CreateTable
CREATE TABLE "CompanyAssetCode" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByKey" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAssetCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePhaseDocument" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "baustelleId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "dataBytes" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdByWorkerId" TEXT,
    "createdByKey" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "archivedByKey" TEXT,

    CONSTRAINT "SitePhaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePhaseDocumentReceipt" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "userId" TEXT,
    "workerId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePhaseDocumentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyAssetCode_companyProfileId_matchValue_idx" ON "CompanyAssetCode"("companyProfileId", "matchValue");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAssetCode_companyProfileId_assetId_kind_matchValue_key" ON "CompanyAssetCode"("companyProfileId", "assetId", "kind", "matchValue");

-- CreateIndex
CREATE INDEX "SitePhaseDocument_companyProfileId_baustelleId_phase_create_idx" ON "SitePhaseDocument"("companyProfileId", "baustelleId", "phase", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SitePhaseDocument_companyProfileId_id_key" ON "SitePhaseDocument"("companyProfileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SitePhaseDocument_companyProfileId_baustelleId_phase_id_key" ON "SitePhaseDocument"("companyProfileId", "baustelleId", "phase", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SitePhaseDocument_companyProfileId_baustelleId_phase_supers_key" ON "SitePhaseDocument"("companyProfileId", "baustelleId", "phase", "supersedesId");

-- CreateIndex
CREATE INDEX "SitePhaseDocumentReceipt_companyProfileId_actorKey_received_idx" ON "SitePhaseDocumentReceipt"("companyProfileId", "actorKey", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SitePhaseDocumentReceipt_companyProfileId_documentId_actorK_key" ON "SitePhaseDocumentReceipt"("companyProfileId", "documentId", "actorKey");

-- AddForeignKey
ALTER TABLE "CompanyAssetCode" ADD CONSTRAINT "CompanyAssetCode_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetCode" ADD CONSTRAINT "CompanyAssetCode_companyProfileId_assetId_fkey" FOREIGN KEY ("companyProfileId", "assetId") REFERENCES "CompanyOperationalAsset"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocument" ADD CONSTRAINT "SitePhaseDocument_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocument" ADD CONSTRAINT "SitePhaseDocument_companyProfileId_baustelleId_fkey" FOREIGN KEY ("companyProfileId", "baustelleId") REFERENCES "Baustelle"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocument" ADD CONSTRAINT "SitePhaseDocument_companyProfileId_createdByUserId_fkey" FOREIGN KEY ("companyProfileId", "createdByUserId") REFERENCES "User"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocument" ADD CONSTRAINT "SitePhaseDocument_companyProfileId_createdByWorkerId_fkey" FOREIGN KEY ("companyProfileId", "createdByWorkerId") REFERENCES "Worker"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocument" ADD CONSTRAINT "SitePhaseDocument_companyProfileId_baustelleId_phase_super_fkey" FOREIGN KEY ("companyProfileId", "baustelleId", "phase", "supersedesId") REFERENCES "SitePhaseDocument"("companyProfileId", "baustelleId", "phase", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocumentReceipt" ADD CONSTRAINT "SitePhaseDocumentReceipt_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocumentReceipt" ADD CONSTRAINT "SitePhaseDocumentReceipt_companyProfileId_documentId_fkey" FOREIGN KEY ("companyProfileId", "documentId") REFERENCES "SitePhaseDocument"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocumentReceipt" ADD CONSTRAINT "SitePhaseDocumentReceipt_companyProfileId_userId_fkey" FOREIGN KEY ("companyProfileId", "userId") REFERENCES "User"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhaseDocumentReceipt" ADD CONSTRAINT "SitePhaseDocumentReceipt_companyProfileId_workerId_fkey" FOREIGN KEY ("companyProfileId", "workerId") REFERENCES "Worker"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Additive private documents and aliases: no legacy records or codes are rewritten.
ALTER TABLE "CompanyAssetCode" ADD CONSTRAINT "CompanyAssetCode_shape" CHECK (kind IN ('factory','label') AND length(value) BETWEEN 1 AND 2048 AND length("matchValue") BETWEEN 1 AND 2053 AND (kind='factory' OR "revokedAt" IS NULL));
CREATE UNIQUE INDEX "CompanyAssetCode_label_identity" ON "CompanyAssetCode"("companyProfileId","matchValue") WHERE kind='label';
CREATE UNIQUE INDEX "CompanyAssetCode_one_label" ON "CompanyAssetCode"("companyProfileId","assetId") WHERE kind='label';
ALTER TABLE "SitePhaseDocument" ADD CONSTRAINT "SitePhaseDocument_shape" CHECK (
 phase IN ('piketim','rilevim','projektim','porosi','prodhimi','montimi') AND size>0 AND size<=15000000 AND octet_length("dataBytes")=size
 AND length(title) BETWEEN 1 AND 160 AND length(note)<=2000 AND sha256 ~ '^[0-9a-f]{64}$'
 AND num_nonnulls("createdByUserId","createdByWorkerId")=1
 AND "createdByKey"=CASE WHEN "createdByUserId" IS NOT NULL THEN 'user:'||"createdByUserId" ELSE 'worker:'||"createdByWorkerId" END
 AND (("archivedAt" IS NULL AND "archivedByKey" IS NULL) OR ("archivedAt" IS NOT NULL AND "archivedByKey" IS NOT NULL))
 AND "supersedesId" IS DISTINCT FROM id
);
ALTER TABLE "SitePhaseDocumentReceipt" ADD CONSTRAINT "SitePhaseDocumentReceipt_identity" CHECK (
 num_nonnulls("userId","workerId")=1 AND "actorKey"=CASE WHEN "userId" IS NOT NULL THEN 'user:'||"userId" ELSE 'worker:'||"workerId" END
);
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['CompanyAssetCode','SitePhaseDocument','SitePhaseDocumentReceipt'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY private_phase_asset_tenant ON %I USING ("companyProfileId"=app_current_tenant_id()) WITH CHECK ("companyProfileId"=app_current_tenant_id())',t);
 END LOOP;
END $$;
