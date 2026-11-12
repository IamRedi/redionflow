import type { ReactNode } from 'react';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import '@/components/steel/steel-studio.css';

/** Presentation only; callers retain their existing report authorization and rows. */
export async function NotebookSurface({ companyId, className, children }: {
  companyId: string; className: string; children: ReactNode;
}) {
  const steel = await isSteelCompany(companyId);
  return <div className={className} data-steel-studio={steel || undefined} data-studio-notebook={steel || undefined}>{children}</div>;
}
