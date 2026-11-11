import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, FolderOpen, LayoutDashboard, LockKeyhole, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SupportedLanguage } from '@/lib/i18n/language';
import { officeCopy } from '@/lib/offices/copy';
import styles from './office.module.css';

type Props = { room: 'reception' | 'megi'; lang: SupportedLanguage; companyName: string; ownDesk: boolean; admin: boolean; assistant?: ReactNode };

/** Pure presentation: receives no colleague records, mail, tasks or personal data. */
export function OfficeSpace({ room, lang, companyName, ownDesk, admin, assistant }: Props) {
  const c = officeCopy(lang);
  const occupantName = 'Megi';
  const reception = room === 'reception';
  const tools = reception || ownDesk;
  const links = [
    { href: '/workzone/plan', text: c.plan, Icon: CalendarDays, visible: admin },
    { href: admin ? '/app/baustellen' : '/workzone', text: c.documents, Icon: FolderOpen, visible: true },
    { href: '/app/dashboard', text: c.panel, Icon: LayoutDashboard, visible: admin },
    { href: admin ? '/app/profile' : '/workzone/profile', text: c.profile, Icon: UserRound, visible: true },
  ].filter(x => x.visible);
  return <section className={styles.office} data-testid="office-space">
    <nav className={styles.breadcrumb} aria-label={c.offices}>
      <Link href="/workzone"><ArrowLeft size={16} />{c.back}</Link>
      <span aria-hidden="true">/</span>
      {reception ? <span aria-current="page">{c.reception}</span> : <><Link href="/workzone/offices">{c.reception}</Link><span aria-hidden="true">/</span><span aria-current="page">{c.megi}</span></>}
    </nav>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}><Building2 size={15} />{companyName}</p><h1>{reception ? c.welcome : c.megi}</h1><p>{reception ? c.subtitle : c.administration}</p></div>
      <span className={styles.hours}>{c.hours}</span>
    </header>
    <div className={`${styles.room} ${reception ? styles.reception : styles.personal}`}>
      <div className={styles.scenery} role="img" aria-label={c.room}>
        <div className={styles.floor} /><div className={styles.sunlight} />
        <div className={styles.window}><div className={styles.landscape} /><i /><i /><i /></div>
        <div className={styles.slats} />
        <div className={styles.wallBrand}><strong>{companyName}</strong><span>{reception ? c.reception : c.administration}</span></div>
        <div className={styles.wallLamp} />
        <div className={styles.rug} />
        <div className={styles.plant}><i /><i /><i /><i /><b /></div>
        <div className={styles.shelf}><i /><i /><i /><b /><b /></div>
        <div className={styles.chair}><i /><b /></div>
        <div className={styles.desk}><div className={styles.deskTop} /><div className={styles.deskFace} /><div className={styles.monitor}><i /></div><div className={styles.keyboard} /><div className={styles.paper} /><div className={styles.cup} /></div>
      </div>
      {reception ? <Link href="/workzone/offices/megi" className={styles.door} data-testid="office-door">
        <span className={styles.doorGlass} aria-hidden="true" />
        <span className={styles.doorPlate}><span>{c.administration}</span><strong>{occupantName}</strong><span>{ownDesk ? c.enter : c.visit}<ArrowUpRight size={16} /></span></span>
        <span className={styles.doorHandle} aria-hidden="true" />
      </Link> : <div className={styles.deskName}><span>{ownDesk ? c.desk : c.administration}</span><strong>{occupantName}</strong></div>}
      {!reception && ownDesk && <div className={styles.deskActions}>
        {links.slice(0, 2).map(({ href, text, Icon }) => <Link href={href} key={href}><Icon size={18} /><span>{text}</span><ArrowUpRight size={15} /></Link>)}
      </div>}
      <span className={styles.roomCaption}>{reception ? c.receptionHint : ownDesk ? c.desk : c.visitor}</span>
    </div>
    {tools ? <section className={styles.work} aria-label={c.work}>
      <div className={styles.workTitle}><h2>{c.work}</h2><p>{c.workHint}</p></div>
      <div className={styles.shortcuts}>
        {links.map(({ href, text, Icon }) => <Link key={href} href={href}><span className={styles.appIcon}><Icon size={20} /></span><span>{text}</span><ArrowUpRight size={15} /></Link>)}
      </div>
      {assistant && <details className={styles.assistant}><summary>{c.assistant}</summary>{assistant}</details>}
    </section> : <p className={styles.privacy}><LockKeyhole size={18} /><span>{c.privacy}</span></p>}
  </section>;
}
