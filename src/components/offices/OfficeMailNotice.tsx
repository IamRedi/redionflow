'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { Mail } from 'lucide-react';
import { unreadOfficeAction } from '@/lib/offices/work-actions';
import { officeWorkCopy } from '@/lib/offices/work-copy';
import type { SupportedLanguage } from '@/lib/i18n/language';
export function OfficeMailNotice({initial,lang}:{initial:number;lang:SupportedLanguage}){
  const [count,setCount]=useState(initial),c=officeWorkCopy(lang);
  useEffect(()=>{let active=true;const read=async()=>{if(document.visibilityState!=='visible')return;try{const r=await unreadOfficeAction();if(active&&r.ok)setCount(r.data);}catch{/* retain the last successful count */}};const timer=setInterval(read,45_000);window.addEventListener('focus',read);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',read);};},[]);
  if(!count)return null;
  return <Link href="/workzone/offices/me/mail" className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-3 text-xs" aria-live="polite"><Mail size={16}/>{c.notifications}: {count}</Link>;
}
