import { assetIdentity } from "./asset-identity";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { currentDemoActor } from "./demo-actor";
import { availability } from "./demo-model";
import { DEMO_WORKSPACE_KEY, digest, ensureWorkshopDemo, requireWorkshopDemo, SharedWorkshopError, workshopDirectory, workshopSnapshot } from "./shared-store";
import { applyWoodCommand, initialWoodState, seedWoodState, WoodError, woodStateSchema, type woodEnvelope, type WoodSnapshot, type WoodState, type WoodMediaTarget } from "./wood-model";
import { IMAGE_LEASE_MS, IMAGE_LEGACY_STYLE, imageEnabled, imageUrl } from "./image-identity";
import { phaseImageIdentity } from "./wood-image";
import { prepareDemoFile } from "./shared-files";
import { treeIdentity } from "./identity-art";
import type { z } from "zod";
import { selectUploadedCover } from "./media-store";

export const WOOD_WORKSPACE_KEY="baumdienst-wood:v1";
const json=(state:WoodState)=>state as unknown as Prisma.InputJsonValue;
export async function ensureWoodDemo(){await ensureWorkshopDemo();return prisma.baumdienstDemoWorkspace.upsert({where:{key:WOOD_WORKSPACE_KEY},update:{},create:{key:WOOD_WORKSPACE_KEY,data:json(seedWoodState(await workshopDirectory())),revision:0}});}
export async function woodSnapshot(tx:Prisma.TransactionClient=prisma):Promise<WoodSnapshot>{
  await requireWorkshopDemo(tx);
  const [row,directory,snapshot]=await Promise.all([tx.baumdienstDemoWorkspace.findUnique({where:{key:WOOD_WORKSPACE_KEY}}),workshopDirectory(tx),workshopSnapshot(tx)]);
  const state=woodStateSchema.parse(row?.data??initialWoodState());
  const [media,generations,trees]=await Promise.all([
    tx.baumdienstDemoFile.findMany({where:{workspaceKey:WOOD_WORKSPACE_KEY},orderBy:{createdAt:"desc"},select:{id:true,target:true,kind:true,name:true,createdAt:true}}),
    tx.baumdienstDemoImageGeneration.findMany({where:{workspaceKey:DEMO_WORKSPACE_KEY,assetId:{startsWith:"wood-phase:"}},orderBy:{startedAt:"desc"},select:{id:true,fingerprint:true,status:true,startedAt:true,errorCode:true}}),
    tx.treeItem.findMany({where:{baustelleId:{in:directory.sites.map(s=>s.id)}},select:{baustelleId:true,treeId:true,status:true}}),
  ]);
  const openTrees=Object.fromEntries(directory.sites.map(site=>[site.key,trees.filter(t=>t.baustelleId===site.id&&(snapshot.state.custody.trees[treeIdentity(site.key,t.treeId)]?.status??t.status)!=="done").length]));
  return {...state,revision:row?.revision??0,actor:await currentDemoActor(directory),directory,equipment:snapshot.state.assets.map(a=>({id:a.id,name:`${a.name} · ${assetIdentity(a)}`,available:!["workshop","inspection"].includes(availability(snapshot.state,a,new Date().toISOString())),holder:a.placement?.workerKey,site:a.placement?.siteKey,pending:snapshot.state.custody.handovers.some(h=>h.assetId===a.id&&h.status==="pending")})),
    openTrees,mediaPreferences:snapshot.mediaPreferences,media:media.filter(m=>/^(phase|job|intake):/.test(m.target)).map(m=>({id:m.id,target:m.target.slice(m.target.indexOf(":")+1),kind:m.target.slice(0,m.target.indexOf(":")) as WoodMediaTarget["kind"],name:m.name,at:m.createdAt.toISOString(),url:`/api/demo/baumdienst/wood/files/${m.id}`})),
    illustrations:state.definitions.flatMap(d=>{const candidates=generations.filter(g=>g.fingerprint===digest(phaseImageIdentity(d)));const legacy=generations.find(g=>g.fingerprint===digest(phaseImageIdentity(d,IMAGE_LEGACY_STYLE))&&g.status==="ready");const g=candidates.find(g=>g.status==="ready")??candidates[0]??legacy;if(!g)return [];const expired=g.status==="pending"&&Date.now()-g.startedAt.getTime()>=IMAGE_LEASE_MS;return [{id:g.id,target:d.id,legacy:g===legacy,status:expired?"error":g.status,...(g.status==="ready"?{url:imageUrl(g.id)}:{}),...(expired?{error:"aiTimeout"}:g.errorCode?{error:g.errorCode}:{})}];}),imageGenerationEnabled:imageEnabled()};
}
async function mutateWood(envelope:{requestId:string;revision:number},fingerprint:string,apply:(tx:Prisma.TransactionClient,state:WoodState,context:WoodSnapshot,at:string,id:string)=>Promise<WoodState>){
  await ensureWoodDemo();
  return prisma.$transaction(async tx=>{
    await requireWorkshopDemo(tx);
    await tx.baumdienstDemoWorkspace.upsert({where:{key:WOOD_WORKSPACE_KEY},update:{},create:{key:WOOD_WORKSPACE_KEY,data:json(initialWoodState()),revision:0}});
    // Fixed lock order shared with the AI ledger. Repairs cannot race equipment checks.
    await tx.$queryRaw`SELECT "key" FROM "BaumdienstDemoWorkspace" WHERE "key" IN (${DEMO_WORKSPACE_KEY},${WOOD_WORKSPACE_KEY}) ORDER BY "key" FOR UPDATE`;
    const row=await tx.baumdienstDemoWorkspace.findUniqueOrThrow({where:{key:WOOD_WORKSPACE_KEY}});
    const receipt=await tx.baumdienstDemoMutation.findUnique({where:{id:envelope.requestId}});
    if(receipt){if(receipt.workspaceKey!==WOOD_WORKSPACE_KEY||receipt.fingerprint!==fingerprint)throw new SharedWorkshopError("conflict",409);return woodSnapshot(tx);}
    if(row.revision!==envelope.revision)throw new SharedWorkshopError("conflict",409);
    if(await tx.baumdienstDemoMutation.count({where:{workspaceKey:WOOD_WORKSPACE_KEY,createdAt:{gte:new Date(Date.now()-60000)}}})>=80)throw new SharedWorkshopError("busy",429);
    const context=await woodSnapshot(tx),state=woodStateSchema.parse(await apply(tx,woodStateSchema.parse(row.data),context,new Date().toISOString(),randomUUID()));
    if(Buffer.byteLength(JSON.stringify(state))>4_000_000)throw new SharedWorkshopError("storage",413);
    await tx.baumdienstDemoWorkspace.update({where:{key:WOOD_WORKSPACE_KEY},data:{data:json(state),revision:{increment:1}}});
    await tx.baumdienstDemoMutation.create({data:{id:envelope.requestId,workspaceKey:WOOD_WORKSPACE_KEY,fingerprint,revision:row.revision+1}});
    return woodSnapshot(tx);
  },{maxWait:10000,timeout:15000});
}
export async function mutateWoodCommand(envelope:z.infer<typeof woodEnvelope>){
  const actor=await currentDemoActor(await workshopDirectory());
  return mutateWood(envelope,digest(JSON.stringify([actor.key,envelope.command])),async(_tx,state,context,at,id)=>{
    try{return applyWoodCommand(state,envelope.command,actor,{...context.directory,equipment:context.equipment,openTrees:context.openTrees},at,id);}
    catch(e){if(e instanceof WoodError)throw new SharedWorkshopError(e.message,e.message==="permission"?403:400);throw e;}
  });
}
export async function uploadWoodMedia(input:WoodMediaTarget,file:File){
  const actor=await currentDemoActor(await workshopDirectory());
  const prepared=await prepareDemoFile(file,"asset");
  return mutateWood(input,digest(JSON.stringify([actor.key,input.kind,input.target,prepared.name,digest(prepared.data)])),async(tx,state,context,at,id)=>{
    const valid=input.kind==="phase"?state.definitions.some(d=>d.id===input.target):input.kind==="intake"?state.intakes.some(i=>i.id===input.target):state.jobs.some(j=>j.id===input.target&&!j.cancelled);
    if(!valid)throw new SharedWorkshopError("missing",404);
    if(actor.role!=="admin"&&(input.kind!=="job"||!state.jobs.find(j=>j.id===input.target)?.workers.includes(actor.key)))throw new SharedWorkshopError("permission",403);
    const previous=await tx.baumdienstDemoFile.findMany({where:{workspaceKey:WOOD_WORKSPACE_KEY,target:`${input.kind}:${input.target}`,bytes:prepared.data.length},select:{id:true,data:true}}),same=previous.find(p=>digest(p.data)===digest(prepared.data));
    if(same){await selectUploadedCover(tx,input,same.id,actor,at,id,true);return state;}
    const usage=await tx.baumdienstDemoFile.aggregate({where:{workspaceKey:WOOD_WORKSPACE_KEY},_sum:{bytes:true},_count:true});
    if(usage._count>=160||(usage._sum.bytes??0)+prepared.data.length>22_000_000)throw new SharedWorkshopError("storage",413);
    // Reuse the existing raster-photo kind; namespace targets inside this separate workspace.
    await tx.baumdienstDemoFile.create({data:{id,workspaceKey:WOOD_WORKSPACE_KEY,kind:"asset",target:`${input.kind}:${input.target}`,name:prepared.name,mime:prepared.mime,bytes:prepared.data.length,data:prepared.data}});
    await selectUploadedCover(tx,input,id,actor,at,id,true);
    state.events.unshift({id,target:input.target,kind:"photo",note:prepared.name,at,actor:context.actor});return state;
  });
}
