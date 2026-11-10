import type { Prisma } from "@/generated/prisma/client";

import { FACTORY_STEP_KEYS } from "../factory/production";

import { FIELD_STAGES, type ElementList, type ElementProcessRoutes } from "./stages";

type Tx = Prisma.TransactionClient;
export type DefaultElementRoutes = Record<ElementList, ElementProcessRoutes>;

/**
 * The processes a newly imported element starts with (Megi, 10.11.2026):
 * every assembly (B/1, C/40) goes through all active factory processes and all
 * active site processes of the company catalog, in catalog order. A cut part
 * only needs cutting and is never on the site list. The engineer can still
 * change them per element with "Proceset".
 */
export async function defaultElementRoutes(tx: Tx, companyId: string): Promise<DefaultElementRoutes> {
  const rows = await tx.steelWorkDefinition.findMany({
    where: { companyProfileId: companyId, kind: { in: ["factory", "field"] }, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { key: true, kind: true },
  });
  const factory = rows.filter(row => row.kind === "factory").map(row => row.key);
  const field = rows.filter(row => row.kind === "field").map(row => row.key);
  const assemblyFactory = factory.length ? factory : [...FACTORY_STEP_KEYS];
  return {
    assembly: { v: 1, factory: assemblyFactory, field: field.length ? field : [...FIELD_STAGES] },
    part: { v: 1, factory: assemblyFactory.includes("cutting") ? ["cutting"] : [], field: [] },
  };
}

const isEmptyRoute = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.v === 1 && Array.isArray(item.factory) && item.factory.length === 0 && Array.isArray(item.field) && item.field.length === 0;
};

/**
 * Gives elements imported before the defaults existed their processes: only
 * rows nobody touched (no saved route, no confirmed work, both routes empty).
 * Safe to run on every boot.
 */
export async function fillDefaultElementRoutes(tx: Tx, companyId: string): Promise<number> {
  const rows = await tx.siteElement.findMany({
    where: { companyProfileId: companyId, processRevision: 0, work: { none: {} } },
    select: { id: true, list: true, processRoutes: true },
  });
  const empty = rows.filter(row => isEmptyRoute(row.processRoutes));
  if (!empty.length) return 0;
  const defaults = await defaultElementRoutes(tx, companyId);
  for (const list of ["assembly", "part"] as const) {
    const ids = empty.filter(row => row.list === list).map(row => row.id);
    if (ids.length) await tx.siteElement.updateMany({ where: { companyProfileId: companyId, id: { in: ids }, processRevision: 0 }, data: { processRoutes: defaults[list] } });
  }
  return empty.length;
}
