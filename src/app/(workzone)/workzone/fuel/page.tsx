import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { readFuelLog } from '@/lib/fleet/fuel/service';
import { fleetCopy } from '@/lib/fleet/copy';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { FuelPanel } from './panel';
export const dynamic = 'force-dynamic';
export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<{ machine?: string }>;
}) {
  if (!(await getCurrentCompanyId())) redirect('/workzone/login');
  const { machine } = await searchParams;
  const [data, lang] = await Promise.all([
    readFuelLog(machine),
    resolveRequestLanguage(),
  ]);
  const c = fleetCopy(lang);
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/workzone" className="text-sm text-muted-foreground">
            ← {c.workzone}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{c.fuelLog}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{c.fuelIntro}</p>
        </div>
      </header>
      <FuelPanel data={data} lang={lang} initialMachineId={machine ?? ''} />
    </div>
  );
}
