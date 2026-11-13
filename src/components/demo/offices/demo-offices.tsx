"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness, Calculator, CalendarDays, ClipboardList, DoorOpen, FolderOpen, MessageSquareText, Moon, MoreHorizontal, Plus, RefreshCw, Sun, Users } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Button } from "@/components/ui/button";
import { officeCopy, officeNames, officePeople } from "@/lib/workshop/offices/copy";
import { officeRoles, type OfficeRole } from "@/lib/workshop/offices/model";
import { workshopDay } from "@/lib/workshop/demo-model";
import { DEMO_BRAND_TARGET } from "@/lib/workshop/media";
import { WorkshopDialog, control } from "../workshop/workshop-ui";
import { demoCoverUrl } from "../workshop/demo-photo";
import { BaumdienstDemoFooter } from "../workshop/demo-footer";
import { useWorkshopDemo } from "../workshop/use-workshop-demo";
import { useOffice } from "./use-office";
import { OfficeArchive, OfficeAssistant, OfficeInquiries, OfficeQuotes, OfficeSiteForm, OfficeStaff, OfficeTasks } from "./office-panels";
import { OfficeReception, OfficeRoom, type ScenePanel } from "./office-scene";
import s from "./office.module.css";

const panels: ScenePanel[] = ["archive", "tasks", "inquiries", "site", "offers", "staff", "assistant", "email", "work", "settings", "visit"];

export function DemoOffices({ room }: { room?: OfficeRole }) {
  const { currentLang: lang } = useLanguage(), c = officeCopy(lang), names = officeNames(lang), router = useRouter(), params = useSearchParams();
  const [month, setMonth] = useState(workshopDay(new Date().toISOString()).slice(0, 7)), o = useOffice(room, month), demo = useWorkshopDemo();
  const logo = demoCoverUrl(demo, "asset", DEMO_BRAND_TARGET), raw = params.get("tab"), panel = panels.includes(raw as ScenePanel) ? raw as ScenePanel : null;
  const path = room ? `/demo/offices/${room}` : "/demo/offices";
  const open = (value: ScenePanel) => router.push(`${path}?tab=${value}`, { scroll: false });
  const caps = o.data?.capabilities, own = !!room && o.data?.actor === room && (o.data?.own ?? false);
  const allowed = !!caps && (panel === "staff" ? caps.staff : panel === "site" ? caps.site : panel === "inquiries" ? caps.inquiries : panel === "offers" ? caps.finances : true);
  const shortcuts = [
    { id: "assistant" as ScenePanel, label: c.assistant, icon: MessageSquareText },
    { id: "tasks" as ScenePanel, label: c.tasks, icon: ClipboardList },
    { id: "archive" as ScenePanel, label: c.archive, icon: FolderOpen },
    ...(caps?.staff ? [{ id: "staff" as ScenePanel, label: c.staff, icon: Users }] : []),
    ...(caps?.site ? [{ id: "site" as ScenePanel, label: c.site, icon: Plus }] : []),
    ...(caps?.inquiries ? [{ id: "inquiries" as ScenePanel, label: c.inquiries, icon: BriefcaseBusiness }] : []),
    ...(caps?.finances ? [{ id: "offers" as ScenePanel, label: c.offers, icon: Calculator }] : []),
  ];
  const errorText = (key: string) => key in c ? c[key as keyof typeof c] : c.error;
  const visible = !!panel && (panel === "settings" || panel === "visit" || !!room && own);

  return <div className={s.workspace} data-testid="muster-offices" data-office-room={room ?? "reception"}>
    {!room && <h1 className="sr-only">{c.title}</h1>}
    {!room ? <OfficeReception actor={o.data?.actor} logo={logo} lang={lang} /> : <OfficeRoom room={room} own={own} lang={lang} open={open} />}
    <nav aria-label={c.title} className={s.toolbar}>
      <Link href={room ? "/demo/offices" : "/demo/workzone"} className={s.nav}><ArrowLeft size={18} aria-hidden="true" /><span>{room ? c.reception : c.workzone}</span></Link>
      <div className={s.toolbarRight}>
        {o.data && !o.pending && (!room || !own) && <Link href={`/demo/offices/${o.data.actor}`} className={s.nav}><DoorOpen size={18} aria-hidden="true" /><span>{c.myOffice}</span></Link>}
        {!!room && own && <button type="button" className={s.nav} onClick={() => open("work")}><BookOpen size={18} aria-hidden="true" /><span>{c.work}</span></button>}
        {!!room && o.data && !own && <button type="button" className={s.nav} onClick={() => open("visit")}>{c.visit}</button>}
        <button type="button" className={s.menuButton} onClick={() => open("settings")} aria-label={c.settings}><MoreHorizontal size={22} aria-hidden="true" /></button>
      </div>
    </nav>
    {o.error && !panel && <p role="alert" className={s.notice}>{errorText(o.error)}</p>}
    {!o.data && !o.error && <p role="status" className={s.notice}>{c.loading}</p>}

    <WorkshopDialog open={visible} onClose={() => router.push(path, { scroll: false })} closeLabel={c.close} title={panel ? c[panel] : room ? names[room] : c.title} description={room ? `${officePeople[room]} · ${names[room]} · Musterfirma` : c.demo} wide={panel === "staff" || panel === "offers"}>
      {o.error && <div role="alert" className="mb-4 space-y-2 rounded-xl border p-3 text-sm"><p>{errorText(o.error)}</p><Button variant="outline" className="min-h-11" onClick={() => void o.refresh()}>{c.retry}</Button></div>}
      {panel === "settings" ? <div className={`${s.settings} space-y-5`} data-testid="office-settings">
        {o.data && <div className="space-y-2"><label htmlFor="office-persona" className="text-sm font-semibold">{c.simulate}</label><select id="office-persona" className={control} value={o.data.actor} disabled={o.pending} onChange={e => void o.switchRole(e.target.value as OfficeRole).catch(() => {})}>{officeRoles.map(role => <option key={role} value={role}>{names[role]} · {officePeople[role]}</option>)}</select></div>}
        <div className={s.preferences}><span>{c.appearance}</span><form action="/app/toggle-theme" method="post"><Button variant="outline" size="icon" type="submit" className="size-11 rounded-full" aria-label={c.appearance}><Moon className="dark:hidden" /><Sun className="hidden dark:block" /></Button></form><span>{c.language}</span><LanguageSwitcher /><Button variant="outline" className="size-11 shrink-0 rounded-full p-0" aria-label={c.refresh} disabled={o.pending} onClick={() => void o.refresh()}><RefreshCw size={17} /></Button></div>
        <nav aria-label={c.visitors} className="grid gap-2 sm:grid-cols-2">{officeRoles.map(role => <Link href={`/demo/offices/${role}`} key={role} className={s.directoryLink}><DoorOpen size={17} aria-hidden="true" /><span><strong>{names[role]}</strong><small>{officePeople[role]}</small></span><ArrowRight size={16} aria-hidden="true" /></Link>)}</nav>
        <p className="text-xs leading-relaxed text-muted-foreground">{c.roleHint}</p><BaumdienstDemoFooter lang={lang} />
      </div> : panel === "visit" ? <div className="space-y-4"><p className="text-sm leading-relaxed">{c.visitor}</p>{o.data && <Link className={s.directoryLink} href={`/demo/offices/${o.data.actor}`}>{c.myOffice}<ArrowRight size={17} /></Link>}</div> : !o.data ? <p role="status">{c.loading}</p> : !allowed ? <p role="alert" className="text-sm">{c.permission}</p> : panel === "work" ? <nav className="grid gap-2 sm:grid-cols-2" aria-label={c.work}>{shortcuts.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={s.directoryLink} onClick={() => open(id)} data-office-action={id}><Icon size={18} aria-hidden="true" /><span>{label}</span><ArrowRight size={16} aria-hidden="true" /></button>)}<Link className={s.directoryLink} href="/demo/plan"><CalendarDays size={18} aria-hidden="true" /><span>{c.plan}</span><ArrowRight size={16} aria-hidden="true" /></Link></nav> : panel === "archive" ? <OfficeArchive controller={o} lang={lang} /> : panel === "tasks" ? <OfficeTasks controller={o} lang={lang} /> : panel === "inquiries" ? <OfficeInquiries controller={o} lang={lang} /> : panel === "site" ? <OfficeSiteForm controller={o} lang={lang} /> : panel === "offers" ? <OfficeQuotes controller={o} lang={lang} /> : panel === "staff" ? <OfficeStaff controller={o} lang={lang} month={month} onMonth={setMonth} /> : panel === "assistant" ? <OfficeAssistant controller={o} lang={lang} /> : <p className="text-sm leading-relaxed">{c.emailHint}</p>}
    </WorkshopDialog>
  </div>;
}
