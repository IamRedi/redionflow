import Link from 'next/link';
import { BookOpenCheck, Bot, LogOut, Settings2, UserRound, UsersRound } from 'lucide-react';
import { logoutAdminAction } from '@/app/admin-login/actions';
import { logoutWorkerAction } from '@/app/(workzone)/workzone/hr-actions';
import { t } from '@/lib/i18n';
import { MusterPreferences } from './MusterPreferences';
import { MusterProfileMenu } from './MusterProfileMenu';
import { NotificationBell } from './NotificationBell';
import s from './muster-header.module.css';
const KIDRAHT = 'KiDraht';

/** Only explicit Muster callers render this header. Access remains server-enforced. */
export function MusterHeaderUtilities({ lang, name, admin, kidraht }: { lang: string; name: string; admin: boolean; kidraht: boolean }) {
  const profile = t('admin.profile', lang);
  return <div className={s.utilities} data-testid="muster-header-utilities">
    <MusterProfileMenu label={profile} name={name}>
      <Link className={s.entry} href={admin ? '/app/profile' : '/workzone/profile'}><UserRound size={17}/>{profile}</Link>
      <NotificationBell admin={admin} labelled/>
      <Link className={s.entry} href="/workzone/assistant"><Bot size={17}/>{t(admin ? 'admin.aiAssistantTitle' : 'workzone.aiHelperButton', lang)}</Link>
      {kidraht && <Link className={s.entry} href="/workzone/kidraht"><BookOpenCheck size={17}/>{KIDRAHT}</Link>}
      {admin && <Link className={s.entry} href="/app/settings"><Settings2 size={17}/>{t('admin.navSettings', lang)}</Link>}
      <Link className={s.entry} href="/muster"><UsersRound size={17}/>{t('admin.publicDemo', lang)}</Link>
      <form action={admin ? logoutAdminAction : logoutWorkerAction}><button type="submit" className={s.entry}><LogOut size={17}/>{t('admin.logout', lang)}</button></form>
    </MusterProfileMenu>
    <MusterPreferences/>
  </div>;
}
