import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { readPanel, wanwayEnabled } from '@/lib/fleet/wanway/service';
import { wanwayCopy } from '@/lib/fleet/wanway/copy';
import { WanwayPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function WanwayPage() {
  if (!wanwayEnabled()) notFound();
  const lang = await resolveRequestLanguage();
  const data = await readPanel();
  const c = wanwayCopy(lang);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <nav className="text-sm text-muted-foreground">
        <Link href="/app/settings" className="hover:underline">
          {c.back}
        </Link>{' '}
        → {c.integrations} → {c.title}
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{c.subtitle}</p>
      </header>
      <WanwayPanel data={data} lang={lang} />
    </div>
  );
}
