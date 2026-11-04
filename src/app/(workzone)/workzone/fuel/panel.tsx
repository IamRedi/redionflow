'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock3,
  Fuel,
  MapPin,
  ReceiptText,
} from 'lucide-react';
import type { readFuelLog, FuelReceiptView } from '@/lib/fleet/fuel/service';
import { fleetCopy } from '@/lib/fleet/copy';
import { mapsLink } from '@/lib/fleet/location-link';
import { fleetTime } from '@/lib/fleet/format';
import {
  uploadFuelAction,
  confirmFuelAction,
  retryFuelGpsAction,
  olderFuelAction,
} from './actions';

export function FuelPanel({
  data,
  lang,
  initialMachineId,
}: {
  data: Awaited<ReturnType<typeof readFuelLog>>;
  lang: string;
  initialMachineId: string;
}) {
  const c = fleetCopy(lang);
  const [machineId, setMachineId] = useState(initialMachineId);
  const [rows, setRows] = useState(data.receipts);
  const [hasMore, setHasMore] = useState(data.hasMore);
  const [cursor, setCursor] = useState(data.receipts.at(-1));
  const [draft, setDraft] = useState<FuelReceiptView | null>(null);
  const [clock, setClock] = useState('');
  const [offset, setOffset] = useState('');
  const [requestId, setRequestId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const date = (s: string, seconds = false) =>
    fleetTime(s, data.timeZone, seconds);
  const duration = (seconds: number) => {
    const n = Math.abs(seconds),
      minutes = Math.floor(n / 60),
      rest = n % 60;
    return [
      minutes ? `${minutes} ${c.minute}` : '',
      rest || !minutes ? `${rest} ${c.second}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  };
  function errorMessage(code: string) {
    return code === 'FILE'
      ? c.fileError
      : code === 'CLOCK'
        ? c.clockError
        : code === 'LIMIT'
          ? c.limitError
          : code === 'UNAUTHORIZED'
            ? c.unauthorized
            : code === 'IMMUTABLE'
              ? c.immutable
              : c.error;
  }
  function upsert(row: FuelReceiptView) {
    setRows((prev) =>
      [row, ...prev.filter((r) => r.id !== row.id)].sort(
        (a, b) =>
          b.uploadedAt.localeCompare(a.uploadedAt) || b.id.localeCompare(a.id),
      ),
    );
  }
  function resume(row: FuelReceiptView) {
    setDraft(row);
    setClock(row.receiptTime ?? '');
    setOffset('');
    setMessage('');
    setMachineId(row.machineId);
  }
  function result(
    res: { ok: true; row: FuelReceiptView } | { ok: false; code: string },
    confirmed = false,
  ) {
    setError(!res.ok);
    if (!res.ok) {
      setMessage(errorMessage(res.code));
      return;
    }
    upsert(res.row);
    if (confirmed) {
      setDraft(null);
      setFile(null);
      setRequestId('');
      setMessage(c.saved);
    } else resume(res.row);
  }
  function perform(
    action: () => Promise<
      { ok: true; row: FuelReceiptView } | { ok: false; code: string }
    >,
    mode: 'draft' | 'confirmed' | 'gps',
  ) {
    start(async () => {
      try {
        const response = await action();
        if (mode === 'gps' && response.ok) {
          upsert(response.row);
          setError(false);
          setMessage('');
        } else result(response, mode === 'confirmed');
      } catch {
        setError(true);
        setMessage(c.error);
      }
    });
  }
  return (
    <div className="space-y-7">
      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        {!draft ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!file) return;
              setMessage('');
              const form = new FormData();
              form.set('machineId', machineId);
              form.set('requestId', requestId);
              form.set('file', file);
              perform(() => uploadFuelAction(form), 'draft');
            }}
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Fuel className="size-5 text-orange-600" />
              {c.fuel}
            </h2>
            <label className="block space-y-2 text-sm font-medium">
              {c.vehicles}
              <select
                required
                aria-label={c.choose}
                name="fuelMachineId"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="block w-full rounded-xl border bg-background p-3"
              >
                <option value="">{c.choose}</option>
                {data.machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.targe ? `${m.targe} · ` : ''}
                    {m.nickname || m.name}
                  </option>
                ))}
              </select>
            </label>
            {!data.machines.length && <p>{c.noVehicles}</p>}
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center focus-within:ring-2 focus-within:ring-orange-600">
              <Camera className="size-8 text-orange-600" />
              <span className="font-semibold">{c.takePhoto}</span>
              <span className="text-xs text-muted-foreground">
                {c.uploadLimit}
              </span>
              <input
                aria-label={c.receipt}
                name="fuelReceipt"
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                required
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setRequestId(crypto.randomUUID());
                }}
                className="sr-only"
              />
              {file && (
                <span className="max-w-full break-all text-xs text-muted-foreground">
                  {file.name}
                </span>
              )}
            </label>
            {file && (
              <button
                disabled={pending || !file || !machineId}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 font-semibold text-white disabled:opacity-50"
              >
                <ReceiptText className="size-5" />
                {pending ? c.uploading : c.upload}
              </button>
            )}
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const number = (key: string) =>
                String(f.get(key) ?? '').trim()
                  ? Number(String(f.get(key)).replace(',', '.'))
                  : null;
              setMessage('');
              perform(
                () =>
                  confirmFuelAction({
                    id: draft.id,
                    clock,
                    utcOffset: offset ? Number(offset) : null,
                    stationAddress: String(f.get('stationAddress') ?? ''),
                    liters: number('liters'),
                    amount: number('amount'),
                    fueledByWorkerId:
                      String(f.get('fueledByWorkerId') ?? '') || null,
                  }),
                'confirmed',
              );
            }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <ReceiptText className="size-5 text-orange-600" />
              {draft.machine.targe ??
                draft.machine.nickname ??
                draft.machine.name}
            </div>
            <div className="grid gap-5 sm:grid-cols-[150px_1fr]">
              <a
                href={`/api/fuel-receipts/${draft.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  alt={c.receipt}
                  src={`/api/fuel-receipts/${draft.id}`}
                  className="max-h-52 w-full rounded-xl border object-contain"
                />
              </a>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {c.by}: {draft.uploadedByName} · {c.uploaded}:{' '}
                  {date(draft.uploadedAt)}
                </p>
                <p
                  className={`rounded-xl p-3 text-sm ${draft.receiptTime ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/10 text-amber-800 dark:text-amber-200'}`}
                >
                  {draft.receiptTime ? c.readTime : c.manualTime}
                </p>
                <label className="block text-sm font-semibold">
                  {c.invoiceTime}
                  <input
                    name="fuelClock"
                    type="datetime-local"
                    step={1}
                    required
                    value={clock}
                    onChange={(e) => setClock(e.target.value)}
                    className="mt-2 block min-h-12 w-full min-w-0 rounded-xl border bg-background p-3"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  {c.timeZone}: {draft.timeZone}
                </p>
              </div>
            </div>
            <label className="block text-sm font-medium">
              {c.fueledBy}
              {data.isOffice ? (
                <select
                  name="fueledByWorkerId"
                  className="mt-2 block min-h-12 w-full rounded-xl border bg-background p-3"
                >
                  <option value="">{data.selfName}</option>
                  {data.workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="mt-1 block text-sm font-normal text-muted-foreground">
                  {data.selfName}
                </span>
              )}
            </label>
            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {c.details}
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block text-sm">
                  {c.station}
                  <input
                    name="stationAddress"
                    maxLength={240}
                    defaultValue={draft.stationAddress ?? ''}
                    className="mt-1 block w-full rounded-lg border bg-background p-3"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    {c.liters}
                    <input
                      name="liters"
                      type="number"
                      min="0.01"
                      max="10000"
                      step="0.01"
                      className="mt-1 block w-full rounded-lg border bg-background p-3"
                    />
                  </label>
                  <label className="text-sm">
                    {c.amount} ({data.currency})
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 block w-full rounded-lg border bg-background p-3"
                    />
                  </label>
                </div>
                <label className="block text-xs">
                  {c.utc}
                  <select
                    aria-label="UTC"
                    value={offset}
                    onChange={(e) => setOffset(e.target.value)}
                    className="mt-1 block rounded-lg border bg-background p-2"
                  >
                    <option value="">{c.timeZone}</option>
                    <option value="1">{c.offset1}</option>
                    <option value="2">{c.offset2}</option>
                  </select>
                </label>
              </div>
            </details>
            <p className="text-xs text-muted-foreground">{c.evidenceHint}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => setDraft(null)}
                className="min-h-12 rounded-xl border px-4"
              >
                {c.cancel}
              </button>
              <button
                disabled={pending}
                className="min-h-12 flex-1 rounded-xl bg-orange-600 px-5 font-semibold text-white disabled:opacity-50"
              >
                {pending ? c.busy : c.save}
              </button>
            </div>
          </form>
        )}
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-sm ${error ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-300'}`}
        >
          {message}
        </p>
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">
            {data.isOffice ? c.officeLog : c.fuelLog}
          </h2>
          <p className="text-xs text-muted-foreground">{c.onlyMine}</p>
        </div>
        {!rows.length && (
          <p className="rounded-2xl border p-6 text-sm text-muted-foreground">
            {c.empty}
          </p>
        )}
        {rows.map((row, index) => {
          const verified = row.gpsStatus === 'matched';
          const gpsMessage =
            row.gpsStatus === 'pending'
              ? c.gpsPending
              : row.gpsStatus in c
                ? c[row.gpsStatus as keyof typeof c]
                : c.unavailable;
          return (
            <article
              key={`${row.id}:${row.confirmedAt}`}
              className="overflow-hidden rounded-2xl border bg-card"
              data-testid="fuel-receipt-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <h3 className="font-semibold">
                    {row.machine.targe ??
                      row.machine.nickname ??
                      row.machine.name}
                  </h3>
                  <p className="mt-1 text-sm">
                    {row.fueledAt
                      ? `${c.fueled}: ${date(row.fueledAt, true)}`
                      : c.draft}
                  </p>
                  {row.fueledByName && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.fueledBy}: {row.fueledByName}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.by}: {row.uploadedByName} · {c.uploaded}:{' '}
                    {date(row.uploadedAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${verified ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/10 text-amber-800 dark:text-amber-200'}`}
                >
                  {verified ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <Clock3 className="size-3.5" />
                  )}
                  {row.confirmedAt ? gpsMessage : c.draft}
                </span>
              </div>
              <details open={index === 0} className="border-t px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {c.details} · {c.gps}
                </summary>
                <div className="mt-3 space-y-3 text-sm">
                  <a
                    href={`/api/fuel-receipts/${row.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3"
                  >
                    <ReceiptText className="size-4" />
                    {c.viewReceipt}
                  </a>
                  {!row.confirmedAt ? (
                    <button
                      disabled={pending}
                      onClick={() => resume(row)}
                      className="ml-2 min-h-10 rounded-lg border px-3"
                    >
                      {c.continue}
                    </button>
                  ) : (
                    <>
                      <div>
                        <p className="font-medium">{c.gpsEvidence}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {gpsMessage}
                        </p>
                      </div>
                      {row.gpsRecordedAt && (
                        <p>
                          {c.gpsTime}: {date(row.gpsRecordedAt, true)} ·{' '}
                          {c.gpsOffset}:{' '}
                          {row.gpsDeltaSeconds === 0
                            ? c.atFueling
                            : `${duration(row.gpsDeltaSeconds!)} ${row.gpsDeltaSeconds! < 0 ? c.beforeFueling : c.afterFueling}`}
                        </p>
                      )}
                      {row.gpsLat !== null && row.gpsLng !== null && (
                        <a
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3"
                          href={mapsLink(row.gpsLat, row.gpsLng)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin className="size-4" />
                          {c.maps} · {row.gpsLat.toFixed(5)},{' '}
                          {row.gpsLng.toFixed(5)}
                        </a>
                      )}
                      {row.gpsIntervalSeconds !== null && (
                        <p>
                          {c.gpsInterval}: {duration(row.gpsIntervalSeconds)}
                        </p>
                      )}
                      {row.stationAddress && (
                        <p>
                          {c.station}: {row.stationAddress}
                        </p>
                      )}
                      {(row.liters !== null || row.amount !== null) && (
                        <p>
                          {row.liters !== null
                            ? `${row.liters} ${c.liters}`
                            : ''}
                          {row.amount !== null
                            ? ` · ${row.amount} ${row.currency}`
                            : ''}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {c.addressHint}
                      </p>
                      <button
                        disabled={pending}
                        onClick={() =>
                          perform(() => retryFuelGpsAction(row.id), 'gps')
                        }
                        className="min-h-10 rounded-lg border px-3 disabled:opacity-50"
                      >
                        {c.retry}
                      </button>
                    </>
                  )}
                </div>
              </details>
            </article>
          );
        })}
        {hasMore && cursor && (
          <button
            disabled={pending}
            className="min-h-12 w-full rounded-xl border px-4 disabled:opacity-50"
            onClick={() =>
              start(async () => {
                try {
                  const res = await olderFuelAction(initialMachineId || null, {
                    id: cursor.id,
                    uploadedAt: cursor.uploadedAt,
                  });
                  if (!res.ok) {
                    setError(true);
                    setMessage(errorMessage(res.code));
                    return;
                  }
                  setRows((prev) => [
                    ...prev,
                    ...res.receipts.filter(
                      (r) => !prev.some((p) => p.id === r.id),
                    ),
                  ]);
                  setHasMore(res.hasMore);
                  setCursor(res.receipts.at(-1));
                } catch {
                  setError(true);
                  setMessage(c.error);
                }
              })
            }
          >
            {pending ? c.uploading : c.older}
          </button>
        )}
      </section>
    </div>
  );
}
