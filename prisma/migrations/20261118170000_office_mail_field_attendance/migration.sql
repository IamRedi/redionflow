-- Existing mail, receipts and work sessions remain untouched.
ALTER TABLE "OfficeMember" ADD COLUMN "fieldAttendanceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OfficeThread" ADD COLUMN "senderArchivedAt" TIMESTAMP(3), ADD COLUMN "recipientArchivedAt" TIMESTAMP(3);
