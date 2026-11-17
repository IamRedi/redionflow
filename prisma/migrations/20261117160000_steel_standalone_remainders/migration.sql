ALTER TABLE "SiteElement" ADD COLUMN "remainderOfId" TEXT;
CREATE UNIQUE INDEX "SiteElement_remainderOfId_key" ON "SiteElement"("remainderOfId");
ALTER TABLE "SiteElement" ADD CONSTRAINT "SiteElement_remainderOfId_fkey"
  FOREIGN KEY ("remainderOfId") REFERENCES "SiteElement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
