import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import type { DemoActor } from "./custody-schema";
import { canUploadDemoFile } from "./inventory-flow";
import { applyMediaPreference, DEMO_BRAND_TARGET, emptyMediaState, mediaStateSchema, type mediaEnvelope, type MediaTarget } from "./media";
import { DEMO_WORKSPACE_KEY, digest, mutateWorkshopDemo, SharedWorkshopError, workshopDirectory } from "./shared-store";
import { woodStateSchema } from "./wood-model";
import { coverImageIdentity, imageIdentity, IMAGE_LEGACY_STYLE } from "./image-identity";

export const MEDIA_WORKSPACE_KEY = "baumdienst-media:v1";
const woodKey = "baumdienst-wood:v1";
export async function readMediaState(tx: Prisma.TransactionClient) {
  const row = await tx.baumdienstDemoWorkspace.findUnique({ where: { key: MEDIA_WORKSPACE_KEY } });
  return mediaStateSchema.parse(row?.data ?? emptyMediaState());
}
export async function selectUploadedCover(tx:Prisma.TransactionClient,scope:MediaTarget,fileId:string,actor:DemoActor,at:string,eventId:string,bumpWorkshop=false) {
  const media=applyMediaPreference(await readMediaState(tx),{...scope,action:"cover",mediaId:fileId},actor,at,eventId);
  await tx.baumdienstDemoWorkspace.upsert({where:{key:MEDIA_WORKSPACE_KEY},update:{data:media as unknown as Prisma.InputJsonValue,revision:{increment:1}},create:{key:MEDIA_WORKSPACE_KEY,data:media as unknown as Prisma.InputJsonValue}});
  if(bumpWorkshop)await tx.baumdienstDemoWorkspace.update({where:{key:DEMO_WORKSPACE_KEY},data:{revision:{increment:1}}});
}
export async function validateMediaTarget(tx: Prisma.TransactionClient, input: MediaTarget, actor: DemoActor, state: Parameters<typeof canUploadDemoFile>[0]) {
  const wood = ["phase", "job", "intake"].includes(input.kind);
  if (wood) {
    if (input.jobId) throw new SharedWorkshopError("missing",404);
    const row = await tx.baumdienstDemoWorkspace.findUnique({where:{key:woodKey}});
    if (!row) throw new SharedWorkshopError("missing",404);
    const data = woodStateSchema.parse(row.data);
    const exists = input.kind === "phase" ? data.definitions.some(d=>d.id===input.target) : input.kind === "job" ? data.jobs.some(j=>j.id===input.target) : data.intakes.some(i=>i.id===input.target);
    if (!exists) throw new SharedWorkshopError("missing",404);
    if (actor.role!=="admin" && (input.kind!=="job" || !data.jobs.find(j=>j.id===input.target)?.workers.includes(actor.key))) throw new SharedWorkshopError("permission",403);
  } else {
    if (input.kind === "site") {
      if (input.jobId || !(await workshopDirectory(tx)).sites.some(s=>s.key===input.target)) throw new SharedWorkshopError("missing",404);
    } else if (input.target === DEMO_BRAND_TARGET) {
      if (input.jobId || actor.role !== "admin") throw new SharedWorkshopError("permission",403);
    } else if (!state.assets.some(a=>a.id===input.target) || (input.jobId && !state.jobs.some(j=>j.id===input.jobId&&j.assetId===input.target))) throw new SharedWorkshopError("missing",404);
    if (!canUploadDemoFile(state, actor, input.kind, input.target, input.jobId)) throw new SharedWorkshopError("permission",403);
  }
  return { workspaceKey: wood ? woodKey : DEMO_WORKSPACE_KEY, kind: input.kind === "site" ? "site" : "asset", target: wood ? `${input.kind}:${input.target}` : input.target, jobId: input.jobId ?? null };
}
export async function changeDemoMedia(envelope: z.infer<typeof mediaEnvelope>, actor: DemoActor) {
  if(actor.role!=="admin")throw new SharedWorkshopError("permission",403);
  return mutateWorkshopDemo(envelope,digest(JSON.stringify([actor.key,"media",envelope.command])),async(tx,state,at,id)=>{
    const command=envelope.command, target=await validateMediaTarget(tx,command,actor,state);
    const file=await tx.baumdienstDemoFile.findFirst({where:{...target,id:command.mediaId},select:{id:true}});
    // Generated and catalogue choices are never mistaken for original uploads.
    const imageId=command.mediaId.startsWith("generated:")?command.mediaId.slice(10):undefined;
    const asset=command.kind==="asset"?state.assets.find(a=>a.id===command.target):undefined;
    const site=command.kind==="site"?(await workshopDirectory(tx)).sites.find(s=>s.key===command.target):undefined;
    const imageFilter=asset?{OR:[{fingerprint:digest(imageIdentity(asset))},{fingerprint:digest(imageIdentity(asset,IMAGE_LEGACY_STYLE))}]}:site?{OR:[{fingerprint:digest(coverImageIdentity("site",site.name))},{fingerprint:digest(coverImageIdentity("site",site.name,false))}]}:{assetId:command.kind==="phase"?`wood-phase:${command.target}`:command.target};
    const generation=imageId&&!command.jobId?await tx.baumdienstDemoImageGeneration.findFirst({where:{id:imageId,workspaceKey:DEMO_WORKSPACE_KEY,...imageFilter,status:"ready"},select:{id:true}}):null;
    if (!file && !generation && command.mediaId!=="catalogue") throw new SharedWorkshopError("missing",404);
    const media=applyMediaPreference(await readMediaState(tx),command,actor,at,id);
    await tx.baumdienstDemoWorkspace.upsert({where:{key:MEDIA_WORKSPACE_KEY},update:{data:media as unknown as Prisma.InputJsonValue,revision:{increment:1}},create:{key:MEDIA_WORKSPACE_KEY,data:media as unknown as Prisma.InputJsonValue}});
    return state;
  });
}
