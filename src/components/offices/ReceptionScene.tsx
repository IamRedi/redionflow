'use client';
import {useEffect,useRef} from 'react';
import {Building2,ChevronDown,MoveHorizontal} from 'lucide-react';
import Image from 'next/image';
import type {OfficeDoor} from './OfficeScene';
import s from './studio.module.css';

/** Continuous native scrolling; destinations and permissions remain server-derived. */
export function ReceptionScene({company,companyLogo,doors,sq}:{company:string;companyLogo?:string|null;doors:OfficeDoor[];doorPage?:number;sq:boolean}){
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{x:number;left:number}|null>(null),dragged=useRef(false);
 const present=doors.filter(p=>p.enabled&&p.officePresence);
 useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=(e:WheelEvent)=>{if(e.ctrlKey||Math.abs(e.deltaX)>=Math.abs(e.deltaY))return;const before=el.scrollLeft;el.scrollLeft+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?el.clientWidth:1);if(el.scrollLeft!==before)e.preventDefault();};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 return <div className={s.lobby}>
  <picture className={s.lobbyPhoto}><source media="(max-width:700px) and (min-height:481px)" srcSet="/office-studio-v1/reception-portrait.webp"/><img src="/office-studio-v1/reception-wide.webp" alt="" draggable={false} fetchPriority="high"/></picture>
  <div className={`${s.wallBrandCanvas} ${s.wallGlowCanvas}`} aria-hidden="true"><div className={s.wallBrand}/></div>
  <div className={s.wallBrandCanvas} aria-label={company}><div className={s.wallBrand} data-testid="office-wall-logo">{companyLogo?<Image src={companyLogo} alt={company} width={360} height={120} unoptimized draggable={false}/>:<span>{company}</span>}</div></div>
  <div className={s.hallCaption}><MoveHorizontal size={15}/><span>{sq?'Rrëshqit për zyrat':'Slide through the offices'}</span></div>
  <div className={s.doorViewport} ref={viewport} data-testid="office-hallway" tabIndex={0} role="region" aria-label={sq?'Korridori i zyrave, rrëshqit majtas ose djathtas':'Office corridor, scroll left or right'}
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.currentTarget.scrollBy({left:(e.key==='ArrowRight'?1:-1)*240,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}}
   onPointerDown={e=>{dragged.current=false;if(e.pointerType==='mouse'&&e.button===0)drag.current={x:e.clientX,left:e.currentTarget.scrollLeft};}}
   onPointerMove={e=>{if(!drag.current||e.pointerType!=='mouse'||e.buttons!==1)return;const dx=e.clientX-drag.current.x;if(Math.abs(dx)>7){dragged.current=true;e.currentTarget.dataset.dragging='true';if(!e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.scrollLeft=drag.current.left-dx;}}}
   onPointerUp={e=>{drag.current=null;delete e.currentTarget.dataset.dragging;}}
   onPointerCancel={e=>{drag.current=null;delete e.currentTarget.dataset.dragging;}}
   onClickCapture={e=>{if(dragged.current){e.preventDefault();e.stopPropagation();dragged.current=false;}}}>
   <div className={s.doorTrack}>{doors.map(p=><a key={p.id} href={p.href} aria-label={`${p.name} · ${p.title}${p.officePresence?` · ${p.officePresence==='paused'?(sq?'Në pauzë':'Paused'):(sq?'Në zyrë':'In the office')}`:''}`} draggable={false} className={s.glassEntrance} data-office-entrance data-office-presence={p.officePresence??undefined}><span className={s.glassReflection}/><span className={s.doorEtching}><strong>{p.name}</strong><small>{p.title}</small>{p.officePresence?<span className={s.doorPresence}><i/>{p.officePresence==='paused'?(sq?'Në pauzë':'Paused'):(sq?'Në zyrë':'In the office')}</span>:<i data-enabled={p.enabled}/>}</span><span className={s.metalHandle}/><span className={s.threshold}/></a>)}</div>
  </div>
  <picture className={s.lobbyForeground}><source media="(max-width:700px) and (min-height:481px)" srcSet="/office-studio-v1/reception-portrait.webp"/><img src="/office-studio-v1/reception-wide.webp" alt="" draggable={false}/></picture>
  <div className={s.presenceCanvas}>
   <section className={s.presenceDisplay} data-testid="office-presence-display" aria-label={sq?'Punonjësit në zyrë':'People in the office'}>
    <header><span>{sq?'Në zyrë':'In the office'}</span><b>{present.length}</b></header>
    {present.length?<ul>{present.slice(0,2).map(p=><li key={p.id}><span title={p.name}>{p.name}</span>{p.officePresence==='paused'&&<small>{sq?'Pauzë':'Paused'}</small>}</li>)}</ul>:<p>{sq?'Për momentin asnjë person.':'No one at the moment.'}</p>}
    {present.length>2&&<details><summary aria-label={sq?'Lista e plotë e personave në zyrë':'Full list of people in the office'}><span className={s.presenceMoreClosed}>+{present.length-2}</span><span className={s.presenceMoreOpen}>−</span></summary><ul>{present.map(p=><li key={p.id}><span title={p.name}>{p.name}</span>{p.officePresence==='paused'&&<small>{sq?'Pauzë':'Paused'}</small>}</li>)}</ul></details>}
   </section>
  </div>
  <details className={s.directory} data-testid="office-directory"><summary><Building2 size={16}/>{sq?'Zgjidh zyrën':'Choose office'}<ChevronDown size={14}/></summary><nav aria-label={sq?'Të gjitha zyrat':'All offices'}>{doors.map(p=><a key={p.id} href={p.href}><span>{p.name}</span><small>{p.title}{p.officePresence?` · ${p.officePresence==='paused'?(sq?'Në pauzë':'Paused'):(sq?'Në zyrë':'In the office')}`:''}</small></a>)}</nav></details>
 </div>;
}
