import { prisma } from "@/lib/db/prisma";
import type { DemoActor } from "./custody-schema";
import { workshopSchema } from "./demo-model";
import { DEMO_WORKSPACE_KEY, digest, ensureWorkshopDemo, requireWorkshopDemo, SharedWorkshopError } from "./shared-store";
import { IMAGE_LEASE_MS, IMAGE_MODEL, IMAGE_STYLE, imageEnabled, imageIdentity, quotaAvailable } from "./image-identity";
import { generateEquipmentImage, generateStudioImage, ImageProviderError } from "./image-provider";
import { initialWoodState, woodStateSchema } from "./wood-model";
import { ensureWoodDemo, WOOD_WORKSPACE_KEY } from "./wood-store";
import { phaseImageIdentity, phaseImagePrompt } from "./wood-image";
import { Prisma } from "@/generated/prisma/client";

/** Public role simulation isn't authentication: quotas are workspace-wide and durable. */
export async function requestEquipmentImage(assetId: string, requestId: string, actor: DemoActor) {
  return requestStudioImage(assetId,requestId,actor,false);
}
export async function requestPhaseImage(phaseId: string, requestId: string, actor: DemoActor) {
  return requestStudioImage(phaseId,requestId,actor,true);
}
async function requestStudioImage(targetId:string,requestId:string,actor:DemoActor,phaseTarget:boolean) {
  await requireWorkshopDemo();
  if (actor.role !== "admin") throw new SharedWorkshopError("permission", 403);
  if (!imageEnabled()) throw new SharedWorkshopError("aiUnavailable", 503);
  await ensureWorkshopDemo();
  if(phaseTarget)await ensureWoodDemo();
  const assetId=phaseTarget?`wood-phase:${targetId}`:targetId;
  const reservation = await prisma.$transaction(async tx => {
    if(phaseTarget){
      await tx.baumdienstDemoWorkspace.upsert({where:{key:WOOD_WORKSPACE_KEY},update:{},create:{key:WOOD_WORKSPACE_KEY,data:initialWoodState() as unknown as Prisma.InputJsonValue,revision:0}});
      await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" IN (${DEMO_WORKSPACE_KEY},${WOOD_WORKSPACE_KEY}) ORDER BY "key" FOR UPDATE`;
    }else await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" = ${DEMO_WORKSPACE_KEY} FOR UPDATE`;
    const workspace = await tx.baumdienstDemoWorkspace.findUniqueOrThrow({ where: { key: DEMO_WORKSPACE_KEY } });
    const asset = phaseTarget?undefined:workshopSchema.parse(workspace.data).assets.find(a => a.id === targetId);
    const phase = phaseTarget?woodStateSchema.parse((await tx.baumdienstDemoWorkspace.findUniqueOrThrow({where:{key:WOOD_WORKSPACE_KEY}})).data).definitions.find(d=>d.id===targetId&&!d.archived):undefined;
    if (!asset && !phase) throw new SharedWorkshopError("missing", 404);
    const fingerprint = digest(phase?phaseImageIdentity(phase):imageIdentity(asset!)), now = new Date();
    const previous = await tx.baumdienstDemoImageGeneration.findUnique({ where: { id: requestId }, select: { workspaceKey: true, assetId: true, actorKey: true, status: true, errorCode: true } });
    if (previous) {
      if (previous.workspaceKey !== DEMO_WORKSPACE_KEY || previous.assetId !== assetId || previous.actorKey !== actor.key) throw new SharedWorkshopError("conflict", 409);
      return { result: { status: previous.status, error: previous.errorCode } };
    }
    // A genuine upload always wins, including a photo added during generation.
    if (await tx.baumdienstDemoFile.count({ where: { workspaceKey: phaseTarget?WOOD_WORKSPACE_KEY:DEMO_WORKSPACE_KEY, kind: "asset", target: phaseTarget?`phase:${targetId}`:targetId } })) return { result: { status: "photo" } };
    const rows = await tx.baumdienstDemoImageGeneration.findMany({ where: { workspaceKey: DEMO_WORKSPACE_KEY }, orderBy: { startedAt: "desc" }, select: { id: true, fingerprint: true, status: true, startedAt: true } });
    if (rows.some(r => r.fingerprint === fingerprint && r.status === "ready")) return { result: { status: "ready" } };
    const stale = new Date(now.getTime() - IMAGE_LEASE_MS);
    if (rows.some(r => r.status === "pending" && r.startedAt > stale)) throw new SharedWorkshopError("aiBusy", 429);
    if (!quotaAvailable(rows, now)) throw new SharedWorkshopError("aiLimit", 429);
    await tx.baumdienstDemoImageGeneration.updateMany({ where: { workspaceKey: DEMO_WORKSPACE_KEY, status: "pending", startedAt: { lte: stale } }, data: { status: "error", errorCode: "aiTimeout", finishedAt: now } });
    await tx.baumdienstDemoImageGeneration.create({ data: { id: requestId, workspaceKey: DEMO_WORKSPACE_KEY, fingerprint, assetId, actorKey: actor.key, model: IMAGE_MODEL, style: IMAGE_STYLE, status: "pending", startedAt: now } });
    await tx.baumdienstDemoWorkspace.update({ where: { key: DEMO_WORKSPACE_KEY }, data: { revision: { increment: 1 } } });
    return { asset, phase };
  }, { maxWait: 10000, timeout: 15000 });
  if (reservation.result) return reservation.result;
  let data: Uint8Array<ArrayBuffer> | undefined, errorCode: string | undefined;
  try { data = new Uint8Array(reservation.phase?await generateStudioImage(phaseImagePrompt(reservation.phase)):await generateEquipmentImage(reservation.asset!)); }
  catch (error) {
    errorCode = error instanceof ImageProviderError ? error.code : "aiFailed";
    console.warn("Baumdienst image generation", { requestId, code: errorCode });
  }
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" = ${DEMO_WORKSPACE_KEY} FOR UPDATE`;
    const status = data ? "ready" : "error";
    const updated = await tx.baumdienstDemoImageGeneration.updateMany({ where: { id: requestId, workspaceKey: DEMO_WORKSPACE_KEY, status: "pending" }, data: { status, ...(data ? { data } : {}), errorCode: errorCode ?? null, finishedAt: new Date() } });
    if (updated.count) await tx.baumdienstDemoWorkspace.update({ where: { key: DEMO_WORKSPACE_KEY }, data: { revision: { increment: 1 } } });
    return { status: updated.count ? status : "error", error: errorCode };
  });
}
