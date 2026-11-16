'use client';

import Link from 'next/link';
import { BookOpenCheck } from 'lucide-react';
import { MusterProfileMenu } from '@/components/shell/MusterProfileMenu';
import { useLanguage } from '@/components/i18n/language-provider';
import { workshopCopy } from '@/lib/workshop/copy';
import { useWorkshopDemo } from './use-workshop-demo';
import { DemoActorBar } from './demo-actor-bar';
import s from '@/components/shell/muster-header.module.css';
const KIDRAHT = 'KiDraht';

export function DemoProfileMenu({ kidraht }: { kidraht: boolean }) {
  const { actor, state } = useWorkshopDemo(), { currentLang } = useLanguage(), c = workshopCopy(currentLang);
  const unread = state.custody.notifications.filter(n => n.recipient === actor.key && !n.readAt).length;
  return <MusterProfileMenu label={c.profile} name={actor.name} badge={unread ? <span className="absolute right-0 top-0 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-label={`${c.notifications} · ${unread}`}/> : null}>
    <DemoActorBar mode="roles"/>
    <DemoActorBar mode="notifications" labelled/>
    {kidraht && <Link className={s.entry} href="/demo/kidraht"><BookOpenCheck size={17}/>{KIDRAHT}</Link>}
  </MusterProfileMenu>;
}
