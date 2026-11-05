import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isBaumdienstWorkshopDemoEnabled } from "@/lib/public-demo";
import { createWorkshopDemo } from "./demo-data";
import { applyWorkshopCommand, WorkshopError, workshopSchema, type WorkshopState } from "./demo-model";
import { fileUrl, type WorkshopDirectory, type WorkshopSnapshot, type mutationEnvelope } from "./shared-contract";
import { upgradeWorkshopInventory } from "./inventory-flow";
import type { z } from "zod";

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
  if ((row.data as { version?: unknown })?.version !== 1) return row;
  // Version 2 makes old writers fail closed instead of stripping relationships.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" = ${DEMO_WORKSPACE_KEY} FOR UPDATE`;
    const current = await tx.baumdienstDemoWorkspace.findUniqueOrThrow({ where: { key: DEMO_WORKSPACE_KEY } });
    if ((current.data as { version?: unknown })?.version !== 1) return current;
    return tx.baumdienstDemoWorkspace.update({ where: { key: DEMO_WORKSPACE_KEY }, data: { data: json(upgradeWorkshopInventory(current.data, directory)), revision: { increment: 1 } } });
  });
}
export async function workshopSnapshot(tx: Prisma.TransactionClient = prisma): Promise<WorkshopSnapshot> {
  const row = await tx.baumdienstDemoWorkspace.findUniqueOrThrow({ where: { key: DEMO_WORKSPACE_KEY } });
  const photos = await tx.baumdienstDemoFile.findMany({ where: { workspaceKey: DEMO_WORKSPACE_KEY, kind: { in: ["asset", "site"] } }, orderBy: { createdAt: "desc" }, select: { id: true, kind: true, target: true, jobId: true, name: true, createdAt: true } });
  return { state: workshopSchema.parse(row.data), revision: row.revision, updatedAt: row.updatedAt.toISOString(), directory: await workshopDirectory(tx), photos: photos.map(p => ({ id: p.id, kind: p.kind as "asset" | "site", target: p.target, ...(p.jobId ? { jobId: p.jobId } : {}), name: p.name, at: p.createdAt.toISOString(), url: fileUrl(p.id) })) };
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
export async function runWorkshopCommand(envelope: z.infer<typeof mutationEnvelope>) {
  return mutateWorkshopDemo(envelope, digest(JSON.stringify(envelope.command)), async (tx, state, at, id) => {
    try {
      const command = envelope.command;
      if (command.type !== "assign") return applyWorkshopCommand(state, command, at, id);
      const directory = await workshopDirectory(tx);
      const worker = command.workerKey ? directory.workers.find(w => w.key === command.workerKey && w.available) : undefined;
      const site = command.siteKey ? directory.sites.find(s => s.key === command.siteKey && s.active) : undefined;
      if ((command.workerKey && !worker) || (command.siteKey && !site)) throw new SharedWorkshopError("unavailable");
      return applyWorkshopCommand(state, { type: "assign", assetId: command.assetId, placement: { ...(worker ? { workerKey: worker.key, workerName: worker.name } : {}), ...(site ? { siteKey: site.key, siteName: site.name } : {}) } }, at, id);
    }
    catch (error) { if (error instanceof WorkshopError) throw new SharedWorkshopError(error.message); throw error; }
  });
}
