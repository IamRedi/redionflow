import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { dayRange } from "@/lib/workzone/date-utils";
import { currentDemoActor } from "./demo-actor";
import { availability, workshopDay } from "./demo-model";
import { DEMO_WORKSPACE_KEY, digest, ensureWorkshopDemo, requireWorkshopDemo, SharedWorkshopError, workshopDirectory, workshopSnapshot } from "./shared-store";
import { applyDemoPlan, DemoPlanError, demoPlansSchema, type DemoPlanSnapshot, type demoPlanEnvelope, type PlanDirectory } from "./plan-model";
import type { z } from "zod";

export const DEMO_PLANS_KEY = "baumdienst-plans:v1";
export async function demoPlanDirectory(date: string, tx: Prisma.TransactionClient): Promise<PlanDirectory> {
  const company = await requireWorkshopDemo(tx), directory = await workshopDirectory(tx);
  const [snapshot, workers, machines] = await Promise.all([
    workshopSnapshot(tx),
    tx.worker.findMany({ where: { companyProfileId: company.id, status: "active" }, select: { id: true, licenses: true, availability: true, vacationRequests: { where: { status: "APPROVED", startDate: { lt: dayRange(date).end }, endDate: { gte: dayRange(date).start } }, select: { id: true }, take: 1 } } }),
    tx.machine.findMany({ where: { companyProfileId: company.id }, select: { targe: true, patentaEnevojshme: true } }),
  ]);
  return {
    sites: directory.sites.filter(s => s.active).map(s => ({ id: s.key, name: s.name })),
    workers: directory.workers.map(w => { const raw = workers.find(r => r.id === w.id); return { id: w.key, name: w.name, licenses: raw?.licenses ?? null, availability: raw?.availability ?? "UNAVAILABLE", hasApprovedVacation: Boolean(raw?.vacationRequests.length) }; }),
    machines: snapshot.state.assets.map(a => ({ id: a.id, name: `${a.name} · ${a.code}`, requiredLicense: machines.find(m => m.targe === a.code)?.patentaEnevojshme ?? null, isActive: !["workshop", "inspection"].includes(availability(snapshot.state, a, `${date}T12:00:00Z`)) })),
  };
}
export async function demoPlansSnapshot(date: string, tx: Prisma.TransactionClient): Promise<DemoPlanSnapshot> {
  const directory = await workshopDirectory(tx), row = await tx.baumdienstDemoWorkspace.findUnique({ where: { key: DEMO_PLANS_KEY } });
  return { ...demoPlansSchema.parse(row?.data ?? { version: 1, plans: [] }), revision: row?.revision ?? 0, ...await demoPlanDirectory(date, tx), actor: await currentDemoActor(directory), today: workshopDay(new Date().toISOString()) };
}
export async function mutateDemoPlan(envelope: z.infer<typeof demoPlanEnvelope>) {
  const directory = await workshopDirectory(), actor = await currentDemoActor(directory);
  if (actor.role !== "admin") throw new SharedWorkshopError("permission", 403);
  await ensureWorkshopDemo();
  return prisma.$transaction(async tx => {
    await requireWorkshopDemo(tx);
    await tx.baumdienstDemoWorkspace.upsert({ where: { key: DEMO_PLANS_KEY }, update: {}, create: { key: DEMO_PLANS_KEY, data: { version: 1, plans: [] }, revision: 0 } });
    // Serialize plan commands with workshop changes so a new defect cannot race a planned assignment.
    await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" IN (${DEMO_WORKSPACE_KEY}, ${DEMO_PLANS_KEY}) ORDER BY "key" FOR UPDATE`;
    const row = await tx.baumdienstDemoWorkspace.findUniqueOrThrow({ where: { key: DEMO_PLANS_KEY } });
    const fingerprint = digest(JSON.stringify([actor.key, envelope.command]));
    const receipt = await tx.baumdienstDemoMutation.findUnique({ where: { id: envelope.requestId } });
    if (receipt) { if (receipt.workspaceKey !== DEMO_PLANS_KEY || receipt.fingerprint !== fingerprint) throw new SharedWorkshopError("conflict", 409); return demoPlansSnapshot(envelope.command.date, tx); }
    if (row.revision !== envelope.revision) throw new SharedWorkshopError("conflict", 409);
    const recent = await tx.baumdienstDemoMutation.count({ where: { workspaceKey: DEMO_PLANS_KEY, createdAt: { gte: new Date(Date.now() - 60000) } } });
    if (recent >= 80) throw new SharedWorkshopError("busy", 429);
    let state;
    try { state = applyDemoPlan(demoPlansSchema.parse(row.data), envelope.command, await demoPlanDirectory(envelope.command.date, tx), new Date().toISOString(), randomUUID(), actor.name); }
    catch (error) { if (error instanceof DemoPlanError) throw new SharedWorkshopError(error.message, error.message === "plan-confirm" ? 409 : 400); throw error; }
    if (Buffer.byteLength(JSON.stringify(state)) > 2_000_000) throw new SharedWorkshopError("storage", 413);
    await tx.baumdienstDemoWorkspace.update({ where: { key: DEMO_PLANS_KEY }, data: { data: state as unknown as Prisma.InputJsonValue, revision: { increment: 1 } } });
    await tx.baumdienstDemoMutation.create({ data: { id: envelope.requestId, workspaceKey: DEMO_PLANS_KEY, fingerprint, revision: row.revision + 1 } });
    return demoPlansSnapshot(envelope.command.date, tx);
  }, { maxWait: 10000, timeout: 15000 });
}
