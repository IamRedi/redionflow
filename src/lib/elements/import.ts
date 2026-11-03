import type { Prisma } from "@/generated/prisma/client";

import { compareMarks, type ParsedElementList } from "./tekla-list";

export type ElementImportResult = { list: ParsedElementList["list"]; added: number; updated: number; removed: number; kept: number };

/**
 * Writes one parsed list onto a site. Running it again with a newer export
 * updates the rows in place, so the checks made so far stay. An element that
 * is no longer in the export is removed, unless somebody already checked work
 * on it; then it stays and is counted as kept.
 */
export async function importElementList(
  tx: Prisma.TransactionClient,
  input: { companyId: string; baustelleId: string; parsed: ParsedElementList; fileName: string },
): Promise<ElementImportResult> {
  const { companyId, baustelleId, parsed, fileName } = input;
  const existing = await tx.siteElement.findMany({
    where: { companyProfileId: companyId, baustelleId, list: parsed.list },
    select: { id: true, mark: true, _count: { select: { work: true } } },
  });
  const byMark = new Map(existing.map((row) => [row.mark, row]));
  const ordered = [...parsed.elements].sort((a, b) => compareMarks(a.mark, b.mark));
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
      sortIndex: index,
      sourceFile: fileName,
    };
    const row = byMark.get(element.mark);
    if (row) {
      await tx.siteElement.update({ where: { id: row.id }, data });
      byMark.delete(element.mark);
      updated += 1;
    } else {
      fresh.push({ companyProfileId: companyId, baustelleId, list: parsed.list, mark: element.mark, ...data });
    }
  }
  if (fresh.length > 0) await tx.siteElement.createMany({ data: fresh });
  const added = fresh.length;
  const gone = [...byMark.values()];
  const removable = gone.filter((row) => row._count.work === 0).map((row) => row.id);
  if (removable.length > 0) await tx.siteElement.deleteMany({ where: { id: { in: removable }, companyProfileId: companyId } });
  return { list: parsed.list, added, updated, removed: removable.length, kept: gone.length - removable.length };
}
