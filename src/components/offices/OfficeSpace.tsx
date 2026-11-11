import Link from 'next/link';
import type {OfficeArtworkState} from '@/lib/offices/artwork';
import {ArrowLeft,Building2,Info,Settings2} from 'lucide-react';
import type {SupportedLanguage} from '@/lib/i18n/language';
import {officeCopy} from '@/lib/offices/copy';
import {officeWorkCopy} from '@/lib/offices/work-copy';
import {OfficeScene,type OfficeDoor,type OfficeObject} from './OfficeScene';
import {RediOnFooter} from '@/components/branding/RediOnFooter';
import s from './office.module.css';
import studio from './studio.module.css';

type Props={artwork?:OfficeArtworkState;room:'reception'|'megi';lang:SupportedLanguage;companyName:string;ownDesk:boolean;admin:boolean;workEnabled?:boolean;ownName?:string;unread?:number;visitorId?:string;officeTitle?:string;workbooksEnabled?:boolean;planEnabled?:boolean;doors?:OfficeDoor[];doorPage?:number;previewBase?:string;previewEnabled?:boolean;canManage?:boolean;workProfile?:string;assistantEnabled?:boolean};
export function OfficeSpace({artwork,room,lang,companyName,ownDesk,admin,workEnabled=false,ownName,unread=0,visitorId,officeTitle,workbooksEnabled=false,planEnabled=true,doors=[],doorPage=0,previewBase,previewEnabled=true,canManage=false,workProfile='GENERAL',assistantEnabled=false}:Props){
 const c=officeCopy(lang),w=officeWorkCopy(lang),sq=lang==='sq',reception=room==='reception',name=ownName||'Megi',tools=ownDesk||!!previewBase;
 const base=previewBase||'/workzone/offices/me';
 const href=(view:string)=>previewBase?`${base}?view=${view}`:`${base}/${view==='documents'?'resources':view}`;
 const objects:OfficeObject[]=tools?[
  ...(!previewBase&&workEnabled?[{kind:'mail' as const,label:w.mail,href:href('mail'),count:unread}]:[]),
  ...(workEnabled?[{kind:'tasks' as const,label:w.tasks,href:href('tasks')}]:[]),
  {kind:'documents',label:workProfile==='PURCHASING'?(sq?'Projektet & blerjet':'Projects & purchasing'):c.documents,href:href('documents'),shortLabel:workProfile==='PURCHASING'?(sq?'Projektet':'Projects'):(sq?'Dokumentet':'Documents')},
  ...(planEnabled?[{kind:'calendar' as const,label:c.plan,href:previewBase?href('plan'):'/workzone/plan?office=desk'}]:[]),
  ...((assistantEnabled||admin&&ownDesk)?[{kind:'assistant' as const,label:admin?(sq?'Asistenti i firmës':'Company assistant'):(sq?'Asistenti personal':'Personal assistant'),href:'/workzone/offices/me/assistant'}]:[]),
  ...(workbooksEnabled?[{kind:'workbooks' as const,label:sq?'Fletoret e punëtorëve':'Staff workbooks',href:href('workbooks')}]:[]),
 ]:[];
 return <section className={`fixed ${s.nativeOffice} ${studio.shell}`} data-testid="office-space" data-office-fullscreen>
  <nav className={`${s.nativeNav} ${studio.nav}`} aria-label={c.offices}><Link href={reception?'/workzone':'/workzone/offices'}><ArrowLeft size={16}/>{reception?'Workzone':c.reception}</Link><h1>{reception?c.reception:`${sq?'Zyra':'Office'} · ${name}`}</h1><div className={studio.navTools}>
   {(reception||!ownDesk)&&<Link href="/workzone/offices/me" aria-label={sq?'Zyra ime':'My office'}><Building2 size={16}/><span>{sq?'Zyra ime':'My office'}</span></Link>}
   {reception&&canManage&&<Link href="/workzone/offices/team" aria-label={sq?'Menaxho zyrat':'Manage offices'} title={sq?'Menaxho zyrat':'Manage offices'}><Settings2 size={16}/></Link>}
   <details><summary aria-label={sq?'Rreth aplikacionit':'About the app'}><Info size={16}/></summary><div><p>{companyName} · {c.hours}</p><RediOnFooter/></div></details>
  </div></nav>
  {previewBase&&<p className={s.previewNotice} data-testid="office-preview-notice">{sq?'Pamja e punonjësit · vetëm shikim':'Employee view · read only'}{!previewEnabled?` · ${sq?'Pa hyrje':'Access disabled'}`:''}<span>{sq?'Posta dhe shënimet personale janë private.':'Personal mail and notes remain private.'}</span></p>}
  <div className={s.nativeScene}><OfficeScene reception={reception} company={companyName} name={name} title={officeTitle||c.administration} doors={doors} objects={objects} artwork={artwork} doorPage={doorPage} sq={sq}/></div>
  {!reception&&!tools&&<p className={s.visitorNotice}> {sq?'Puna, shënimet dhe Posta personale mbeten private.':'Work, notes and personal mail remain private.'}{workEnabled&&<Link href={`/workzone/offices/me/mail?compose=1${visitorId?`&to=${encodeURIComponent(visitorId)}`:''}`}>{w.mail} ↗</Link>}</p>}
 </section>;
}
