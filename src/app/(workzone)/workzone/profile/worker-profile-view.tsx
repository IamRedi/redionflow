import Image from "next/image";
import Link from "next/link";
import { LogOut, Mail, MessageCircle, Pencil, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { reportLocale } from "@/lib/workzone/date-utils";
import { dateKey, monthKey } from "@/lib/workzone/reporting";
import { hasOpenPause, isReportableSession, totalPauseMinutes } from "@/lib/workzone/session-rules";
import { isRecord } from "@/lib/workzone/site-json";
import { logoutWorkerAction } from "../hr-actions";
import { updateWorkerContactDetailsFormAction } from "../hr-actions";
import { updateWorkerClothingSizesFormAction } from "../hr-actions";
import { updateNotificationSettingsFormAction } from "../hr-actions";
import { updateWorkerLanguagePreferencesFormAction } from "../hr-actions";
import { approveVacationRequestAction, rejectVacationRequestAction, requestVacationAction } from "../vacation-actions";
import { VacationRequestForm } from "./vacation-request-form";
import { ReportPeriodPicker } from "./report-period-picker";
import { WorkSessionControls } from "./work-session-controls";
import { NotificationEnableButton } from "./notification-enable-button";
import { WorkerAssets, WorkerPhotoButton } from "./worker-assets";
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
  level: string;
  availability: string;
  vacationAllowanceDays: number;
  profileImageUrl: string | null;
  documents: unknown;
  preferredLanguage?: string;
  motherTongue?: string;
  assetItems: Array<{
    id: string;
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
  const currentLang = await resolveRequestLanguage();
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="h-28 bg-gradient-to-r from-muted via-muted to-background dark:from-brand-green/30" />
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-6">
          <div className="-mt-12 flex items-end gap-4">
            <div className="relative size-28">
              <div className="relative flex size-28 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted text-3xl font-semibold shadow-sm">
                {worker.profileImageUrl ? (
                  <Image src={worker.profileImageUrl} unoptimized={worker.profileImageUrl.startsWith("/api/private-files?")} alt={`${worker.firstName} ${worker.lastName}`} fill sizes="112px" className="object-cover" />
                ) : (
                  initials
                )}
              </div>
              <WorkerPhotoButton workerId={worker.id} currentLang={currentLang} />
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-semibold">
                {worker.firstName} {worker.lastName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {worker.position ?? t("workzone.workerDefaultRole", currentLang)} {" · "} {worker.level} {" · "} {availabilityLabel(worker.availability, currentLang)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {backHref ? (
              <Button asChild variant="outline">
                <Link href={backHref}>{t("report.back", currentLang)}</Link>
              </Button>
            ) : null}
            {mode === "worker" ? (
              <form action={logoutWorkerAction}>
                <Button type="submit" variant="outline">
                  <LogOut className="size-4" />
                  {t("workzone.logout", currentLang)}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("workzone.liveStatusTitle", currentLang)}</CardTitle>
            <CardDescription>{t("workzone.liveStatusDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent>
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
            {/* Set once and rarely changed, so folded away. */}
            <details className="mt-3 rounded-md border">
              <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">{t("workzone.settingsFold", currentLang)}</summary>
              <div className="border-t p-3">
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
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("workzone.documentsTitle", currentLang)}</CardTitle>
            <CardDescription>{t("workzone.documentsDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent>
            <WorkerAssets workerId={worker.id} documents={documents} currentLang={currentLang} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("workzone.dataTitle", currentLang)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("common.phone", currentLang)}</span>
              <div className="flex items-center gap-1">
                <span className="mr-1 font-medium">{worker.phone ?? "-"}</span>
                {worker.phone ? (
                  <Button asChild variant="ghost" size="icon" className="size-8" title={t("common.phone", currentLang)}>
                    <a href={`tel:${worker.phone}`}>
                      <Phone className="size-4" />
                    </a>
                  </Button>
                ) : null}
                {whatsappUrl ? (
                  <Button asChild variant="ghost" size="icon" className="size-8" title={t("common.whatsapp", currentLang)}>
                    <a href={whatsappUrl} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4 text-brand-green" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("workzone.emailAccount", currentLang)}</span>
              <div className="flex items-center gap-1">
                <span className="font-medium">{worker.emailAccount ?? "-"}</span>
                {worker.emailAccount ? (
                  <Button asChild variant="ghost" size="icon" className="size-8" title={t("common.email", currentLang)}>
                    <a href={`mailto:${worker.emailAccount}`}>
                      <Mail className="size-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("workzone.positionLabel", currentLang)}</span>
              <span className="font-medium">{worker.position ?? "-"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("workzone.birthDateLabel", currentLang)}</span>
              <span className="font-medium">{formatProfileDate(worker.birthDate, currentLang)}</span>
            </div>
            <div>
              <div className="text-muted-foreground">{t("workzone.licensesLabel", currentLang)}</div>
              <div className="mt-1 rounded-md border bg-muted/30 px-3 py-2 font-medium">{worker.licenses ?? "-"}</div>
            </div>
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("workzone.equipmentClothingTitle", currentLang)}</CardTitle>
          <CardDescription>{t("workzone.equipmentClothingDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <WorkerInventory
            workerId={worker.id}
            mode={mode}
            items={worker.assetItems}
            catalogItems={catalogItems}
            movementHistory={inventoryMovements}
            currentLang={currentLang}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workzone.hoursHistoryTitle", currentLang)}</CardTitle>
          <CardDescription>{t("workzone.hoursHistoryDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-muted/20 p-4">
            <div>
              <div className="text-sm font-semibold">{t("workzone.ticketsReportsTitle", currentLang)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t("workzone.ticketsReportsDescription", currentLang)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={mode === "admin" ? `/app/admin/workers/${worker.id}/day/${todayKey}` : `/workzone/profile/day/${todayKey}`}>
                  {t("workzone.todayDailyReport", currentLang)}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={mode === "admin" ? `/app/admin/workers/${worker.id}/month/${currentMonthKey}` : `/workzone/profile/month/${currentMonthKey}`}>
                  {t("workzone.monthlyHoursReport", currentLang)}
                </Link>
              </Button>
            </div>
            <div className="flex w-full flex-wrap gap-3 border-t pt-3">
              <ReportPeriodPicker
                mode={mode}
                workerId={worker.id}
                reportType="day"
                initialValue={todayKey}
                buttonLabel={t("report.showDay", currentLang)}
              />
              <ReportPeriodPicker
                mode={mode}
                workerId={worker.id}
                reportType="month"
                initialValue={currentMonthKey}
                buttonLabel={t("report.showMonth", currentLang)}
              />
            </div>
          </div>

          <details>
            <summary className="cursor-pointer text-sm font-medium">{t("workzone.recentShiftsFold", currentLang)}</summary>
            <div className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("report.start", currentLang)}</TableHead>
                    <TableHead>{t("report.end", currentLang)}</TableHead>
                    <TableHead>{t("report.siteLocation", currentLang)}</TableHead>
                    <TableHead className="text-right">{t("report.break", currentLang)}</TableHead>
                    <TableHead className="text-right">{t("report.hours", currentLang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        {t("workzone.noCompletedSessions", currentLang)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{formatDateTime(session.startTime, currentLang)}</TableCell>
                        <TableCell>{formatDateTime(session.endTime, currentLang)}</TableCell>
                        <TableCell>{session.baustelle?.name ?? "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{session.breakMinutes} {t("common.minutes", currentLang)}</TableCell>
                        <TableCell className="text-right tabular-nums">{session.totalHours.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workzone.vacationTitle", currentLang)}</CardTitle>
          <CardDescription>{t("workzone.vacationDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{t("workzone.vacationTitle", currentLang)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("workzone.totalLabel", currentLang)} {worker.vacationAllowanceDays} {t("workzone.daysLabel", currentLang)}{" / "}{t("workzone.approvedStatus", currentLang)} {approvedVacationDays}{" / "}{t("workzone.pendingStatus", currentLang)} {pendingVacationDays}{" / "}{t("workzone.remainingLabel", currentLang)} {remainingVacationDays}
                </div>
              </div>
              {mode === "worker" ? (
                <VacationRequestForm workerId={worker.id} currentLang={currentLang} action={requestVacationFormAction} />
              ) : null}
            </div>

            <div className="mt-4 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("workzone.period", currentLang)}</TableHead>
                    <TableHead className="text-right">{t("workzone.daysLabel", currentLang)}</TableHead>
                    <TableHead>{t("workzone.statusLabel", currentLang)}</TableHead>
                    <TableHead>{t("workzone.messageLabel", currentLang)}</TableHead>
                    {mode === "admin" ? <TableHead className="text-right">{t("form.action", currentLang)}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacationRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={mode === "admin" ? 5 : 4} className="text-muted-foreground">
                        {t("workzone.noVacationRequests", currentLang)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    vacationRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          {formatProfileDate(request.startDate, currentLang)} - {formatProfileDate(request.endDate, currentLang)}
                          {request.workerNote ? <div className="mt-1 text-xs text-muted-foreground">{request.workerNote}</div> : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{request.requestedDays}</TableCell>
                        <TableCell>
                          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${vacationStatusClass(request.status)}`}>
                            {vacationStatusLabel(request.status, currentLang)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{request.adminMessage ?? "-"}</TableCell>
                        {mode === "admin" ? (
                          <TableCell className="text-right">
                            {request.status === "PENDING" ? (
                              <div className="flex justify-end gap-2">
                                <form action={approveVacationFormAction} className="flex gap-2">
                                  <input type="hidden" name="requestId" value={request.id} />
                                  <input name="adminMessage" className="h-8 w-36 rounded-md border bg-background px-2 text-xs" placeholder={t("workzone.messageLabel", currentLang)} />
                                  <Button type="submit" size="sm" variant="outline">
                                    {t("workzone.approve", currentLang)}
                                  </Button>
                                </form>
                                <form action={rejectVacationFormAction} className="flex gap-2">
                                  <input type="hidden" name="requestId" value={request.id} />
                                  <input name="adminMessage" className="h-8 w-36 rounded-md border bg-background px-2 text-xs" placeholder={t("workzone.reasonLabel", currentLang)} />
                                  <Button type="submit" size="sm" variant="outline">
                                    {t("workzone.reject", currentLang)}
                                  </Button>
                                </form>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{request.reviewedAt ? formatProfileDate(request.reviewedAt, currentLang) : "-"}</span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
