import { notFound } from 'next/navigation';
import { currentOfficeAccess } from '@/lib/offices/access';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { withPilotDbContext } from '@/lib/db/tenant-runtime';
import { OfficeSpace } from './OfficeSpace';

export async function OfficePage({ room }: { room: 'reception' | 'megi' }) {
  const access = await currentOfficeAccess();
  if (!access) notFound();
  const [company, lang] = await Promise.all([
    withPilotDbContext(access.companyId, tx => tx.companyProfile.findUnique({ where: { id: access.companyId }, select: { displayName: true } })),
    resolveRequestLanguage(),
  ]);
  if (!company) notFound();
  // No colleague profile or private data is fetched, including in the RSC payload.
  return <OfficeSpace room={room} lang={lang} companyName={company.displayName} ownDesk={access.seat === 'megi'} admin={access.kind === 'admin'} />;
}
