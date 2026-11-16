import Link from 'next/link';
import { Monitor, Settings2 } from 'lucide-react';

/** Only render for the authenticated owner/admin at their own Muster desk. */
export function OfficeManagementTools({ lang }: { lang: string }) {
  const label = lang === 'sq' ? 'Paneli i kontrollit' : lang === 'de' ? 'Kontrollbereich' : lang === 'it' ? 'Pannello di controllo' : 'Control panel';
  const dashboard = 'Dashboard view';
  return <><Link href="/app/dashboard?office=desk" title={label} aria-label={label} data-testid="office-control-panel"><Settings2 size={18}/></Link><Link href="/display/dashboard" target="_blank" rel="noopener noreferrer" title={dashboard} aria-label={dashboard} data-testid="office-dashboard-view"><Monitor size={18}/></Link></>;
}
