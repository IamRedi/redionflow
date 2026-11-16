'use client';

import { addTransitionType, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import { cycleLanguage, type SupportedLanguage } from '@/lib/i18n/language';
import { t } from '@/lib/i18n';
import s from './muster-header.module.css';

const languageNames: Record<SupportedLanguage, string> = { de: 'Deutsch', en: 'English', sq: 'Shqip', it: 'Italiano', pl: 'Polski', ro: 'Română' };
const errors: Record<SupportedLanguage, string> = { de: 'Die Aktion konnte nicht abgeschlossen werden.', en: 'The action could not be completed.', sq: 'Veprimi nuk u përfundua.', it: 'Impossibile completare l’azione.', pl: 'Nie udało się wykonać działania.', ro: 'Acțiunea nu a putut fi finalizată.' };

/** Bundled flag artwork also renders on Windows, without emoji-font/network dependencies. */
function LanguageFlag({ lang }: { lang: SupportedLanguage }) {
  let art;
  switch (lang) {
    case 'de': art = <><path fill="#181818" d="M0 0h30v7H0z"/><path fill="#d6202e" d="M0 7h30v7H0z"/><path fill="#ffce00" d="M0 14h30v6H0z"/></>; break;
    case 'it': art = <><path fill="#009246" d="M0 0h10v20H0z"/><path fill="#fff" d="M10 0h10v20H10z"/><path fill="#ce2b37" d="M20 0h10v20H20z"/></>; break;
    case 'pl': art = <><path fill="#fff" d="M0 0h30v10H0z"/><path fill="#dc143c" d="M0 10h30v10H0z"/></>; break;
    case 'ro': art = <><path fill="#002b7f" d="M0 0h10v20H0z"/><path fill="#fcd116" d="M10 0h10v20H10z"/><path fill="#ce1126" d="M20 0h10v20H20z"/></>; break;
    case 'sq': art = <><path fill="#e41e20" d="M0 0h30v20H0z"/><path fill="#111" d="m15 7-2-3-3-1 1 2-2 1 3 1-1 2-5-5 1 4-2-1 2 4-2-1 2 3h5l-2 2-2-1 1 3 4-1 2 2 2-2 4 1 1-3-2 1-2-2h5l2-3-2 1 2-4-2 1 1-4-5 5-1-2 3-1-2-1 1-2-3 1z"/></>; break;
    case 'en': art = <><path fill="#123065" d="M0 0h30v20H0z"/><path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20"/><path stroke="#c8102e" strokeWidth="2" d="m0 0 30 20M30 0 0 20"/><path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30"/><path stroke="#c8102e" strokeWidth="4" d="M15 0v20M0 10h30"/></>; break;
  }
  return <svg viewBox="0 0 30 20" className={s.flag} aria-hidden="true">{art}</svg>;
}

/** Explicit Muster-only controls reuse existing cookies/provider and preserve open work. */
export function MusterPreferences() {
  const { currentLang, setLang } = useLanguage(), router = useRouter();
  const posting = useRef(false);
  const [pending, start] = useTransition(), [failed, setFailed] = useState(false);
  const next = cycleLanguage(currentLang);
  const label = `${t('workzone.language', currentLang)}: ${languageNames[currentLang]} → ${languageNames[next]}`;
  async function toggle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting.current || pending) return;
    posting.current = true; setFailed(false);
    start(async () => {
      try {
        const response = await fetch('/app/toggle-theme', { method: 'POST', credentials: 'same-origin', redirect: 'manual', cache: 'no-store' });
        if (response.type !== 'opaqueredirect' && !response.ok) throw new Error('theme');
        start(() => { addTransitionType('baum-theme'); router.refresh(); });
      } catch { setFailed(true); start(() => router.refresh()); }
      finally { posting.current = false; }
    });
  }
  return <>
    <form action="/app/toggle-theme" method="post" onSubmit={toggle} className={s.theme}>
      <button type="submit" className={s.icon} aria-label={t('admin.themeToggle', currentLang)} title={t('admin.themeToggle', currentLang)} disabled={pending} aria-busy={pending} data-testid="muster-theme-toggle"><Sun size={18} className="hidden dark:block" aria-hidden="true"/><Moon size={18} className="dark:hidden" aria-hidden="true"/></button>
      {failed && <span role="alert" className={s.error}>{errors[currentLang]}</span>}
    </form>
    <button type="button" className={s.icon} aria-label={label} title={label} onClick={() => setLang(next)} data-testid="muster-language-cycle" data-language={currentLang}><LanguageFlag lang={currentLang}/></button>
  </>;
}
