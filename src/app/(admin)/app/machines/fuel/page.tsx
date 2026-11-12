import Link from 'next/link';
import { requireAdminTenant } from '@/lib/auth/authorization';
import { readFuelLog } from '@/lib/fleet/fuel/service';
import { fleetCopy } from '@/lib/fleet/copy';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { FuelPanel } from '@/app/(workzone)/workzone/fuel/panel';

export const dynamic = 'force-dynamic';

export default async function FleetFuelPage() {
  await requireAdminTenant();
  const [data, lang] = await Promise.all([readFuelLog(), resolveRequestLanguage()]);
  const c = fleetCopy(lang);
  return <div data-studio-fuel className="min-w-0 space-y-5">
    <header>
      <Link href="/app/admin#machines" className="inline-flex min-h-11 items-center text-sm text-muted-foreground">← {c.fleet}</Link>
      <h1 className="text-2xl font-bold">{c.fuelLog}</h1>
    </header>
    <FuelPanel data={data} lang={lang} initialMachineId="" logOnly />
  </div>;
}
