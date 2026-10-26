CREATE TABLE "WorkzoneAnnouncement" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkzoneAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkzoneAnnouncement_companyProfileId_isActive_createdAt_idx" ON "WorkzoneAnnouncement"("companyProfileId", "isActive", "createdAt");

ALTER TABLE "WorkzoneAnnouncement" ADD CONSTRAINT "WorkzoneAnnouncement_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
