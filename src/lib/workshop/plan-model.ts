import { z } from "zod";

const key = z.string().min(1).max(128);
const rowSchema = z.object({ id: key, workerNames: z.string().max(8000), machineNames: z.string().max(8000), baustelleName: z.string().max(200), note: z.string().max(2000).nullable() });
const assignment = z.object({ id: key, kind: z.enum(["WORKER", "MACHINE"]), itemId: key, label: z.string().max(200) });
const column = z.object({ id: key, title: z.string().max(200), note: z.string().max(2000), assignments: z.array(assignment).max(200) });
export const demoPlanSchema = z.object({ date: z.iso.date(), columns: z.array(column).max(50), savedRows: z.array(rowSchema).max(50), versions: z.array(z.object({ id: key, at: z.iso.datetime(), actor: z.string().max(200), rows: z.array(rowSchema).max(50) })).max(20) });
export const demoPlansSchema = z.object({ version: z.literal(1), plans: z.array(demoPlanSchema).max(90) });
export const demoPlanCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prepare"), date: z.iso.date() }).strict(),
  z.object({ type: z.literal("move"), date: z.iso.date(), columnId: key, kind: z.enum(["WORKER", "MACHINE"]), itemId: key, force: z.boolean().optional() }).strict(),
  z.object({ type: z.literal("note"), date: z.iso.date(), columnId: key, note: z.string().trim().max(2000) }).strict(),
  z.object({ type: z.literal("remove"), date: z.iso.date(), assignmentId: key }).strict(),
  z.object({ type: z.literal("save"), date: z.iso.date() }).strict(),
  z.object({ type: z.literal("clear"), date: z.iso.date() }).strict(),
]);
export const demoPlanEnvelope = z.object({ requestId: z.uuid(), revision: z.number().int().nonnegative(), command: demoPlanCommand }).strict();
export type DemoPlans = z.infer<typeof demoPlansSchema>;
export type DemoPlan = z.infer<typeof demoPlanSchema>;
export type DemoPlanCommand = z.infer<typeof demoPlanCommand>;
export type PlanDirectory = {
  sites: { id: string; name: string }[];
  workers: { id: string; name: string; licenses: string | null; availability: string; hasApprovedVacation: boolean }[];
  machines: { id: string; name: string; requiredLicense: string | null; isActive: boolean }[];
};
export type DemoPlanSnapshot = DemoPlans & PlanDirectory & { revision: number; today: string; actor: { key: string; name: string; role: "admin" | "worker" } };
export class DemoPlanError extends Error {}
function assert(value: unknown, code: string): asserts value { if (!value) throw new DemoPlanError(code); }
export function adjacentPlanDay(date: string, delta: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10); }
export function planRows(plan: DemoPlan) { return plan.columns.map(c => ({ id: c.id, baustelleName: c.title, workerNames: c.assignments.filter(a => a.kind === "WORKER").map(a => a.label).join(", "), machineNames: c.assignments.filter(a => a.kind === "MACHINE").map(a => a.label).join(", "), note: c.note || null })).filter(r => r.workerNames || r.machineNames || r.note); }
export function blankDemoPlan(date: string, directory: PlanDirectory): DemoPlan { return { date, columns: directory.sites.map(s => ({ id: s.id, title: s.name, note: "", assignments: [] })), savedRows: [], versions: [] }; }

/** Planning never changes custody, stock, repairs, uploaded files or operational tables. */
export function applyDemoPlan(input: DemoPlans, command: DemoPlanCommand, directory: PlanDirectory, now: string, id: string, actor: string): DemoPlans {
  const state = structuredClone(input);
  let plan = state.plans.find(p => p.date === command.date);
  if (!plan) {
    assert(state.plans.length < 90, "storage");
    plan = blankDemoPlan(command.date, directory);
    const previous = state.plans.find(p => p.date === adjacentPlanDay(command.date, -1));
    if (previous) for (const c of plan.columns) {
      const old = previous.columns.find(o => o.id === c.id);
      if (old) { c.note = old.note; c.assignments = old.assignments.filter(a => a.kind === "WORKER" ? directory.workers.some(w => w.id === a.itemId) : directory.machines.some(m => m.id === a.itemId && m.isActive)); }
    }
    state.plans.push(plan);
  }
  // Only stable company-directory identities survive the nightly seed reset.
  for (const site of directory.sites) if (!plan.columns.some(c => c.id === site.id)) plan.columns.push({ id: site.id, title: site.name, note: "", assignments: [] });
  const liveSiteIds = new Set(directory.sites.map(s => s.id));
  if (command.type === "move" || command.type === "note") {
    const c = plan.columns.find(c => c.id === command.columnId && liveSiteIds.has(c.id)); assert(c, "missing");
    if (command.type === "note") c.note = command.note;
    else {
      const item = command.kind === "WORKER" ? directory.workers.find(w => w.id === command.itemId) : directory.machines.find(m => m.id === command.itemId);
      assert(item, "missing");
      if ("isActive" in item) assert(item.isActive, "plan-asset-unavailable");
      else assert(command.force || (item.availability === "AVAILABLE" && !item.hasApprovedVacation), "plan-confirm");
      for (const col of plan.columns) col.assignments = col.assignments.filter(a => !(a.kind === command.kind && a.itemId === command.itemId));
      c.assignments.push({ id, kind: command.kind, itemId: item.id, label: item.name });
    }
  } else if (command.type === "remove") {
    assert(plan.columns.some(c => c.assignments.some(a => a.id === command.assignmentId)), "missing");
    for (const c of plan.columns) c.assignments = c.assignments.filter(a => a.id !== command.assignmentId);
  } else if (command.type === "clear") {
    for (const c of plan.columns) { c.assignments = []; c.note = ""; }
  } else if (command.type === "save") {
    assert(plan.columns.every(c => liveSiteIds.has(c.id) && c.assignments.every(a => a.kind === "WORKER" ? directory.workers.some(w => w.id === a.itemId) : directory.machines.some(m => m.id === a.itemId && m.isActive))), "plan-asset-unavailable");
    const rows = planRows(plan);
    const contents = (values: typeof rows) => values.map(r => [r.id, r.workerNames, r.machineNames, r.baustelleName, r.note]);
    if (!plan.versions.length || JSON.stringify(contents(rows)) !== JSON.stringify(contents(plan.savedRows))) {
      assert(plan.versions.length < 20, "storage");
      plan.versions.push({ id, at: now, actor, rows });
      plan.savedRows = rows;
    }
  }
  return demoPlansSchema.parse(state);
}
