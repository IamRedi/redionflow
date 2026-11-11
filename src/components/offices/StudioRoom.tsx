import {BookOpen,ClipboardCheck,FolderOpen,Mail,MessageSquareText,ArrowUpRight} from 'lucide-react';
import {dateKey} from '@/lib/workzone/date-utils';
import type {OfficeObject} from './OfficeScene';
import s from './studio.module.css';

function CalendarPrint({sq}:{sq:boolean}){
 const key=dateKey(new Date()),[year,month,day]=key.split('-').map(Number);
 const first=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(year,month,0)).getUTCDate();
 const heading=new Intl.DateTimeFormat(sq?'sq-AL':'en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,15)));
 return <><span className={s.calendarBinding}/><strong>{sq?'Plani ditor':'Daily plan'}</strong><small>{heading}</small><b className={s.calendarDay} aria-hidden="true">{day}</b><span className={s.calendarGrid} aria-hidden="true">{Array.from({length:42},(_,i)=>{const n=i-first+1;return <i key={i} data-today={n===day||undefined}>{n>0&&n<=days?n:''}</i>;})}</span></>;
}
export function StudioRoom({company,name,title,objects,sq}:{company:string;name:string;title:string;objects:OfficeObject[];sq:boolean}){
 return <div className={s.room} data-testid="office-interior"><div className={s.roomCanvas}>
  <picture className={s.roomPhoto}><source media="(max-width:700px) and (min-height:481px)" srcSet="/office-studio-v1/room-portrait.webp"/><img src="/office-studio-v1/room-wide.webp" alt="" draggable={false} fetchPriority="high"/></picture>
  <div className={s.wallIdentity}><span>{company}</span><h2>{name}</h2><p>{title}</p></div>
  {objects.map(item=>{
   if(item.kind==='calendar')return <a key={item.kind} href={item.href} aria-label={item.label} className={`${s.roomObject} ${s.wallCalendar}`}><CalendarPrint sq={sq}/></a>;
   if(item.kind==='tasks')return <a key={item.kind} href={item.href} aria-label={item.label} className={`${s.roomObject} ${s.taskBook}`}><span className={s.clip}/><ClipboardCheck size={22} strokeWidth={1.3}/><strong>{sq?'Detyrat':'Tasks'}</strong><span className={s.paperLines} aria-hidden="true"/></a>;
   if(item.kind==='assistant')return <a key={item.kind} href={item.href} aria-label={item.label} className={`${s.roomObject} ${s.monitorScreen}`}><MessageSquareText size={25} strokeWidth={1.25}/><strong>{sq?'Asistenti':'Assistant'}</strong><small>{sq?'Hap bisedën e punës':'Open work conversation'}</small><ArrowUpRight size={13}/></a>;
   if(item.kind==='documents'||item.kind==='workbooks'){const workbook=item.kind==='workbooks';const Icon=workbook?BookOpen:FolderOpen;return <a key={item.kind} href={item.href} aria-label={item.label} className={`${s.roomObject} ${s.drawer} ${workbook?s.lowerDrawer:s.upperDrawer}`}><span className={s.drawerPull}/><span className={s.drawerPlate}><Icon size={17} strokeWidth={1.5}/><strong>{workbook?(sq?'Fletoret':'Workbooks'):(item.shortLabel??(sq?'Dokumentet':'Documents'))}</strong></span></a>;}
   return <a key={item.kind} href={item.href} aria-label={item.label} className={`${s.roomObject} ${s.mailTray}`}><span className={s.envelope} aria-hidden="true"/><span><Mail size={17} strokeWidth={1.4}/><strong>{item.label}</strong>{!!item.count&&<b>{item.count}</b>}</span></a>;
  })}
 </div></div>;
}
