import { AssetWarehouse } from '@/components/company-assets/asset-warehouse';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { AssetPhoto } from '@/components/asset-photo';
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock3,
  HardHat,
  IdCard,
  LogOut,
  Mail,
  MessageCircle,
  Palmtree,
  Pencil,
  Phone,
  Plus,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { getCompanyCountry } from "@/lib/db/company";
import { reportLocale } from "@/lib/workzone/date-utils";
import { dateKey, monthKey } from "@/lib/workzone/reporting";
import { hasOpenPause, isReportableSession, totalPauseMinutes } from "@/lib/workzone/session-rules";
import { isRecord } from "@/lib/workzone/site-json";
import { logoutWorkerAction } from "../hr-actions";
import { updateWorkerContactDetailsFormAction } from "../hr-actions";
import { ChangeCodeForm } from "./change-code-form";
import { updateWorkerClothingSizesFormAction } from "../hr-actions";
import { updateNotificationSettingsFormAction } from "../hr-actions";
import { updateWorkerLanguagePreferencesFormAction } from "../hr-actions";
import { approveVacationRequestAction, rejectVacationRequestAction, requestVacationAction } from "../vacation-actions";
import { VacationRequestForm } from "./vacation-request-form";
import { ReportPeriodPicker } from "./report-period-picker";
import { WorkSessionControls } from "./work-session-controls";
import { NotificationEnableButton } from "./notification-enable-button";
import { WorkerAssets } from "./worker-assets";
import { WorkerInventory } from "./worker-inventory";

type WorkerDocument = {
  id: string;
  label: string;
  type: string;
  url: string;
  filename: string;
  uploadedAt: string;
};

type WorkerProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailAccount: string | null;
  clothingTopSize: string | null;
  clothingBottomSize: string | null;
  shoeSize: string | null;
  position: string | null;
  licenses: string | null;
  birthDate: Date | null;
  nationalId?: string | null;
  level: string;
  availability: string;
  vacationAllowanceDays: number;
  profileImageUrl: string | null;
  documents: unknown;
  preferredLanguage?: string;
  motherTongue?: string;
  assetItems: Array<{
    id: string;
    companyInventoryItemId?: string | null;
    kind: "CLOTHING" | "EQUIPMENT";
    itemName: string;
    itemCode: string | null;
    barcode: string | null;
    sizeLabel: string | null;
    isPrivate: boolean;
    note: string | null;
    handedOverAt: Date;
    status: string;
    createdByRole: string;
    createdByName: string | null;
  }>;
  sessions: Array<{
    id: string;
    startTime: Date;
    endTime: Date | null;
    breakMinutes: number;
    totalHours: number;
    isLive: boolean;
    baustelle?: { name: string } | null;
    pauseIntervals?: Array<{
      id: string;
      startedAt: Date;
      endedAt: Date | null;
    }>;
  }>;
  vacationRequests?: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    requestedDays: number;
    status: string;
    workerNote: string | null;
    adminMessage: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }>;
  notificationSettings?: {
    tagesplan: boolean;
    workStart: boolean;
    workEnd: boolean;
    adminMessages: boolean;
  } | null;
  companyProfile?: {
    workerPhoneGpsEnabled: boolean;
  } | null;
};

const WHATSAPP_LABEL = "WhatsApp";

function formatDateTime(date: Date | null, lang?: string) {
  return date ? date.toLocaleString(reportLocale(lang), { dateStyle: "short", timeStyle: "short" }) : "-";
}

function parseDocuments(value: unknown, fallbackLabel: string): WorkerDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
      .filter((item) => typeof item?.url === "string")
    .map((item) => ({
      id: String(item.id ?? item.url),
      label: String(item.label ?? item.filename ?? fallbackLabel),
      type: String(item.type ?? "document"),
      url: String(item.url),
      filename: String(item.filename ?? ""),
      uploadedAt: String(item.uploadedAt ?? ""),
    }));
}

function availabilityLabel(value: string, lang: string) {
  if (value === "SICK") return t("workzone.sickStatus", lang);
  if (value === "VACATION") return t("workzone.vacationStatus", lang);
  if (value === "UNAVAILABLE") return t("workzone.unavailableStatus", lang);
  return t("workzone.availableStatus", lang);
}

function formatProfileDate(date: Date | null, lang?: string) {
  return date ? date.toLocaleDateString(reportLocale(lang), { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
}

function vacationStatusLabel(status: string, lang: string) {
  if (status === "APPROVED") return t("workzone.approvedStatus", lang);
  if (status === "REJECTED") return t("workzone.rejectedStatus", lang);
  return t("workzone.pendingStatus", lang);
}

function vacationStatusClass(status: string) {
  if (status === "APPROVED") return "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  if (status === "REJECTED") return "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-200";
  return "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-200";
}

function whatsappHref(phone: string | null) {
  const cleaned = phone?.replace(/[^\d+]/g, "") ?? "";
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return `https://wa.me/${cleaned.slice(1)}`;
  if (cleaned.startsWith("00")) return `https://wa.me/${cleaned.slice(2)}`;
  if (cleaned.startsWith("0")) return `https://wa.me/49${cleaned.slice(1)}`;
  return `https://wa.me/${cleaned}`;
}

async function requestVacationFormAction(formData: FormData) {
  "use server";
  await requestVacationAction(formData);
}

async function approveVacationFormAction(formData: FormData) {
  "use server";
  await approveVacationRequestAction(formData);
}

async function rejectVacationFormAction(formData: FormData) {
  "use server";
  await rejectVacationRequestAction(formData);
}

export async function WorkerProfileView({
  worker,
  mode,
  backHref,
  catalogItems,
  inventoryMovements,
}: {
  worker: WorkerProfile;
  mode: "worker" | "admin";
  backHref?: string;
  catalogItems: Array<{
    id: string;
    category: "WORK_TOOL" | "CLOTHING" | "SITE_EQUIPMENT";
    itemCode: string;
    name: string;
    sizeLabel: string | null;
    note: string | null;
    isActive: boolean;
    barcode: string | null;
    assignedWorkerName?: string | null;
    assignedWorkerId?: string | null;
  }>;
  inventoryMovements: Array<{
    id: string;
    action: string;
    actorRole: string | null;
    actorName: string | null;
    barcode: string | null;
    isPrivate: boolean;
    note: string | null;
    createdAt: Date;
    item: { id: string; name: string; itemCode: string } | null;
  }>;
}) {
  const [currentLang, companyCountry] = await Promise.all([resolveRequestLanguage(), getCompanyCountry()]);
  const companyId = await getCurrentCompanyId();
  const assetOperations = Boolean(companyId && await isSteelCompany(companyId));
  const activeSession = worker.sessions.find((session) => session.isLive && !session.endTime) ?? null;
  const activePauseIntervals = activeSession?.pauseIntervals ?? [];
  const history = worker.sessions.filter((session) => (!session.isLive || session.endTime) && isReportableSession(session)).slice(0, 15);
  const todayKey = dateKey(new Date());
  const currentMonthKey = monthKey(new Date());
  const documents = parseDocuments(worker.documents, t("workzone.documentFallback", currentLang));
  const vacationRequests = worker.vacationRequests ?? [];
  const approvedVacationDays = vacationRequests
    .filter((request) => request.status === "APPROVED")
    .reduce((sum, request) => sum + request.requestedDays, 0);
  const pendingVacationDays = vacationRequests
    .filter((request) => request.status === "PENDING")
    .reduce((sum, request) => sum + request.requestedDays, 0);
  const remainingVacationDays = Math.max(0, worker.vacationAllowanceDays - approvedVacationDays);
  const initials = `${worker.firstName[0] ?? ""}${worker.lastName[0] ?? ""}`.toUpperCase();
  const whatsappUrl = whatsappHref(worker.phone);
  const notificationSettings = worker.notificationSettings ?? {
    tagesplan: true,
    workStart: true,
    workEnd: true,
    adminMessages: true,
  };

  const todayHours = worker.sessions
    .filter((session) => dateKey(session.startTime) === todayKey && isReportableSession(session))
    .reduce((sum, session) => sum + session.totalHours, 0);
  const monthHours = worker.sessions
    .filter((session) => monthKey(session.startTime) === currentMonthKey && isReportableSession(session))
    .reduce((sum, session) => sum + session.totalHours, 0);
  const vacationPct = worker.vacationAllowanceDays > 0 ? Math.round((remainingVacationDays / worker.vacationAllowanceDays) * 100) : 0;
  const dayHref = mode === "admin" ? `/app/admin/workers/${worker.id}/day/${todayKey}` : `/workzone/profile/day/${todayKey}`;
  const monthHref = mode === "admin" ? `/app/admin/workers/${worker.id}/month/${currentMonthKey}` : `/workzone/profile/month/${currentMonthKey}`;
  const available = worker.availability === "AVAILABLE";
  const details = (
    [
      [t("workzone.positionLabel", currentLang), worker.position],
      [t("workzone.birthDateLabel", currentLang), worker.birthDate ? formatProfileDate(worker.birthDate, currentLang) : null],
      [t("workzone.nationalIdLabel", currentLang), worker.nationalId ?? null],
      [t("workzone.licensesLabel", currentLang), worker.licenses],
      [t("common.phone", currentLang), worker.phone],
      [t("workzone.emailAccount", currentLang), worker.emailAccount],
    ] as const
  ).filter(([, value]) => Boolean(value));
  const section = "rounded-2xl border bg-card p-3 sm:p-4";
  const sectionTitle = "flex items-center gap-2 text-sm font-semibold";
  const metricLink = "group flex min-h-16 min-w-0 flex-col justify-center gap-1 px-2 py-2 transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3" data-testid="worker-profile">
      {/* Who: photo, name, role. Start and stop right below. */}
      <section className="relative overflow-hidden rounded-2xl border bg-card" data-testid="worker-profile-summary">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
        <div className="relative flex flex-wrap items-center gap-3 p-3 sm:p-4">
          <AssetPhoto kind="worker" id={worker.id} src={worker.profileImageUrl} alt={`${worker.firstName} ${worker.lastName}`} canEdit
            className="relative size-14 shrink-0 sm:size-16" imageClassName="size-full rounded-full border-2 border-background object-cover shadow-sm">
            <div className="flex size-full items-center justify-center rounded-full border-2 border-background bg-muted text-lg font-semibold shadow-sm">
              {initials}
            </div>
          </AssetPhoto>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
              {worker.firstName} {worker.lastName}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">{worker.position ?? t("workzone.workerDefaultRole", currentLang)}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${available ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                <span className={`size-1.5 rounded-full ${available ? "bg-green-500" : "bg-amber-500"}`} />
                {availabilityLabel(worker.availability, currentLang)}
              </span>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1 self-start">
            {worker.phone ? (
              <a href={`tel:${worker.phone}`} title={worker.phone} aria-label={t("common.phone", currentLang)} className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground">
                <Phone className="size-4" />
              </a>
            ) : null}
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" title={WHATSAPP_LABEL} aria-label={WHATSAPP_LABEL} className="grid size-9 place-items-center rounded-full text-green-600 transition hover:bg-green-500/10">
                <MessageCircle className="size-4" />
              </a>
            ) : null}
            {worker.emailAccount ? (
              <a href={`mailto:${worker.emailAccount}`} title={worker.emailAccount} aria-label={t("common.email", currentLang)} className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground">
                <Mail className="size-4" />
              </a>
            ) : null}
            {backHref ? (
              <Link href={backHref} title={t("report.back", currentLang)} aria-label={t("report.back", currentLang)} className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground">
                <ArrowLeft className="size-4" />
              </Link>
            ) : null}
            {mode === "worker" ? (
              <form action={logoutWorkerAction}>
                <button type="submit" title={t("workzone.logout", currentLang)} aria-label={t("workzone.logout", currentLang)} className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600">
                  <LogOut className="size-4" />
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-2 px-3 pb-3 sm:px-4">
          <WorkSessionControls
            workerId={worker.id}
            workerPhoneGpsEnabled={mode === "worker" && (worker.companyProfile?.workerPhoneGpsEnabled ?? false)}
            activeSession={
              activeSession
                ? {
                    id: activeSession.id,
                    startTime: activeSession.startTime.toISOString(),
                    breakMinutes: activeSession.breakMinutes,
                    manualPauseMinutes: totalPauseMinutes(activePauseIntervals),
                    hasManualPause: activePauseIntervals.length > 0,
                    isPaused: hasOpenPause(activePauseIntervals),
                  }
                : null
            }
          />
          <WorkerAssets workerId={worker.id} documents={documents} currentLang={currentLang} />
        </div>
        <div className="relative grid grid-cols-3 divide-x border-t" data-testid="worker-profile-metrics">
          <Link href={dayHref} className={metricLink}>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground">
              <CalendarDays className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
              <span className="truncate">{t("workzone.tileToday", currentLang)}</span>
            </span>
            <span className="text-base font-semibold leading-tight tabular-nums">{`${todayHours.toFixed(1)} h`}</span>
          </Link>
          <Link href={monthHref} className={metricLink}>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground">
              <CalendarRange className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
              <span className="truncate">{t("workzone.tileMonth", currentLang)}</span>
            </span>
            <span className="text-base font-semibold leading-tight tabular-nums">{`${monthHours.toFixed(0)} h`}</span>
          </Link>
          <a href="#pushimi" className={metricLink}>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground">
              <Palmtree className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
              <span className="truncate">{t("workzone.tileVacation", currentLang)}</span>
            </span>
            <span className="text-base font-semibold leading-tight tabular-nums">
              {remainingVacationDays}<span className="text-xs font-normal text-muted-foreground">/{worker.vacationAllowanceDays}</span>
            </span>
          </a>
        </div>
      </section>

      <section className={section}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={sectionTitle}>
            <Clock3 className="size-4 text-primary" strokeWidth={1.8} /> {t("workzone.hoursHistoryTitle", currentLang)}
          </div>
          <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto">
            <ReportPeriodPicker mode={mode} workerId={worker.id} reportType="day" initialValue={todayKey} buttonLabel={t("report.showDay", currentLang)} />
            <ReportPeriodPicker mode={mode} workerId={worker.id} reportType="month" initialValue={currentMonthKey} buttonLabel={t("report.showMonth", currentLang)} />
          </div>
        </div>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("workzone.noCompletedSessions", currentLang)}</p>
        ) : (
          <ul className="mt-3 divide-y">
            {history.slice(0, 6).map((session) => (
              <li key={session.id} className="flex items-center gap-3 py-2 text-sm" title={`${formatDateTime(session.startTime, currentLang)} – ${formatDateTime(session.endTime, currentLang)} · ${t("report.break", currentLang)} ${session.breakMinutes} ${t("common.minutes", currentLang)}`}>
                <span className="w-20 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{formatProfileDate(session.startTime, currentLang)}</span>
                <span className="min-w-0 flex-1 truncate">{session.baustelle?.name ?? "—"}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">{`${session.totalHours.toFixed(1)} h`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="pushimi" className={`${section} scroll-mt-28`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={sectionTitle}>
            <Palmtree className="size-4 text-primary" strokeWidth={1.8} /> {t("workzone.vacationTitle", currentLang)}
          </div>
          <span className="text-xs text-muted-foreground" title={`${t("workzone.approvedStatus", currentLang)} ${approvedVacationDays} · ${t("workzone.pendingStatus", currentLang)} ${pendingVacationDays}`}>
            {t("workzone.remainingLabel", currentLang)} <b className="text-foreground">{remainingVacationDays}</b> / {worker.vacationAllowanceDays} {t("workzone.daysLabel", currentLang)}
          </span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${vacationPct}%` }} />
        </div>
        {vacationRequests.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {vacationRequests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm" title={[request.workerNote, request.adminMessage].filter(Boolean).join(" · ") || undefined}>
                <span className="font-medium tabular-nums">
                  {formatProfileDate(request.startDate, currentLang)} – {formatProfileDate(request.endDate, currentLang)}
                </span>
                <span className="text-xs text-muted-foreground">{request.requestedDays} {t("workzone.daysLabel", currentLang)}</span>
                <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${vacationStatusClass(request.status)}`}>{vacationStatusLabel(request.status, currentLang)}</span>
                {mode === "admin" && request.status === "PENDING" ? (
                  <div className="flex w-full flex-wrap justify-end gap-2">
                    <form action={approveVacationFormAction} className="flex gap-2">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input name="adminMessage" className="h-8 w-36 rounded-full border bg-background px-3 text-xs" placeholder={t("workzone.messageLabel", currentLang)} />
                      <Button type="submit" size="sm" variant="outline" className="h-8 rounded-full">
                        {t("workzone.approve", currentLang)}
                      </Button>
                    </form>
                    <form action={rejectVacationFormAction} className="flex gap-2">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input name="adminMessage" className="h-8 w-36 rounded-full border bg-background px-3 text-xs" placeholder={t("workzone.reasonLabel", currentLang)} />
                      <Button type="submit" size="sm" variant="outline" className="h-8 rounded-full">
                        {t("workzone.reject", currentLang)}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {mode === "worker" ? (
          <details className="group mt-3">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition hover:border-primary/40 [&::-webkit-details-marker]:hidden">
              <Plus className="size-4 text-primary transition-transform group-open:rotate-45" /> {t("workzone.requestVacation", currentLang)}
            </summary>
            <div className="mt-2">
              <VacationRequestForm workerId={worker.id} currentLang={currentLang} country={companyCountry} action={requestVacationFormAction} />
            </div>
          </details>
        ) : null}
      </section>

      {/* Everything set once and rarely opened stays folded. */}
      <details className={`${section} group`}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <IdCard className="size-4 text-primary" strokeWidth={1.8} /> {t("workzone.moreAboutMe", currentLang)}
          <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-4">
          {details.length > 0 ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/40 px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="truncate text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {mode === "worker" ? <ChangeCodeForm currentLang={currentLang} /> : null}
          {mode === "admin" ? (
              <details className="rounded-md border bg-muted/20 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                  <span>{t("workzone.editProfileData", currentLang)}</span>
                  <Pencil className="size-4 text-muted-foreground" />
                </summary>
                <form action={updateWorkerContactDetailsFormAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="workerId" value={worker.id} />
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    {t("common.phone", currentLang)}
                    <Input name="phone" defaultValue={worker.phone ?? ""} className="h-9 text-sm" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    {t("workzone.emailAccount", currentLang)}
                    <Input name="emailAccount" type="email" defaultValue={worker.emailAccount ?? ""} className="h-9 text-sm" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    {t("workzone.positionLabel", currentLang)}
                    <Input name="position" defaultValue={worker.position ?? ""} className="h-9 text-sm" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    {t("workzone.licensesLabel", currentLang)}
                    <Input name="licenses" defaultValue={worker.licenses ?? ""} className="h-9 text-sm" />
                  </label>
                  <div className="flex justify-end sm:col-span-2">
                    <Button type="submit" variant="outline" size="sm">
                      {t("common.save", currentLang)}
                    </Button>
                  </div>
                </form>
              </details>
            ) : null}

          <div className="space-y-3">
            <div className={sectionTitle}>
              <HardHat className="size-4 text-primary" strokeWidth={1.8} /> {t("workzone.equipmentClothingTitle", currentLang)}
            </div>
          <details className="rounded-md border bg-muted/20 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{t("workzone.clothingSizes", currentLang)}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{t("workzone.clothingTop", currentLang)}: <span className="font-medium text-foreground">{worker.clothingTopSize ?? "-"}</span></span>
                  <span>{t("workzone.clothingBottom", currentLang)}: <span className="font-medium text-foreground">{worker.clothingBottomSize ?? "-"}</span></span>
                  <span>{t("workzone.shoes", currentLang)}: <span className="font-medium text-foreground">{worker.shoeSize ?? "-"}</span></span>
                </div>
              </div>
              <span className="inline-flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:text-foreground">
                <Pencil className="size-4" />
              </span>
            </summary>

            <form action={updateWorkerClothingSizesFormAction} className="mt-3 grid gap-3 border-t pt-3">
              <input type="hidden" name="workerId" value={worker.id} />
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">{t("workzone.clothingTop", currentLang)}</span>
                  <input
                    name="clothingTopSize"
                    defaultValue={worker.clothingTopSize ?? ""}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    placeholder={t("workzone.clothingTopPlaceholder", currentLang)}
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">{t("workzone.clothingBottom", currentLang)}</span>
                  <input
                    name="clothingBottomSize"
                    defaultValue={worker.clothingBottomSize ?? ""}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    placeholder={t("workzone.clothingBottomPlaceholder", currentLang)}
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">{t("workzone.shoes", currentLang)}</span>
                  <input
                    name="shoeSize"
                    defaultValue={worker.shoeSize ?? ""}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    placeholder={t("workzone.shoesPlaceholder", currentLang)}
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" size="sm">
                  {t("common.save", currentLang)}
                </Button>
              </div>
            </form>
          </details>

          {assetOperations && <section className="space-y-3"><AssetWarehouse workerId={worker.id}/></section>}
          <WorkerInventory
            workerId={worker.id}
            mode={mode}
            items={assetOperations ? worker.assetItems.filter(item => item.isPrivate || !item.companyInventoryItemId) : worker.assetItems}
            catalogItems={assetOperations ? [] : catalogItems}
            movementHistory={inventoryMovements}
            currentLang={currentLang}
          />
          </div>

          <div className="space-y-3">
            <div className={sectionTitle}>
              <Settings2 className="size-4 text-primary" strokeWidth={1.8} /> {t("workzone.settingsFold", currentLang)}
            </div>
              <form action={updateWorkerLanguagePreferencesFormAction} className="grid gap-2 rounded-md border p-3">
                <input type="hidden" name="workerId" value={worker.id} />
                <div className="text-xs font-semibold">{t("workzone.language", currentLang)}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted-foreground">{t("admin.motherTongue", currentLang)}</span>
                    <select
                      name="motherTongue"
                      defaultValue={worker.motherTongue ?? "DE"}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="DE">{t("language.de", currentLang)}</option>
                      <option value="EN">{t("language.en", currentLang)}</option>
                      <option value="SQ">{t("language.sq", currentLang)}</option>
                      <option value="IT">{t("language.it", currentLang)}</option>
                      <option value="PL">{t("language.pl", currentLang)}</option>
                      <option value="RO">{t("language.ro", currentLang)}</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted-foreground">{t("admin.responseLanguage", currentLang)}</span>
                    <select
                      name="preferredLanguage"
                      defaultValue={worker.preferredLanguage ?? "DE"}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="DE">{t("language.de", currentLang)}</option>
                      <option value="EN">{t("language.en", currentLang)}</option>
                      <option value="SQ">{t("language.sq", currentLang)}</option>
                      <option value="IT">{t("language.it", currentLang)}</option>
                      <option value="PL">{t("language.pl", currentLang)}</option>
                      <option value="RO">{t("language.ro", currentLang)}</option>
                    </select>
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="outline" size="sm">
                    {t("common.save", currentLang)}
                  </Button>
                </div>
              </form>
              <form action={updateNotificationSettingsFormAction} className="mt-3 grid gap-3 rounded-md border p-3">
                <input type="hidden" name="userId" value={worker.id} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold">{t("workzone.pushNotifications", currentLang)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t("workzone.pushNotificationsDescription", currentLang)}</div>
                  </div>
                  <NotificationEnableButton />
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="tagesplan" defaultChecked={notificationSettings.tagesplan} className="size-4 accent-brand-green" />
                    {t("workzone.dailyPlanUpdates", currentLang)}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="workStart" defaultChecked={notificationSettings.workStart} className="size-4 accent-brand-green" />
                    {t("workzone.workStartNotifications", currentLang)}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="workEnd" defaultChecked={notificationSettings.workEnd} className="size-4 accent-brand-green" />
                    {t("workzone.workEndNotifications", currentLang)}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="adminMessages" defaultChecked={notificationSettings.adminMessages} className="size-4 accent-brand-green" />
                    {t("workzone.adminMessages", currentLang)}
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="outline" size="sm">
                    {t("common.save", currentLang)}
                  </Button>
                </div>
              </form>
          </div>
        </div>
      </details>
    </div>
  );
}
