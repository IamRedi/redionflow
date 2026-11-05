-- CreateTable
CREATE TABLE "CompanyOperationalAsset" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "machineId" TEXT,
    "inventoryItemId" TEXT,
    "disposition" TEXT NOT NULL DEFAULT 'active',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "holderWorkerId" TEXT,
    "siteId" TEXT,
    "wasActive" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyOperationalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAssetHandover" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "fromWorkerId" TEXT,
    "toWorkerId" TEXT,
    "siteId" TEXT,
    "required" JSONB NOT NULL,
    "confirmations" JSONB NOT NULL,
    "createdByKey" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAssetHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAssetIncident" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT NOT NULL,
    "reportedByKey" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "decisionNote" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAssetIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAssetRepair" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'reported',
    "location" TEXT NOT NULL DEFAULT 'internal',
    "provider" TEXT NOT NULL DEFAULT '',
    "problem" TEXT NOT NULL,
    "repairNote" TEXT NOT NULL DEFAULT '',
    "tested" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "reportedByKey" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "originWorkerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAssetRepair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAssetEvent" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "repairId" TEXT,
    "type" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAssetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAssetFile" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "repairId" TEXT,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "dataBytes" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedByWorkerId" TEXT,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAssetFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAssetCommandReceipt" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAssetCommandReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOperationalAsset_machineId_key" ON "CompanyOperationalAsset"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOperationalAsset_inventoryItemId_key" ON "CompanyOperationalAsset"("inventoryItemId");

-- CreateIndex
CREATE INDEX "CompanyOperationalAsset_companyProfileId_disposition_idx" ON "CompanyOperationalAsset"("companyProfileId", "disposition");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOperationalAsset_companyProfileId_id_key" ON "CompanyOperationalAsset"("companyProfileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOperationalAsset_companyProfileId_machineId_key" ON "CompanyOperationalAsset"("companyProfileId", "machineId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOperationalAsset_companyProfileId_inventoryItemId_key" ON "CompanyOperationalAsset"("companyProfileId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "CompanyAssetHandover_companyProfileId_status_idx" ON "CompanyAssetHandover"("companyProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAssetHandover_companyProfileId_id_key" ON "CompanyAssetHandover"("companyProfileId", "id");

-- CreateIndex
CREATE INDEX "CompanyAssetIncident_companyProfileId_status_idx" ON "CompanyAssetIncident"("companyProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAssetIncident_companyProfileId_id_key" ON "CompanyAssetIncident"("companyProfileId", "id");

-- CreateIndex
CREATE INDEX "CompanyAssetRepair_companyProfileId_phase_idx" ON "CompanyAssetRepair"("companyProfileId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAssetRepair_companyProfileId_assetId_id_key" ON "CompanyAssetRepair"("companyProfileId", "assetId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAssetRepair_companyProfileId_id_key" ON "CompanyAssetRepair"("companyProfileId", "id");

-- CreateIndex
CREATE INDEX "CompanyAssetEvent_companyProfileId_assetId_createdAt_idx" ON "CompanyAssetEvent"("companyProfileId", "assetId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyAssetFile_companyProfileId_assetId_createdAt_idx" ON "CompanyAssetFile"("companyProfileId", "assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAssetFile_companyProfileId_id_key" ON "CompanyAssetFile"("companyProfileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAssetCommandReceipt_companyProfileId_requestId_key" ON "CompanyAssetCommandReceipt"("companyProfileId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyProfileId_id_key" ON "User"("companyProfileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInventoryItem_companyProfileId_id_key" ON "CompanyInventoryItem"("companyProfileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_companyProfileId_id_key" ON "Worker"("companyProfileId", "id");

-- AddForeignKey
ALTER TABLE "CompanyOperationalAsset" ADD CONSTRAINT "CompanyOperationalAsset_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOperationalAsset" ADD CONSTRAINT "CompanyOperationalAsset_companyProfileId_machineId_fkey" FOREIGN KEY ("companyProfileId", "machineId") REFERENCES "Machine"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOperationalAsset" ADD CONSTRAINT "CompanyOperationalAsset_companyProfileId_inventoryItemId_fkey" FOREIGN KEY ("companyProfileId", "inventoryItemId") REFERENCES "CompanyInventoryItem"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOperationalAsset" ADD CONSTRAINT "CompanyOperationalAsset_companyProfileId_holderWorkerId_fkey" FOREIGN KEY ("companyProfileId", "holderWorkerId") REFERENCES "Worker"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOperationalAsset" ADD CONSTRAINT "CompanyOperationalAsset_companyProfileId_siteId_fkey" FOREIGN KEY ("companyProfileId", "siteId") REFERENCES "Baustelle"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetHandover" ADD CONSTRAINT "CompanyAssetHandover_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetHandover" ADD CONSTRAINT "CompanyAssetHandover_companyProfileId_assetId_fkey" FOREIGN KEY ("companyProfileId", "assetId") REFERENCES "CompanyOperationalAsset"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetHandover" ADD CONSTRAINT "CompanyAssetHandover_companyProfileId_fromWorkerId_fkey" FOREIGN KEY ("companyProfileId", "fromWorkerId") REFERENCES "Worker"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetHandover" ADD CONSTRAINT "CompanyAssetHandover_companyProfileId_toWorkerId_fkey" FOREIGN KEY ("companyProfileId", "toWorkerId") REFERENCES "Worker"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetHandover" ADD CONSTRAINT "CompanyAssetHandover_companyProfileId_siteId_fkey" FOREIGN KEY ("companyProfileId", "siteId") REFERENCES "Baustelle"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetIncident" ADD CONSTRAINT "CompanyAssetIncident_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetIncident" ADD CONSTRAINT "CompanyAssetIncident_companyProfileId_assetId_fkey" FOREIGN KEY ("companyProfileId", "assetId") REFERENCES "CompanyOperationalAsset"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetRepair" ADD CONSTRAINT "CompanyAssetRepair_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetRepair" ADD CONSTRAINT "CompanyAssetRepair_companyProfileId_assetId_fkey" FOREIGN KEY ("companyProfileId", "assetId") REFERENCES "CompanyOperationalAsset"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetRepair" ADD CONSTRAINT "CompanyAssetRepair_companyProfileId_originWorkerId_fkey" FOREIGN KEY ("companyProfileId", "originWorkerId") REFERENCES "Worker"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetEvent" ADD CONSTRAINT "CompanyAssetEvent_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetEvent" ADD CONSTRAINT "CompanyAssetEvent_companyProfileId_assetId_fkey" FOREIGN KEY ("companyProfileId", "assetId") REFERENCES "CompanyOperationalAsset"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetEvent" ADD CONSTRAINT "CompanyAssetEvent_companyProfileId_assetId_repairId_fkey" FOREIGN KEY ("companyProfileId", "assetId", "repairId") REFERENCES "CompanyAssetRepair"("companyProfileId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetFile" ADD CONSTRAINT "CompanyAssetFile_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetFile" ADD CONSTRAINT "CompanyAssetFile_companyProfileId_assetId_fkey" FOREIGN KEY ("companyProfileId", "assetId") REFERENCES "CompanyOperationalAsset"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetFile" ADD CONSTRAINT "CompanyAssetFile_companyProfileId_assetId_repairId_fkey" FOREIGN KEY ("companyProfileId", "assetId", "repairId") REFERENCES "CompanyAssetRepair"("companyProfileId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetFile" ADD CONSTRAINT "CompanyAssetFile_companyProfileId_uploadedByUserId_fkey" FOREIGN KEY ("companyProfileId", "uploadedByUserId") REFERENCES "User"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetFile" ADD CONSTRAINT "CompanyAssetFile_companyProfileId_uploadedByWorkerId_fkey" FOREIGN KEY ("companyProfileId", "uploadedByWorkerId") REFERENCES "Worker"("companyProfileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetCommandReceipt" ADD CONSTRAINT "CompanyAssetCommandReceipt_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Additive only: no existing asset, assignment, event or private belonging is rewritten.
-- Domain checks and tenant policies supplement the generated composite foreign keys.
ALTER TABLE "CompanyOperationalAsset" ADD CONSTRAINT "CompanyOperationalAsset_base_xor" CHECK (num_nonnulls("machineId","inventoryItemId")=1), ADD CONSTRAINT "CompanyOperationalAsset_state" CHECK (disposition IN ('active','lost','retired') AND revision>=0);
ALTER TABLE "CompanyAssetHandover" ADD CONSTRAINT "CompanyAssetHandover_state" CHECK (kind IN ('issue','return','transfer') AND status IN ('pending','completed','declined','cancelled') AND revision>0);
ALTER TABLE "CompanyAssetIncident" ADD CONSTRAINT "CompanyAssetIncident_state" CHECK (kind IN ('defect','lost','retire') AND status IN ('pending','confirmed','rejected') AND revision>0);
ALTER TABLE "CompanyAssetRepair" ADD CONSTRAINT "CompanyAssetRepair_state" CHECK (phase IN ('reported','received','repairing','ready','cancelled') AND location IN ('internal','external') AND revision>0);
ALTER TABLE "CompanyAssetFile" ADD CONSTRAINT "CompanyAssetFile_shape" CHECK (kind IN ('photo','invoice','document','cover') AND size>0 AND size<=12000000 AND octet_length("dataBytes")=size AND num_nonnulls("uploadedByUserId","uploadedByWorkerId")=1);
CREATE UNIQUE INDEX "CompanyAssetHandover_one_pending" ON "CompanyAssetHandover"("assetId") WHERE status='pending';
CREATE UNIQUE INDEX "CompanyAssetIncident_one_pending_kind" ON "CompanyAssetIncident"("assetId",kind) WHERE status='pending';
CREATE UNIQUE INDEX "CompanyAssetRepair_one_open" ON "CompanyAssetRepair"("assetId") WHERE phase IN ('reported','received','repairing');
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['CompanyOperationalAsset','CompanyAssetHandover','CompanyAssetIncident','CompanyAssetRepair','CompanyAssetEvent','CompanyAssetFile','CompanyAssetCommandReceipt'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY company_asset_tenant ON %I USING ("companyProfileId"=app_current_tenant_id()) WITH CHECK ("companyProfileId"=app_current_tenant_id())',t);
 END LOOP;
END $$;
