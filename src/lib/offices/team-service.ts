import { z } from 'zod';
import { withTenantContext } from '@/lib/db/tenant-context';
import { officeActor, OfficeError } from './work-access';

export async function officeDirectory(){
  const actor=await officeActor();
  return {self:actor.principalId,manager:actor.manager,people:actor.people};
}
export async function officeTeamSettings(){
  const actor=await officeActor();
  if(!actor.manager||process.env.VIRTUAL_OFFICE_TEAM_ENABLED!=='true')throw new OfficeError('DENIED');
  return withTenantContext(actor.companyId,async tx=>{
    const [workers,members]=await Promise.all([
      tx.worker.findMany({where:{companyProfileId:actor.companyId,status:'active'},select:{id:true,firstName:true,lastName:true,position:true},orderBy:[{firstName:'asc'},{id:'asc'}],take:500}),
      tx.officeMember.findMany({where:{companyProfileId:actor.companyId,workerId:{not:null}},select:{id:true,workerId:true,title:true,enabled:true,version:true}}),
    ]);
    const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
    const directors=[config.megi.workerId,config.almet.workerId];
    return workers.filter(w=>!directors.includes(w.id)).map(w=>({workerId:w.id,name:`${w.firstName} ${w.lastName}`,position:w.position,member:members.find(m=>m.workerId===w.id)??null}));
  });
}
export async function saveOfficeMember(raw:unknown){
  const input=z.object({workerId:z.string().min(1).max(128),title:z.string().trim().min(1).max(100),enabled:z.boolean(),version:z.number().int().min(0)}).strict().parse(raw);
  const actor=await officeActor();
  if(!actor.manager||process.env.VIRTUAL_OFFICE_TEAM_ENABLED!=='true')throw new OfficeError('DENIED');
  const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
  if([config.megi.workerId,config.almet.workerId].includes(input.workerId))throw new OfficeError('DENIED');
  return withTenantContext(actor.companyId,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`office-team:${actor.companyId}`}))`;
    if(!await tx.worker.findFirst({where:{id:input.workerId,companyProfileId:actor.companyId,status:'active'}}))throw new OfficeError('NOT_FOUND');
    const old=await tx.officeMember.findUnique({where:{companyProfileId_workerId:{companyProfileId:actor.companyId,workerId:input.workerId}}});
    if((old?.version??0)!==input.version)throw new OfficeError('CONFLICT');
    if(old)return tx.officeMember.update({where:{id:old.id},data:{title:input.title,enabled:input.enabled,version:{increment:1}},select:{id:true}});
    if(await tx.officeMember.count({where:{companyProfileId:actor.companyId}})>=500)throw new OfficeError('LIMIT');
    return tx.officeMember.create({data:{companyProfileId:actor.companyId,workerId:input.workerId,title:input.title,enabled:input.enabled},select:{id:true}});
  });
}
