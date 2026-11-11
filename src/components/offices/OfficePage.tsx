import { notFound } from 'next/navigation';
import { currentOfficeAccess } from '@/lib/offices/access';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { withPilotDbContext } from '@/lib/db/tenant-runtime';
import { OfficeSpace } from './OfficeSpace';
import { officeUnreadCount } from '@/lib/offices/work-service';
import { OfficeError } from '@/lib/offices/work-access';

export async function OfficePage({ room }: { room: 'reception' | 'megi' | 'me' }) {
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
  const ownDesk=room==='me'||access.seat==='megi';
  const unread=workEnabled?await officeUnreadCount().catch(error=>{if(error instanceof OfficeError)return null;throw error;}):null;
  return <OfficeSpace room={room==='me'?'megi':room} lang={lang} companyName={company.displayName} ownDesk={ownDesk} admin={access.kind === 'admin'} workEnabled={unread!==null} ownName={room==='me'&&access.seat==='almet'?'Almet':undefined} unread={unread??0} />;
}
