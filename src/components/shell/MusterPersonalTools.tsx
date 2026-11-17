import { logoutAdminAction } from '@/app/admin-login/actions';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpenCheck, Bot, LogOut, UsersRound } from 'lucide-react';
import { isMusterOperationsCompany } from '@/lib/demo/muster-operations';
import { kidrahtAvailable } from '@/lib/kidraht/company-link';
import { t } from '@/lib/i18n';
import { MusterLanguageCycle } from './MusterPreferences';
import s from './muster-header.module.css';

const KIDRAHT = 'KiDraht';

/** Own profile only. This grouping grants no application or assistant permission. */
export async function MusterPersonalTools({companyId,lang,admin,notifications}:{companyId:string|null;lang:string;admin:boolean;notifications:ReactNode}) {
  if (!isMusterOperationsCompany(companyId)) return null;
  return <div className={s.profileTools} data-testid="muster-profile-tools">
    {notifications}<MusterLanguageCycle/>
    {await kidrahtAvailable(companyId) && <Link className={s.entry} href="/workzone/kidraht"><BookOpenCheck size={17}/><span>{KIDRAHT}</span></Link>}
    <Link className={s.entry} href="/workzone/assistant"><Bot size={17}/>{t(admin?'admin.aiAssistantTitle':'workzone.aiHelperButton',lang)}</Link>
    <Link className={s.entry} href="/muster"><UsersRound size={17}/>{t('admin.publicDemo',lang)}</Link>
    {admin && <form action={logoutAdminAction}><button type="submit" className={s.entry}><LogOut size={17}/>{t('admin.logout',lang)}</button></form>}
  </div>;
}
