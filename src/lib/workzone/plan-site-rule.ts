/**
 * The saved daily plan ("Aktuale" in the calendar) keeps names only: a row has
 * the site name and the workers' full names. When the editable plan has no
 * assignment for a worker (it was cleared after saving), the saved row still
 * says where they work.
 */
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

export type SavedPlanRow = { workerNames: string; baustelleName: string };
export type PlanSite = { id: string; name: string };

export function siteFromSavedRows(rows: SavedPlanRow[], workerFullName: string, sites: PlanSite[]): PlanSite | null {
  const wanted = fold(workerFullName);
  if (!wanted) return null;
  const row = rows.find((entry) => entry.workerNames.split(",").some((name) => fold(name) === wanted));
  if (!row) return null;
  const siteName = fold(row.baustelleName);
  const matches = sites.filter((site) => fold(site.name) === siteName);
  return matches.length === 1 ? matches[0] : null;
}
