import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { compactPhoto } from '@/lib/asset-photos/image';
import { safeFileName, sniffSiteFileMime, SITE_FILE_MAX_BYTES } from '@/lib/site-files/validate';
import { scanFileContent } from '@/lib/storage/content-scan';
import { assetFail } from '@/lib/company-assets/access';
import { documentActor, assertDocumentSite } from './access';
import { DOCUMENT_PHASES, type DocumentPhase, type PhaseDocumentSnapshot } from './types';

const id=z.string().min(1).max(128),phase=z.enum(DOCUMENT_PHASES);
const metadata=z.object({requestId:z.uuid(),siteId:id,phase,title:z.string().trim().min(1).max(160),note:z.string().trim().max(2000),supersedesId:z.uuid().nullable()});
export const MAX_PHASE_DOCUMENTS=300,MAX_PHASE_DOCUMENT_BYTES=250_000_000;
const listSelect={id:true,phase:true,title:true,note:true,fileName:true,mime:true,size:true,createdByKey:true,createdByName:true,createdAt:true,supersedesId:true,archivedAt:true,receipts:{select:{actorName:true,actorKey:true,receivedAt:true},orderBy:[{receivedAt:'asc'},{id:'asc'}]}} satisfies Prisma.SitePhaseDocumentSelect;

export async function readPhaseDocuments(siteId:string):Promise<PhaseDocumentSnapshot>{
  id.parse(siteId);const actor=await documentActor();
  return withTenantContext(actor.companyId,async tx=>{
    await assertDocumentSite(tx,actor,siteId);
    const rows=await tx.sitePhaseDocument.findMany({where:{companyProfileId:actor.companyId,baustelleId:siteId},select:listSelect,orderBy:[{createdAt:'desc'},{id:'desc'}],take:MAX_PHASE_DOCUMENTS});
    return {actorName:actor.name,documents:rows.map(d=>({id:d.id,phase:d.phase as DocumentPhase,title:d.title,note:d.note,fileName:d.fileName,mime:d.mime,size:d.size,uploadedBy:d.createdByName,uploadedAt:d.createdAt.toISOString(),supersedesId:d.supersedesId,archivedAt:d.archivedAt?.toISOString()??null,canEdit:actor.office||d.createdByKey===actor.key,receipts:d.receipts.map(r=>({name:r.actorName,at:r.receivedAt.toISOString(),mine:r.actorKey===actor.key}))}))};
  });
}

/** Immutable file versions; retries retain their UUID and never reset or copy receipts. */
export async function uploadPhaseDocument(form:FormData){
  const actor=await documentActor();
  const input=metadata.parse({requestId:form.get('requestId'),siteId:form.get('siteId'),phase:form.get('phase'),title:form.get('title'),note:form.get('note')??'',supersedesId:form.get('supersedesId')||null});
  const file=form.get('file');
  if(!(file instanceof File)||!file.size||file.size>SITE_FILE_MAX_BYTES)return assetFail('FILE_INVALID');
  await withTenantContext(actor.companyId,tx=>assertDocumentSite(tx,actor,input.siteId));
  const original=new Uint8Array(await file.arrayBuffer());
  const scan=await scanFileContent(new File([original],'phase-document-upload',{type:file.type}));
  if(!scan.ok)return assetFail('FILE_REFUSED');
  let mime=sniffSiteFileMime(original,file.name),bytes=original,fileName=safeFileName(file.name);
  if(!mime)return assetFail('FILE_INVALID');
  if(mime.startsWith('image/')){
    const photo=await withTenantContext(actor.companyId,async tx=>{
      const [lock]=await tx.$queryRaw<{locked:boolean}[]>`SELECT pg_try_advisory_xact_lock(71402004) AS locked`;if(!lock.locked)return assetFail('BUSY');
      try{return await compactPhoto(original);}catch{return assetFail('FILE_INVALID');}
    },{timeout:20000});
    bytes=new Uint8Array(photo.data);mime='image/webp';fileName=fileName.replace(/\.[^.]+$/,'')+'.webp';
  }
  const sha256=createHash('sha256').update(bytes).digest('hex');
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase-docs:${actor.companyId}:${input.siteId}`}))`;
    await assertDocumentSite(tx,actor,input.siteId);
    const existing=await tx.sitePhaseDocument.findFirst({where:{id:input.requestId,companyProfileId:actor.companyId},select:{baustelleId:true,phase:true,title:true,note:true,supersedesId:true,sha256:true,fileName:true,createdByKey:true}});
    if(existing){
      if(existing.baustelleId!==input.siteId||existing.phase!==input.phase||existing.title!==input.title||existing.note!==input.note||existing.supersedesId!==input.supersedesId||existing.sha256!==sha256||existing.fileName!==fileName||existing.createdByKey!==actor.key)return assetFail('CONFLICT');
      return {id:input.requestId};
    }
    if(input.supersedesId){
      const previous=await tx.sitePhaseDocument.findFirst({where:{id:input.supersedesId,companyProfileId:actor.companyId,baustelleId:input.siteId,phase:input.phase},select:{createdByKey:true,archivedAt:true}});
      if(!previous)return assetFail('NOT_FOUND');
      if(!actor.office&&previous.createdByKey!==actor.key)return assetFail('DENIED');
      if(previous.archivedAt)return assetFail('CONFLICT');
      await tx.sitePhaseDocument.update({where:{id:input.supersedesId},data:{archivedAt:new Date(),archivedByKey:actor.key}});
    }
    const totals=await tx.sitePhaseDocument.aggregate({where:{companyProfileId:actor.companyId,baustelleId:input.siteId},_count:true,_sum:{size:true}});
    if(totals._count>=MAX_PHASE_DOCUMENTS||(totals._sum.size??0)+bytes.length>MAX_PHASE_DOCUMENT_BYTES)return assetFail('FILE_LIMIT');
    await tx.sitePhaseDocument.create({data:{id:input.requestId,companyProfileId:actor.companyId,baustelleId:input.siteId,phase:input.phase,title:input.title,note:input.note,supersedesId:input.supersedesId,fileName,mime:mime!,size:bytes.length,dataBytes:bytes,sha256,createdByKey:actor.key,createdByName:actor.name,createdByUserId:actor.userId,createdByWorkerId:actor.workerId}});
    return {id:input.requestId};
  });
}

export async function actOnPhaseDocument(input:unknown){
  const {documentId,action}=z.object({documentId:z.uuid(),action:z.enum(['receive','archive'])}).strict().parse(input),actor=await documentActor();
  return withTenantContext(actor.companyId,async tx=>{
    const head=await tx.sitePhaseDocument.findFirst({where:{id:documentId,companyProfileId:actor.companyId},select:{baustelleId:true}});if(!head)return assetFail('NOT_FOUND');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase-docs:${actor.companyId}:${head.baustelleId}`}))`;
    await assertDocumentSite(tx,actor,head.baustelleId);
    const doc=await tx.sitePhaseDocument.findFirstOrThrow({where:{id:documentId,companyProfileId:actor.companyId},select:{createdByKey:true,archivedAt:true}});
    if(action==='archive'){
      if(!actor.office&&doc.createdByKey!==actor.key)return assetFail('DENIED');
      if(!doc.archivedAt)await tx.sitePhaseDocument.update({where:{id:documentId},data:{archivedAt:new Date(),archivedByKey:actor.key}});
    }else{
      if(doc.archivedAt)return assetFail('CONFLICT');
      await tx.sitePhaseDocumentReceipt.upsert({where:{companyProfileId_documentId_actorKey:{companyProfileId:actor.companyId,documentId,actorKey:actor.key}},update:{},create:{companyProfileId:actor.companyId,documentId,actorKey:actor.key,actorName:actor.name,userId:actor.userId,workerId:actor.workerId}});
    }
    return {siteId:head.baustelleId};
  });
}

export async function readPhaseDocumentFile(documentId:string){
  z.uuid().parse(documentId);const actor=await documentActor();
  return withTenantContext(actor.companyId,async tx=>{
    const doc=await tx.sitePhaseDocument.findFirst({where:{id:documentId,companyProfileId:actor.companyId},select:{baustelleId:true,fileName:true,mime:true,dataBytes:true,size:true}});
    if(!doc)return assetFail('NOT_FOUND');await assertDocumentSite(tx,actor,doc.baustelleId);return doc;
  });
}
