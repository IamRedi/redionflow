import type { ReactNode } from 'react';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import '@/components/steel/steel-studio.css';

/** Presentation only; the caller retains its existing warehouse authorization. */
export async function WarehouseSurface({ companyId, children }: { companyId: string; children: ReactNode }) {
  const steel = await isSteelCompany(companyId);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-steel-studio={steel || undefined} data-studio-warehouse={steel || undefined}>{children}</div>;
}
