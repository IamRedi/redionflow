import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isBaumdienstWorkshopDemoEnabled } from "@/lib/public-demo";
import { createWorkshopDemo } from "./demo-data";
import { WorkshopError, workshopSchema, type WorkshopState } from "./demo-model";
import { fileUrl, type WorkshopDirectory, type WorkshopSnapshot, type mutationEnvelope } from "./shared-contract";
import { upgradeWorkshopInventory } from "./inventory-flow";
import type { DemoActor } from "./custody-schema";
import { applyCustodyCommand, type BaseTree } from "./custody-flow";
import type { z } from "zod";
import { IMAGE_LEASE_MS, imageEnabled, imageIdentity, imageUrl } from "./image-identity";

export const DEMO_WORKSPACE_KEY = "baumdienst-workshop:v1";
export class SharedWorkshopError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function demoSiteKey(site: { name: string; address: string | null }) {
  return `site-${createHash("sha256").update(JSON.stringify([site.name, site.address ?? ""])).digest("hex").slice(0, 24)}`;
}

/** Fail closed, with no company creation or fallback-to-baumdienst behavior. */
export function demoWorkerKey(worker: { firstName: string; lastName: string }) {
  return `worker-${createHash("sha256").update(JSON.stringify([worker.firstName, worker.lastName])).digest("hex").slice(0, 24)}`;
}
export async function requireWorkshopDemo(tx: Prisma.TransactionClient = prisma) {
  if (!isBaumdienstWorkshopDemoEnabled("baumdienst")) throw new SharedWorkshopError("missing", 404);
  const companies = await tx.companyProfile.findMany({ take: 2, select: { id: true, mode: true, displayName: true } });
  if (companies.length !== 1 || companies[0].mode !== "baumdienst" || companies[0].displayName !== "Baumdienst Musterstadt GmbH") throw new SharedWorkshopError("missing", 404);
  return companies[0];
}
const json = (value: WorkshopState) => value as unknown as Prisma.InputJsonValue;
export async function workshopDirectory(tx: Prisma.TransactionClient = prisma): Promise<WorkshopDirectory> {
  const company = await requireWorkshopDemo(tx);
  const [sites, workers] = await Promise.all([
    tx.baustelle.findMany({ where: { companyProfileId: company.id }, select: { id: true, name: true, address: true, status: true }, orderBy: { name: "asc" } }),
    tx.worker.findMany({ where: { companyProfileId: company.id, status: "active" }, select: { id: true, firstName: true, lastName: true, availability: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
  ]);
  const directory = { sites: sites.map(s => ({ key: demoSiteKey(s), id: s.id, name: s.name, active: s.status === "active" })), workers: workers.map(w => ({ key: demoWorkerKey(w), id: w.id, name: `${w.firstName} ${w.lastName}`.trim(), available: w.availability === "AVAILABLE" })) };
  if (new Set(directory.sites.map(s => s.key)).size !== sites.length || new Set(directory.workers.map(w => w.key)).size !== workers.length) throw new SharedWorkshopError("connection", 503);
  return directory;
}
export async function ensureWorkshopDemo() {
  const directory = await workshopDirectory();
  const row = await prisma.baumdienstDemoWorkspace.upsert({ where: { key: DEMO_WORKSPACE_KEY }, update: {}, create: { key: DEMO_WORKSPACE_KEY, data: json(upgradeWorkshopInventory(createWorkshopDemo(), directory)) } });
  if ((row.data as { version?: unknown })?.version === 4) return row;
  // Version 4 makes older writers fail closed rather than losing confirmations.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" = ${DEMO_WORKSPACE_KEY} FOR UPDATE`;
    const current = await tx.baumdienstDemoWorkspace.findUniqueOrThrow({ where: { key: DEMO_WORKSPACE_KEY } });
    if ((current.data as { version?: unknown })?.version === 4) return current;
    return tx.baumdienstDemoWorkspace.update({ where: { key: DEMO_WORKSPACE_KEY }, data: { data: json(upgradeWorkshopInventory(current.data, directory)), revision: { increment: 1 } } });
  });
}
export async function workshopSnapshot(tx: Prisma.TransactionClient = prisma): Promise<WorkshopSnapshot> {
  const row = await tx.baumdienstDemoWorkspace.findUniqueOrThrow({ where: { key: DEMO_WORKSPACE_KEY } });
  const photos = await tx.baumdienstDemoFile.findMany({ where: { workspaceKey: DEMO_WORKSPACE_KEY, kind: { in: ["asset", "site"] } }, orderBy: { createdAt: "desc" }, select: { id: true, kind: true, target: true, jobId: true, name: true, createdAt: true } });
  const state = workshopSchema.parse(row.data);
  const generations = await tx.baumdienstDemoImageGeneration.findMany({ where: { workspaceKey: DEMO_WORKSPACE_KEY }, orderBy: { startedAt: "desc" }, select: { id: true, fingerprint: true, status: true, startedAt: true, finishedAt: true, errorCode: true } });
  const illustrations = state.assets.flatMap(asset => {
    const candidates = generations.filter(g => g.fingerprint === digest(imageIdentity(asset)));
    const g = candidates.find(g => g.status === "ready") || candidates[0]; if (!g) return [];
    const expired = g.status === "pending" && Date.now() - g.startedAt.getTime() >= IMAGE_LEASE_MS;
    return [{ assetId: asset.id, status: (expired ? "error" : g.status) as "pending" | "ready" | "error", at: (g.finishedAt || g.startedAt).toISOString(), ...(g.status === "ready" ? { url: imageUrl(g.id) } : {}), ...(expired || g.errorCode ? { error: expired ? "aiTimeout" : g.errorCode! } : {}) }];
  });
  return { state, illustrations, imageGenerationEnabled: imageEnabled(), revision: row.revision, updatedAt: row.updatedAt.toISOString(), directory: await workshopDirectory(tx), photos: photos.map(p => ({ id: p.id, kind: p.kind as "asset" | "site", target: p.target, ...(p.jobId ? { jobId: p.jobId } : {}), name: p.name, at: p.createdAt.toISOString(), url: fileUrl(p.id) })) };
}

export async function mutateWorkshopDemo(envelope: { requestId: string; revision: number }, fingerprint: string, apply: (tx: Prisma.TransactionClient, state: WorkshopState, at: string, id: string) => Promise<WorkshopState>) {
  await ensureWorkshopDemo();
  return prisma.$transaction(async tx => {
    // One profile row serializes stock, history, files, quotas and receipts across replicas.
    await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" = ${DEMO_WORKSPACE_KEY} FOR UPDATE`;
    const row = await tx.baumdienstDemoWorkspace.findUniqueOrThrow({ where: { key: DEMO_WORKSPACE_KEY } });
    const receipt = await tx.baumdienstDemoMutation.findUnique({ where: { id: envelope.requestId } });
    if (receipt) {
      if (receipt.workspaceKey !== DEMO_WORKSPACE_KEY || receipt.fingerprint !== fingerprint) throw new SharedWorkshopError("conflict", 409);
      return workshopSnapshot(tx);
    }
    if (row.revision !== envelope.revision) throw new SharedWorkshopError("conflict", 409);
    const recent = await tx.baumdienstDemoMutation.count({ where: { workspaceKey: DEMO_WORKSPACE_KEY, createdAt: { gte: new Date(Date.now() - 60000) } } });
    if (recent >= 80) throw new SharedWorkshopError("busy", 429);
    const state = await apply(tx, workshopSchema.parse(row.data), new Date().toISOString(), randomUUID());
    const checked = workshopSchema.parse(state);
    if (Buffer.byteLength(JSON.stringify(checked)) > 4_000_000) throw new SharedWorkshopError("storage", 413);
    await tx.baumdienstDemoWorkspace.update({ where: { key: DEMO_WORKSPACE_KEY }, data: { data: json(checked), revision: { increment: 1 } } });
    await tx.baumdienstDemoMutation.create({ data: { id: envelope.requestId, workspaceKey: DEMO_WORKSPACE_KEY, fingerprint, revision: row.revision + 1 } });
    return workshopSnapshot(tx);
  }, { maxWait: 10000, timeout: 15000 });
}
export function digest(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
export async function runWorkshopCommand(envelope: z.infer<typeof mutationEnvelope>, actor: DemoActor) {
  return mutateWorkshopDemo(envelope, digest(JSON.stringify([actor.key, envelope.command])), async (tx, state, at, id) => {
    try {
      const command = envelope.command;
      const directory = await workshopDirectory(tx);
      let baseTree: BaseTree | undefined;
      if (command.type === "tree") {
        const site = directory.sites.find(s => s.key === command.siteKey && s.active);
        if (!site) throw new SharedWorkshopError("missing", 404);
        const rows = await tx.treeItem.findMany({ where: { baustelleId: site.id, treeId: command.treeCode }, take: 2, select: { status: true, species: true, diameter: true, notes: true } });
        if (rows.length !== 1) throw new SharedWorkshopError("missing", 404);
        let note = rows[0].notes || ""; try { const json = JSON.parse(note); note = typeof json.note === "string" ? json.note : ""; } catch { /* Plain historical note. */ }
        baseTree = { ...rows[0], note };
      }
      return applyCustodyCommand(state, command, actor, directory, at, id, baseTree);
    }
    catch (error) { if (error instanceof WorkshopError) throw new SharedWorkshopError(error.message, error.message === "permission" ? 403 : error.message === "pending" ? 409 : 400); throw error; }
  });
}
