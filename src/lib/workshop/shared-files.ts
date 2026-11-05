import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { compactPhoto, MAX_PHOTO_BYTES } from "@/lib/asset-photos/image";
import { applyWorkshopCommand } from "./demo-model";
import { DEMO_WORKSPACE_KEY, demoSiteKey, digest, mutateWorkshopDemo, SharedWorkshopError } from "./shared-store";
import type { uploadEnvelope } from "./shared-contract";
import type { z } from "zod";

type Upload = Omit<z.infer<typeof uploadEnvelope>, "revision"> & { revision: number };
let converting = 0;
export async function prepareDemoFile(file: File, kind: Upload["kind"]) {
  const wellFormed = (value: string) => Buffer.from(value, "utf8").toString("utf8");
  const name = wellFormed(file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 120)) || "demo-file";
  const image = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (!file.size || file.size > (image ? MAX_PHOTO_BYTES : 1_000_000) || (!image && (kind !== "document" || !["application/pdf", "text/plain"].includes(file.type)))) throw new SharedWorkshopError("fileError", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (image) {
    if (converting >= 2) throw new SharedWorkshopError("busy", 429);
    converting++;
    try {
      const photo = await compactPhoto(bytes);
      return { data: new Uint8Array(photo.data), name: `${wellFormed(name.replace(/\.[^.]*$/, "").slice(0, 110))}.webp`, mime: "image/webp" as const };
    } catch { throw new SharedWorkshopError("fileError"); }
    finally { converting--; }
  }
  if (file.type === "application/pdf") {
    const b = Buffer.from(bytes);
    if (!b.toString("ascii", 0, 5).startsWith("%PDF-") || !b.subarray(-2048).includes(Buffer.from("%%EOF"))) throw new SharedWorkshopError("fileError");
  } else {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new SharedWorkshopError("fileError"); }
    if (bytes.includes(0)) throw new SharedWorkshopError("fileError");
  }
  return { data: bytes, name, mime: file.type as "application/pdf" | "text/plain" };
}
export async function uploadWorkshopFile(input: Upload, file: File, companyId: string) {
  let target = input.target;
  if (input.kind === "site") {
    if (input.jobId) throw new SharedWorkshopError("missing", 404);
    const site = await prisma.baustelle.findFirst({ where: { id: target, companyProfileId: companyId }, select: { name: true, address: true } });
    if (!site) throw new SharedWorkshopError("missing", 404);
    target = demoSiteKey(site);
  }
  const prepared = await prepareDemoFile(file, input.kind);
  const fingerprint = digest(JSON.stringify({ kind: input.kind, target, jobId: input.jobId, name: prepared.name, mime: prepared.mime, digest: digest(prepared.data) }));
  return mutateWorkshopDemo(input, fingerprint, async (tx, state, at) => {
    if (input.kind !== "site" && !state.assets.some(a => a.id === target)) throw new SharedWorkshopError("missing", 404);
    if (input.jobId && !state.jobs.some(j => j.id === input.jobId && j.assetId === target)) throw new SharedWorkshopError("missing", 404);
    const usage = await tx.baumdienstDemoFile.aggregate({ where: { workspaceKey: DEMO_WORKSPACE_KEY }, _sum: { bytes: true }, _count: true });
    if (usage._count >= 160 || (usage._sum.bytes ?? 0) + prepared.data.length > 22_000_000) throw new SharedWorkshopError("storage", 413);
    const fileId = randomUUID();
    await tx.baumdienstDemoFile.create({ data: { id: fileId, workspaceKey: DEMO_WORKSPACE_KEY, kind: input.kind, target, jobId: input.jobId, name: prepared.name, mime: prepared.mime, bytes: prepared.data.length, data: prepared.data } });
    if (input.kind === "document") {
      return applyWorkshopCommand(state, { type: "document", document: { id: fileId, fileId, name: prepared.name, mime: prepared.mime, bytes: prepared.data.length, assetId: target, ...(input.jobId ? { jobId: input.jobId } : {}), at } }, at, fileId);
    }
    if (input.kind === "asset") state.assets.find(a => a.id === target)!.events.unshift({ id: fileId, at, kind: "photo", note: prepared.name, actor: "Demo", ...(input.jobId ? { ref: input.jobId } : {}) });
    return state;
  });
}
