"use client";
import Link from 'next/link';
import { BookOpenCheck } from 'lucide-react';
import { MusterLanguageCycle } from '@/components/shell/MusterPreferences';
import { useWorkshopDemo } from './use-workshop-demo';
import { DemoActorBar } from './demo-actor-bar';
import s from '@/components/shell/muster-header.module.css';

const KIDRAHT = 'KiDraht';

/** Show personal actions for the active fictional persona, never a visited colleague. */
export function DemoPersonalTools({kidraht,workerKey}:{kidraht:boolean;workerKey?:string}) {
  const { actor } = useWorkshopDemo();
  if (workerKey && actor.key!==workerKey) return null;
  return <div className={s.profileTools} data-testid="muster-profile-tools">
    <DemoActorBar mode="notifications" labelled/><MusterLanguageCycle/>
    {kidraht && <Link className={s.entry} href="/demo/kidraht"><BookOpenCheck size={17}/><span>{KIDRAHT}</span></Link>}
    <DemoActorBar mode="roles"/>
  </div>;
}
