'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, CheckCheck, Send, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/i18n/language-provider';
import { t } from '@/lib/i18n';
import { enableAndTestNotifications, iphoneNeedsInstall, testBrowserNotification } from '@/lib/notifications/notification-client';

export function NotificationBell({ admin = false, className = '' }: { admin?: boolean; className?: string }) {
  const { currentLang: lang } = useLanguage();
  const [open, setOpen] = useState(false), [message, setMessage] = useState<string | null>(null), [iphone, setIphone] = useState(false);
  const [busy, start] = useTransition();
  // The device button must call the permission prompt straight from the tap (iPhone), so no await before it.
  const run = (team = false) => { setMessage(null); const pending = team ? testBrowserNotification(true) : enableAndTestNotifications(); start(async () => { setMessage((await pending).message); }); };
  return <Dialog.Root open={open} onOpenChange={value => { setOpen(value); if (value) setIphone(iphoneNeedsInstall()); }}>
    <Dialog.Trigger asChild><Button type="button" variant="outline" size="icon" data-testid="notification-bell" aria-label={t('workzone.notificationTitle', lang)} title={t('workzone.notificationTitle', lang)} className={`size-[44px] rounded-full bg-transparent text-foreground/80 shadow-none hover:bg-muted hover:text-foreground ${className}`}><Bell className="size-4" /></Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/45" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[1201] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-4 text-foreground shadow-xl" data-testid="notification-dialog">
      <div className="flex items-center justify-between gap-3"><Dialog.Title className="flex items-center gap-2 text-base font-semibold"><Bell className="size-4 text-orange-600 dark:text-orange-400" />{t('workzone.notificationTitle', lang)}</Dialog.Title><Dialog.Close asChild><Button size="icon" variant="ghost" className="size-11 shrink-0" aria-label={t('common.close', lang)}><X className="size-4" /></Button></Dialog.Close></div>
      <Dialog.Description className="mt-1 text-sm text-muted-foreground">{t('workzone.notificationHint', lang)}</Dialog.Description>
      {iphone ? <p className="mt-3 rounded-lg bg-muted p-2.5 text-xs">{t('workzone.notificationIphone', lang)}</p> : null}
      <div className="mt-4 grid gap-2"><Button className="min-h-11 justify-start gap-2 bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:text-slate-950" disabled={busy} onClick={() => run()} data-testid="notification-enable-test"><CheckCheck className="size-4" />{t('workzone.notificationEnableTest', lang)}</Button>{admin ? <Button variant="outline" className="min-h-11 justify-start gap-2" disabled={busy} onClick={() => run(true)} data-testid="notification-test-all"><Send className="size-4" />{t('workzone.notificationTestTeam', lang)}</Button> : null}</div>
      {message ? <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
