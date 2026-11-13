"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, ArrowLeft, ArrowRight, CalendarDays, ClipboardList, DoorOpen, FolderOpen, Mail, MessageSquareText, Plus, RefreshCw, Users, Calculator, BriefcaseBusiness } from "lucide-react";
import { useState } from "react";
import { AppBrand } from "@/components/branding/AppBrand";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { officeCopy, officeNames, officePeople } from "@/lib/workshop/offices/copy";
import { officeRoles, type OfficeRole } from "@/lib/workshop/offices/model";
import { workshopDay } from "@/lib/workshop/demo-model";
import { DEMO_BRAND_TARGET } from "@/lib/workshop/media";
import { WorkshopDialog, control, Status } from "../workshop/workshop-ui";
import { demoCoverUrl } from "../workshop/demo-photo";
import { useWorkshopDemo } from "../workshop/use-workshop-demo";
import { useOffice } from "./use-office";
import { OfficeArchive, OfficeAssistant, OfficeInquiries, OfficeQuotes, OfficeSiteForm, OfficeStaff, OfficeTasks } from "./office-panels";
import s from "./office.module.css";

type Panel = "archive" | "tasks" | "inquiries" | "site" | "offers" | "staff" | "assistant" | "email";
const panels: Panel[] = ["archive", "tasks", "inquiries", "site", "offers", "staff", "assistant", "email"];
export function DemoOffices({ room }: { room?: OfficeRole }) {
  const { currentLang: lang } = useLanguage(), c = officeCopy(lang), names = officeNames(lang), router = useRouter(), params = useSearchParams();
  const [month, setMonth] = useState(workshopDay(new Date().toISOString()).slice(0, 7)), o = useOffice(room, month), demo = useWorkshopDemo();
  const logo = demoCoverUrl(demo, "asset", DEMO_BRAND_TARGET), raw = params.get("tab"), panel = panels.includes(raw as Panel) ? raw as Panel : null;
  const path = room ? `/demo/offices/${room}` : "/demo/offices";
  const open = (value: Panel) => router.push(`${path}?tab=${value}`, { scroll: false });
  const caps = o.data?.capabilities;
  const allowed = !!caps && (panel === "staff" ? caps.staff : panel === "site" ? caps.site : panel === "inquiries" ? caps.inquiries : panel === "offers" ? caps.finances : true);
  const shortcuts = [
    { id: "assistant" as Panel, label: c.assistant, icon: MessageSquareText },
    { id: "tasks" as Panel, label: c.tasks, icon: ClipboardList },
    { id: "archive" as Panel, label: c.archive, icon: FolderOpen },
    ...(caps?.staff ? [{ id: "staff" as Panel, label: c.staff, icon: Users }] : []),
    ...(caps?.site ? [{ id: "site" as Panel, label: c.site, icon: Plus }] : []),
    ...(caps?.inquiries ? [{ id: "inquiries" as Panel, label: c.inquiries, icon: BriefcaseBusiness }] : []),
    ...(caps?.finances ? [{ id: "offers" as Panel, label: c.offers, icon: Calculator }] : []),
  ];
  const errorText = (key: string) => key in c ? c[key as keyof typeof c] : c.error;
  return <div className={s.workspace} data-testid="muster-offices" data-office-room={room ?? "reception"}>
    <header className={s.heading}>
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-primary">BaumdienstFlow · Musterfirma</p><h1 className="mt-1 text-2xl font-semibold">{room ? names[room] : c.title}</h1><p className="mt-1 text-xs text-muted-foreground">{room ? `${officePeople[room]} · ${c.demo}` : c.demo}</p></div>
      <nav aria-label={c.title} className="flex flex-wrap items-center gap-2">{room && <Link href="/demo/offices" className={s.nav}><ArrowLeft className="size-4" /><span>{c.reception}</span></Link>}<Link href="/demo/workzone" className={s.nav}><Building2 className="size-4" /><span>{c.workzone}</span></Link>{o.data && !room && <Link href={`/demo/offices/${o.data.actor}`} className={s.nav}><DoorOpen className="size-4" />{c.myOffice}</Link>}<Button variant="ghost" className="size-11 shrink-0 rounded-full p-0" aria-label={c.refresh} disabled={o.pending} onClick={() => void o.refresh()}><RefreshCw className="size-4" /></Button></nav>
    </header>
    {o.error && !panel && <p role="alert" className="rounded-xl border bg-card p-3 text-sm">{errorText(o.error)}</p>}
    {!o.data && !o.error && <p role="status" className="text-sm">{c.loading}</p>}
    {o.data && (!room ? <>
      <div className={s.persona}><label htmlFor="office-persona" className="text-xs font-semibold">{c.simulate}</label><select id="office-persona" className={`${control} max-w-sm`} value={o.data.actor} disabled={o.pending} onChange={e => void o.switchRole(e.target.value as OfficeRole).catch(() => {})}>{officeRoles.map(role => <option key={role} value={role}>{names[role]} · {officePeople[role]}</option>)}</select></div>
      <div className={s.reception} data-testid="office-reception-scene">
        <div className={s.wallBrand}>{logo ? <Image src={logo} alt="BaumdienstFlow · Musterfirma" width={100} height={100} unoptimized /> : <AppBrand mode="baumdienst" logoAlt="BaumdienstFlow · Musterfirma" />}</div>
        <nav aria-label={c.visitors} className={s.doors}>{officeRoles.filter(r => r !== "reception").map(role => <Link key={role} href={`/demo/offices/${role}`} className={s.door}><DoorOpen className="size-4" /><strong>{names[role]}</strong><span>{officePeople[role]}</span><ArrowRight className="size-4" /></Link>)}</nav>
        <Link href="/demo/offices/reception" className={s.receptionDesk}><BriefcaseBusiness className="size-4" /><span>{c.reception}</span><ArrowRight className="size-4" /></Link>
      </div>
    </> : <>
      {!o.data.own && <div className="max-w-xl space-y-3 rounded-2xl border bg-card p-4"><Status>{c.visit}</Status><p className="text-sm leading-relaxed">{c.visitor}</p><Link href={`/demo/offices/${o.data.actor}`} className={s.nav}>{c.myOffice}<ArrowRight className="size-4" /></Link></div>}
      <div className={s.room} data-testid="office-room-scene">
        <div className={s.deskIdentity}><span>{c.private}</span><h2>{officePeople[room]}</h2><p>{names[room]}</p></div>
        {o.data.own && <nav aria-label={names[room]} className={s.objects}>{shortcuts.map(({ id, label, icon: Icon }) => <button key={id} type="button" data-office-action={id} className={s.object} onClick={() => open(id)}><Icon className="size-5" /><span>{label}</span><ArrowRight className="size-4" /></button>)}<Link className={s.object} href="/demo/plan"><CalendarDays className="size-5" /><span>{c.plan}</span><ArrowRight className="size-4" /></Link></nav>}
      </div>
      {o.data.own && <details className="rounded-2xl border bg-card px-3"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold"><Mail className="size-4" />{c.email}</summary><p className="max-w-2xl pb-3 text-sm leading-relaxed text-muted-foreground">{c.emailHint}</p></details>}
    </>)}
    <p className="text-xs text-muted-foreground">{c.roleHint}</p>
    {o.data?.own && room && <WorkshopDialog open={!!panel} onClose={() => router.push(path, { scroll: false })} closeLabel={c.close} title={panel ? c[panel] : names[room]} description={`${officePeople[room]} · ${names[room]} · Musterfirma`} wide={panel === "staff" || panel === "offers"}>
      {o.error && <div role="alert" className="mb-4 space-y-2 rounded-xl border p-3 text-sm"><p>{errorText(o.error)}</p>{o.error !== "permission" && <p className="text-xs text-muted-foreground">{c.lost}</p>}<Button variant="outline" className="min-h-11" onClick={() => void o.refresh()}>{c.retry}</Button></div>}
      {!allowed ? <p role="alert" className="text-sm">{c.permission}</p> : panel === "archive" ? <OfficeArchive controller={o} lang={lang} /> : panel === "tasks" ? <OfficeTasks controller={o} lang={lang} /> : panel === "inquiries" ? <OfficeInquiries controller={o} lang={lang} /> : panel === "site" ? <OfficeSiteForm controller={o} lang={lang} /> : panel === "offers" ? <OfficeQuotes controller={o} lang={lang} /> : panel === "staff" ? <OfficeStaff controller={o} lang={lang} month={month} onMonth={setMonth} /> : panel === "assistant" ? <OfficeAssistant controller={o} lang={lang} /> : <p className="text-sm">{c.emailHint}</p>}
    </WorkshopDialog>}
  </div>;
}
