'use server';
import { revalidatePath } from 'next/cache';
import { actOnPhaseDocument, deletePhaseDocument, readPhaseDocuments, uploadPhaseDocument } from '@/lib/site-phase-documents/service';
import { assetActionError } from '@/lib/company-assets/action-errors';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { phaseDocumentCopy } from '@/lib/site-phase-documents/copy';
import { AssetOperationError } from '@/lib/company-assets/access';

async function phaseError(error:unknown){
  const result=await assetActionError(error);
  if(error instanceof AssetOperationError&&error.code.startsWith('FILE_')){
    const c=phaseDocumentCopy(await resolveRequestLanguage());return {...result,message:error.code==='FILE_LIMIT'?c.limitError:c.fileError};
  }return result;
}

export async function getPhaseDocumentsAction(siteId:string){
  try{return {ok:true as const,data:await readPhaseDocuments(siteId)};}catch(error){return assetActionError(error);}
}
export async function uploadPhaseDocumentAction(form:FormData){
  try{const data=await uploadPhaseDocument(form);revalidatePath('/workzone','layout');return {ok:true as const,data};}catch(error){return phaseError(error);}
}
export async function phaseDocumentAction(input:{documentId:string;action:'receive'|'archive'}){
  try{const data=await actOnPhaseDocument(input);revalidatePath('/workzone','layout');return {ok:true as const,data};}catch(error){return assetActionError(error);}
}
export async function deletePhaseDocumentAction(input:{documentId:string}){
  try{const data=await deletePhaseDocument(input);revalidatePath('/workzone','layout');return {ok:true as const,data};}catch(error){return assetActionError(error);}
}
