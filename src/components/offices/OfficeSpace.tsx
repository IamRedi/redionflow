import Link from 'next/link';
import {ArrowLeft,Building2,Info} from 'lucide-react';
import type {SupportedLanguage} from '@/lib/i18n/language';
import {officeCopy} from '@/lib/offices/copy';
import {officeWorkCopy} from '@/lib/offices/work-copy';
import {OfficeScene,type OfficeDoor,type OfficeObject} from './OfficeScene';
import {RediOnFooter} from '@/components/branding/RediOnFooter';
import s from './office.module.css';

type Props={room:'reception'|'megi';lang:SupportedLanguage;companyName:string;ownDesk:boolean;admin:boolean;workEnabled?:boolean;ownName?:string;unread?:number;visitorId?:string;officeTitle?:string;workbooksEnabled?:boolean;planEnabled?:boolean;doors?:OfficeDoor[];doorPage?:number;previewBase?:string;previewEnabled?:boolean;canManage?:boolean};
export function OfficeSpace({room,lang,companyName,ownDesk,workEnabled=false,ownName,unread=0,visitorId,officeTitle,workbooksEnabled=false,planEnabled=true,doors=[],doorPage=0,previewBase,previewEnabled=true,canManage=false}:Props){
 const c=officeCopy(lang),w=officeWorkCopy(lang),sq=lang==='sq',reception=room==='reception',name=ownName||'Megi',tools=ownDesk||!!previewBase;
 const base=previewBase||'/workzone/offices/me';
 const href=(view:string)=>previewBase?`${base}?view=${view}`:`${base}/${view==='documents'?'resources':view}`;
 const objects:OfficeObject[]=tools?[
  ...(!previewBase&&workEnabled?[{kind:'mail' as const,label:w.mail,href:href('mail'),count:unread}]:[]),
  ...(workEnabled?[{kind:'tasks' as const,label:w.tasks,href:href('tasks')}]:[]),
  {kind:'documents',label:c.documents,href:href('documents')},
  ...(planEnabled?[{kind:'calendar' as const,label:c.plan,href:previewBase?href('plan'):'/workzone/plan?office=desk'}]:[]),
  ...(workbooksEnabled?[{kind:'workbooks' as const,label:sq?'Fletoret e punëtorëve':'Staff workbooks',href:href('workbooks')}]:[]),
 ]:[];
 return <section className={`fixed ${s.nativeOffice}`} data-testid="office-space" data-office-fullscreen>
  <nav className={s.nativeNav} aria-label={c.offices}><Link href={reception?'/workzone':'/workzone/offices'}><ArrowLeft size={16}/>{reception?'Workzone':c.reception}</Link><h1>{reception?c.reception:`${sq?'Zyra':'Office'} · ${name}`}</h1>{reception?<Link href="/workzone/offices/me"><Building2 size={16}/>{sq?'Zyra ime':'My office'}</Link>:!ownDesk&&<Link href="/workzone/offices/me">{sq?'Zyra ime':'My office'}</Link>}</nav>
  {previewBase&&<p className={s.previewNotice} data-testid="office-preview-notice">{sq?'Pamja e punonjësit · vetëm shikim':'Employee view · read only'}{!previewEnabled?` · ${sq?'Pa hyrje':'Access disabled'}`:''}<span>{sq?'Posta dhe shënimet personale janë private.':'Personal mail and notes remain private.'}</span></p>}
  <div className={s.nativeScene}><OfficeScene reception={reception} company={companyName} name={name} title={officeTitle||c.administration} doors={doors} objects={objects} doorPage={doorPage} sq={sq}/></div>
  {!reception&&!tools&&<p className={s.visitorNotice}> {sq?'Puna, shënimet dhe Posta personale mbeten private.':'Work, notes and personal mail remain private.'}{workEnabled&&<Link href={`/workzone/offices/me/mail?compose=1${visitorId?`&to=${encodeURIComponent(visitorId)}`:''}`}>{w.mail} ↗</Link>}</p>}
  <div className={s.nativeUtilities}>{reception&&canManage&&<Link href="/workzone/offices/team">{sq?'Menaxho zyrat':'Manage offices'}</Link>}<details><summary aria-label={sq?'Rreth aplikacionit':'About the app'}><Info size={16}/></summary><div><p>{companyName} · {c.hours}</p><RediOnFooter/></div></details></div>
 </section>;
}
