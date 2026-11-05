'use client';
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock3,
  Map,
  RefreshCw,
  Settings2,
  Truck,
} from 'lucide-react';
import type { readPanel } from '@/lib/fleet/wanway/service';
import type { Language } from '@/lib/i18n';
import { wanwayCopy, wanwayError } from '@/lib/fleet/wanway/copy';
import { fleetCopy } from '@/lib/fleet/copy';
import { wanwayAction } from './actions';
import { Button } from '@/components/ui/button';

type PanelData = Awaited<ReturnType<typeof readPanel>>;
function DeviceCard({
  device: d,
  machines,
  lang,
  pending,
  run,
}: {
  device: PanelData['devices'][number];
  machines: PanelData['machines'];
  lang: Language;
  pending: boolean;
  run: (input: unknown) => void;
}) {
  const c = wanwayCopy(lang),
    f = fleetCopy(lang);
  const [chosen, setChosen] = useState(
    d.machineId ?? d.suggestedMachineId ?? '',
  );
  const [create, setCreate] = useState(false);
  const machine = machines.find((m) => m.id === d.machineId);
  const picker = (
    <div className="space-y-3">
      {!create ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run({ action: 'link', id: d.id, machineId: chosen || null });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
            {c.vehicle}
            <select
              name="machineId"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
              aria-describedby={
                !d.machineId && d.suggestedMachineId
                  ? `suggestion-${d.id}`
                  : undefined
              }
              disabled={pending || !d.available}
              className="mt-1 block min-h-12 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
            >
              <option value="">{d.machineId ? c.unlink : f.choose}</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.targe ? `${m.targe} · ` : ''}
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            disabled={pending || !d.available || (!d.machineId && !chosen)}
            className="min-h-12 rounded-xl"
          >
            {c.link}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            run({
              action: 'createVehicle',
              id: d.id,
              name: String(form.get('newMachineName') ?? ''),
              plate: String(form.get('newMachinePlate') ?? ''),
            });
          }}
          className="space-y-3 rounded-xl border bg-background p-3"
        >
          <p className="text-xs text-muted-foreground">{f.newVehicleHint}</p>
          <label className="block text-sm">
            {f.vehicleName}
            <input
              name="newMachineName"
              required
              minLength={2}
              maxLength={160}
              defaultValue={d.name}
              className="mt-1 block w-full rounded-lg border bg-background p-3"
            />
          </label>
          <label className="block text-sm">
            {f.plate}
            <input
              name="newMachinePlate"
              maxLength={30}
              className="mt-1 block w-full rounded-lg border bg-background p-3"
            />
          </label>
          <Button
            type="submit"
            disabled={pending || !d.available}
            className="min-h-12 rounded-xl"
          >
            {f.createConfirm}
          </Button>
        </form>
      )}
      {!d.machineId && d.suggestedMachineId && (
        <p id={`suggestion-${d.id}`} className="text-xs text-muted-foreground">
          {c.suggested}
        </p>
      )}
      {!d.machineId && (
        <button
          type="button"
          disabled={pending || !d.available}
          onClick={() => setCreate((v) => !v)}
          className="min-h-10 text-sm font-medium underline underline-offset-4"
        >
          {create ? f.cancel : f.addVehicle}
        </button>
      )}
    </div>
  );
  return (
    <article
      className={`rounded-2xl border p-4 sm:p-5 ${d.machineId ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-amber-500/40 bg-amber-500/[0.06]'}`}
      data-state={d.machineId ? 'confirmed' : 'pending'}
    >
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${d.machineId ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'}`}
        >
          <Truck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{d.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {d.model} · {c.suffix} ••••{d.suffix}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${d.machineId ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'}`}
        >
          {d.machineId ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <Clock3 className="size-3.5" />
          )}
          {d.machineId ? f.confirmed : f.pending}
        </span>
      </div>
      {!d.available && (
        <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">
          {c.unavailable}
        </p>
      )}
      {d.machineId ? (
        <>
          <p className="text-sm font-medium">
            {machine?.targe ? `${machine.targe} · ` : ''}
            {machine?.name ?? c.vehicle}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer py-2 text-sm text-muted-foreground">
              {f.change}
            </summary>
            {picker}
          </details>
        </>
      ) : (
        picker
      )}
    </article>
  );
}

export function WanwayPanel({
  data,
  lang,
}: {
  data: PanelData;
  lang: Language;
}) {
  const c = wanwayCopy(lang),
    f = fleetCopy(lang);
  const waiting = data.devices.filter((d) => !d.machineId),
    confirmed = data.devices.filter((d) => d.machineId);
  const [filter, setFilter] = useState<'pending' | 'confirmed' | 'all'>(
    waiting.length ? 'pending' : 'all',
  );
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(!data.appid);
  const secret = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const activeFilter =
    filter === 'pending' && !waiting.length && confirmed.length
      ? 'confirmed'
      : filter;
  const devices =
    activeFilter === 'pending'
      ? waiting
      : activeFilter === 'confirmed'
        ? confirmed
        : [...waiting, ...confirmed];
  function run(input: unknown) {
    setMessage('');
    start(async () => {
      try {
        const result = await wanwayAction(input);
        setOk(result.ok);
        setMessage(
          result.ok
            ? `${c.done}${result.count === undefined ? '' : ` · ${result.count}`}`
            : wanwayError(result.code ?? 'INTERNAL', lang),
        );
        if (result.ok) {
          setConfirm(false);
          if (
            input &&
            typeof input === 'object' &&
            'action' in input &&
            input.action === 'save'
          )
            setSettingsOpen(false);
          router.refresh();
        }
      } catch {
        setOk(false);
        setMessage(c.failed);
      }
    });
  }
  const connection =
    c[data.status as 'configured' | 'disconnected' | 'connected' | 'error'] ??
    data.status;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span
              className={`size-2.5 rounded-full ${data.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            {connection}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.lastSync}:{' '}
            {data.lastSuccessfulSync
              ? new Date(data.lastSuccessfulSync).toLocaleString(lang)
              : '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || !data.appid || !data.keyReady}
            onClick={() => run({ action: 'sync' })}
            className="min-h-11 rounded-xl"
          >
            <RefreshCw className={`size-4 ${pending ? 'animate-spin' : ''}`} />
            {c.sync}
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/workzone?view=map">
              <Map className="size-4" />
              {f.workzoneMap}
            </Link>
          </Button>
        </div>
      </div>
      {data.lastError && (
        <p className="text-sm text-destructive">
          {c.lastError}: {wanwayError(data.lastError, lang)}
        </p>
      )}
      {!data.keyReady && (
        <p
          role="alert"
          className="rounded-xl border border-amber-500 p-4 text-sm"
        >
          {c.keyMissing}
        </p>
      )}
      <details
        open={settingsOpen}
        onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
        className="rounded-2xl border bg-card p-4"
      >
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Settings2 className="size-4" />
          {f.settings}
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">{c.readonly}</p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const key = String(form.get('key') ?? '');
              if (secret.current) secret.current.value = '';
              run({
                action: 'save',
                appid: String(form.get('appid') ?? ''),
                key,
                approved: form.get('approved') === 'on',
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                {c.appid}
                <input
                  name="appid"
                  defaultValue={data.appid}
                  maxLength={200}
                  required
                  autoComplete="off"
                  className="mt-2 block w-full rounded-xl border bg-background p-3"
                />
              </label>
              <label className="text-sm font-medium">
                {c.key}
                <input
                  ref={secret}
                  name="key"
                  type="password"
                  maxLength={512}
                  autoComplete="new-password"
                  spellCheck={false}
                  className="mt-2 block w-full rounded-xl border bg-background p-3"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{c.keyHint}</p>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="approved"
                required
                className="mt-1"
              />
              <span>{c.privacy}</span>
            </label>
            <Button
              type="submit"
              disabled={pending || !data.keyReady}
              className="rounded-xl"
            >
              {pending ? c.pending : c.save}
            </Button>
          </form>
          <div className="flex flex-wrap gap-3 border-t pt-4">
            <Button
              variant="outline"
              disabled={pending || !data.appid || !data.keyReady}
              onClick={() => run({ action: 'test' })}
            >
              {c.test}
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/fleet-gps">{c.fleet}</Link>
            </Button>
            <Button
              variant="ghost"
              disabled={pending || !data.appid}
              onClick={() => setConfirm(true)}
            >
              {c.disconnect}
            </Button>
          </div>
          {confirm && (
            <div className="rounded-xl border border-destructive/30 p-3">
              <p className="text-sm">{c.disconnectConfirm}</p>
              <div className="mt-3 flex gap-3">
                <Button
                  disabled={pending}
                  onClick={() => run({ action: 'disconnect' })}
                >
                  {c.confirm}
                </Button>
                <Button variant="outline" onClick={() => setConfirm(false)}>
                  {c.cancel}
                </Button>
              </div>
            </div>
          )}
        </div>
      </details>
      <p
        role="status"
        aria-live="polite"
        className={`text-sm ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}`}
      >
        {pending ? c.pending : message}
      </p>
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            {c.devices} ({data.devices.length})
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {f.pendingHint}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={c.devices}>
          {(['pending', 'confirmed', 'all'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeFilter === key}
              onClick={() => setFilter(key)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${activeFilter === key ? (key === 'pending' ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200' : key === 'confirmed' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200' : 'border-foreground bg-muted') : 'bg-card text-muted-foreground'}`}
            >
              {key === 'pending'
                ? f.pending
                : key === 'confirmed'
                  ? f.confirmed
                  : f.all}{' '}
              (
              {key === 'pending'
                ? waiting.length
                : key === 'confirmed'
                  ? confirmed.length
                  : data.devices.length}
              )
            </button>
          ))}
        </div>
        {devices.map((d) => (
          <DeviceCard
            key={`${d.id}:${d.machineId}:${d.suggestedMachineId}`}
            device={d}
            machines={data.machines}
            lang={lang}
            pending={pending}
            run={run}
          />
        ))}
        {!devices.length && (
          <p className="rounded-2xl border p-6 text-sm text-muted-foreground">
            {!data.devices.length
              ? c.empty
              : filter === 'pending'
                ? f.noPending
                : f.noConfirmed}
          </p>
        )}
      </section>
    </div>
  );
}
