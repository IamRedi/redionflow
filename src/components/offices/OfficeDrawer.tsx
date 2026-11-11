'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import s from './office.module.css';
export function OfficeDrawer({children,backHref,label}:{children:ReactNode;backHref:string;label:string}){
 const ref=useRef<HTMLDialogElement>(null),router=useRouter();
 useEffect(()=>{const el=ref.current;if(el&&!el.open)el.showModal();return()=>el?.close();},[]);
 return <dialog ref={ref} className={s.officeDrawer} aria-label={label} onCancel={e=>{e.preventDefault();router.push(backHref);}}>{children}</dialog>;
}
