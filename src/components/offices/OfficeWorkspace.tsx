'use client';
import {useEffect,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {RediOnFooter} from '@/components/branding/RediOnFooter';
import s from './surfaces.module.css';

/** One scrolling work surface, with the room's materials behind it. */
export function OfficeWorkspace({children}:{children:ReactNode}){
 const path=usePathname();
 const work=/^\/workzone\/offices\/(?:me\/(mail|tasks|resources|workbooks)(\/|$)|team(?:\/|$))/.test(path);
 useEffect(()=>{
  if(path==='/workzone/offices/me'&&location.hash==='#office-assistant')document.getElementById('office-assistant')?.focus({preventScroll:true});
 },[path]);
 return <div className={s.workspace} data-office-workspace>{work?<div className={s.view} data-office-view><div className={s.surface} data-office-scroll><div className={s.content}>{children}</div><RediOnFooter/></div></div>:children}</div>;
}
