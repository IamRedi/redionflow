-- Add audit fields for manual TreeItem edits in Workzone.
ALTER TABLE "TreeItem"
ADD COLUMN "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastEditedBy" TEXT,
ADD COLUMN "lastEditedAt" TIMESTAMP(3);

-- Prevent duplicate tree numbers inside the same Baustelle.
CREATE UNIQUE INDEX "TreeItem_baustelleId_treeId_key" ON "TreeItem"("baustelleId", "treeId");
