'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import s from './office.module.css';
import glass from './surfaces.module.css';
export function OfficeDrawer({children,backHref,label,placement}:{children:ReactNode;backHref:string;label:string;placement?:'assistant'}){
 const ref=useRef<HTMLDialogElement>(null),router=useRouter();
 useEffect(()=>{const el=ref.current;if(el&&!el.open)el.showModal();return()=>el?.close();},[]);
 useEffect(()=>{
  if(placement!=='assistant')return;
  const place=()=>{
   const el=ref.current;if(!el)return;
   const viewport=window.visualViewport,w=viewport?.width??innerWidth,h=viewport?.height??innerHeight,offset=viewport?.offsetTop??0,offsetLeft=viewport?.offsetLeft??0;
   const width=Math.min(420,w-24),height=Math.min(680,h-24),monitor=document.querySelector('[data-office-object="assistant"]')?.getBoundingClientRect();
   let left=(w-width)/2;
   if(monitor&&w>=1000){if(monitor.right+16+width<=w-12)left=monitor.right+16;else if(monitor.left-16-width>=12)left=monitor.left-16-width;}
   const top=offset+Math.max(12,Math.min(monitor?monitor.top-40:80,h-height-12));
   el.style.setProperty('--office-left',`${left+offsetLeft}px`);el.style.setProperty('--office-top',`${top}px`);el.style.setProperty('--office-width',`${width}px`);el.style.setProperty('--office-height',`${height}px`);
  };
  place();window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);
  return()=>{window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place);};
 },[placement]);
 return <dialog ref={ref} className={`${s.officeDrawer} ${glass.dialog} ${placement==='assistant'?glass.assistant:''}`} data-office-drawer={placement??'work'} aria-label={label} onCancel={e=>{e.preventDefault();router.push(backHref);}}>{children}</dialog>;
}
