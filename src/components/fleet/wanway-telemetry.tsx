'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/lib/i18n';
import type { readFleet } from '@/lib/fleet/wanway/service';
import { wanwayCopy, wanwayError } from '@/lib/fleet/wanway/copy';
import { wanwayAction } from '@/app/(admin)/app/settings/integrations/wanway/actions';
import { Button } from '@/components/ui/button';

const Map = dynamic(() => import('./wanway-map'), { ssr: false });
type Snapshot = Awaited<ReturnType<typeof readFleet>>[number];

export function WanwayTelemetry({
  data: d,
  lang,
  compact = false,
}: {
  data: Snapshot;
  lang: Language;
  compact?: boolean;
}) {
  const c = wanwayCopy(lang);
  const [showMap, setShowMap] = useState(false);
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState<[number, number][]>([]);
  const [historyAt, setHistoryAt] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const date = (s: string | null) =>
    s ? new Date(s).toLocaleString(lang) : '—';
  const hasPosition = d.lat !== null && d.lng !== null && d.reportedAt !== null;
  if (compact)
    return (
      <div className="mt-2 space-y-1 text-xs">
        <p
          className={
            d.online
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-muted-foreground'
          }
        >
          {c.title}
          {' · '}
          {d.online ? c.online : c.offline}
          {d.stale ? ` · ${c.stale}` : ''}
        </p>
        <Link href={`/app/fleet-gps/${d.machineId}`} className="underline">
          {c.lastPosition}: {date(d.reportedAt)}
        </Link>
      </div>
    );
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{c.title}</h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/settings/integrations/wanway">{c.sync}</Link>
        </Button>
      </div>
      <p
        className={
          d.online
            ? 'text-sm text-emerald-700 dark:text-emerald-400'
            : 'text-sm text-amber-700 dark:text-amber-400'
        }
      >
        {d.online ? c.online : c.offline} {d.stale ? `· ${c.stale}` : ''}
        {!d.available ? ` · ${c.unavailable}` : ''}
      </p>
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {[
          [c.reporting, date(d.reportedAt)],
          [c.snapshot, date(d.syncedAt)],
          [c.speed, d.speedKmh === null ? c.noValue : `${d.speedKmh} km/h`],
          [c.voltage, d.voltage === null ? c.noValue : `${d.voltage} V`],
          [
            c.mileage,
            d.mileage24hKm === null
              ? c.noValue
              : `${d.mileage24hKm} km · ${date(d.mileageAt)}`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {d.mileageError && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {c.mileage}: {wanwayError(d.mileageError, lang)}
        </p>
      )}
      {hasPosition ? (
        <>
          <p className="text-sm text-muted-foreground">
            {c.lastPosition}: {d.lat}, {d.lng}
          </p>
          <Button
            variant="outline"
            onClick={() => setShowMap((v) => !v)}
            aria-expanded={showMap}
          >
            {c.map}
          </Button>
          <p className="text-xs text-muted-foreground">{c.mapPrivacy}</p>
          {showMap && <Map lat={d.lat!} lng={d.lng!} points={points} />}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{c.noPosition}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={pending || !d.available}
          onClick={() =>
            start(async () => {
              try {
                const result = await wanwayAction({
                  action: 'history',
                  id: d.id,
                });
                setMessage(
                  result.ok
                    ? `${c.done} · ${result.count ?? 0}`
                    : wanwayError(result.code ?? 'INTERNAL', lang),
                );
                if (result.ok) {
                  setPoints((result.points ?? []).map((p) => [p.lat, p.lng]));
                  setHistoryAt(result.fetchedAt ?? null);
                  router.refresh();
                }
              } catch {
                setMessage(c.failed);
              }
            })
          }
        >
          {pending ? c.pending : c.history}
        </Button>
        <span className="text-xs text-muted-foreground">
          {historyAt
            ? `${c.historyAt}: ${date(historyAt)} · ${points.length}`
            : c.noHistory}
        </span>
      </div>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </section>
  );
}
