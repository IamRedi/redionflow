import { prisma } from "@/lib/db/prisma";
import type { DemoActor } from "./custody-schema";
import { workshopSchema } from "./demo-model";
import { DEMO_WORKSPACE_KEY, digest, ensureWorkshopDemo, requireWorkshopDemo, workshopDirectory, SharedWorkshopError } from "./shared-store";
import { IMAGE_LEASE_MS, IMAGE_MODEL, IMAGE_STYLE, coverImageIdentity, coverImagePrompt, imageEnabled, imageIdentity, quotaAvailable } from "./image-identity";
import { DEMO_BRAND_TARGET, mediaPreference, mediaVisible } from "./media";
import { readMediaState } from "./media-store";
import { generateEquipmentImage, generateStudioImage, ImageProviderError } from "./image-provider";
import { initialWoodState, woodStateSchema } from "./wood-model";
import { ensureWoodDemo, WOOD_WORKSPACE_KEY } from "./wood-store";
import { phaseImageIdentity, phaseImagePrompt } from "./wood-image";
import { Prisma } from "@/generated/prisma/client";

/** Public role simulation isn't authentication: quotas are workspace-wide and durable. */
export async function requestEquipmentImage(assetId: string, requestId: string, actor: DemoActor) {
  return requestStudioImage(assetId,requestId,actor,"asset");
}
export async function requestCoverImage(target:string,requestId:string,actor:DemoActor,kind:"site"|"brand") { return requestStudioImage(target,requestId,actor,kind); }
export async function requestPhaseImage(phaseId: string, requestId: string, actor: DemoActor) {
  return requestStudioImage(phaseId,requestId,actor,"phase");
}
async function requestStudioImage(targetId:string,requestId:string,actor:DemoActor,kind:"asset"|"phase"|"site"|"brand") {
  const phaseTarget=kind==="phase";
  await requireWorkshopDemo();
  if (actor.role !== "admin") throw new SharedWorkshopError("permission", 403);
  if (!imageEnabled()) throw new SharedWorkshopError("aiUnavailable", 503);
  await ensureWorkshopDemo();
  if(phaseTarget)await ensureWoodDemo();
  const assetId=phaseTarget?`wood-phase:${targetId}`:kind==="site"?`site-cover:${targetId}`:kind==="brand"?DEMO_BRAND_TARGET:targetId;
  const reservation = await prisma.$transaction(async tx => {
    if(phaseTarget){
      await tx.baumdienstDemoWorkspace.upsert({where:{key:WOOD_WORKSPACE_KEY},update:{},create:{key:WOOD_WORKSPACE_KEY,data:initialWoodState() as unknown as Prisma.InputJsonValue,revision:0}});
      await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" IN (${DEMO_WORKSPACE_KEY},${WOOD_WORKSPACE_KEY}) ORDER BY "key" FOR UPDATE`;
    }else await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" = ${DEMO_WORKSPACE_KEY} FOR UPDATE`;
    const workspace = await tx.baumdienstDemoWorkspace.findUniqueOrThrow({ where: { key: DEMO_WORKSPACE_KEY } });
    const asset = kind==="asset"?workshopSchema.parse(workspace.data).assets.find(a => a.id === targetId):undefined;
    const phase = phaseTarget?woodStateSchema.parse((await tx.baumdienstDemoWorkspace.findUniqueOrThrow({where:{key:WOOD_WORKSPACE_KEY}})).data).definitions.find(d=>d.id===targetId&&!d.archived):undefined;
    const sites=kind==="site"?(await workshopDirectory(tx)).sites:undefined;
    const coverName=kind==="brand"&&targetId===DEMO_BRAND_TARGET?"BaumdienstFlow Musterfirma":sites?sites.find(s=>s.key===targetId)?.name:undefined;
    if (!asset && !phase && !coverName) throw new SharedWorkshopError("missing", 404);
    const fingerprint = digest(phase?phaseImageIdentity(phase):coverName?coverImageIdentity(kind as "site"|"brand",coverName):imageIdentity(asset!)), now = new Date();
    const previous = await tx.baumdienstDemoImageGeneration.findUnique({ where: { id: requestId }, select: { workspaceKey: true, assetId: true, actorKey: true, status: true, errorCode: true } });
    if (previous) {
      if (previous.workspaceKey !== DEMO_WORKSPACE_KEY || previous.assetId !== assetId || previous.actorKey !== actor.key) throw new SharedWorkshopError("conflict", 409);
      return { result: { status: previous.status, error: previous.errorCode } };
    }
    // A genuine upload always wins, including a photo added during generation.
    const preference=mediaPreference((await readMediaState(tx)).preferences,{kind:phaseTarget?"phase":kind==="site"?"site":"asset",target:kind==="brand"?DEMO_BRAND_TARGET:targetId});
    const photos=await tx.baumdienstDemoFile.findMany({where:{workspaceKey:phaseTarget?WOOD_WORKSPACE_KEY:DEMO_WORKSPACE_KEY,kind:kind==="site"?"site":"asset",target:phaseTarget?`phase:${targetId}`:kind==="brand"?DEMO_BRAND_TARGET:targetId,jobId:null},select:{id:true}});
    if (photos.some(p=>mediaVisible(preference,p.id))) return { result: { status: "photo" } };
    const rows = await tx.baumdienstDemoImageGeneration.findMany({ where: { workspaceKey: DEMO_WORKSPACE_KEY }, orderBy: { startedAt: "desc" }, select: { id: true, fingerprint: true, status: true, startedAt: true } });
    if (rows.some(r => r.fingerprint === fingerprint && r.status === "ready")) return { result: { status: "ready" } };
    const stale = new Date(now.getTime() - IMAGE_LEASE_MS);
    if (rows.some(r => r.status === "pending" && r.startedAt > stale)) throw new SharedWorkshopError("aiBusy", 429);
    if (!quotaAvailable(rows, now)) throw new SharedWorkshopError("aiLimit", 429);
    await tx.baumdienstDemoImageGeneration.updateMany({ where: { workspaceKey: DEMO_WORKSPACE_KEY, status: "pending", startedAt: { lte: stale } }, data: { status: "error", errorCode: "aiTimeout", finishedAt: now } });
    await tx.baumdienstDemoImageGeneration.create({ data: { id: requestId, workspaceKey: DEMO_WORKSPACE_KEY, fingerprint, assetId, actorKey: actor.key, model: IMAGE_MODEL, style: IMAGE_STYLE, status: "pending", startedAt: now } });
    await tx.baumdienstDemoWorkspace.update({ where: { key: DEMO_WORKSPACE_KEY }, data: { revision: { increment: 1 } } });
    return { asset, phase, coverName };
  }, { maxWait: 10000, timeout: 15000 });
  if (reservation.result) return reservation.result;
  let data: Uint8Array<ArrayBuffer> | undefined, errorCode: string | undefined;
  try { data = new Uint8Array(reservation.phase?await generateStudioImage(phaseImagePrompt(reservation.phase)):reservation.coverName?await generateStudioImage(coverImagePrompt(kind as "site"|"brand",reservation.coverName)):await generateEquipmentImage(reservation.asset!)); }
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
