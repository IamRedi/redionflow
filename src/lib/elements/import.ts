import type { Prisma } from "@/generated/prisma/client";

import { compareMarks, type ParsedElementList } from "./tekla-list";
import { readProcessRoutes } from "./stages";

export type ElementImportResult = { list: ParsedElementList["list"]; added: number; updated: number; removed: number; kept: number; addedIds: string[] };
export type ElementImportMode = 'merge' | 'snapshot';
export class ElementImportConflict extends Error {}

/**
 * Writes one parsed list onto a site. Running it again with a newer export
 * updates the rows in place, so the checks made so far stay. An element that
 * is absent from a partial upload stays. Only an explicitly selected full-list
 * snapshot may remove untouched marks. Matching marks update; quantities never
 * add implicitly when the same file is retried.
 */
export async function importElementList(
  tx: Prisma.TransactionClient,
  input: { companyId: string; baustelleId: string; parsed: ParsedElementList; fileName: string; mode?: ElementImportMode },
): Promise<ElementImportResult> {
  const { companyId, baustelleId, parsed, fileName } = input;
  // Also serializes two uploads when there are no element rows yet.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`steel-catalog:${companyId}`}))`;
  // Use the same stable row-lock order as bulk route editing. Reimports may
  // update quantity/weight or remove an unchecked mark, so they participate in
  // the confirmation/configuration serialization before inspecting work.
  await tx.$queryRaw`SELECT "id" FROM "SiteElement" WHERE "companyProfileId"=${companyId} AND "baustelleId"=${baustelleId} ORDER BY "id" FOR UPDATE`;
  const existing = await tx.siteElement.findMany({
    where: { companyProfileId: companyId, baustelleId, list: parsed.list },
    select: { id: true, mark: true, quantity: true, sortIndex: true, processRoutes: true, processRevision: true, work: { select: { stage: true, pieces: true } }, _count: { select: { work: true } } },
  });
  const byMark = new Map(existing.map((row) => [row.mark, row]));
  const ordered = [...parsed.elements].sort((a, b) => compareMarks(a.mark, b.mark));
  for (const element of ordered) {
    const row = byMark.get(element.mark);
    if (!row) continue;
    const byStage = new Map<string, number>();
    for (const work of row.work) byStage.set(work.stage, (byStage.get(work.stage) ?? 0) + (work.pieces > 0 ? work.pieces : row.quantity));
    if (element.quantity < Math.max(0, ...byStage.values())) throw new ElementImportConflict(element.mark);
  }
  let nextSortIndex = Math.max(-1, ...existing.map(row => row.sortIndex)) + 1;
  let updated = 0;
  const fresh: Prisma.SiteElementCreateManyInput[] = [];
  for (const [index, element] of ordered.entries()) {
    const data = {
      kind: element.kind,
      profile: element.profile,
      material: element.material,
      quantity: element.quantity,
      lengthMm: element.lengthMm,
      weightKg: element.weightKg,
      areaM2: element.areaM2,
      sortIndex: input.mode === 'snapshot' ? index : byMark.get(element.mark)?.sortIndex ?? nextSortIndex++,
      sourceFile: fileName,
    };
    const row = byMark.get(element.mark);
    if (row) {
      await tx.siteElement.update({ where: { id: row.id }, data });
      byMark.delete(element.mark);
      updated += 1;
    } else {
      fresh.push({ companyProfileId: companyId, baustelleId, list: parsed.list, mark: element.mark, ...data, processRoutes: { v: 1, factory: [], field: [] } });
    }
  }
  if (fresh.length > 0) await tx.siteElement.createMany({ data: fresh });
  const newRows = fresh.length ? await tx.siteElement.findMany({ where: { companyProfileId: companyId, baustelleId, list: parsed.list, mark: { in: fresh.map(row => row.mark) } }, select: { id: true } }) : [];
  const added = fresh.length;
  const gone = [...byMark.values()];
  const removable = (input.mode === 'snapshot' ? gone : []).filter((row) => {
    const routes = readProcessRoutes(row.processRoutes);
    // An untouched new import has two empty selections. An engineer's saved
    // route (including an intentionally empty one) is planning data to retain.
    return row._count.work === 0 && row.processRevision === 0 && !routes?.factory?.length && !routes?.field?.length;
  }).map((row) => row.id);
  if (removable.length > 0) await tx.siteElement.deleteMany({ where: { id: { in: removable }, companyProfileId: companyId } });
  return { list: parsed.list, added, updated, removed: removable.length, kept: gone.length - removable.length, addedIds: newRows.map(row => row.id) };
}
