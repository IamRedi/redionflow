"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { runAssetOperationAction, getAssetSnapshotAction } from '@/app/(workzone)/workzone/asset-operations-actions';
import { MachineArt, machineKind } from '@/components/steel/machine-art';
import type { AssetCommand, AssetQuery, AssetSnapshot, AssetSummary } from '@/lib/company-assets/types';
import type { AssetCopy } from './copy';

export const assetButton = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50';
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
  return { run, pending, message, failed };
}

export function useAssetSnapshot(query: AssetQuery, c: AssetCopy) {
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
  return <label className="relative block min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" /><input type="search" value={value} onChange={event => onChange(event.target.value)} aria-label={label} placeholder={label} className={`${assetInput} pl-10`} /></label>;
}
export function AssetStatus({ value, c }: { value: string; c: AssetCopy }) {
  const label = c[value as keyof AssetCopy] || value;
  const tone = ['available','ready','completed','confirmed'].includes(value) ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : ['lost','retired','rejected','declined'].includes(value) ? 'bg-red-500/10 text-red-800 dark:text-red-300' : 'bg-orange-500/10 text-orange-800 dark:text-orange-300';
  return <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}
export function assetIdentity(asset: Pick<AssetSummary, 'code' | 'plate' | 'size'>) { return [asset.plate, asset.code, asset.size].filter(Boolean).join(' · '); }
export function assetTime(value: string, language: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
export function AssetPicture({ asset, className = 'h-full w-full' }: { asset: Pick<AssetSummary,'name'|'category'|'photoUrl'>; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (asset.photoUrl && failed !== asset.photoUrl) return <img src={asset.photoUrl} alt="" loading="lazy" onError={() => setFailed(asset.photoUrl)} className={`${className} object-cover`} />;
  if (asset.category === 'vehicle') return <MachineArt kind={machineKind({ name: asset.name })} animate={false} className={className} />;
  return <svg className={className} viewBox="0 0 240 150" aria-hidden="true" fill="none">
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
  </svg>;
}
