"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { BookOpen, ClipboardCheck, FolderOpen, Mail, MessageSquareText, MoveHorizontal, TreeDeciduous } from "lucide-react";
import { officeCopy, officeNames, officePeople } from "@/lib/workshop/offices/copy";
import { officeRoles, type OfficeRole } from "@/lib/workshop/offices/model";
import { workshopDay } from "@/lib/workshop/demo-model";
import s from "./office.module.css";

export type ScenePanel = "archive" | "tasks" | "inquiries" | "site" | "offers" | "staff" | "assistant" | "email" | "work" | "settings" | "visit";

export function OfficeReception({ actor, logo, lang }: { actor?: OfficeRole; logo?: string | null; lang: string }) {
  const c = officeCopy(lang), names = officeNames(lang), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const place = () => { el.scrollLeft = el.clientWidth < 700 ? Math.max(0, el.scrollWidth * .325 - el.clientWidth * .12) : (el.scrollWidth - el.clientWidth) / 2; };
    place(); const observer = new ResizeObserver(place); observer.observe(el); return () => observer.disconnect();
  }, []);
  return <div className={s.hall} ref={ref} data-testid="office-reception-scene" tabIndex={0} role="region" aria-label={c.visitors}>
    <div className={s.hallCanvas}>
      <div className={s.hallPhoto} aria-hidden="true" />
      <div className={s.wallBrand}>
        {logo ? <Image src={logo} alt="BaumdienstFlow · Musterfirma" width={100} height={100} unoptimized draggable={false} /> : <TreeDeciduous className={s.treeEmblem} aria-hidden="true" />}
        <strong>BaumdienstFlow</strong><span>Musterfirma</span>
      </div>
      <nav aria-label={c.visitors} className={s.doors}>
        {officeRoles.filter(r => r !== "reception").map((role, index) => <Link transitionTypes={["baum-scene"]} key={role} href={`/demo/offices/${role}`} className={`${s.door} ${s[`door${index}`]}`} data-office-door={role} aria-label={`${names[role]} ${officePeople[role]}`}>
          <span className={s.doorEtching}><strong>{officePeople[role]}</strong><small>{names[role]}</small>{actor === role && <span>{c.myOffice}</span>}</span>
        </Link>)}
      </nav>
      <Link transitionTypes={["baum-scene"]} href="/demo/offices/reception" className={s.receptionDesk} aria-label={c.reception}><span>{c.reception}</span><small>{officePeople.reception}</small></Link>
    </div>
    <span className={s.panHint}><MoveHorizontal size={15} aria-hidden="true" />{c.swipe}</span>
  </div>;
}

function CalendarPaper({ lang }: { lang: string }) {
  const c = officeCopy(lang), key = workshopDay(new Date().toISOString()), [year, month, today] = key.split("-").map(Number);
  const first = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7, count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const title = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
  return <><span className={s.binding} aria-hidden="true" /><strong>{c.plan}</strong><small>{title}</small><b className={s.calendarDay} aria-hidden="true">{today}</b><span className={s.calendarGrid} aria-hidden="true">{Array.from({ length: 42 }, (_, i) => { const d = i - first + 1; return <i data-today={d === today || undefined} key={i}>{d > 0 && d <= count ? d : ""}</i>; })}</span></>;
}

export function OfficeRoom({ room, own, lang, open }: { room: OfficeRole; own: boolean; lang: string; open: (p: ScenePanel) => void }) {
  const c = officeCopy(lang), names = officeNames(lang);
  return <div className={s.room} data-testid="office-room-scene">
    <div className={s.roomCanvas}>
      <div className={s.roomPhoto} aria-hidden="true" />
      <div className={s.wallIdentity}><span>BaumdienstFlow · Musterfirma</span><h1>{officePeople[room]}</h1><p>{names[room]}</p></div>
      <div className={s.artFrame} aria-hidden="true"><Image src="/api/demo/baumdienst/art/tree-oak" alt="" fill unoptimized sizes="240px" /></div>
      {own && <>
        <Link transitionTypes={["baum-scene"]} href="/demo/plan" className={`${s.object} ${s.calendar}`} aria-label={c.plan} data-office-object="calendar"><CalendarPaper lang={lang} /></Link>
        <button type="button" className={`${s.object} ${s.taskBook}`} onClick={() => open("tasks")} aria-label={c.tasks} data-office-object="tasks" data-office-action="tasks"><span className={s.clip} aria-hidden="true" /><ClipboardCheck size={21} strokeWidth={1.3} aria-hidden="true" /><strong>{c.taskObject}</strong><span className={s.paperLines} aria-hidden="true" /></button>
        <button type="button" className={`${s.object} ${s.monitor}`} onClick={() => open("assistant")} aria-label={c.assistant} data-office-object="assistant" data-office-action="assistant"><MessageSquareText size={24} strokeWidth={1.3} aria-hidden="true" /><strong>{c.assistantObject}</strong><small>{c.assistantOpen}</small></button>
        <button type="button" className={`${s.object} ${s.envelope}`} onClick={() => open("email")} aria-label={c.email} data-office-object="mail"><Mail size={17} strokeWidth={1.3} aria-hidden="true" /><strong>{c.mailObject}</strong></button>
        <button type="button" className={`${s.object} ${s.drawer} ${s.upperDrawer}`} onClick={() => open("archive")} aria-label={c.archive} data-office-object="documents" data-office-action="archive"><FolderOpen size={18} strokeWidth={1.3} aria-hidden="true" /><strong>{c.documentObject}</strong></button>
        <button type="button" className={`${s.object} ${s.drawer} ${s.lowerDrawer}`} onClick={() => open("work")} aria-label={c.workbooks} data-office-object="workbooks" data-office-action="work"><BookOpen size={18} strokeWidth={1.3} aria-hidden="true" /><strong>{c.workbooks}</strong></button>
      </>}
    </div>
  </div>;
}
