/**
 * One-time check at boot: data that came from a site document that was later
 * deleted (before deleting a document also deleted its data).
 *
 *   ORPHAN_SITE_DATA=report   log, per site, elements whose source file and
 *                             factory batches whose order document are gone
 *   ORPHAN_SITE_DATA=delete   delete exactly those
 *
 * Remove the variable after one boot.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";

export async function runOrphanSiteData() {
  const mode = (process.env.ORPHAN_SITE_DATA ?? "").trim();
  if (mode !== "report" && mode !== "delete") return;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) { console.log(`[orphan-data] expected exactly one company, found ${companies.length}; nothing done.`); return; }
    const companyId = companies[0].id;
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, companyId);
      const files = await tx.siteFile.findMany({ where: { companyProfileId: companyId }, select: { id: true, baustelleId: true, kind: true, fileName: true, reference: true } });
      const names = new Set(files.map(f => `${f.baustelleId}|${f.fileName}`));
      const orders = new Set(files.filter(f => f.kind === "order" && f.reference).map(f => `${f.baustelleId}|${f.reference}`));
      const fileIds = new Set(files.map(f => f.id));
      const sites = new Map((await tx.baustelle.findMany({ where: { companyProfileId: companyId }, select: { id: true, name: true } })).map(s => [s.id, s.name]));
      const elements = (await tx.siteElement.findMany({ where: { companyProfileId: companyId, sourceFile: { not: null } }, select: { id: true, baustelleId: true, sourceFile: true, list: true, _count: { select: { work: true } } } }))
        .filter(e => !names.has(`${e.baustelleId}|${e.sourceFile}`));
      const batches = (await tx.productionBatch.findMany({ where: { companyProfileId: companyId, OR: [{ siteFileId: { not: null } }, { orderRef: { not: null } }] }, select: { id: true, baustelleId: true, orderRef: true, siteFileId: true, title: true } }))
        .filter(b => b.siteFileId ? !fileIds.has(b.siteFileId) : !orders.has(`${b.baustelleId}|${b.orderRef}`));
      const groups = new Map<string, { elements: number; work: number; batches: number }>();
      const key = (site: string, source: string) => `${sites.get(site) ?? site} ← ${source}`;
      for (const e of elements) { const g = groups.get(key(e.baustelleId, e.sourceFile!)) ?? { elements: 0, work: 0, batches: 0 }; g.elements++; g.work += e._count.work; groups.set(key(e.baustelleId, e.sourceFile!), g); }
      for (const b of batches) { const k = key(b.baustelleId, `porosia ${b.orderRef ?? "?"}`); const g = groups.get(k) ?? { elements: 0, work: 0, batches: 0 }; g.batches++; groups.set(k, g); }
      for (const [k, g] of groups) console.log(`[orphan-data] ${k}: ${g.elements} elements (${g.work} checked work), ${g.batches} factory batches`);
      console.log(`[orphan-data] total ${elements.length} elements, ${batches.length} batches without their document.`);
      if (mode === "delete") {
        await tx.siteElement.deleteMany({ where: { companyProfileId: companyId, id: { in: elements.map(e => e.id) } } });
        await tx.productionBatch.deleteMany({ where: { companyProfileId: companyId, id: { in: batches.map(b => b.id) } } });
        console.log("[orphan-data] deleted.");
      }
    }, { timeout: 60_000 });
  } finally {
    await prisma.$disconnect();
  }
}
