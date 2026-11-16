import { notFound } from 'next/navigation';
import { assetActor } from '@/lib/company-assets/access';
import { isMusterOperationsCompany } from '@/lib/demo/muster-operations';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { assetCopy } from '@/components/company-assets/copy';
import { MusterFleetWorkspaceSlot } from '@/components/shell/ProductionHeaderActions';

export const metadata = { robots: { index: false, follow: false } };

/** The existing layout fleet controller mounts its picker here; no second store. */
export default async function MusterFleetPage() {
  const actor = await assetActor();
  if (!isMusterOperationsCompany(actor.companyId)) notFound();
  return <MusterFleetWorkspaceSlot loadingLabel={assetCopy(await resolveRequestLanguage()).loading}/>;
}
