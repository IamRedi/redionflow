ALTER TABLE "SiteElement" ADD COLUMN "processRoutes" JSONB, ADD COLUMN "processRevision" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "processEditedBy" TEXT, ADD COLUMN "processEditedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "TreeItem_baustelleId_id_key" ON "TreeItem"("baustelleId","id");
CREATE TABLE "SteelWorkDefinition" (
 "id" TEXT PRIMARY KEY, "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "kind" TEXT NOT NULL CHECK ("kind" IN ('site','factory','field')), "key" TEXT NOT NULL,
 "label" TEXT NOT NULL DEFAULT '', "description" TEXT NOT NULL DEFAULT '', "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision">0), "archivedAt" TIMESTAMP(3),
 "linkedProcessKey" TEXT, "linkedList" TEXT CHECK ("linkedList" IN ('assembly','part')), "linkedKind" TEXT,
 "visualUpdatedAt" TIMESTAMP(3), "visualStatus" TEXT NOT NULL DEFAULT 'fallback',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SteelWorkDefinition_companyProfileId_id_key" UNIQUE("companyProfileId","id"),
 CONSTRAINT "SteelWorkDefinition_companyProfileId_key_key" UNIQUE("companyProfileId","key"),
 CONSTRAINT "SteelWorkDefinition_link_shape" CHECK ("kind"='site' OR ("linkedProcessKey" IS NULL AND "linkedList" IS NULL AND "linkedKind" IS NULL))
);
CREATE INDEX "SteelWorkDefinition_companyProfileId_kind_archivedAt_sortOr_idx" ON "SteelWorkDefinition"("companyProfileId","kind","archivedAt","sortOrder");
CREATE TABLE "SteelWorkVisual" (
 "id" TEXT PRIMARY KEY, "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "definitionId" TEXT NOT NULL UNIQUE, "data" BYTEA, "scene" JSONB, "mime" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("companyProfileId","definitionId"),
 FOREIGN KEY("companyProfileId","definitionId") REFERENCES "SteelWorkDefinition"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "SteelSiteTask" (
 "id" TEXT PRIMARY KEY, "companyProfileId" TEXT NOT NULL REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "baustelleId" TEXT NOT NULL, "definitionId" TEXT NOT NULL, "treeItemId" TEXT NOT NULL UNIQUE,
 "enabled" BOOLEAN NOT NULL DEFAULT true, "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision">0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("companyProfileId","baustelleId","definitionId"), UNIQUE("baustelleId","treeItemId"),
 FOREIGN KEY("companyProfileId","baustelleId") REFERENCES "Baustelle"("companyProfileId","id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY("companyProfileId","definitionId") REFERENCES "SteelWorkDefinition"("companyProfileId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY("baustelleId","treeItemId") REFERENCES "TreeItem"("baustelleId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SteelSiteTask_companyProfileId_definitionId_idx" ON "SteelSiteTask"("companyProfileId","definitionId");

-- Seed catalog choices only; never create or complete site history rows.
INSERT INTO "SteelWorkDefinition" ("id","companyProfileId","kind","key","sortOrder")
SELECT md5('steeldef:'||c.id||':'||v.key),c.id,v.kind,v.key,v.pos
FROM "CompanyProfile" c CROSS JOIN (VALUES
 ('site','steel-foundation',0),('site','steel-columns',1),('site','steel-trusses',2),('site','steel-painting',3),
 ('site','steel-cutting',4),('site','steel-drilling',5),('site','steel-welding',6),('site','steel-coating',7),
 ('factory','cutting',0),('factory','assembly',1),('factory','welding',2),('factory','cleaning',3),('factory','coating',4),('factory','loading',5),
 ('field','received',0),('field','mounted',1),('field','bolted',2),('field','touchup',3)
) AS v(kind,key,pos)
WHERE EXISTS (SELECT 1 FROM "Baustelle" b WHERE b."companyProfileId"=c.id AND b.type::text IN ('STEEL_WORKSHOP','STEEL_ASSEMBLY'))
ON CONFLICT ("companyProfileId","key") DO NOTHING;

-- Bind every existing fixed/custom phase, preserving its ID, notes and status.
DO $$ DECLARE r RECORD; meta JSONB; defid TEXT;
BEGIN
 FOR r IN SELECT t.*,b."companyProfileId" AS tenant FROM "TreeItem" t JOIN "Baustelle" b ON b.id=t."baustelleId"
 WHERE b.type::text IN ('STEEL_WORKSHOP','STEEL_ASSEMBLY') AND (t."treeId" LIKE 'steel-task-%' OR t."treeId" IN ('steel-foundation','steel-columns','steel-trusses','steel-painting','steel-cutting','steel-drilling','steel-welding','steel-coating')) LOOP
  BEGIN meta:=r.notes::jsonb; EXCEPTION WHEN OTHERS THEN meta:='{}'::jsonb; END;
  defid:=md5('steeldef:'||r.tenant||':'||r."treeId");
  INSERT INTO "SteelWorkDefinition" ("id","companyProfileId","kind","key","label","sortOrder")
  VALUES(defid,r.tenant,'site',r."treeId",CASE WHEN r."treeId" LIKE 'steel-task-%' THEN COALESCE(meta->>'label','Task') ELSE '' END,100)
  ON CONFLICT ("companyProfileId","key") DO NOTHING;
  SELECT id INTO defid FROM "SteelWorkDefinition" WHERE "companyProfileId"=r.tenant AND key=r."treeId";
  INSERT INTO "SteelSiteTask"("id","companyProfileId","baustelleId","definitionId","treeItemId")
  VALUES(md5('steeltask:'||r.id),r.tenant,r."baustelleId",defid,r.id) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
ALTER TABLE "SteelWorkDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SteelWorkDefinition" FORCE ROW LEVEL SECURITY;
CREATE POLICY steel_definition_tenant ON "SteelWorkDefinition" USING("companyProfileId"=app_current_tenant_id()) WITH CHECK("companyProfileId"=app_current_tenant_id());
ALTER TABLE "SteelWorkVisual" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SteelWorkVisual" FORCE ROW LEVEL SECURITY;
CREATE POLICY steel_visual_tenant ON "SteelWorkVisual" USING("companyProfileId"=app_current_tenant_id()) WITH CHECK("companyProfileId"=app_current_tenant_id());
ALTER TABLE "SteelSiteTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SteelSiteTask" FORCE ROW LEVEL SECURITY;
CREATE POLICY steel_task_tenant ON "SteelSiteTask" USING("companyProfileId"=app_current_tenant_id()) WITH CHECK("companyProfileId"=app_current_tenant_id());
