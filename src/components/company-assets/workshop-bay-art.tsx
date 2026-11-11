import type { RepairPhase } from '@/lib/company-assets/types';

/** Decorative workshop bays, using the existing fleet's steel/orange SVG palette. */
export function WorkshopBayArt({ phase }: { phase: RepairPhase }) {
  return <svg data-studio-sketch viewBox="0 0 320 104" fill="none" aria-hidden="true" className="h-24 w-full">
    <path d="M22 36 160 8l138 28" stroke="currentColor" strokeWidth="5" className="text-slate-400 dark:text-slate-600"/>
    <path d="M32 98V36h256v62" fill="currentColor" className="text-slate-200 dark:text-slate-800"/>
    <path d="M53 98V48h214v50" fill="currentColor" className="text-slate-100 dark:text-slate-900"/>
    <path d="M53 49h214M53 54h214M53 59h214" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600"/>
    <path d="M15 99h290" stroke="currentColor" strokeWidth="4" className="text-slate-400 dark:text-slate-600"/>
    <rect x="126" y="25" width="68" height="5" rx="2" fill="currentColor" className="text-orange-500"/>
    {phase === 'reported' ? <>
      <path d="M132 69h46l12 17h-70z" fill="#f97316"/><path d="M138 72h25l8 8h-36z" fill="#1e293b"/>
      <circle cx="135" cy="88" r="6" fill="#475569"/><circle cx="176" cy="88" r="6" fill="#475569"/>
      <path d="m214 66 12 21h-24z" fill="#f97316"/><path d="M214 73v5m0 4v1" stroke="#0f172a" strokeWidth="2"/>
    </> : phase === 'received' ? <>
      <rect x="116" y="66" width="63" height="20" rx="4" fill="#f97316"/><rect x="125" y="70" width="23" height="10" rx="2" fill="#1e293b"/>
      <circle cx="130" cy="88" r="6" fill="#475569"/><circle cx="166" cy="88" r="6" fill="#475569"/>
      <rect x="207" y="66" width="18" height="25" rx="2" fill="#475569"/><path d="m211 77 4 4 7-9" stroke="#86efac" strokeWidth="2"/>
    </> : phase === 'repairing' ? <>
      <path d="M101 96V63m117 33V63M98 83h123" stroke="#c2410c" strokeWidth="5"/>
      <rect x="117" y="60" width="72" height="18" rx="4" fill="#f97316"/><path d="M130 63h23v10h-23z" fill="#1e293b"/>
      <circle cx="132" cy="79" r="5" fill="#475569"/><circle cx="176" cy="79" r="5" fill="#475569"/>
      <path d="m240 72-9 15m6-22a6 6 0 0 0 8 8l-3-4 1-4z" stroke="#94a3b8" strokeWidth="3"/>
    </> : <>
      <rect x="116" y="66" width="63" height="20" rx="4" fill="#f97316"/><rect x="125" y="70" width="23" height="10" rx="2" fill="#1e293b"/>
      <circle cx="130" cy="88" r="6" fill="#475569"/><circle cx="166" cy="88" r="6" fill="#475569"/>
      <circle cx="216" cy="76" r="13" fill="#166534"/><path d="m209 76 5 5 9-11" stroke="#bbf7d0" strokeWidth="3"/>
    </>}
  </svg>;
}
