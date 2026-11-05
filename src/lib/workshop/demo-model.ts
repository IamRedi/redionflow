import { z } from "zod";

// A browser-local rehearsal, deliberately independent of operational tables/actions.
const stamp = z.iso.datetime();
const text = z.string().trim().min(1).max(2000);
const eventSchema = z.object({ id: text, at: stamp, kind: z.enum(["received", "started", "repaired", "released", "issued", "returned", "part", "inspection", "document"]), note: z.string().max(2000), actor: text, ref: z.string().optional() });
const assetSchema = z.object({ id: text, name: text, code: text, kind: z.enum(["fleet", "tool"]), location: text, holder: z.string().max(100), inspection: z.iso.date(), events: z.array(eventSchema) });
const jobSchema = z.object({ id: text, assetId: text, problem: text, priority: z.enum(["normal", "urgent"]), status: z.enum(["received", "repairing", "repaired"]), assignee: z.string().max(100), createdAt: stamp, repairedAt: stamp.optional(), releasedAt: stamp.optional(), repairNote: z.string().max(2000), tested: z.boolean(), parts: z.array(z.object({ id: text, name: text, qty: z.number().int().positive(), unitCents: z.number().int().nonnegative() })) });
export const documentSchema = z.object({ id: text, name: z.string().min(1).max(120), assetId: text, jobId: z.string().optional(), mime: z.enum(["application/pdf", "image/png", "image/jpeg", "text/plain"]), data: z.string().max(360000), bytes: z.number().int().min(1).max(256000), at: stamp });
export const workshopSchema = z.object({ version: z.literal(1), assets: z.array(assetSchema).min(1).max(100), jobs: z.array(jobSchema).max(1000), parts: z.array(z.object({ id: text, name: text, stock: z.number().int().nonnegative(), minimum: z.number().int().nonnegative(), unitCents: z.number().int().nonnegative() })).max(100), documents: z.array(documentSchema).max(40) }).superRefine((state, ctx) => {
  const ids = new Set(state.assets.map(a => a.id));
  const jobs = new Map(state.jobs.map(j => [j.id, j]));
  const open = state.jobs.filter(j => !j.releasedAt).map(j => j.assetId);
  if (ids.size !== state.assets.length || jobs.size !== state.jobs.length || new Set(open).size !== open.length || state.jobs.some(j => !ids.has(j.assetId) || (j.releasedAt && (j.status !== "repaired" || !j.tested))) || state.documents.some(d => !ids.has(d.assetId) || (d.jobId && jobs.get(d.jobId)?.assetId !== d.assetId) || (d.mime !== "text/plain" && !/^[A-Za-z0-9+/]+={0,2}$/.test(d.data)))) ctx.addIssue({ code: "custom", message: "Invalid workshop references" });
});
export type WorkshopState = z.infer<typeof workshopSchema>;
export type WorkshopAsset = WorkshopState["assets"][number];
export type WorkshopJob = WorkshopState["jobs"][number];
export type WorkshopDocument = WorkshopState["documents"][number];
export type EventKind = WorkshopAsset["events"][number]["kind"];
export const WORKSHOP_STORAGE_KEY = "redionflow:baumdienst:workshop-demo:v1";
export const workshopTabs = ["orders", "fleet", "tools", "parts", "documents", "history"] as const;
export type WorkshopTab = typeof workshopTabs[number];

export type WorkshopCommand =
  | { type: "receive"; assetId: string; problem: string; priority: "normal" | "urgent"; assignee: string }
  | { type: "start"; jobId: string; assignee: string }
  | { type: "repair"; jobId: string; note: string; tested: boolean }
  | { type: "release"; jobId: string }
  | { type: "issue"; assetId: string; holder: string }
  | { type: "return"; assetId: string }
  | { type: "inspection"; assetId: string; date: string; note: string }
  | { type: "part"; jobId: string; partId: string; qty: number }
  | { type: "restock"; partId: string; qty: number }
  | { type: "document"; document: WorkshopDocument };
export class WorkshopError extends Error {}
function assert(value: unknown, code: string): asserts value { if (!value) throw new WorkshopError(code); }
export function activeJob(state: WorkshopState, assetId: string) { return state.jobs.find(j => j.assetId === assetId && !j.releasedAt); }
export function workshopDay(now: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now)); }
export function inspectionOverdue(asset: WorkshopAsset, now: string) { return asset.inspection < workshopDay(now); }
export function availability(state: WorkshopState, asset: WorkshopAsset, now: string) {
  if (activeJob(state, asset.id)) return "workshop";
  if (inspectionOverdue(asset, now)) return "inspection";
  return asset.holder ? "issued" : "available";
}
export function applyWorkshopCommand(input: WorkshopState, command: WorkshopCommand, now: string, id: string): WorkshopState {
  const state = structuredClone(input);
  const event = (asset: WorkshopAsset, kind: EventKind, note = "", ref?: string) => asset.events.unshift({ id, at: now, kind, note, actor: "Demo", ...(ref ? { ref } : {}) });
  const assetFor = (assetId: string) => { const asset = state.assets.find(a => a.id === assetId); assert(asset, "missing"); return asset; };
  const jobFor = (jobId: string) => { const job = state.jobs.find(j => j.id === jobId); assert(job, "missing"); return job; };
  const positive = (qty: number) => assert(Number.isSafeInteger(qty) && qty > 0 && qty <= 10000, "quantity");
  switch (command.type) {
    case "receive": {
      const asset = assetFor(command.assetId);
      assert(!activeJob(state, asset.id), "duplicate"); assert(command.problem.trim() && command.problem.length <= 2000, "required");
      state.jobs.unshift({ id, assetId: asset.id, problem: command.problem.trim(), priority: command.priority, status: "received", assignee: command.assignee.trim().slice(0, 100), createdAt: now, repairNote: "", tested: false, parts: [] });
      if (asset.holder) event(asset, "returned", asset.holder, id);
      asset.holder = ""; asset.location = "Werkstatt"; event(asset, "received", command.problem.trim(), id); break;
    }
    case "start": {
      const job = jobFor(command.jobId); assert(job.status === "received" && !job.releasedAt, "transition"); assert(command.assignee.trim(), "required");
      job.status = "repairing"; job.assignee = command.assignee.trim().slice(0, 100); event(assetFor(job.assetId), "started", job.assignee, job.id); break;
    }
    case "repair": {
      const job = jobFor(command.jobId); assert(job.status === "repairing", "transition"); assert(command.note.trim() && command.tested, "testRequired");
      job.status = "repaired"; job.repairedAt = now; job.repairNote = command.note.trim(); job.tested = true; event(assetFor(job.assetId), "repaired", job.repairNote, job.id); break;
    }
    case "release": {
      const job = jobFor(command.jobId); const asset = assetFor(job.assetId);
      assert(job.status === "repaired" && job.tested && !job.releasedAt, "transition"); assert(!inspectionOverdue(asset, now), "inspectionRequired");
      job.releasedAt = now; asset.location = "Lager"; event(asset, "released", "", job.id); break;
    }
    case "issue": {
      const asset = assetFor(command.assetId); assert(availability(state, asset, now) === "available", "unavailable"); assert(command.holder.trim(), "required");
      asset.holder = command.holder.trim().slice(0, 100); asset.location = asset.holder; event(asset, "issued", asset.holder); break;
    }
    case "return": {
      const asset = assetFor(command.assetId); assert(asset.holder, "transition"); event(asset, "returned", asset.holder); asset.holder = ""; asset.location = "Lager"; break;
    }
    case "inspection": {
      const asset = assetFor(command.assetId); assert(z.iso.date().safeParse(command.date).success && command.date >= workshopDay(now) && command.note.trim(), "required");
      asset.inspection = command.date; event(asset, "inspection", `${command.date} · ${command.note.trim()}`); break;
    }
    case "part": {
      const job = jobFor(command.jobId); assert(job.status === "repairing", "transition"); positive(command.qty);
      const part = state.parts.find(p => p.id === command.partId); assert(part, "missing"); assert(part.stock >= command.qty, "stock");
      part.stock -= command.qty; job.parts.push({ id: part.id, name: part.name, qty: command.qty, unitCents: part.unitCents }); event(assetFor(job.assetId), "part", `${command.qty} × ${part.name}`, job.id); break;
    }
    case "restock": {
      positive(command.qty); const part = state.parts.find(p => p.id === command.partId); assert(part, "missing"); part.stock += command.qty; break;
    }
    case "document": {
      const doc = documentSchema.parse(command.document); const asset = assetFor(doc.assetId);
      if (doc.jobId) assert(jobFor(doc.jobId).assetId === asset.id, "missing");
      assert(state.documents.reduce((n, d) => n + d.bytes, 0) + doc.bytes <= 1_000_000 && state.documents.length < 40, "storage");
      state.documents.unshift(doc); event(asset, "document", doc.name, doc.jobId); break;
    }
  }
  return workshopSchema.parse(state);
}
