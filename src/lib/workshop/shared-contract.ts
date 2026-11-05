import { z } from "zod";
import { workshopSchema, type WorkshopState } from "./demo-model";

const id = z.string().trim().min(1).max(128);
const note = z.string().trim().min(1).max(2000);
export const publicWorkshopCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("receive"), assetId: id, problem: note, priority: z.enum(["normal", "urgent"]), assignee: z.string().trim().max(100) }).strict(),
  z.object({ type: z.literal("start"), jobId: id, assignee: z.string().trim().min(1).max(100) }).strict(),
  z.object({ type: z.literal("repair"), jobId: id, note, tested: z.boolean() }).strict(),
  z.object({ type: z.literal("release"), jobId: id }).strict(),
  z.object({ type: z.literal("issue"), assetId: id, holder: z.string().trim().min(1).max(100) }).strict(),
  z.object({ type: z.literal("return"), assetId: id }).strict(),
  z.object({ type: z.literal("inspection"), assetId: id, date: z.iso.date(), note }).strict(),
  z.object({ type: z.literal("part"), jobId: id, partId: id, qty: z.number().int().min(1).max(10000) }).strict(),
  z.object({ type: z.literal("restock"), partId: id, qty: z.number().int().min(1).max(10000) }).strict(),
]);
export const mutationEnvelope = z.object({ requestId: z.uuid(), revision: z.number().int().nonnegative(), command: publicWorkshopCommand }).strict();
export const uploadEnvelope = z.object({ requestId: z.uuid(), revision: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative()), kind: z.enum(["document", "asset", "site"]), target: id, jobId: id.optional() }).strict();
export type WorkshopPhoto = { id: string; kind: "asset" | "site"; target: string; jobId?: string; name: string; at: string; url: string };
export type WorkshopSnapshot = { state: WorkshopState; revision: number; updatedAt: string; photos: WorkshopPhoto[] };
export const WORKSHOP_API = "/api/demo/baumdienst/workshop";
export const WORKSHOP_FILES_API = "/api/demo/baumdienst/files";
export const fileUrl = (id: string) => `${WORKSHOP_FILES_API}/${encodeURIComponent(id)}`;
export const snapshotSchema = z.object({ state: workshopSchema, revision: z.number().int().nonnegative(), updatedAt: z.iso.datetime(), photos: z.array(z.object({ id: z.uuid(), kind: z.enum(["asset", "site"]), target: id, jobId: id.optional(), name: z.string(), at: z.iso.datetime(), url: z.string().startsWith(`${WORKSHOP_FILES_API}/`) })) });
