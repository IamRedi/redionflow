import { z } from "zod";

const key = z.string().trim().min(1).max(128);
const at = z.iso.datetime();
export const actorSchema = z.object({ key, name: z.string(), role: z.enum(["admin", "worker"]) });
export type DemoActor = z.infer<typeof actorSchema>;
export const demoOffice: DemoActor = { key: "admin", name: "Musterfirma · Büro", role: "admin" };
export const assetDetailsSchema = z.object({ category: z.enum(["tool", "vehicle", "ppe", "equipment"]), manufacturer: z.string().max(100), model: z.string().max(100), serial: z.string().max(100), note: z.string().max(2000) });
export const custodyPlacementSchema = z.object({ workerKey: key.optional(), workerName: z.string().optional(), siteKey: key.optional(), siteName: z.string().optional() });
export const handoverSchema = z.object({ id: key, assetId: key, kind: z.enum(["issue", "return", "transfer"]), status: z.enum(["pending", "completed", "declined", "cancelled"]), fromHolder: z.string().default(""), from: custodyPlacementSchema.optional(), to: custodyPlacementSchema.optional(), createdBy: actorSchema, at, updatedAt: at, method: z.enum(["scan", "selection"]), automatic: z.boolean(), required: z.array(key).min(1).max(3), confirmations: z.array(z.object({ actorKey: key, by: key, at, mode: z.enum(["explicit", "policy"]) })).max(3), reason: z.string().max(2000).default("") });
export type Handover = z.infer<typeof handoverSchema>;
export const treeUpdateSchema = z.object({ status: z.enum(["todo", "done", "blocked"]), note: z.string().max(2000), species: z.string().max(100).optional(), diameter: z.number().min(0).max(1000).optional(), equipment: z.object({ SIGN: z.number().int().min(0).max(1000), PLATE: z.number().int().min(0).max(1000), FENCE: z.number().int().min(0).max(1000), halt: z.boolean() }).optional(), at, actor: actorSchema });
export const custodySchema = z.object({
  autoConfirm: z.boolean(),
  policyEvents: z.array(z.object({ id: key, autoConfirm: z.boolean(), at, actor: actorSchema })).max(1000).default([]),
  handovers: z.array(handoverSchema).max(1000),
  notifications: z.array(z.object({ id: key, recipient: key, assetId: key.optional(), handoverId: key.optional(), kind: z.enum(["requested", "confirmed", "completed", "declined", "cancelled"]), at, readAt: at.optional() })).max(2000),
  fileEvents: z.array(z.object({ id: key, kind: z.enum(["asset", "site", "document"]), target: key, name: z.string().max(120), at, actor: actorSchema })).max(160).default([]),
  trees: z.record(z.string(), treeUpdateSchema),
  treeEvents: z.array(z.object({ id: key, siteKey: key, treeCode: key, kind: z.enum(["done", "reopened", "reported", "updated", "equipment"]), note: z.string().max(2000), at, actor: actorSchema })).max(10000),
});
export const emptyCustody = () => ({ autoConfirm: false, policyEvents: [], fileEvents: [], handovers: [], notifications: [], trees: {}, treeEvents: [] });
