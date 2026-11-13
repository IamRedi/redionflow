import { prisma } from "@/lib/db/prisma";
import { isBaumdienstWorkshopDemoEnabled } from "@/lib/public-demo";
import { officeStateSchema } from "./model";

/** Rehydrate only explicitly saved fictional sites after the nightly base-demo reset.
 * Existing records win: never overwrite site edits, trees, coordinates or assignment. */
export async function restoreOfficeSites(companyId: string) {
  if (!isBaumdienstWorkshopDemoEnabled("baumdienst")) return;
  const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { mode: true, displayName: true } });
  if (company?.mode !== "baumdienst" || company.displayName !== "Baumdienst Musterstadt GmbH") return;
  const row = await prisma.baumdienstDemoWorkspace.findUnique({ where: { key: "baumdienst-offices:v1" } });
  if (!row) return;
  const sites = officeStateSchema.parse(row.data).sites;
  if (!sites.length) return;
  const existing = new Set((await prisma.baustelle.findMany({ where: { companyProfileId: companyId, id: { in: sites.map(s => s.id) } }, select: { id: true } })).map(s => s.id));
  const missing = sites.filter(s => !existing.has(s.id));
  if (missing.length) await prisma.baustelle.createMany({ data: missing.map(s => ({ id: s.id, companyProfileId: companyId, name: s.name, address: s.address || null, description: s.description || null, type: s.method, status: "active" as const, documents: [] })), skipDuplicates: true });
}
