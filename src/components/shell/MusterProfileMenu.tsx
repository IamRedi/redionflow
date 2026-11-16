'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';
import s from './muster-header.module.css';

/** Native disclosure: one personal entry, no nested menu roles around forms/dialog triggers. */
export function MusterProfileMenu({ label, name, children, badge }: { label: string; name: string; children: ReactNode; badge?: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null), path = usePathname();
  useEffect(() => {
    const close = () => { if (ref.current) ref.current.open = false; };
    // Child notification dialogs render in a portal. Keep their trigger visible
    // so the existing dialog can restore focus when it closes.
    const dialogOpen = () => Boolean(document.querySelector('[role="dialog"]'));
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !dialogOpen()) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && ref.current?.open && !dialogOpen()) { close(); ref.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    close();
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [path]);
  return <details ref={ref} className={s.profile} data-testid="muster-profile" data-demo-profile>
    <summary className={s.icon} aria-label={`${label} · ${name}`} title={`${label} · ${name}`}><UserRound size={18} aria-hidden="true"/>{badge}</summary>
    <div className={s.panel} data-muster-profile-panel><strong className={s.name}>{name}</strong>{children}</div>
  </details>;
}
