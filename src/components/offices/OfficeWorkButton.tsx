'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Check, Loader2 } from 'lucide-react';
import { startOfficeWorkAction } from '@/lib/offices/presence-actions';
import s from './studio.module.css';

export function OfficeWorkButton({ active, profile, sq }: { active: boolean; profile: string | null; sq: boolean }) {
  const router = useRouter(), [pending, start] = useTransition(), [error, setError] = useState('');
  const label = active ? (sq ? 'Në zyrë' : 'In the office') : (sq ? 'Puno në zyrë' : 'Work in office');
  return <div className={s.officeWork}>
    {active && profile ? <Link data-testid="office-work-button" className={s.workButton} data-active="true" href={profile} title={sq ? 'Hap profilin · Nis / Ndalo' : 'Open profile · Start / Stop'}><Check size={16}/>{label}</Link> :
      <button data-testid="office-work-button" className={s.workButton} type="button" disabled={pending} aria-busy={pending} onClick={() => {
        setError('');
        start(async () => {
          try {
            const result = await startOfficeWorkAction();
            if (result.ok) router.refresh();
            else setError(result.error === 'NOT_FOUND' ? (sq ? 'Llogaria nuk ka profil pune të lidhur.' : 'No linked work profile.') : (sq ? 'Puna nuk u nis. Kontrollo disponueshmërinë dhe provo përsëri.' : 'Work was not started. Check availability and try again.'));
          } catch { setError(sq ? 'Nuk u lidh. Provo përsëri.' : 'Connection failed. Try again.'); }
        });
      }}>{pending ? <Loader2 size={16} className="animate-spin"/> : <Building2 size={16}/>}<span>{label}</span></button>}
    {error && <p role="alert" className={s.workError}>{error}</p>}
  </div>;
}
