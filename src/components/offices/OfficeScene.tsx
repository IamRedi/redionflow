import type {ReactNode} from 'react';
import s from './office.module.css';
import {ReceptionScene} from './ReceptionScene';

export type OfficeDoor={id:string;name:string;title:string;href:string;enabled:boolean};
export type OfficeObject={kind:'mail'|'tasks'|'documents'|'calendar'|'workbooks'|'assistant';label:string;href:string;count?:number;shortLabel?:string};
function ObjectLink({item,x,y,children}:{item:OfficeObject;x:number;y:number;children:ReactNode}){
 return <a href={item.href} aria-label={item.label} className={s.sceneLink}><g transform={`translate(${x} ${y})`}><title>{item.label}</title><rect y="-4" width="64" height="100" fill="transparent"/>{children}</g></a>;
}
/** Native SVG objects reuse the room's oak, glass, paper and steel palette. */
export function OfficeScene({reception,company,name,title,doors,objects,doorPage=0,sq}:{reception:boolean;company:string;name:string;title:string;doors:OfficeDoor[];objects:OfficeObject[];doorPage?:number;sq:boolean}){
 if(reception)return <ReceptionScene company={company} doors={doors} doorPage={doorPage} sq={sq}/>;
 return <>{[false,true].map(mobile=>{
  const W=mobile?420:1200,H=680;
  return <svg key={String(mobile)} viewBox={`0 0 ${W} ${H}`} className={mobile?s.sceneMobile:s.sceneDesktop} role="group" aria-label={reception?(sq?'Recepsioni dhe dyert e zyrave':'Reception and office doors'):`${sq?'Zyra':'Office'} · ${name}`}>
   <rect width={W} height={H} fill="var(--wall)"/><path d={`M0 500H${W}V680H0Z`} fill="var(--floor)"/><path d={`M0 500H${W}`} stroke="var(--oak-light)" strokeWidth="5"/>
   <path d={`M${W*.68} 0H${W}V500H${W*.68}Z`} fill="var(--slats)" opacity=".35"/>
   {Array.from({length:12},(_,i)=><path key={i} d={`M${W*.69+i*W*.026} 0V500`} stroke="var(--oak)" strokeWidth="3" opacity=".3"/>)}
   <g transform={`translate(${mobile?22:50} ${reception?28:80})`} aria-hidden="true"><rect width={mobile?110:240} height={mobile?105:250} rx="3" fill="var(--frame)"/><rect x="6" y="6" width={mobile?98:228} height={mobile?93:238} fill="#bed1cc"/><path d={mobile?'M6 75L39 45 67 64 104 40V99H6Z':'M6 168L60 95 132 141 234 72V244H6Z'} fill="#90a89c"/><path d={mobile?'M55 6V99M6 50H104':'M120 6V244M6 125H234'} stroke="var(--frame)" strokeWidth="5"/></g>
   <text x={mobile?155:340} y={reception?32:100} className={s.sceneBrand}>{company}</text><text x={mobile?155:340} y={reception?52:124} className={s.sceneSub}>{reception?(sq?'RECEPSIONI':'RECEPTION'):title.slice(0,mobile?27:60)}</text>
   {!reception&&<><ellipse cx={W*.52} cy="577" rx={W*.34} ry="48" fill="#637471" opacity=".18"/><rect x={W*.45} y="380" width={W*.15} height="160" rx="30" fill="var(--frame)"/><path d={`M${W*.2} 495H${W*.83}L${W*.86} 519H${W*.18}Z`} fill="var(--oak-light)"/><path d={`M${W*.21} 519H${W*.82}V625H${W*.21}Z`} fill="var(--oak)"/><path d={`M${W*.22} 525H${W*.81}`} stroke="var(--oak-light)" strokeWidth="3"/><rect x={W*.4} y="396" width={W*.22} height="96" rx="5" fill="var(--frame)"/><rect x={W*.42} y="408" width={W*.18} height="66" rx="2" fill="#446c67"/><path d={`M${W*.51} 490V504`} stroke="var(--frame)" strokeWidth="8"/><rect x={W*.58} y="549" width={W*.21} height="31" rx="2" fill="var(--oak-light)"/><path d={`M${W*.64} 561H${W*.72}`} stroke="var(--frame)" strokeWidth="3"/><text x={W*.69} y="620" textAnchor="middle" className={s.deskLabel}>{name}</text></>}
   {!reception&&objects.map(item=>{
    if(item.kind==='assistant')return <ObjectLink key={item.kind} item={item} x={W*.4} y={396}><rect width={W*.22} height="96" rx="5" fill="var(--frame)"/><rect x={W*.02} y="12" width={W*.18} height="66" rx="2" fill="#446c67"/><text x={W*.11} y="52" textAnchor="middle" style={{fill:'#f1f6ef',fontSize:mobile?12:18}}>{sq?'Asistenti':'Assistant'}</text></ObjectLink>;
    if(item.kind==='calendar')return <ObjectLink key={item.kind} item={item} x={mobile?202:570} y={mobile?166:164}><rect width={mobile?130:172} height="154" rx="6" fill="var(--paper)"/><path d={`M0 20H${mobile?130:172}`} stroke="#ad7049" strokeWidth="27"/><path d="M25 0V16M100 0V16" stroke="var(--frame)" strokeWidth="5"/><text x="16" y="56" className={s.objectLabel}>{item.label}</text>{[0,1,2].map(r=>[0,1,2,3].map(c=><rect key={`${r}${c}`} x={18+c*26} y={70+r*23} width="16" height="13" rx="2" fill={r===1&&c===2?'#658b77':'#919b8e'} opacity=".5"/>))}</ObjectLink>;
    if(item.kind==='documents')return <ObjectLink key={item.kind} item={item} x={mobile?45:275} y={441}><path d="M0 12H24L30 4H115V72H0Z" fill="#c7ac76" stroke="#9b7e4b"/><path d="M0 24H119L111 79H0Z" fill="#e2ce9b" stroke="#a18b5d"/><text x="10" y="49" className={s.objectLabel}>{item.shortLabel??(sq?'Dokumentet':'Documents')}</text><path d="M10 60H75" stroke="#9b7e4b" strokeWidth="2"/></ObjectLink>;
    if(item.kind==='tasks')return <ObjectLink key={item.kind} item={item} x={mobile?42:340} y={mobile?187:196}><rect width="120" height="156" rx="4" fill="#bba583"/><rect x="7" y="11" width="106" height="135" rx="3" fill="var(--paper)"/><rect x="38" y="-4" width="45" height="16" rx="4" fill="var(--frame)"/><text x="16" y="41" className={s.objectLabel}>{sq?'Detyrat':'Tasks'}</text>{[66,91,116].map(y=><g key={y}><rect x="18" y={y} width="12" height="12" rx="2" fill="none" stroke="#8a948c"/><path d={`M40 ${y+5}H94`} stroke="#8a948c" strokeWidth="3"/></g>)}</ObjectLink>;
    if(item.kind==='mail')return <ObjectLink key={item.kind} item={item} x={mobile?257:835} y={mobile?422:393}><rect x="-7" y="-12" width="125" height="110" rx="3" fill="var(--oak)"/><path d="M0 9H109V78H0Z" fill="var(--paper)" stroke="#b6b2a3"/><path d="M0 9L54 48 109 9M0 78L39 43M109 78L70 43" fill="none" stroke="#b6b2a3" strokeWidth="2"/><text x="54" y="105" textAnchor="middle" className={s.sceneLabel}>{item.label}{item.count?` · ${item.count}`:''}</text></ObjectLink>;
    return <ObjectLink key={item.kind} item={item} x={mobile?249:715} y={550}><rect width="126" height="51" rx="3" fill="var(--oak-light)" stroke="var(--oak)"/><path d="M42 8H84" stroke="var(--frame)" strokeWidth="3"/><text x="63" y="34" textAnchor="middle" className={s.objectLabel}>{sq?'Fletoret':'Workbooks'}</text></ObjectLink>;
   })}
  </svg>;
 })}</>;
}
