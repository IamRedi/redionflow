import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, FolderOpen, LayoutDashboard, LockKeyhole, UserRound, Mail, ListTodo, BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SupportedLanguage } from '@/lib/i18n/language';
import { officeCopy } from '@/lib/offices/copy';
import { officeWorkCopy } from '@/lib/offices/work-copy';
import styles from './office.module.css';
import { OfficeMailNotice } from './OfficeMailNotice';

type Props = { room: 'reception' | 'megi'; lang: SupportedLanguage; companyName: string; ownDesk: boolean; admin: boolean; assistant?: ReactNode; workEnabled?:boolean; ownName?:string; unread?:number;visitorId?:string;officeTitle?:string;workbooksEnabled?:boolean;planEnabled?:boolean };

/** Pure presentation: receives no colleague records, mail, tasks or personal data. */
export function OfficeSpace({ room, lang, companyName, ownDesk, admin, assistant,workEnabled=false,ownName,unread=0,visitorId,officeTitle,workbooksEnabled=false,planEnabled=true }: Props) {
  const c = officeCopy(lang);
  const w = officeWorkCopy(lang);
  const occupantName = ownName||'Megi';
  const roomTitle=ownName?(ownDesk?w.desk:`${lang==='sq'?'Zyra':'Office'} · ${occupantName}`):c.megi;
  const roleTitle=officeTitle||c.administration;
  const reception = room === 'reception';
  const tools = reception || ownDesk;
  const origin=reception||!workEnabled?'reception':'desk';
  const links = [
    { href: '/workzone/offices/me/mail', text: `${w.mail}${unread?` · ${unread}`:''}`, Icon: Mail, visible: workEnabled },
    { href: '/workzone/offices/me/tasks', text: w.tasks, Icon: ListTodo, visible: workEnabled },
    { href: `/workzone/plan?office=${origin}`, text: c.plan, Icon: CalendarDays, visible: admin },
    { href: admin ? '/app/baustellen' : '/workzone', text: c.documents, Icon: FolderOpen, visible: true },
    { href: '/app/dashboard', text: c.panel, Icon: LayoutDashboard, visible: admin },
    { href: admin ? '/app/profile' : '/workzone/profile', text: c.profile, Icon: UserRound, visible: true },
  ].filter(x => x.visible).map(x=>({...x,href:x.href.startsWith('/app/')?`${x.href}?office=${origin}`:x.href}));
  return <section className={styles.office} data-testid="office-space">
    <nav className={styles.breadcrumb} aria-label={c.offices}>
      <Link href={reception?'/workzone':'/workzone/offices'}><ArrowLeft size={16} />{reception?c.back:c.reception}</Link>
      <span aria-hidden="true">/</span>
      {reception ? <span aria-current="page">{c.reception}</span> : <span aria-current="page">{roomTitle}</span>}
      {workEnabled&&(!ownDesk||reception)&&<Link href="/workzone/offices/me">{w.desk}<ArrowUpRight size={15}/></Link>}
    </nav>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}><Building2 size={15} />{companyName}</p><h1>{reception ? c.welcome : roomTitle}</h1><p>{reception ? c.subtitle : roleTitle}</p></div>
      <span className={styles.hours}>{c.hours}</span>
    </header>
    {workEnabled&&<OfficeMailNotice initial={unread} lang={lang}/>}
    <div className={`${styles.room} ${reception ? styles.reception : styles.personal}`}>
      <div className={styles.scenery} role="img" aria-label={c.room}>
        <div className={styles.floor} /><div className={styles.sunlight} />
        <div className={styles.window}><div className={styles.landscape} /><i /><i /><i /></div>
        <div className={styles.slats} />
        <div className={styles.wallBrand}><strong>{companyName}</strong><span>{reception ? c.reception : roleTitle}</span></div>
        <div className={styles.wallLamp} />
        <div className={styles.rug} />
        <div className={styles.plant}><i /><i /><i /><i /><b /></div>
        <div className={styles.shelf}><i /><i /><i /><b /><b /></div>
        <div className={styles.chair}><i /><b /></div>
        <div className={styles.desk}><div className={styles.deskTop} /><div className={styles.deskFace} /><div className={styles.monitor}><i /></div><div className={styles.keyboard} /><div className={styles.paper} /><div className={styles.cup} /></div>
      </div>
      {!reception&&ownDesk&&planEnabled&&<Link href={`/workzone/plan?office=${origin}`} className={styles.wallCalendar}><span className={styles.calendarRings} aria-hidden="true"/><CalendarDays size={28}/><strong>{c.plan}</strong><span>{lang==='sq'?'Hap kalendarin':'Open calendar'}</span></Link>}
      {reception ? <Link href="/workzone/offices/megi" className={styles.door} data-testid="office-door">
        <span className={styles.doorGlass} aria-hidden="true" />
        <span className={styles.doorPlate}><span>{c.administration}</span><strong>{occupantName}</strong><span>{ownDesk ? c.enter : c.visit}<ArrowUpRight size={16} /></span></span>
        <span className={styles.doorHandle} aria-hidden="true" />
      </Link> : <div className={styles.deskName}><span>{ownDesk ? c.desk : c.administration}</span><strong>{occupantName}</strong></div>}
      {!reception && ownDesk && <div className={styles.deskActions}>
        {links.slice(0, 2).map(({ href, text, Icon }) => <Link href={href} key={href}><Icon size={18} /><span>{text}</span><ArrowUpRight size={15} /></Link>)}
      </div>}
      {!reception&&ownDesk&&<Link href="/workzone/offices/me/resources" className={styles.deskFolder}><FolderOpen size={24}/><span>{c.documents}</span></Link>}
      {!reception&&ownDesk&&workbooksEnabled&&<Link href="/workzone/offices/me/workbooks" className={styles.deskWorkbook}><BookOpen size={20}/><span>{lang==='sq'?'Fletoret e punëtorëve':'Staff workbooks'}</span></Link>}
      <span className={styles.roomCaption}>{reception ? c.receptionHint : ownDesk ? c.desk : occupantName}</span>
    </div>
    {tools ? <section className={styles.work} aria-label={c.work}>
      <div className={styles.workTitle}><h2>{c.work}</h2><p>{c.workHint}</p></div>
      <div className={styles.shortcuts}>
        {links.map(({ href, text, Icon }) => <Link key={href} href={href}><span className={styles.appIcon}><Icon size={20} /></span><span>{text}</span><ArrowUpRight size={15} /></Link>)}
      </div>
      {assistant && <details className={styles.assistant}><summary>{c.assistant}</summary>{assistant}</details>}
    </section> : <div><p className={styles.privacy}><LockKeyhole size={18} /><span>{lang==='sq'?'Puna, shënimet dhe Posta personale mbeten private.':'Work, notes and personal mail remain private.'}</span></p>{workEnabled&&<Link href={`/workzone/offices/me/mail?compose=1${visitorId?`&to=${encodeURIComponent(visitorId)}`:''}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 text-sm"><Mail size={18}/>{w.mail}<ArrowUpRight size={15}/></Link>}</div>}
  </section>;
}
