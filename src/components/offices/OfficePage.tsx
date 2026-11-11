import { notFound } from 'next/navigation';
import { currentOfficeAccess } from '@/lib/offices/access';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { withPilotDbContext } from '@/lib/db/tenant-runtime';
import { OfficeSpace } from './OfficeSpace';
import { officeUnreadCount } from '@/lib/offices/work-service';
import { OfficeError } from '@/lib/offices/work-access';
import { officeDirectory } from '@/lib/offices/team-service';
import Link from 'next/link';
import {OfficeResources} from './OfficeResources';
import {officeResources} from '@/lib/offices/resources';

export async function OfficePage({ room,personId }: { room: 'reception' | 'megi' | 'me' | 'person';personId?:string }) {
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
  const resources=workEnabled&&ownDesk&&room!=='reception'?await officeResources():null;
  const unread=workEnabled?await officeUnreadCount().catch(error=>{if(error instanceof OfficeError)return null;throw error;}):null;
  return <><OfficeSpace room={room==='reception'?'reception':'megi'} lang={lang} companyName={company.displayName} ownDesk={ownDesk} admin={access.kind === 'admin'} workEnabled={unread!==null} ownName={room!=='reception'?occupant?.name:undefined} planEnabled={resources?.plan??true} workbooksEnabled={resources?.workbooks??false} officeTitle={occupant?.title} visitorId={ownDesk?undefined:occupant?.id} unread={unread??0} />
    {room==='reception'&&directory&&<section className="mt-5 grid gap-3" aria-label={lang==='sq'?'Zyrat e ekipit':'Team offices'}><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{lang==='sq'?'Zyrat e ekipit':'Team offices'}</h2>{directory.manager&&process.env.VIRTUAL_OFFICE_TEAM_ENABLED==='true'&&<Link className="inline-flex min-h-11 items-center rounded-xl border bg-card px-3 text-sm" href="/workzone/offices/team">{lang==='sq'?'Menaxho zyrat':'Manage offices'}</Link>}</div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{directory.people.map(p=><Link key={p.id} href={p.id===directory.self?'/workzone/offices/me':`/workzone/offices/people/${p.id}`} className="flex min-h-24 min-w-0 flex-col justify-center gap-1 rounded-2xl border bg-card p-4 transition hover:border-primary"><strong className="break-words text-sm">{p.name}</strong><span className="break-words text-xs text-muted-foreground">{p.title}</span></Link>)}</div></section>}
    {room!=='reception'&&ownDesk&&workEnabled&&<OfficeResources lang={lang} initial={resources??undefined}/>}
  </>;
}
