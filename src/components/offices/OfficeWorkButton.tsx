'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Loader2, Square } from 'lucide-react';
import { startOfficeWorkAction, stopOfficeWorkAction } from '@/lib/offices/presence-actions';
import s from './studio.module.css';

export function OfficeWorkButton({ active, sessionId, paused, sq }: { active: boolean; sessionId: string | null; paused: boolean; sq: boolean }) {
  const router = useRouter(), [pending, start] = useTransition(), [error, setError] = useState('');
  const label = sq ? 'Puno në zyrë' : 'Work in office';
  return <div className={s.officeWork}>
      <button data-testid="office-work-button" className={s.workButton} data-active={active?'true':undefined} type="button" disabled={pending} aria-busy={pending} aria-label={active?(sq?'Ndalo punën në zyrë':'Stop office work'):label} onClick={() => {
        setError('');
        start(async () => {
          try {
            const result = active ? await stopOfficeWorkAction(sessionId) : await startOfficeWorkAction();
            if (result.ok) router.refresh();
            else { router.refresh(); setError(result.error === 'NOT_FOUND' ? (sq ? 'Llogaria nuk ka profil pune të lidhur.' : 'No linked work profile.') : active ? (sq?'Puna nuk u ndal. Rifresko dhe provo përsëri.':'Work was not stopped. Refresh and try again.') : (sq ? 'Puna nuk u nis. Kontrollo disponueshmërinë dhe provo përsëri.' : 'Work was not started. Check availability and try again.')); }
          } catch { setError(sq ? 'Nuk u lidh. Provo përsëri.' : 'Connection failed. Try again.'); }
        });
      }}>{pending ? <Loader2 size={16} className="animate-spin"/> : active ? <span className={s.workActiveLabel}><small><Check size={11}/>{paused?(sq?'Në pauzë':'Paused'):(sq?'Në zyrë':'In the office')}</small><strong><Square size={10}/>{sq?'Ndalo':'Stop'}</strong></span> : <><Building2 size={16}/><span>{label}</span></>}</button>
    {error && <p role="alert" className={s.workError}>{error}</p>}
  </div>;
}
