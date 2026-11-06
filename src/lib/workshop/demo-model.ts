import { z } from "zod";
import { identityCollision } from "./asset-identity";
import { assetDetailsSchema, custodySchema, emptyCustody } from "./custody-schema";

// Fictional workshop rules, independent of operational fleet and planning actions.
const stamp = z.iso.datetime();
const text = z.string().trim().min(1).max(2000);
export const placementSchema = z.object({ workerKey: text.optional(), workerName: text.optional(), siteKey: text.optional(), siteName: text.optional() }).strict().superRefine((p, ctx) => {
  if ((!p.workerKey && !p.siteKey) || Boolean(p.workerKey) !== Boolean(p.workerName) || Boolean(p.siteKey) !== Boolean(p.siteName)) ctx.addIssue({ code: "custom", message: "Invalid inventory placement" });
});
export type InventoryPlacement = z.infer<typeof placementSchema>;
const eventSchema = z.object({ id: text, at: stamp, kind: z.enum(["received", "started", "repaired", "released", "issued", "transferred", "returned", "part", "inspection", "document", "photo", "registered", "updated", "handover_requested", "handover_confirmed", "handover_declined", "handover_cancelled"]), note: z.string().max(2000), actor: text, actorKey: text.optional(), method: z.enum(["scan", "selection"]).optional(), ref: z.string().optional(), placement: placementSchema.optional() });
const assetSchema = z.object({ id: text, name: text, code: text, plate: z.string().trim().min(1).max(24).optional(), barcode: z.string().trim().regex(/^[A-Z0-9 .$/+%\-]{1,80}$/).optional(), kind: z.enum(["fleet", "tool"]), location: text, holder: z.string().max(100), inspection: z.iso.date(), events: z.array(eventSchema), placement: placementSchema.optional(), details: assetDetailsSchema.optional() });
const originSchema = z.object({ holder: z.string().max(100), location: text, placement: placementSchema.optional() });
const jobSchema = z.object({ id: text, assetId: text, problem: text, priority: z.enum(["normal", "urgent"]), status: z.enum(["received", "repairing", "repaired"]), assignee: z.string().max(100), createdAt: stamp, repairedAt: stamp.optional(), releasedAt: stamp.optional(), repairNote: z.string().max(2000), tested: z.boolean(), origin: originSchema.optional(), parts: z.array(z.object({ id: text, name: text, qty: z.number().int().positive(), unitCents: z.number().int().nonnegative() })) });
export const documentSchema = z.object({ id: text, name: z.string().min(1).max(120), assetId: text, jobId: z.string().optional(), mime: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]), data: z.string().max(360000).optional(), fileId: z.uuid().optional(), bytes: z.number().int().min(1).max(1_000_000), at: stamp });
const movementSchema = z.object({ id: text, at: stamp, kind: z.enum(["consume", "restock"]), partId: text, qty: z.number().int().positive(), unitCents: z.number().int().nonnegative(), jobId: z.string().optional(), actor: text });
const stateShape = z.object({ version: z.literal(4), custody: custodySchema.default(emptyCustody), assets: z.array(assetSchema).min(1).max(100), jobs: z.array(jobSchema).max(1000), parts: z.array(z.object({ id: text, name: text, stock: z.number().int().nonnegative(), minimum: z.number().int().nonnegative(), unitCents: z.number().int().nonnegative() })).max(100), documents: z.array(documentSchema).max(80), movements: z.array(movementSchema).max(10000).default([]) });
export const legacyWorkshopSchema = stateShape.extend({ version: z.literal(1) });
export const previousWorkshopSchema = stateShape.extend({ version: z.literal(2) });
export const versionThreeWorkshopSchema = stateShape.extend({ version: z.literal(3) });
export const workshopSchema = stateShape.superRefine((state, ctx) => {
  const ids = new Set(state.assets.map(a => a.id));
  if (state.assets.some(asset => identityCollision(asset, state.assets))) ctx.addIssue({ code: "custom", message: "Duplicate inventory identifier" });
  const jobs = new Map(state.jobs.map(j => [j.id, j]));
  const open = state.jobs.filter(j => !j.releasedAt).map(j => j.assetId);
  const pending = state.custody.handovers.filter(h => h.status === "pending");
  if (new Set(pending.map(h => h.assetId)).size !== pending.length || pending.some(h => !ids.has(h.assetId) || open.includes(h.assetId)) || state.custody.handovers.some(h => !ids.has(h.assetId) || new Set(h.required).size !== h.required.length || new Set(h.confirmations.map(c => c.actorKey)).size !== h.confirmations.length || h.confirmations.some(c => !h.required.includes(c.actorKey)) || (h.status === "completed" && h.required.some(k => !h.confirmations.some(c => c.actorKey === k))))) ctx.addIssue({ code: "custom", message: "Invalid custody references" });
  if (ids.size !== state.assets.length || jobs.size !== state.jobs.length || new Set(open).size !== open.length || state.jobs.some(j => !ids.has(j.assetId) || (j.releasedAt && (j.status !== "repaired" || !j.tested))) || state.documents.some(d => !ids.has(d.assetId) || (d.jobId && jobs.get(d.jobId)?.assetId !== d.assetId) || (!d.fileId && !d.data) || (d.data && d.mime !== "text/plain" && !/^[A-Za-z0-9+/]+={0,2}$/.test(d.data)))) ctx.addIssue({ code: "custom", message: "Invalid workshop references" });
  if (new Set(state.documents.map(d => d.id)).size !== state.documents.length || state.movements.some(m => !state.parts.some(p => p.id === m.partId) || (m.jobId && !jobs.has(m.jobId)))) ctx.addIssue({ code: "custom", message: "Invalid document or movement references" });
  if (new Set(state.assets.map(a => a.code.trim().toUpperCase())).size !== state.assets.length || state.assets.some(a => a.placement && (Boolean(a.holder) !== Boolean(a.placement.workerKey) || a.holder !== (a.placement.workerName ?? "") || open.includes(a.id)))) ctx.addIssue({ code: "custom", message: "Invalid inventory identity or placement" });
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
  | { type: "assign"; assetId: string; placement: InventoryPlacement }
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
  return asset.holder || asset.placement ? "issued" : "available";
}
export function applyWorkshopCommand(input: WorkshopState, command: WorkshopCommand, now: string, id: string): WorkshopState {
  const state = structuredClone(input);
  const event = (asset: WorkshopAsset, kind: EventKind, note = "", ref?: string, placement = asset.placement) => asset.events.unshift({ id, at: now, kind, note, actor: "Demo", ...(ref ? { ref } : {}), ...(placement ? { placement: structuredClone(placement) } : {}) });
  const assetFor = (assetId: string) => { const asset = state.assets.find(a => a.id === assetId); assert(asset, "missing"); return asset; };
  const jobFor = (jobId: string) => { const job = state.jobs.find(j => j.id === jobId); assert(job, "missing"); return job; };
  const positive = (qty: number) => assert(Number.isSafeInteger(qty) && qty > 0 && qty <= 10000, "quantity");
  switch (command.type) {
    case "receive": {
      const asset = assetFor(command.assetId);
      assert(!activeJob(state, asset.id), "duplicate"); assert(command.problem.trim() && command.problem.length <= 2000, "required");
      const origin = { holder: asset.holder, location: asset.location, ...(asset.placement ? { placement: structuredClone(asset.placement) } : {}) };
      state.jobs.unshift({ id, assetId: asset.id, problem: command.problem.trim(), priority: command.priority, status: "received", assignee: command.assignee.trim().slice(0, 100), createdAt: now, repairNote: "", tested: false, parts: [], origin });
      if (asset.holder || asset.placement) event(asset, "returned", [asset.holder, asset.placement?.siteName].filter(Boolean).join(" · "), id);
      asset.holder = ""; delete asset.placement; asset.location = "Werkstatt"; event(asset, "received", command.problem.trim(), id, origin.placement); break;
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
    case "assign": {
      const asset = assetFor(command.assetId);
      assert(!["workshop", "inspection"].includes(availability(state, asset, now)), "unavailable");
      const placement = placementSchema.parse(command.placement);
      assert(JSON.stringify(asset.placement) !== JSON.stringify(placement), "transition");
      const moving = Boolean(asset.holder || asset.placement);
      const from = [asset.holder, asset.placement?.siteName].filter(Boolean).join(" · ");
      asset.placement = placement; asset.holder = placement.workerName ?? ""; asset.location = placement.siteName ?? placement.workerName!;
      const to = [placement.workerName, placement.siteName].filter(Boolean).join(" · ");
      event(asset, moving ? "transferred" : "issued", moving ? `${from} → ${to}` : to); break;
    }
    case "return": {
      const asset = assetFor(command.assetId); assert(asset.holder || asset.placement, "transition"); event(asset, "returned", [asset.holder, asset.placement?.siteName].filter(Boolean).join(" · ")); asset.holder = ""; delete asset.placement; asset.location = "Lager"; break;
    }
    case "inspection": {
      const asset = assetFor(command.assetId); assert(z.iso.date().safeParse(command.date).success && command.date >= workshopDay(now) && command.note.trim(), "required");
      asset.inspection = command.date; event(asset, "inspection", `${command.date} · ${command.note.trim()}`); break;
    }
    case "part": {
      const job = jobFor(command.jobId); assert(job.status === "repairing", "transition"); positive(command.qty);
      const part = state.parts.find(p => p.id === command.partId); assert(part, "missing"); assert(part.stock >= command.qty, "stock");
      part.stock -= command.qty; job.parts.push({ id: part.id, name: part.name, qty: command.qty, unitCents: part.unitCents });
      state.movements.unshift({ id, at: now, kind: "consume", partId: part.id, qty: command.qty, unitCents: part.unitCents, jobId: job.id, actor: "Demo" });
      event(assetFor(job.assetId), "part", `${command.qty} × ${part.name}`, job.id); break;
    }
    case "restock": {
      positive(command.qty); const part = state.parts.find(p => p.id === command.partId); assert(part, "missing"); assert(part.stock + command.qty <= 100000, "quantity"); part.stock += command.qty;
      state.movements.unshift({ id, at: now, kind: "restock", partId: part.id, qty: command.qty, unitCents: part.unitCents, actor: "Demo" }); break;
    }
    case "document": {
      const doc = documentSchema.parse(command.document); const asset = assetFor(doc.assetId);
      if (doc.jobId) assert(jobFor(doc.jobId).assetId === asset.id, "missing");
      assert(state.documents.reduce((n, d) => n + d.bytes, 0) + doc.bytes <= 10_000_000 && state.documents.length < 80, "storage");
      state.documents.unshift(doc); event(asset, "document", doc.name, doc.jobId); break;
    }
  }
  return workshopSchema.parse(state);
}
