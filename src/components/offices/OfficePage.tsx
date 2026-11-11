import { notFound } from 'next/navigation';
import { currentOfficeAccess } from '@/lib/offices/access';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { withPilotDbContext } from '@/lib/db/tenant-runtime';
import { OfficeSpace } from './OfficeSpace';
import { officeUnreadCount } from '@/lib/offices/work-service';
import { OfficeError } from '@/lib/offices/work-access';
import { officeDirectory } from '@/lib/offices/team-service';
import {officeResources} from '@/lib/offices/resources';
import {OfficePreviewPanel,type OfficePreviewQuery} from './OfficePreviewPanel';

export async function OfficePage({ room,personId,query={} }: { room: 'reception' | 'megi' | 'me' | 'person';personId?:string;query?:OfficePreviewQuery&{doors?:string} }) {
  const access = await currentOfficeAccess();
  if (!access) notFound();
  const [company, lang] = await Promise.all([
    withPilotDbContext(access.companyId, tx => tx.companyProfile.findUnique({ where: { id: access.companyId }, select: { displayName: true } })),
    resolveRequestLanguage(),
  ]);
  if (!company) notFound();
  const workEnabled=process.env.VIRTUAL_OFFICE_WORK_ENABLED==='true';
  if(room==='me'&&!workEnabled)notFound();
  // Only the current person's unread count enters the room payload, never a colleague's work.
  const directory=workEnabled?await officeDirectory():null;
  const occupant=directory?.people.find(p=>room==='me'?p.id===directory.self:room==='person'?p.id===personId:p.seat==='megi');
  if(room==='person'&&!occupant)notFound();
  const ownDesk=room==='me'||(occupant?occupant.id===directory?.self:access.seat==='megi');
  const preview=room==='person'&&directory?.manager&&occupant?.seat==='staff';
  const resources=workEnabled&&(ownDesk||preview)&&room!=='reception'?await officeResources(preview?occupant!.id:undefined).catch(e=>{if(e instanceof OfficeError)notFound();throw e;}):null;
  const unread=workEnabled?await officeUnreadCount().catch(error=>{if(error instanceof OfficeError)return null;throw error;}):null;
  return <><OfficeSpace room={room==='reception'?'reception':'megi'} lang={lang} companyName={company.displayName} ownDesk={ownDesk} admin={access.kind === 'admin'} workEnabled={unread!==null} ownName={room!=='reception'?occupant?.name:undefined} planEnabled={resources?.plan??true} workbooksEnabled={resources?.workbooks??false} officeTitle={occupant?.title} visitorId={ownDesk?undefined:occupant?.id} unread={unread??0} previewBase={preview?`/workzone/offices/people/${occupant!.id}`:undefined} previewEnabled={occupant?.enabled} canManage={!!directory?.manager&&process.env.VIRTUAL_OFFICE_TEAM_ENABLED==='true'} doorPage={/^\d{1,3}$/.test(query.doors??'')?Number(query.doors):0} doors={directory?.people.map(p=>({...p,href:p.id===directory.self?'/workzone/offices/me':`/workzone/offices/people/${p.id}`}))??[{id:'megi',name:'Megi',title:'Administrata',enabled:true,href:'/workzone/offices/megi'}]}/>
    {preview&&query.view&&<OfficePreviewPanel id={occupant!.id} name={occupant!.name} lang={lang} query={query}/>}
  </>;
}
