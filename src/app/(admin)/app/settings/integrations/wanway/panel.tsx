'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { readPanel } from '@/lib/fleet/wanway/service';
import type { Language } from '@/lib/i18n';
import { wanwayCopy, wanwayError } from '@/lib/fleet/wanway/copy';
import { wanwayAction } from './actions';
import { Button } from '@/components/ui/button';

export function WanwayPanel({
  data,
  lang,
}: {
  data: Awaited<ReturnType<typeof readPanel>>;
  lang: Language;
}) {
  const c = wanwayCopy(lang);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const secret = useRef<HTMLInputElement>(null);
  const router = useRouter();
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
          router.refresh();
        }
      } catch {
        setOk(false);
        setMessage(c.failed);
      }
    });
  }
  const date = (s: string | null) =>
    s ? new Date(s).toLocaleString(lang) : '—';
  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5 text-sm">
        <p>{c.readonly}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{c.status}</dt>
            <dd className="font-semibold">
              {c[
                data.status as
                  | 'configured'
                  | 'disconnected'
                  | 'connected'
                  | 'error'
              ] ?? data.status}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{c.lastSync}</dt>
            <dd>{date(data.lastSuccessfulSync)}</dd>
          </div>
        </dl>
        {data.lastError && (
          <p className="mt-3 text-destructive">
            {c.lastError}: {wanwayError(data.lastError, lang)}
          </p>
        )}
      </div>
      {!data.keyReady && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500 p-4 text-sm"
        >
          {c.keyMissing}
        </p>
      )}
      <form
        className="space-y-4 rounded-xl border bg-card p-5"
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
        <label className="block space-y-2 text-sm font-medium">
          {c.appid}
          <input
            name="appid"
            defaultValue={data.appid}
            maxLength={200}
            required
            autoComplete="off"
            className="block w-full rounded-md border bg-background p-3"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          {c.key}
          <input
            ref={secret}
            name="key"
            type="password"
            maxLength={512}
            autoComplete="new-password"
            spellCheck={false}
            className="block w-full rounded-md border bg-background p-3"
          />
        </label>
        <p className="text-xs text-muted-foreground">{c.keyHint}</p>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="approved" required className="mt-1" />
          <span>{c.privacy}</span>
        </label>
        <Button type="submit" disabled={pending || !data.keyReady}>
          {pending ? c.pending : c.save}
        </Button>
      </form>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={pending || !data.appid || !data.keyReady}
          onClick={() => run({ action: 'test' })}
        >
          {c.test}
        </Button>
        <Button
          variant="outline"
          disabled={pending || !data.appid || !data.keyReady}
          onClick={() => run({ action: 'sync' })}
        >
          {c.sync}
        </Button>
        <Button
          variant="outline"
          disabled={pending || !data.appid}
          onClick={() => setConfirm(true)}
        >
          {c.disconnect}
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/fleet-gps">{c.fleet}</Link>
        </Button>
      </div>
      {confirm && (
        <div className="space-y-3 rounded-lg border p-4">
          <p>{c.disconnectConfirm}</p>
          <div className="flex gap-3">
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
      <p
        role="status"
        aria-live="polite"
        className={`text-sm ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
      >
        {pending ? c.pending : message}
      </p>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {c.devices} ({data.devices.length})
        </h2>
        {data.devices.length === 0 && (
          <p className="rounded-lg border p-5 text-sm text-muted-foreground">
            {c.empty}
          </p>
        )}
        {data.devices.map((d) => (
          <form
            key={`${d.id}:${d.machineId}:${d.suggestedMachineId}`}
            className="space-y-3 rounded-xl border bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get('machineId');
              run({
                action: 'link',
                id: d.id,
                machineId: value ? String(value) : null,
              });
            }}
          >
            <div>
              <h3 className="font-medium">{d.name}</h3>
              <p className="text-xs text-muted-foreground">
                {d.model} · {c.suffix} ••••{d.suffix}
              </p>
              {!d.available && (
                <p className="text-sm text-amber-600">{c.unavailable}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="min-w-0 flex-1 text-xs text-muted-foreground">
                {c.vehicle}
                <select
                  name="machineId"
                  defaultValue={d.machineId ?? d.suggestedMachineId ?? ''}
                  aria-describedby={!d.machineId && d.suggestedMachineId ? `suggestion-${d.id}` : undefined}
                  disabled={pending || !d.available}
                  className="mt-1 block w-full rounded-md border bg-background p-3 text-sm text-foreground"
                >
                  <option value="">{c.unlink}</option>
                  {data.machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.targe ? `${m.targe} · ` : ''}
                      {m.name}
                    </option>
                  ))}
                </select>
                {!d.machineId && d.suggestedMachineId && (
                  <span id={`suggestion-${d.id}`} className="mt-2 block text-xs text-muted-foreground">
                    {c.suggested}
                  </span>
                )}
              </label>
              <Button
                type="submit"
                variant="outline"
                className="self-end"
                disabled={pending || !d.available}
              >
                {c.link}
              </Button>
            </div>
          </form>
        ))}
      </section>
    </div>
  );
}
