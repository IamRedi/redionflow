'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { officeReturn } from '@/lib/offices/work-policy';
import { officeWorkCopy } from '@/lib/offices/work-copy';
import type { SupportedLanguage } from '@/lib/i18n/language';
import s from './work.module.css';
import glass from './surfaces.module.css';

const roots=['/app/baustellen','/app/dashboard','/app/profile','/workzone/baustellen','/workzone/inventory','/workzone/workshop'];
function subscribe(notify:()=>void){window.addEventListener('office-return-change',notify);window.addEventListener('storage',notify);return()=>{window.removeEventListener('office-return-change',notify);window.removeEventListener('storage',notify);};}
function snapshot(){try{return sessionStorage.getItem('office-return')||'';}catch{return '';}}
export function OfficeReturnLinks({lang}:{lang:SupportedLanguage}){
  const path=usePathname(),params=useSearchParams(),explicit=params.get('office'),c=officeWorkCopy(lang);
  const stored=useSyncExternalStore(subscribe,snapshot,()=>'');
  let saved:{root:string;origin:string}|null=null;
  try{saved=JSON.parse(stored);}catch{/* no saved return path */}
  const root=roots.find(r=>path===r||path.startsWith(`${r}/`));
  useEffect(()=>{
    try{
      if(root&&officeReturn(explicit))sessionStorage.setItem('office-return',JSON.stringify({root,origin:explicit}));
      else if(!root)sessionStorage.removeItem('office-return');
      window.dispatchEvent(new Event('office-return-change'));
    }catch{/* storage can be disabled without breaking explicit return links */}
  },[root,explicit]);
  const origin=officeReturn(explicit)?explicit:saved?.root===root?saved?.origin:null;
  const href=officeReturn(origin);
  if(!root||!href)return null;
  return <nav className={`${s.workspace} ${s.nav} ${glass.backNav}`} aria-label={c.desk} data-testid="office-return"><Link href={href}><ArrowLeft size={16}/>{origin==='reception'?c.reception:c.desk}</Link><Link href={`/workzone/plan?office=${origin}`}><CalendarDays size={16}/>{c.plan}</Link></nav>;
}
