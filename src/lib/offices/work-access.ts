import { currentOfficeAccess } from './access';
import { officeSeat, type OfficeSeat } from './policy';
import { withTenantContext } from '@/lib/db/tenant-context';

export class OfficeError extends Error {
  constructor(public code:'DENIED'|'NOT_FOUND'|'CONFLICT'|'INVALID'|'LIMIT'){super(code);}
}
/** Resolve BOTH login kinds to the same person. No display-name matching. */
export async function officeActor(){
  if(process.env.VIRTUAL_OFFICE_WORK_ENABLED!=='true')throw new OfficeError('DENIED');
  const access=await currentOfficeAccess();
  if(!access)throw new OfficeError('DENIED');
  const config=JSON.parse(process.env.VIRTUAL_OFFICE_ACCESS_JSON!);
  const ids=(['megi','almet'] as const).map(seat=>({seat,id:String(config[seat].adminId)}));
  const people=await withTenantContext(access.companyId,async tx=>{
    const rows=await tx.user.findMany({where:{companyProfileId:access.companyId,id:{in:ids.map(x=>x.id)},isActive:true,role:'ADMIN'},select:{id:true,name:true}});
    return rows.flatMap(row=>{
      const seat=officeSeat(process.env.VIRTUAL_OFFICE_ACCESS_JSON,{kind:'admin',id:row.id,companyId:access.companyId});
      return seat?[{id:row.id,name:row.name||seat,seat}]:[];
    });
  });
  const self=people.find(p=>p.seat===access.seat);
  if(!self)throw new OfficeError('DENIED');
  return {...access,principalId:self.id,name:self.name,people};
}
export type OfficeActor=Awaited<ReturnType<typeof officeActor>>;
export function personSeat(actor:OfficeActor,id:string):OfficeSeat|null{return actor.people.find(p=>p.id===id)?.seat??null;}
