import { after } from 'next/server';
import { withTenantContext } from '@/lib/db/tenant-context';
import { dispatchWorkNotification } from './events';
import { logger } from '@/lib/observability/logger';

export function scheduleSiteTaskAdded(companyId:string,selection:{id:string;revision:number}){
 const run=()=>dispatchSiteTaskAdded(companyId,selection).catch(()=>logger.warn({event:'site_task.notification_failed'},'Site task notification did not complete'));
 try{after(run);}catch{/* Direct test/script callers dispatch explicitly. */}
}
export async function dispatchSiteTaskAdded(companyId:string,selection:{id:string;revision:number}){
 const task=await withTenantContext(companyId,tx=>tx.steelSiteTask.findFirst({where:{id:selection.id,companyProfileId:companyId,revision:selection.revision,enabled:true,definition:{kind:'site',archivedAt:null},baustelle:{companyProfileId:companyId}},select:{treeItemId:true,baustelleId:true,baustelle:{select:{name:true}}}}));
 if(!task)return;
 return dispatchWorkNotification(companyId,{key:`site-task-added:${selection.id}:${selection.revision}`,kind:'process',action:'site.view',siteId:task.baustelleId,title:task.baustelle.name,body:'Detyrë e re në kantier.',url:`/workzone/baustellen/${task.baustelleId}?task=${task.treeItemId}`,preference:'adminMessages'});
}
