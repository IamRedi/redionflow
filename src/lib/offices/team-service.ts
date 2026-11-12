import { z } from 'zod';
import { withTenantContext } from '@/lib/db/tenant-context';
import { officeActor, OfficeError } from './work-access';
import { directoryOfficePresence } from './presence';

export async function officeDirectory(){
  const actor=await officeActor();
  const prepared=actor.manager&&process.env.VIRTUAL_OFFICE_TEAM_ENABLED==='true'?await withTenantContext(actor.companyId,tx=>tx.officeMember.findMany({where:{companyProfileId:actor.companyId,enabled:false,worker:{status:'active'}},select:{id:true,title:true,worker:{select:{firstName:true,lastName:true}}},orderBy:{title:'asc'}})):[];
  const presence=await directoryOfficePresence(actor);
  return {self:actor.principalId,manager:actor.manager,people:[...actor.people.map(p=>({...p,enabled:true,officePresence:presence.get(p.id)??null})),...prepared.filter(p=>!actor.people.some(a=>a.id===p.id)).map(p=>({id:p.id,name:`${p.worker!.firstName} ${p.worker!.lastName}`,title:p.title,seat:'staff' as const,enabled:false,officePresence:null}))]};
}
export async function officeTeamSettings(){
  const actor=await officeActor();
  if(!actor.manager||process.env.VIRTUAL_OFFICE_TEAM_ENABLED!=='true')throw new OfficeError('DENIED');
  return withTenantContext(actor.companyId,async tx=>{
    const [workers,members]=await Promise.all([
      tx.worker.findMany({where:{companyProfileId:actor.companyId,status:'active'},select:{id:true,firstName:true,lastName:true,position:true},orderBy:[{firstName:'asc'},{id:'asc'}],take:500}),
      tx.officeMember.findMany({where:{companyProfileId:actor.companyId,workerId:{not:null}},select:{id:true,workerId:true,title:true,enabled:true,version:true,workbooksEnabled:true,workProfile:true,assistantEnabled:true}}),
    ]);
    const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
    const directors=[config.megi.workerId,config.almet.workerId];
    return workers.filter(w=>!directors.includes(w.id)).map(w=>({workerId:w.id,name:`${w.firstName} ${w.lastName}`,position:w.position,member:members.find(m=>m.workerId===w.id)??null}));
  });
}
export async function saveOfficeMember(raw:unknown){
  const input=z.object({workerId:z.string().min(1).max(128),title:z.string().trim().min(1).max(100),enabled:z.boolean(),workbooksEnabled:z.boolean().default(false),workProfile:z.enum(['GENERAL','PURCHASING']).optional(),assistantEnabled:z.boolean().optional(),version:z.number().int().min(0)}).strict().parse(raw);
  const actor=await officeActor();
  if(!actor.manager||process.env.VIRTUAL_OFFICE_TEAM_ENABLED!=='true')throw new OfficeError('DENIED');
  const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
  if([config.megi.workerId,config.almet.workerId].includes(input.workerId))throw new OfficeError('DENIED');
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-team:${actor.companyId}`}))`;
    if(!await tx.worker.findFirst({where:{id:input.workerId,companyProfileId:actor.companyId,status:'active'}}))throw new OfficeError('NOT_FOUND');
    const old=await tx.officeMember.findUnique({where:{companyProfileId_workerId:{companyProfileId:actor.companyId,workerId:input.workerId}}});
    if((old?.version??0)!==input.version)throw new OfficeError('CONFLICT');
    if(old)return tx.officeMember.update({where:{id:old.id},data:{title:input.title,enabled:input.enabled,workbooksEnabled:input.workbooksEnabled,workProfile:input.workProfile??old.workProfile,assistantEnabled:input.assistantEnabled??old.assistantEnabled,version:{increment:1}},select:{id:true}});
    if(await tx.officeMember.count({where:{companyProfileId:actor.companyId}})>=500)throw new OfficeError('LIMIT');
    return tx.officeMember.create({data:{companyProfileId:actor.companyId,workerId:input.workerId,title:input.title,enabled:input.enabled,workbooksEnabled:input.workbooksEnabled,workProfile:input.workProfile??'GENERAL',assistantEnabled:input.assistantEnabled??false},select:{id:true}});
  });
}
/** Explicit setup, never a seed-on-read. Prepared rooms stay disabled. */
export async function prepareOfficeTeam(){
 const actor=await officeActor();if(!actor.manager||process.env.VIRTUAL_OFFICE_TEAM_ENABLED!=='true')throw new OfficeError('DENIED');
 const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
 const raw=process.env.VIRTUAL_OFFICE_TEAM_SETUP_JSON;
 const setup=raw?z.object({companyId:z.string(),people:z.array(z.object({workerId:z.string().min(1),title:z.string().trim().min(1).max(100),workbooksEnabled:z.boolean().default(false)}).strict()).max(500)}).strict().parse(JSON.parse(raw)):null;
 if(setup&&(setup.companyId!==actor.companyId||new Set(setup.people.map(p=>p.workerId)).size!==setup.people.length||setup.people.some(p=>[config.megi.workerId,config.almet.workerId].includes(p.workerId))))throw new OfficeError('DENIED');
 return withTenantContext(actor.companyId,async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-team:${actor.companyId}`}))`;
  const workers=await tx.worker.findMany({where:{companyProfileId:actor.companyId,status:'active',...(setup?{id:{in:setup.people.map(p=>p.workerId)}}:{crewRole:{in:['OFFICE','FIELD_ENGINEER','FACTORY_ENGINEER']},id:{notIn:[config.megi.workerId,config.almet.workerId].filter(Boolean)}})},select:{id:true,position:true}});
  if(workers.length>500)throw new OfficeError('LIMIT');
  if(setup&&workers.length!==setup.people.length)throw new OfficeError('CONFLICT');
  for(const w of workers){const plan=setup?.people.find(p=>p.workerId===w.id);await tx.officeMember.upsert({where:{companyProfileId_workerId:{companyProfileId:actor.companyId,workerId:w.id}},update:{},create:{companyProfileId:actor.companyId,workerId:w.id,title:plan?.title||w.position?.trim()||'Zyra personale',enabled:false,workbooksEnabled:plan?.workbooksEnabled??false}});}
  return {prepared:workers.length};
 });
}
