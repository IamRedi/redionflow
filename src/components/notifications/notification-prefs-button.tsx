'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { BellRing, CalendarDays, CheckCheck, LogIn, LogOut, MessageSquare, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useLanguage } from '@/components/i18n/language-provider';
import { Button } from '@/components/ui/button';
import { saveNotificationPreferenceAction } from '@/app/(workzone)/workzone/hr-actions';
import { enableAndTestNotifications } from '@/lib/notifications/notification-client';
import type { NotificationPreference, NotificationSettingsRow } from '@/lib/notifications/notification-store';

const LANGS = ['sq', 'en', 'de', 'it', 'pl', 'ro'] as const;
const words = {
  title: ['Njoftimet', 'Notifications', 'Benachrichtigungen', 'Notifiche', 'Powiadomienia', 'Notificări'],
  hint: ['Zgjidh çfarë njoftimesh merr në këtë pajisje.', 'Choose which notices you get on your devices.', 'Wähle, welche Hinweise du bekommst.', 'Scegli quali avvisi ricevere.', 'Wybierz, które powiadomienia otrzymujesz.', 'Alege ce notificări primești.'],
  enable: ['Aktivizo dhe provo pajisjen time', 'Enable and test my device', 'Gerät aktivieren und testen', 'Attiva e prova il mio dispositivo', 'Włącz i przetestuj moje urządzenie', 'Activează și testează dispozitivul'],
  tagesplan: ['Plani ditor', 'Daily plan', 'Tagesplan', 'Piano giornaliero', 'Plan dnia', 'Planul zilei'],
  tagesplanHint: ['Kur ndryshon plani yt', 'When your plan changes', 'Wenn sich dein Plan ändert', 'Quando cambia il tuo piano', 'Gdy zmienia się twój plan', 'Când se schimbă planul'],
  workStart: ['Filloi punën', 'Started work', 'Arbeit begonnen', 'Ha iniziato', 'Rozpoczął pracę', 'A început lucrul'],
  workStartHint: ['Kur një punëtor fillon ditën', 'When a worker starts the day', 'Wenn jemand den Tag beginnt', 'Quando un operaio inizia', 'Gdy pracownik zaczyna dzień', 'Când un muncitor începe ziua'],
  workEnd: ['Mbaroi punën', 'Finished work', 'Arbeit beendet', 'Ha finito', 'Zakończył pracę', 'A terminat lucrul'],
  workEndHint: ['Kur një punëtor mbyll ditën', 'When a worker ends the day', 'Wenn jemand den Tag beendet', 'Quando un operaio finisce', 'Gdy pracownik kończy dzień', 'Când un muncitor termină ziua'],
  adminMessages: ['Mesazhe nga zyra', 'Office messages', 'Nachrichten vom Büro', 'Messaggi dall’ufficio', 'Wiadomości z biura', 'Mesaje de la birou'],
  adminMessagesHint: ['Njoftime dhe kërkesa', 'Notices and requests', 'Hinweise und Anfragen', 'Avvisi e richieste', 'Ogłoszenia i prośby', 'Anunțuri și cereri'],
  bossOnly: ['Këtë e ndez shefi', 'The boss switches this on', 'Schaltet der Chef ein', 'Lo attiva il capo', 'Włącza szef', 'O activează șeful'],
  saved: ['U ruajt', 'Saved', 'Gespeichert', 'Salvato', 'Zapisano', 'Salvat'],
  failed: ['Nuk u ruajt, provo prapë', 'Not saved, try again', 'Nicht gespeichert', 'Non salvato, riprova', 'Nie zapisano, spróbuj ponownie', 'Nu s-a salvat'],
  close: ['Mbyll', 'Close', 'Schließen', 'Chiudi', 'Zamknij', 'Închide'],
} as const;
type Copy = { [K in keyof typeof words]: string };
const copy = (lang: string): Copy => {
  const index = Math.max(0, LANGS.indexOf(lang.toLowerCase() as (typeof LANGS)[number]));
  return Object.fromEntries(Object.entries(words).map(([key, values]) => [key, values[index] ?? values[1]])) as Copy;
};

const ROWS: Array<{ key: NotificationPreference; icon: typeof BellRing; work?: boolean }> = [
  { key: 'workStart', icon: LogIn, work: true },
  { key: 'workEnd', icon: LogOut, work: true },
  { key: 'tagesplan', icon: CalendarDays },
  { key: 'adminMessages', icon: MessageSquare },
];

/**
 * Bell button on a profile: opens a small card with one switch per notice.
 * Each switch saves at once. Work start/end are opt-in and only an admin can
 * switch them on (canEnableWork); everyone else sees them only when already on.
 */
export function NotificationPrefsButton({ userId, initial, canEnableWork, self = true, className = '' }: { userId: string; initial: NotificationSettingsRow; canEnableWork: boolean; self?: boolean; className?: string }) {
  const { currentLang } = useLanguage();
  const c = copy(currentLang);
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const anyOn = settings.workStart || settings.workEnd;
  const rows = ROWS.filter(row => !row.work || canEnableWork || settings[row.key]);

  const toggle = (key: NotificationPreference) => {
    const value = !settings[key];
    setSettings(prev => ({ ...prev, [key]: value }));
    setMessage(null);
    start(async () => {
      const result = await saveNotificationPreferenceAction({ userId, key, value });
      if (result.ok && result.settings) { setSettings(result.settings); setMessage(c.saved); }
      else { setSettings(prev => ({ ...prev, [key]: !value })); setMessage(c.failed); }
    });
  };
  // Permission prompt must come straight from the tap (iPhone).
  const enable = () => { setMessage(null); const pending = enableAndTestNotifications(); start(async () => setMessage((await pending).message)); };

  return <Dialog.Root>
    <Dialog.Trigger asChild>
      <button type="button" data-testid="notification-prefs" title={c.title} aria-label={c.title} className={`relative grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-orange-500/10 hover:text-orange-600 ${className}`}>
        <BellRing className="size-4" />
        {anyOn ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-orange-500 ring-2 ring-card" /> : null}
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/45 backdrop-blur-[2px]" />
      <Dialog.Content data-testid="notification-prefs-card" className="fixed inset-x-3 bottom-3 z-[1201] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border bg-card p-4 text-foreground shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[22rem] sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400"><BellRing className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <Dialog.Title className="text-base font-semibold leading-tight">{c.title}</Dialog.Title>
            <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">{c.hint}</Dialog.Description>
          </div>
          <Dialog.Close asChild><button type="button" aria-label={c.close} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /></button></Dialog.Close>
        </div>
        <ul className="mt-3 divide-y rounded-2xl border bg-muted/20">
          {rows.map(({ key, icon: Icon, work }) => {
            const on = settings[key];
            const locked = Boolean(work) && !canEnableWork && !on;
            return <li key={key}>
              <button type="button" role="switch" aria-checked={on} disabled={busy || locked} onClick={() => toggle(key)} data-testid={`notification-pref-${key}`}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/50 disabled:cursor-not-allowed">
                <Icon className={`size-4 shrink-0 ${on ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c[key]}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{work && !canEnableWork ? c.bossOnly : c[`${key}Hint` as keyof Copy]}</span>
                </span>
                <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? 'bg-orange-500' : 'bg-muted-foreground/25'}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.125rem]' : 'left-0.5'}`} />
                </span>
              </button>
            </li>;
          })}
        </ul>
        {self ? <Button type="button" disabled={busy} onClick={enable} data-testid="notification-prefs-enable" className="mt-3 min-h-11 w-full justify-center gap-2 rounded-2xl bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:text-slate-950"><CheckCheck className="size-4" />{c.enable}</Button> : null}
        {message ? <p role="status" className="mt-2 text-center text-xs text-muted-foreground">{message}</p> : null}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
