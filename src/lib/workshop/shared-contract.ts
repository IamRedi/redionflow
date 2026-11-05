import { z } from "zod";
import { workshopSchema, type WorkshopState } from "./demo-model";

const id = z.string().trim().min(1).max(128);
const note = z.string().trim().min(1).max(2000);
export const publicWorkshopCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("receive"), assetId: id, problem: note, priority: z.enum(["normal", "urgent"]), assignee: z.string().trim().max(100) }).strict(),
  z.object({ type: z.literal("start"), jobId: id, assignee: z.string().trim().min(1).max(100) }).strict(),
  z.object({ type: z.literal("repair"), jobId: id, note, tested: z.boolean() }).strict(),
  z.object({ type: z.literal("release"), jobId: id }).strict(),
  z.object({ type: z.literal("assign"), assetId: id, workerKey: id.optional(), siteKey: id.optional() }).strict().refine(c => c.workerKey || c.siteKey),
  z.object({ type: z.literal("return"), assetId: id }).strict(),
  z.object({ type: z.literal("inspection"), assetId: id, date: z.iso.date(), note }).strict(),
  z.object({ type: z.literal("part"), jobId: id, partId: id, qty: z.number().int().min(1).max(10000) }).strict(),
  z.object({ type: z.literal("restock"), partId: id, qty: z.number().int().min(1).max(10000) }).strict(),
]);
export const mutationEnvelope = z.object({ requestId: z.uuid(), revision: z.number().int().nonnegative(), command: publicWorkshopCommand }).strict();
export const uploadEnvelope = z.object({ requestId: z.uuid(), revision: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative()), kind: z.enum(["document", "asset", "site"]), target: id, jobId: id.optional() }).strict();
export type WorkshopPhoto = { id: string; kind: "asset" | "site"; target: string; jobId?: string; name: string; at: string; url: string };
export const directorySchema = z.object({ sites: z.array(z.object({ key: id, id, name: z.string(), active: z.boolean() })), workers: z.array(z.object({ key: id, id, name: z.string(), available: z.boolean() })) });
export type WorkshopDirectory = z.infer<typeof directorySchema>;
export const emptyDirectory: WorkshopDirectory = { sites: [], workers: [] };
export type WorkshopSnapshot = { state: WorkshopState; revision: number; updatedAt: string; photos: WorkshopPhoto[]; directory: WorkshopDirectory };
export const WORKSHOP_API = "/api/demo/baumdienst/workshop";
export const WORKSHOP_FILES_API = "/api/demo/baumdienst/files";
export const fileUrl = (id: string) => `${WORKSHOP_FILES_API}/${encodeURIComponent(id)}`;
export const snapshotSchema = z.object({ state: workshopSchema, revision: z.number().int().nonnegative(), updatedAt: z.iso.datetime(), directory: directorySchema.default(emptyDirectory), photos: z.array(z.object({ id: z.uuid(), kind: z.enum(["asset", "site"]), target: id, jobId: id.optional(), name: z.string(), at: z.iso.datetime(), url: z.string().startsWith(`${WORKSHOP_FILES_API}/`) })) });
