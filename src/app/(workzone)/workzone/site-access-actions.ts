'use server';
import { revalidatePath } from 'next/cache';
import { assetActionError } from '@/lib/company-assets/action-errors';
import { readEngineerOptions, readSiteEngineerGrants, setSiteEngineerGrants } from '@/lib/site-phase-documents/grants';
export async function getDocumentEngineerOptionsAction(){try{return {ok:true as const,data:await readEngineerOptions()};}catch(e){return assetActionError(e);}}
export async function getSiteDocumentAccessAction(siteId:string){try{return {ok:true as const,data:await readSiteEngineerGrants(siteId)};}catch(e){return assetActionError(e);}}
export async function setSiteDocumentAccessAction(input:{siteId:string;workerIds:string[];revision:number}){try{const data=await setSiteEngineerGrants(input);revalidatePath('/workzone','layout');return {ok:true as const,data};}catch(e){return assetActionError(e);}}
