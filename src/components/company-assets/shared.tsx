"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search,Shirt,Package,Wrench } from 'lucide-react';
import { runAssetOperationAction, getAssetSnapshotAction } from '@/app/(workzone)/workzone/asset-operations-actions';
import { getMachineOperationalStatusAction } from '@/app/(workzone)/workzone/asset-status-actions';
import { MachineArt, machineKind } from '@/components/steel/machine-art';
import type { AssetCommand, AssetOperationalStatus, AssetQuery, AssetSnapshot, AssetSummary } from '@/lib/company-assets/types';
import { operationalStatusLabels, unknownAssetStatus, type OperationalStatusKey } from '@/lib/company-assets/status';
import type { AssetCopy } from './copy';
import { visibleAssetCode } from '@/lib/company-assets/identity';
import { AssetThumbnail } from '@/components/asset-thumbnail';
import type { PhotoShape } from '@/lib/asset-photos/rendition';

export const assetButton = 'steelStudioAssetButton inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50';
export const assetPrimary = `${assetButton} border-orange-700 bg-orange-700 text-white hover:bg-orange-800 dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950 dark:hover:bg-orange-400`;
export const assetInput = 'min-h-11 w-full min-w-0 rounded-xl border bg-card px-3 py-2 text-base outline-none focus:border-orange-500 focus-visible:ring-1 focus-visible:ring-orange-500 disabled:opacity-50';

/** A retry retains the same UUID only while its command payload is unchanged. */
export function useAssetMutation(c: AssetCopy, after: () => Promise<unknown>) {
  const router = useRouter();
  const guard = useRef(false);
  const receipt = useRef<{ signature: string; requestId: string } | null>(null);
  const alive = useRef(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function run(command: AssetCommand) {
    if (guard.current) return false;
    guard.current = true; setPending(true); setMessage(null); setFailed(false);
    const signature = JSON.stringify(command);
    if (receipt.current?.signature !== signature) receipt.current = { signature, requestId: crypto.randomUUID() };
    try {
      const result = await runAssetOperationAction({ requestId: receipt.current.requestId, command });
      if (!result.ok) { if (alive.current) { setMessage(result.message || c.saveError); setFailed(true); } return false; }
      receipt.current = null;
      if (alive.current) {
        setResult(result.data);
        setMessage(c.saved);
        try { await after(); } catch { setMessage(c.refreshError); setFailed(true); }
        router.refresh();
      }
      return true;
    } catch {
      if (alive.current) { setMessage(c.saveError); setFailed(true); }
      return false;
    } finally {
      guard.current = false;
      if (alive.current) setPending(false);
    }
  }
  return { run, pending, message, failed, result };
}

export function useAssetSnapshot(query: AssetQuery, c: AssetCopy, refreshInterval = 0) {
  const queryKey = JSON.stringify(query);
  const [loaded, setLoaded] = useState<{ key: string; snapshot: AssetSnapshot } | null>(null);
  const [request, setRequest] = useState<{ key: string; loading: boolean; error: string | null }>({key:queryKey,loading:true,error:null});
  const epoch = useRef(0);
  const invalidate = useCallback(() => { epoch.current++; }, []);
  const load = useCallback(async () => {
    const own = ++epoch.current;
    setRequest({key:queryKey,loading:true,error:null});
    try {
      const result = await getAssetSnapshotAction(JSON.parse(queryKey) as AssetQuery);
      if (own !== epoch.current) return;
      if (!result.ok) { setLoaded(null); setRequest({key:queryKey,loading:false,error:result.message || c.loadError}); return; }
      setLoaded({key:queryKey,snapshot:result.data});
      setRequest({key:queryKey,loading:false,error:null});
    } catch { if (own === epoch.current) { setLoaded(null); setRequest({key:queryKey,loading:false,error:c.loadError}); } }
  }, [queryKey, c.loadError]);
  useEffect(() => {
    let current = true;
    queueMicrotask(() => { if (current) void load(); });
    return () => { current = false; invalidate(); };
  }, [load, invalidate]);
  useEffect(() => {
    let last = 0;
    const refresh = () => { const now = Date.now(); if (document.visibilityState === 'hidden' || now - last < 1000) return; last = now; void load(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    const timer=refreshInterval>0?setInterval(refresh,refreshInterval):null;
    return () => { if(timer)clearInterval(timer);window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load,refreshInterval]);
  // Refresh the same query in place; a new query can never expose an older result.
  const snapshot=loaded?.key===queryKey?loaded.snapshot:null;
  const loading=request.key!==queryKey||request.loading;
  const error=request.key===queryKey?request.error:null;
  return { snapshot, loading, error, reload: load };
}

export function AssetFeedback({ message, failed }: { message: string | null; failed?: boolean }) {
  return message ? <p role={failed ? 'alert' : 'status'} className={failed ? 'rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300' : 'text-sm text-emerald-700 dark:text-emerald-300'}>{message}</p> : null;
}
export function AssetLoading({ label }: { label: string }) { return <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 size={18} className="animate-spin" />{label}</p>; }
export function AssetField({ label, children }: { label: string; children: ReactNode }) { return <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">{label}{children}</label>; }
export function AssetSearch({ value, onChange, label }: { value: string; onChange: (s: string) => void; label: string }) {
  return <label className="relative block min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" /><input data-studio-input type="search" value={value} onChange={event => onChange(event.target.value)} aria-label={label} placeholder={label} className={`${assetInput} pl-10`} /></label>;
}
export function AssetStatus({ value, c }: { value: string; c: AssetCopy }) {
  const label = c[value as keyof AssetCopy] || value;
  const tone = ['available','ready','completed','confirmed'].includes(value) ? 'bg-green-500/10 text-green-800 dark:text-green-300' : ['lost','retired','rejected','declined'].includes(value) ? 'bg-red-500/10 text-red-800 dark:text-red-300' : 'bg-orange-500/10 text-orange-800 dark:text-orange-300';
  return <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}
export function AssetOperationalStatusBadge({ status, c, compact = false, className = '' }: { status: AssetOperationalStatus | null | undefined; c: AssetCopy; compact?: boolean; className?: string }) {
  const { primary, secondary, location } = operationalStatusLabels(status);
  const label = (key: OperationalStatusKey) => key === 'unknown' ? c.statusUnknown : key === 'available' ? (compact ? c.statusAvailableShort : c.statusAvailable) : key === 'reported' ? c.statusReported : key === 'received' ? (compact ? c.statusReceivedShort : c.received) : key === 'workshop' ? c.statusWorkshop : key === 'handover' ? c.statusHandover : c[key as keyof AssetCopy];
  const tone = primary === 'unknown' || primary === 'inactive' ? 'bg-muted text-muted-foreground' : ['available','issued'].includes(primary) ? 'bg-green-500/10 text-green-800 dark:text-green-300' : ['lost','retired','loss_pending','retirement_pending'].includes(primary) ? 'bg-red-500/10 text-red-800 dark:text-red-300' : 'bg-orange-500/10 text-orange-800 dark:text-orange-300';
  return <span data-testid="asset-operational-status" data-status-key={primary} data-phase={status?.activeRepairPhase ?? ''} data-availability={status?.availability ?? ''} className={`inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold leading-snug ${tone} ${className}`}>
    <span className="min-w-0 break-words">{label(primary)}</span>
    {secondary ? <span className="min-w-0 break-words">· {label(secondary)}</span> : null}
    {location ? <span className="min-w-0 break-words">· {c[location]}</span> : null}
  </span>;
}

/** One exact-ID batch per visible scope. An older request can never restore stale availability. */
export function useMachineOperationalStatuses(machines: { id: string; operationalStatus?: AssetOperationalStatus | null }[], enabled: boolean) {
  const key = JSON.stringify([...new Set(machines.map(machine => machine.id))].sort());
  // A new SSR snapshot invalidates the client batch without comparing server and browser clocks.
  const seedKey = JSON.stringify(machines.map(machine => [machine.id, machine.operationalStatus]).sort(([a], [b]) => String(a).localeCompare(String(b))));
  const scopeKey = `${key}:${seedKey}`;
  const initial = new Map(machines.map(machine => [machine.id, machine.operationalStatus]));
  const [loaded, setLoaded] = useState<{ key: string; values: Map<string, AssetOperationalStatus> } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const epoch = useRef(0);
  const invalidate = useCallback(() => { epoch.current++; }, []);
  const unknown = useMemo(() => unknownAssetStatus(''), []);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const own = ++epoch.current;
    setLoadingKey(scopeKey);
    let values = new Map<string, AssetOperationalStatus>();
    try {
      const ids = JSON.parse(key) as string[];
      if (ids.length <= 500) {
        const result = await getMachineOperationalStatusAction(ids);
        if (result.ok) values = new Map(result.data.map(row => [row.id, row.status]));
      }
    } catch { /* Unknown is safer than a stale available badge. */ }
    if (own !== epoch.current) return;
    setLoaded({ key: scopeKey, values }); setLoadingKey(null);
  }, [key, scopeKey, enabled]);
  useEffect(() => {
    let current = true;
    queueMicrotask(() => { if (current) void reload(); });
    return () => { current = false; invalidate(); };
  }, [reload, invalidate]);
  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    const refresh = () => { const now = Date.now(); if (document.visibilityState === 'hidden' || now - last < 1000) return; last = now; void reload(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [enabled, reload]);
  function statusFor(id: string): AssetOperationalStatus {
    if (loadingKey === scopeKey) return unknown;
    const seed = initial.get(id);
    if (loaded?.key === scopeKey) return loaded.values.get(id) ?? unknown;
    return seed ?? unknown;
  }
  return { statusFor, reload };
}
export function assetIdentity(asset: Pick<AssetSummary, 'code' | 'plate' | 'size'> & Partial<Pick<AssetSummary,'category'>>) { return [asset.plate, visibleAssetCode(asset), asset.size].filter(Boolean).join(' · '); }
export function assetTime(value: string, language: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
export function AssetPicture({ asset, className = 'h-full w-full', sizes = '100vw', shape = 'square' }: { asset: Pick<AssetSummary,'name'|'category'|'photoUrl'>; className?: string; sizes?: string; shape?: PhotoShape }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (asset.photoUrl && failed !== asset.photoUrl) return <AssetThumbnail src={asset.photoUrl} sizes={sizes} shape={shape} alt="" onError={() => setFailed(asset.photoUrl)} className={`${className} object-cover`} />;
  if (asset.category === 'vehicle') return <MachineArt kind={machineKind({ name: asset.name })} animate={false} className={className} />;
  const Icon=asset.category==='clothing'?Shirt:asset.category==='tool'?Wrench:Package;
  return <><span data-studio-machine-icon aria-hidden="true" className={className} style={{display:'none'}}><Icon/></span><svg data-studio-sketch className={className} viewBox="0 0 240 150" aria-hidden="true" fill="none">
    <path d="M25 128H215" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
    {asset.category === 'clothing' ? <>
      <path d="M84 25 101 17C103 37 137 37 139 17L156 25 176 108 149 121H91L64 108Z" fill="#f97316" />
      <path d="M104 23V120M137 23V120M75 79H164M69 100H170" stroke="#e2e8f0" strokeWidth="9" />
      <path d="M120 39V124" stroke="#1e293b" strokeWidth="4" />
    </> : asset.category === 'equipment' ? <>
      <path d="M58 45V125M182 45V125" stroke="#475569" strokeWidth="10" />
      <path d="M44 50H196V89H44Z" fill="#f97316" />
      <path d="M63 50 84 89M111 50 132 89M159 50 180 89" stroke="#f8fafc" strokeWidth="15" />
      <path d="M43 125H76M165 125H198" stroke="#94a3b8" strokeWidth="7" />
    </> : <>
      <path d="M51 42H155V77H51Z" fill="#f97316" />
      <path d="M142 42H175V76H142Z" fill="#475569" /><path d="M174 54H213" stroke="#94a3b8" strokeWidth="9" />
      <path d="M88 77H126L119 112H94Z" fill="#334155" /><path d="M80 110H137V128H80Z" fill="#f97316" />
      <path d="M57 50H82M57 61H82" stroke="#c2410c" strokeWidth="4" />
    </>}
  </svg></>;
}
