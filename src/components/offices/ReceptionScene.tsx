'use client';
import {useEffect,useRef} from 'react';
import {Building2,ChevronDown,MoveHorizontal} from 'lucide-react';
import type {OfficeDoor} from './OfficeScene';
import s from './studio.module.css';

/** Continuous native scrolling; destinations and permissions remain server-derived. */
export function ReceptionScene({company,doors,sq}:{company:string;doors:OfficeDoor[];doorPage?:number;sq:boolean}){
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{x:number;left:number}|null>(null),dragged=useRef(false);
 useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=(e:WheelEvent)=>{if(e.ctrlKey||Math.abs(e.deltaX)>=Math.abs(e.deltaY))return;const before=el.scrollLeft;el.scrollLeft+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?el.clientWidth:1);if(el.scrollLeft!==before)e.preventDefault();};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 return <div className={s.lobby}>
  <picture className={s.lobbyPhoto}><source media="(max-width:700px) and (min-height:481px)" srcSet="/office-studio-v1/reception-portrait.webp"/><img src="/office-studio-v1/reception-wide.webp" alt="" draggable={false} fetchPriority="high"/></picture>
  <div className={s.lobbyIdentity}><span>{sq?'RECEPSIONI':'RECEPTION'}</span><h2>{company}</h2><p>{sq?'Zyrat e ekipit':'Team offices'}</p></div>
  <div className={s.hallCaption}><MoveHorizontal size={15}/><span>{sq?'Rrëshqit për zyrat':'Slide through the offices'}</span></div>
  <div className={s.doorViewport} ref={viewport} data-testid="office-hallway" tabIndex={0} role="region" aria-label={sq?'Korridori i zyrave, rrëshqit majtas ose djathtas':'Office corridor, scroll left or right'}
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.currentTarget.scrollBy({left:(e.key==='ArrowRight'?1:-1)*240,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}}
   onPointerDown={e=>{dragged.current=false;if(e.pointerType==='mouse'&&e.button===0)drag.current={x:e.clientX,left:e.currentTarget.scrollLeft};}}
   onPointerMove={e=>{if(!drag.current||e.pointerType!=='mouse'||e.buttons!==1)return;const dx=e.clientX-drag.current.x;if(Math.abs(dx)>7){dragged.current=true;e.currentTarget.dataset.dragging='true';if(!e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.scrollLeft=drag.current.left-dx;}}}
   onPointerUp={e=>{drag.current=null;delete e.currentTarget.dataset.dragging;}}
   onPointerCancel={e=>{drag.current=null;delete e.currentTarget.dataset.dragging;}}
   onClickCapture={e=>{if(dragged.current){e.preventDefault();e.stopPropagation();dragged.current=false;}}}>
   <div className={s.doorTrack}>{doors.map(p=><a key={p.id} href={p.href} aria-label={`${p.name} · ${p.title}`} draggable={false} className={s.glassEntrance} data-office-entrance><span className={s.glassReflection}/><span className={s.doorEtching}><strong>{p.name}</strong><small>{p.title}</small><i data-enabled={p.enabled}/></span><span className={s.metalHandle}/><span className={s.threshold}/></a>)}</div>
  </div>
  <picture className={s.lobbyForeground}><source media="(max-width:700px) and (min-height:481px)" srcSet="/office-studio-v1/reception-portrait.webp"/><img src="/office-studio-v1/reception-wide.webp" alt="" draggable={false}/></picture>
  <details className={s.directory} data-testid="office-directory"><summary><Building2 size={16}/>{sq?'Zgjidh zyrën':'Choose office'}<ChevronDown size={14}/></summary><nav aria-label={sq?'Të gjitha zyrat':'All offices'}>{doors.map(p=><a key={p.id} href={p.href}><span>{p.name}</span><small>{p.title}</small></a>)}</nav></details>
 </div>;
}
