import type { Prisma } from "@/generated/prisma/client";
import { assetActor, assetFail } from "@/lib/company-assets/access";
import { withTenantContext } from "@/lib/db/tenant-context";
import { logger } from "@/lib/observability/logger";

import { applyAccessLevel } from "./apply";
import { ACCESS_ACTIONS, ACCESS_PLACES, can, effectiveLevel, legacyActions, placeOf, type AccessAction, type AccessLevel, type AccessPlace, type AccessSubject, type GrantLevel } from "./rules";

type Tx = Prisma.TransactionClient;

/** Only an active admin of a steel company manages access. */
async function accessAdmin() {
  const actor = await assetActor();
  if (!actor.userId) return assetFail("DENIED");
  return actor;
}

export const readAccessPlace = (value: unknown): AccessPlace | null => (typeof value === "string" && (ACCESS_PLACES as readonly string[]).includes(value) ? (value as AccessPlace) : null);
const cleanScope = (place: AccessPlace, scopeId: unknown) => (place === "site" && typeof scopeId === "string" ? scopeId.trim().slice(0, 64) : "");

async function checkScope(tx: Tx, companyId: string, place: AccessPlace, scopeId: string) {
  if (place !== "site" || !scopeId) return "";
  const site = await tx.baustelle.findFirst({ where: { id: scopeId, companyProfileId: companyId }, select: { name: true } });
  return site ? site.name : assetFail("NOT_FOUND");
}

const actActions = (place: AccessPlace) => (Object.keys(ACCESS_ACTIONS) as AccessAction[]).filter(action => placeOf(action) === place && !action.endsWith(".view"));
const workerSelect = {
  id: true, firstName: true, lastName: true, crewRole: true, accessLevel: true, status: true,
  accessGrants: { select: { place: true, scopeId: true, level: true } },
  siteDocumentGrants: { select: { baustelleId: true } },
} satisfies Prisma.WorkerSelect;
type WorkerRow = Prisma.WorkerGetPayload<{ select: typeof workerSelect }>;

function subjectOf(row: WorkerRow): Extract<AccessSubject, { kind: "worker" }> {
  return {
    kind: "worker",
    active: row.status === "active",
    accessLevel: row.accessLevel === "BASE" || row.accessLevel === "FULL_VIEW" ? row.accessLevel : null,
    crewRole: row.crewRole,
    grants: row.accessGrants.flatMap(g => {
      const place = readAccessPlace(g.place);
      return place && (g.level === "view" || g.level === "act" || g.level === "none") ? [{ place, scopeId: g.scopeId, level: g.level as GrantLevel }] : [];
    }),
    legacySiteGrants: new Set(row.siteDocumentGrants.map(g => g.baustelleId)),
  };
}

export type PlacePerson = {
  id: string; name: string; level: AccessLevel; crewRole: string | null;
  /** Grant set with the key button for exactly this place/scope (editable). */
  grant: GrantLevel | null;
  /** "all" = grant for the whole place covers this site too. */
  grantScope: "here" | "all" | null;
  acts: "all" | "some" | "none";
  sees: boolean;
};

/** Who sees and who acts at one place, for the key button. */
export async function readPlaceAccess(placeInput: unknown, scopeInput?: unknown) {
  const place = readAccessPlace(placeInput) ?? assetFail("BAD_INPUT");
  const scopeId = cleanScope(place, scopeInput);
  const actor = await accessAdmin();
  return withTenantContext(actor.companyId, async tx => {
    const scopeName = await checkScope(tx, actor.companyId, place, scopeId);
    const [rows, admins] = await Promise.all([
      tx.worker.findMany({ where: { companyProfileId: actor.companyId, status: "active" }, select: workerSelect, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
      tx.user.findMany({ where: { companyProfileId: actor.companyId, role: "ADMIN", isActive: true }, select: { name: true, email: true }, orderBy: { name: "asc" } }),
    ]);
    const people: PlacePerson[] = rows.map(row => {
      const subject = subjectOf(row);
      const here = row.accessGrants.find(g => g.place === place && g.scopeId === scopeId);
      const all = scopeId ? row.accessGrants.find(g => g.place === place && g.scopeId === "") : undefined;
      const allowed = actActions(place).filter(action => can(subject, action, scopeId));
      return {
        id: row.id, name: `${row.firstName} ${row.lastName}`.trim(), level: effectiveLevel(subject), crewRole: row.crewRole,
        grant: here ? (here.level as GrantLevel) : all ? (all.level as GrantLevel) : null,
        grantScope: here ? "here" : all ? "all" : null,
        acts: allowed.length === 0 ? "none" : allowed.length === actActions(place).length ? "all" : "some",
        sees: can(subject, `${place}.view` as AccessAction, scopeId),
      };
    });
    return { place, scopeId, scopeName, admins: admins.map(a => a.name || a.email), people };
  });
}

/** Number of people (not admins) who act at a place, for the "🔑 N" badge. */
export async function countPlaceActors(placeInput: unknown, scopeInput?: unknown) {
  const data = await readPlaceAccess(placeInput, scopeInput);
  return data.people.filter(p => p.acts !== "none").length;
}

/** Key button: give "view"/"act" at a place, or null to take the grant away. */
export async function setPlaceAccess(input: { place: unknown; scopeId?: unknown; workerId: unknown; level: unknown }) {
  const place = readAccessPlace(input.place) ?? assetFail("BAD_INPUT");
  const scopeId = cleanScope(place, input.scopeId);
  const workerId = typeof input.workerId === "string" ? input.workerId : assetFail("BAD_INPUT");
  const level = input.level === "view" || input.level === "act" || input.level === "none" ? input.level : input.level === null ? null : assetFail("BAD_INPUT");
  const actor = await accessAdmin();
  await withTenantContext(actor.companyId, async tx => {
    await checkScope(tx, actor.companyId, place, scopeId);
    const worker = await tx.worker.findFirst({ where: { id: workerId, companyProfileId: actor.companyId, status: "active" }, select: { id: true } });
    if (!worker) return assetFail("NOT_FOUND");
    const key = { companyProfileId_place_scopeId_workerId: { companyProfileId: actor.companyId, place, scopeId, workerId } };
    if (level === null) await tx.accessGrant.deleteMany({ where: { companyProfileId: actor.companyId, place, scopeId, workerId } });
    else await tx.accessGrant.upsert({ where: key, create: { companyProfileId: actor.companyId, place, scopeId, workerId, level, grantedByUserId: actor.userId }, update: { level, grantedByUserId: actor.userId } });
  });
  logger.info({ event: "access.grant_changed", place, scoped: Boolean(scopeId), level }, "Access changed");
  return readPlaceAccess(place, scopeId);
}

/** Profile list "Ku ka akses": level and every key-button grant of one worker. */
export async function readWorkerAccessSummary(workerIdInput: unknown) {
  const workerId = typeof workerIdInput === "string" ? workerIdInput : assetFail("BAD_INPUT");
  const actor = await accessAdmin();
  return withTenantContext(actor.companyId, async tx => {
    const row = await tx.worker.findFirst({ where: { id: workerId, companyProfileId: actor.companyId }, select: workerSelect });
    if (!row) return assetFail("NOT_FOUND");
    const siteIds = row.accessGrants.filter(g => g.place === "site" && g.scopeId).map(g => g.scopeId);
    const sites = siteIds.length ? await tx.baustelle.findMany({ where: { companyProfileId: actor.companyId, id: { in: siteIds } }, select: { id: true, name: true } }) : [];
    const siteName = new Map(sites.map(s => [s.id, s.name]));
    const subject = subjectOf(row);
    return {
      id: row.id,
      level: effectiveLevel(subject),
      levelSet: row.accessLevel === "BASE" || row.accessLevel === "FULL_VIEW",
      crewRole: row.crewRole,
      fromRole: subject.accessLevel ? [] : [...new Set(legacyActions(row.crewRole).map(a => placeOf(a.action)))],
      grants: row.accessGrants
        .flatMap(g => { const place = readAccessPlace(g.place); return place ? [{ place, scopeId: g.scopeId, scopeName: g.scopeId ? siteName.get(g.scopeId) ?? null : null, level: g.level as GrantLevel }] : []; })
        .sort((a, b) => ACCESS_PLACES.indexOf(a.place) - ACCESS_PLACES.indexOf(b.place)),
    };
  });
}

export async function setWorkerAccessLevel(input: { workerId: unknown; level: unknown }) {
  const workerId = typeof input.workerId === "string" ? input.workerId : assetFail("BAD_INPUT");
  const level = input.level === "BASE" || input.level === "FULL_VIEW" ? input.level : assetFail("BAD_INPUT");
  const actor = await accessAdmin();
  const done = await withTenantContext(actor.companyId, tx => applyAccessLevel(tx, actor.companyId, workerId, level, actor.userId));
  if (!done) return assetFail("NOT_FOUND");
  logger.info({ event: "access.level_changed", level }, "Access level changed");
  return readWorkerAccessSummary(workerId);
}
