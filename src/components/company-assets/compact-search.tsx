'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { assetButton, AssetSearch } from './shared';

/** A quiet search control; opening, clearing and focus never alter server data. */
export function CompactAssetSearch({ value, onChange, label, closeLabel }: { value: string; onChange: (value: string) => void; label: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const group = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => group.current?.querySelector('input')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const close = () => { onChange(''); setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  return <div ref={group} data-muster-search className="flex min-w-0 max-w-full items-center gap-2" onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); close(); } }}>
    {open ? <><AssetSearch value={value} onChange={onChange} label={label} /><button type="button" className={`${assetButton} shrink-0 rounded-full px-0`} onClick={close} aria-label={closeLabel}><X size={18} /></button></> : <button ref={trigger} type="button" className={`${assetButton} rounded-full px-0`} onClick={() => setOpen(true)} aria-label={label} title={label}><Search size={18} /></button>}
  </div>;
}
