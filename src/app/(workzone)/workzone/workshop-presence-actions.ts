'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {notifyRealtimeUpdate} from '@/lib/realtime/event-hub';
import {workshopPresence,startOwnWorkshopWork,stopOwnWorkshopWork,type WorkshopPresence} from '@/lib/workzone/workshop-presence';
import {assetActionError} from '@/lib/company-assets/action-errors';
import type {AssetResult} from '@/lib/company-assets/types';
export async function getWorkshopPresenceAction():Promise<AssetResult<WorkshopPresence>>{try{return {ok:true,data:await workshopPresence()};}catch(error){return assetActionError(error);}}
export async function workInWorkshopAction(input:unknown={}):Promise<AssetResult<WorkshopPresence>>{
 try{const parsed=z.object({stopSessionId:z.string().min(1).max(128).optional()}).strict().parse(input);const companyId=parsed.stopSessionId?await stopOwnWorkshopWork(parsed.stopSessionId):await startOwnWorkshopWork();
  revalidatePath('/workzone','layout');revalidatePath('/app/workshop');
  notifyRealtimeUpdate('worker.session.updated',['worker-strip','working-badge','company-assets'],companyId);
  return {ok:true,data:await workshopPresence()};
 }catch(error){return assetActionError(error);}
}
