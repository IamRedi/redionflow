import { z } from "zod";
import { calculatePositionTotals } from "@/lib/calculation/position";

export const officeRole = z.enum(["reception", "manager", "finance", "operations", "clients"]);
export type OfficeRole = z.infer<typeof officeRole>;
export const officeRoles = officeRole.options;
export const officeCapabilities = (role: OfficeRole) => ({ staff: role === "manager" || role === "finance", site: role === "manager" || role === "operations", quote: role === "manager" || role === "clients", inquiries: role !== "finance", finances: ["manager", "finance", "clients"].includes(role) });
const id = z.uuid(), text = z.string().trim().min(1).max(160), memo = z.string().trim().max(4000), at = z.iso.datetime();
const money = z.number().int().min(0).max(100_000_000), pct = z.number().min(0).max(1);
export const officeOverhead = z.object({ bgkPct: pct, agkPct: pct, riskPct: pct, profitPct: pct, vatPct: pct, bgkBase: z.enum(["EK_TOTAL", "LABOR_ONLY"]), riskProfitMode: z.enum(["SEPARATE", "COMBINED"]), applyVatByDefault: z.boolean() }).strict();
export const quoteInput = z.object({ title: text, client: text, inquiryId: id.optional(), laborCents: money, machineCents: money, materialCents: money, externalCents: money, overhead: officeOverhead }).strict();
export const quoteTotals = (q: z.infer<typeof quoteInput>) => calculatePositionTotals(q, q.overhead);
export const defaultOfficeOverhead: z.infer<typeof officeOverhead> = { bgkPct: .15, agkPct: .1, riskPct: .03, profitPct: .05, vatPct: .19, bgkBase: "EK_TOTAL", riskProfitMode: "SEPARATE", applyVatByDefault: true };
export const officeStateSchema = z.object({
  version: z.literal(1),
  folders: z.array(z.object({ id, owner: officeRole, name: text, archived: z.boolean() })).max(100),
  documents: z.array(z.object({ id, owner: officeRole, folderId: id.optional(), shared: z.boolean(), archived: z.boolean(), siteIds: z.array(z.string().max(128)).max(50), at })).max(200),
  tasks: z.array(z.object({ id, owner: officeRole, title: text, text: memo, status: z.enum(["todo", "doing", "done"]), archived: z.boolean(), at })).max(500),
  inquiries: z.array(z.object({ id, createdBy: officeRole, client: text, contact: z.string().trim().max(200), address: z.string().trim().max(300), description: memo, siteId: z.string().max(128).optional(), at })).max(300),
  quotes: z.array(quoteInput.extend({ id, owner: officeRole, at })).max(300),
  sites: z.array(z.object({ id: z.string().max(128), name: text, address: z.string().max(300), description: memo, method: z.enum(["CLIMBING", "TRUCK_PLATFORM", "TRUCK_CRANE"]), at })).max(200).default([]),
  turns: z.array(z.object({ id, owner: officeRole, question: z.string().max(2000), answer: z.string().max(8000), status: z.enum(["pending", "completed", "error"]), at, model: z.string().max(100) })).max(2000),
  events: z.array(z.object({ id, owner: officeRole, kind: z.enum(["folder", "file", "task", "inquiry", "quote", "site", "assistant"]), ref: z.string().max(128), at })).max(5000),
}).strict();
export type OfficeState = z.infer<typeof officeStateSchema>;
export const emptyOfficeState = (): OfficeState => ({ version: 1, folders: [], documents: [], tasks: [], inquiries: [], quotes: [], sites: [], turns: [], events: [] });
export const officeCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("folder"), name: text }).strict(),
  z.object({ type: z.literal("task"), title: text, text: memo }).strict(),
  z.object({ type: z.literal("task-status"), id, status: z.enum(["todo", "doing", "done"]) }).strict(),
  z.object({ type: z.literal("archive"), kind: z.enum(["folder", "document", "task"]), id, archived: z.boolean() }).strict(),
  z.object({ type: z.literal("inquiry"), client: text, contact: z.string().trim().max(200), address: z.string().trim().max(300), description: memo }).strict(),
  z.object({ type: z.literal("quote"), quote: quoteInput }).strict(),
  z.object({ type: z.literal("site"), name: text, address: z.string().trim().max(300), description: memo, method: z.enum(["CLIMBING", "TRUCK_PLATFORM", "TRUCK_CRANE"]), inquiryId: id.optional(), fileIds: z.array(id).max(10), shareWithSite: z.boolean() }).strict(),
]);
export const officeEnvelope = z.object({ requestId: id, revision: z.number().int().nonnegative(), command: officeCommand }).strict();
export const officeMonth = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export const ownsDocument = (d: OfficeState["documents"][number], role: OfficeRole) => d.owner === role;
export const canReadDocument = (d: OfficeState["documents"][number], role: OfficeRole) => d.owner === role || !d.archived && d.shared;
/** No note/file from another private office enters a snapshot, including the boss. */
export function officeVisibleState(state: OfficeState, role: OfficeRole) {
  const caps = officeCapabilities(role);
  return { folders: state.folders.filter(f => f.owner === role), documents: state.documents.filter(d => canReadDocument(d, role)), tasks: state.tasks.filter(t => t.owner === role), inquiries: caps.inquiries ? state.inquiries : [], quotes: caps.finances ? state.quotes.map(q => ({ ...q, totals: quoteTotals(q) })) : [], turns: state.turns.filter(t => t.owner === role).slice(-30), events: state.events.filter(e => e.owner === role).slice(-50) };
}
