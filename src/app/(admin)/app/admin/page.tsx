import { requireAdminTenant } from "@/lib/auth/authorization";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BriefcaseBusiness, Eye, HardHat, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminWorkerCard } from "./admin-worker-card";
import { deleteWorkerAction, updateWorkerAction } from "./worker-admin-actions";
import { hashPassword } from "@/lib/auth/password";
import { ASSISTANT_LANGUAGE_OPTIONS, normalizeAssistantLanguage } from "@/lib/assistant/language";
import { checkLimit } from "@/lib/billing/limits";
import { getCompanyMode, getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { MACHINE_CATEGORY_OPTIONS, machineOptionLabel, type MachineCategoryCode } from "@/lib/machines/display";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { cn } from "@/lib/ui/cn";
import type { CompanyMode } from "@/lib/mode-config";
import { reportLocale } from "@/lib/workzone/date-utils";
import { dateKey, monthKey } from "@/lib/workzone/reporting";

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeLoginCode(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function generatedLoginCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function machineNameFromForm(formData: FormData) {
  return cleanText(formData.get("nickname")) ?? cleanText(formData.get("model")) ?? cleanText(formData.get("targe")) ?? "Machine";
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? new Date(`${text}T00:00:00`) : null;
}

function cleanInt(value: FormDataEntryValue | null, fallback: number) {
  const next = Math.floor(Number(value ?? fallback));
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function cleanMoneyCents(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return 0;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

function cleanOptionalMoneyCents(value: FormDataEntryValue | null) {
  const cents = cleanMoneyCents(value);
  return cents > 0 ? cents : null;
}

function inspectionState(date: Date | null, status?: string | null) {
  const text = (status ?? "").toLowerCase();
  if (text.includes("abgelaufen")) return "red";
  if (text.includes("monat")) return "yellow";
  if (text.includes("gültig") || text.includes("gueltig")) return "green";
  if (!date) return "gray";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "red";
  if (diffDays <= 31) return "yellow";
  return "green";
}

function dateLabel(date: Date | null, lang?: string) {
  if (!date) return "-";
  return date.toLocaleDateString(reportLocale(lang), { month: "2-digit", year: "2-digit" });
}

function dateValue(date: Date | null) {
  return date ? dateKey(date) : "";
}

function todayKey() {
  return dateKey(new Date());
}

function currentMonthKey() {
  return monthKey(new Date());
}

function ageLabel(date: Date | null) {
  if (!date) return "-";
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age -= 1;
  return `${age}`;
}

function workerAvailabilityClass(value: string) {
  if (value === "AVAILABLE") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200";
  if (value === "SICK") return "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-200";
  if (value === "VACATION") return "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-200";
  return "border-muted-foreground/30 bg-muted text-muted-foreground";
}

// BDF-P8-007 accessibility: never rely on colour alone (WCAG 1.4.1).
// Every state also carries a distinct glyph shape (✓ / ! / ✗ / –) inside
// the dot and a translated `aria-label` on the wrapper so screen readers
// announce the status without depending on the visual cue.
type InspectionState = "green" | "yellow" | "red" | "gray";

const INSPECTION_GLYPH: Record<InspectionState, string> = {
  green: "✓",
  yellow: "!",
  red: "✗",
  gray: "–",
};

const INSPECTION_STATUS_KEY: Record<InspectionState, string> = {
  green: "admin.inspectionStatusOk",
  yellow: "admin.inspectionStatusWarning",
  red: "admin.inspectionStatusExpired",
  gray: "admin.inspectionStatusUnknown",
};

function InspectionDot({
  label,
  date,
  status,
  currentLang,
  mode,
}: {
  label: string;
  date: Date | null;
  status?: string | null;
  currentLang?: string;
  mode?: CompanyMode;
}) {
  const state = inspectionState(date, status) as InspectionState;
  const statusText = t(INSPECTION_STATUS_KEY[state], currentLang, mode);
  return (
    <span
      className="inline-flex min-w-24 items-center gap-2 rounded-md border px-2 py-1 text-xs"
      // Announce every InspectionDot as a single accessible unit so a
      // screen reader reads "HU: valid, 03/26" instead of enumerating
      // three unlabelled decorations.
      role="group"
      aria-label={`${label}: ${statusText}${date ? `, ${dateLabel(date)}` : ""}`}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none",
          state === "green" ? "bg-emerald-500 text-white" : "",
          state === "yellow" ? "bg-amber-400 text-amber-950" : "",
          state === "red" ? "bg-red-500 text-white" : "",
          state === "gray" ? "bg-muted-foreground/35 text-foreground/70" : "",
        )}
      >
        {INSPECTION_GLYPH[state]}
      </span>
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{dateLabel(date, currentLang)}</span>
    </span>
  );
}

function machineCategoryText(category: string | null | undefined, currentLang: string, mode: CompanyMode) {
  const key = category && ["TRUCK", "AWP", "CHIPPER", "CHAINSAW", "OTHER"].includes(category) ? category : "OTHER";
  return t(`workzone.machineCategory.${key}`, currentLang, mode);
}

async function createWorker(formData: FormData) {
  "use server";
    await requireAdminTenant();

  const companyId = String(formData.get("companyId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!companyId || !firstName || !lastName) return;

  // T-025b: cross-check tenant. T-028: block on plan limit.
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId || currentCompanyId !== companyId) return;
  const limit = await checkLimit(currentCompanyId, "workers");
  if (!limit.ok) return;

  const isTemporary = formData.get("isTemporary") === "on";
  const enteredLoginCode = normalizeLoginCode(formData.get("loginCode"));
  const loginCode = enteredLoginCode || (isTemporary ? "" : generatedLoginCode());
  if (loginCode && loginCode.length !== 6) return;

  await prisma.worker.create({
    data: {
      companyProfileId: companyId,
      firstName,
      lastName,
      phone: cleanText(formData.get("phone")),
      emailAccount: cleanText(formData.get("emailAccount")),
      position: cleanText(formData.get("position")),
      licenses: cleanText(formData.get("licenses")),
      status: formData.get("status") === "inactive" ? "inactive" : "active",
      availability: String(formData.get("availability") ?? "AVAILABLE") as any,
      vacationAllowanceDays: cleanInt(formData.get("vacationAllowanceDays"), 26),
      // BDF-P1-005: hash the raw code into `loginCodeHash`; never persist
      // it verbatim into `loginCode` (the legacy plaintext column is
      // read-only from here on).
      loginCode: null,
      loginCodeHash: loginCode ? hashPassword(loginCode) : null,
      isTemporary,
      birthDate: cleanDate(formData.get("birthDate")),
      startedAtCompany: cleanDate(formData.get("startedAtCompany")),
      level: String(formData.get("level") ?? "JUNIOR") as any,
      preferredLanguage: normalizeAssistantLanguage(formData.get("preferredLanguage")),
      motherTongue: normalizeAssistantLanguage(formData.get("motherTongue")),
    },
  });

  revalidatePath("/app/admin");
  revalidatePath("/workzone");
}

async function createMachine(formData: FormData) {
  "use server";
    await requireAdminTenant();

  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) return;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId || currentCompanyId !== companyId) return;
  const limit = await checkLimit(currentCompanyId, "machines");
  if (!limit.ok) return;

  const name = machineNameFromForm(formData);
  await prisma.machine.create({
    data: {
      companyProfileId: companyId,
      name,
      nickname: cleanText(formData.get("nickname")) ?? name,
      model: cleanText(formData.get("model")),
      targe: cleanText(formData.get("targe")),
      tuvDate: cleanDate(formData.get("tuvDate")),
      huStatus: cleanText(formData.get("huStatus")),
      spDate: cleanDate(formData.get("spDate")),
      spStatus: cleanText(formData.get("spStatus")),
      uvvDate: cleanDate(formData.get("uvvDate")),
      uvvStatus: cleanText(formData.get("uvvStatus")),
      funksioni: cleanText(formData.get("funksioni")),
      category: String(formData.get("category") ?? "OTHER") as MachineCategoryCode,
      hourlyRateCents: cleanMoneyCents(formData.get("hourlyEur")),
      dayRateCents: cleanOptionalMoneyCents(formData.get("dayEur")),
      isActive: true,
    },
  });

  revalidatePath("/app/admin");
  revalidatePath("/workzone");
  notifyRealtimeUpdate("machine.updated", ["machine-sidebar"]);
}

async function deleteMachine(formData: FormData) {
  "use server";
    const companyProfileId = await requireAdminTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.machine.deleteMany({ where: { id, companyProfileId } });
  revalidatePath("/app/admin");
  revalidatePath("/app/machines");
  revalidatePath("/workzone");
  notifyRealtimeUpdate("machine.updated", ["machine-sidebar"]);
}

export default async function AdminHrFleetPage() {
  const [company, mode, currentLang] = await Promise.all([
    getOrCreateDefaultCompany(),
    getCompanyMode(),
    resolveRequestLanguage(),
  ]);
  const reportTodayKey = todayKey();
  const reportMonthKey = currentMonthKey();
  const [workers, machines] = await Promise.all([
    prisma.worker.findMany({
      where: { companyProfileId: company.id },
      orderBy: [{ status: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.machine.findMany({
      where: { companyProfileId: company.id },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        nickname: true,
        model: true,
        targe: true,
        category: true,
        tuvDate: true,
        huStatus: true,
        spDate: true,
        spStatus: true,
        uvvDate: true,
        uvvStatus: true,
        funksioni: true,
        isActive: true,
      },
    }),
  ]);
  const activeWorkers = workers.filter((worker) => worker.status === "active").length;
  const unavailableWorkers = workers.filter((worker) => worker.availability !== "AVAILABLE").length;
  const inactiveWorkers = workers.length - activeWorkers;
  const activeMachines = machines.filter((machine) => machine.isActive).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="rounded-3xl border bg-card/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("admin.hrHeading", currentLang, mode)}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("admin.hrSubtitle", currentLang, mode)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="#workers">{t("admin.hrJumpWorkers", currentLang, mode)}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="#machines">{t("admin.hrJumpFleet", currentLang, mode)}</Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.hrActiveWorkers", currentLang, mode)}</div>
            <div className="mt-2 text-2xl font-semibold">{activeWorkers}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("admin.hrOfTotal", currentLang, mode)} {workers.length}</div>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.hrUnavailable", currentLang, mode)}</div>
            <div className="mt-2 text-2xl font-semibold">{unavailableWorkers}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("admin.hrUnavailableSub", currentLang, mode)}</div>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.hrMachinesActive", currentLang, mode)}</div>
            <div className="mt-2 text-2xl font-semibold">{activeMachines}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("admin.hrMachinesActiveSub", currentLang, mode)}</div>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.hrInactiveWorkers", currentLang, mode)}</div>
            <div className="mt-2 text-2xl font-semibold">{inactiveWorkers}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("admin.hrInactiveWorkersSub", currentLang, mode)}</div>
          </div>
        </div>
      </div>
      <div>
        <div className="sr-only">{t("admin.operations", currentLang, mode)}</div>
        <p className="sr-only">
          {t("admin.hrFleetDescription", currentLang, mode)}
        </p>
      </div>

      <section className="space-y-3">
        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.hrStaffLabel", currentLang, mode)}</div>
          <h2 className="mt-2 text-lg font-semibold">{t("admin.hrWorkerManagement", currentLang, mode)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.hrWorkerManagementSub", currentLang, mode)}
          </p>
        </div>

      <Card id="workers" className="scroll-mt-28">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardHat className="size-4" />
            {t("admin.workersCardTitle", currentLang, mode)}
          </CardTitle>
          <CardDescription>{t("admin.workersCardDescription", currentLang, mode)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border bg-muted/20 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.quickAccess", currentLang, mode)}</div>
            <div className="flex flex-wrap gap-2">
            {workers.map((worker) => (
              <Button key={worker.id} asChild variant="outline" size="sm" className={workerAvailabilityClass(worker.availability)}>
                <Link href={`/app/admin/workers/${worker.id}`}>
                  {worker.firstName} {worker.lastName}
                </Link>
              </Button>
            ))}
            </div>
          </div>

          <details className="rounded-2xl border bg-card/50 p-3">
            <summary className="cursor-pointer list-none text-sm font-medium">{t("admin.createWorkerToggle", currentLang, mode)}</summary>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("admin.createWorkerDescription", currentLang, mode)}
            </p>
            <form action={createWorker} className="mt-4 grid gap-3 md:grid-cols-10">
              <input type="hidden" name="companyId" value={company.id} />
              <div className="space-y-1.5">
              <Label htmlFor="firstName">{t("admin.colFirstName", currentLang, mode)}</Label>
              <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-1.5">
              <Label htmlFor="lastName">{t("admin.colLastName", currentLang, mode)}</Label>
              <Input id="lastName" name="lastName" required />
              </div>
              <div className="space-y-1.5">
              <Label htmlFor="phone">{t("admin.colPhone", currentLang, mode)}</Label>
              <Input id="phone" name="phone" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="emailAccount">{t("admin.colEmail", currentLang, mode)}</Label>
              <Input id="emailAccount" name="emailAccount" type="email" />
              </div>
              <div className="space-y-1.5">
              <Label htmlFor="position">{t("admin.colPosition", currentLang, mode)}</Label>
              <Input id="position" name="position" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="licenses">{t("admin.colLicenses", currentLang, mode)}</Label>
              <Input id="licenses" name="licenses" placeholder={t("admin.licensesPlaceholder", currentLang, mode)} />
              </div>
              <div className="space-y-1.5">
              <Label htmlFor="loginCode">{t("admin.colLoginCode", currentLang, mode)}</Label>
              <Input id="loginCode" name="loginCode" inputMode="numeric" maxLength={6} placeholder={t("admin.autoPlaceholder", currentLang, mode)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vacationAllowanceDays">{t("admin.vacationDays", currentLang, mode)}</Label>
              <Input id="vacationAllowanceDays" name="vacationAllowanceDays" type="number" min="0" defaultValue={26} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="level">{t("admin.colLevel", currentLang, mode)}</Label>
              <select id="level" name="level" defaultValue="JUNIOR" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="JUNIOR">{t("admin.levelJunior", currentLang, mode)}</option>
                <option value="WORKER">{t("admin.levelWorker", currentLang, mode)}</option>
                <option value="SENIOR">{t("admin.levelSenior", currentLang, mode)}</option>
                <option value="VORARBEITER">{t("admin.levelForeman", currentLang, mode)}</option>
                <option value="MEISTER">{t("admin.levelMaster", currentLang, mode)}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="availability">{t("admin.colAvailability", currentLang, mode)}</Label>
              <select id="availability" name="availability" defaultValue="AVAILABLE" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="AVAILABLE">{t("admin.availabilityAvailable", currentLang, mode)}</option>
                <option value="SICK">{t("admin.availabilitySick", currentLang, mode)}</option>
                <option value="VACATION">{t("admin.availabilityVacation", currentLang, mode)}</option>
                <option value="UNAVAILABLE">{t("admin.availabilityUnavailable", currentLang, mode)}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motherTongue">{t("admin.colMotherTongue", currentLang, mode)}</Label>
              <select id="motherTongue" name="motherTongue" defaultValue="DE" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferredLanguage">{t("admin.colResponseLanguage", currentLang, mode)}</Label>
              <select id="preferredLanguage" name="preferredLanguage" defaultValue="DE" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                {t("common.add", currentLang, mode)}
                </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthDate">{t("admin.birthDate", currentLang, mode)}</Label>
              <Input id="birthDate" name="birthDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startedAtCompany">{t("admin.startInCompany", currentLang, mode)}</Label>
              <Input id="startedAtCompany" name="startedAtCompany" type="date" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="isTemporary" name="isTemporary" type="checkbox" />
              <Label htmlFor="isTemporary">{t("admin.temporaryShort", currentLang, mode)}</Label>
            </div>
            </form>
          </details>

          <div className="grid gap-3">
            {workers.map((worker) => {
              const cardFormId = `worker-card-${worker.id}`;
              const workerName = `${worker.firstName} ${worker.lastName}`.trim();
              const availabilityLabel =
                worker.availability === "AVAILABLE"
                  ? t("admin.availabilityAvailable", currentLang, mode)
                  : worker.availability === "SICK"
                    ? t("admin.availabilitySick", currentLang, mode)
                    : worker.availability === "VACATION"
                      ? t("admin.availabilityVacation", currentLang, mode)
                      : t("admin.availabilityUnavailable", currentLang, mode);
              return (
                <AdminWorkerCard
                  key={worker.id}
                  worker={{
                    id: worker.id,
                    firstName: worker.firstName,
                    lastName: worker.lastName,
                    phone: worker.phone,
                    emailAccount: worker.emailAccount,
                    position: worker.position,
                    licenses: worker.licenses,
                    loginCode: worker.loginCode,
                    birthDate: dateValue(worker.birthDate),
                    startedAtCompany: dateValue(worker.startedAtCompany),
                    ageLabel: ageLabel(worker.birthDate),
                    availability: worker.availability,
                    availabilityLabel,
                    availabilityClass: workerAvailabilityClass(worker.availability),
                    isTemporary: worker.isTemporary,
                    status: worker.status,
                    vacationAllowanceDays: worker.vacationAllowanceDays ?? 26,
                    level: worker.level,
                    motherTongue: (worker as any).motherTongue ?? "DE",
                    preferredLanguage: (worker as any).preferredLanguage ?? "DE",
                  }}
                  currentLang={currentLang}
                  companyMode={mode}
                  reportTodayKey={reportTodayKey}
                  reportMonthKey={reportMonthKey}
                />
              );
            })}
          </div>

          <div className="hidden">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead>{t("admin.colFirstName", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colLastName", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colPhone", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colEmail", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colPosition", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colLicenses", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colLevel", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colAge", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colStart", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colTemporary", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colAvailability", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colStatus", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colLoginCode", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colMotherTongue", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colResponseLanguage", currentLang, mode)}</TableHead>
                <TableHead className="text-right">{t("admin.colActions", currentLang, mode)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((worker) => {
                const formId = `worker-${worker.id}`;
                return (
                  <TableRow key={worker.id}>
                    <TableCell className="py-1.5">
                      <Input form={formId} name="firstName" defaultValue={worker.firstName} className="h-8" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input form={formId} name="lastName" defaultValue={worker.lastName} className="h-8" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input form={formId} name="phone" defaultValue={worker.phone ?? ""} className="h-8" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input form={formId} name="emailAccount" type="email" defaultValue={worker.emailAccount ?? ""} className="h-8" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input form={formId} name="position" defaultValue={worker.position ?? ""} className="h-8" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input form={formId} name="licenses" defaultValue={worker.licenses ?? ""} className="h-8" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <select form={formId} name="level" defaultValue={worker.level} className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                        <option value="JUNIOR">{t("admin.levelJunior", currentLang, mode)}</option>
                        <option value="WORKER">{t("admin.levelWorker", currentLang, mode)}</option>
                        <option value="SENIOR">{t("admin.levelSenior", currentLang, mode)}</option>
                        <option value="VORARBEITER">{t("admin.levelForeman", currentLang, mode)}</option>
                        <option value="MEISTER">{t("admin.levelMaster", currentLang, mode)}</option>
                      </select>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="text-sm">{ageLabel(worker.birthDate)}</div>
                      <Input form={formId} name="birthDate" type="hidden" defaultValue={dateValue(worker.birthDate)} />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input form={formId} name="startedAtCompany" type="date" defaultValue={dateValue(worker.startedAtCompany)} className="h-8 min-w-36" />
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      <input form={formId} name="isTemporary" type="checkbox" defaultChecked={worker.isTemporary} />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <select form={formId} name="availability" defaultValue={worker.availability} className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                        <option value="AVAILABLE">{t("admin.availabilityAvailable", currentLang, mode)}</option>
                        <option value="SICK">{t("admin.availabilitySick", currentLang, mode)}</option>
                        <option value="VACATION">{t("admin.availabilityVacation", currentLang, mode)}</option>
                        <option value="UNAVAILABLE">{t("admin.availabilityUnavailable", currentLang, mode)}</option>
                      </select>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <select
                        form={formId}
                        name="status"
                        defaultValue={worker.status}
                        className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="active">{t("admin.statusActiveWorkable", currentLang, mode)}</option>
                        <option value="inactive">{t("admin.statusInactiveLocked", currentLang, mode)}</option>
                      </select>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input form={formId} name="loginCode" defaultValue={worker.loginCode ?? ""} maxLength={6} className="h-8" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <select
                        form={formId}
                        name="motherTongue"
                        defaultValue={(worker as any).motherTongue ?? "DE"}
                        className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                        title={t("admin.colMotherTongue", currentLang, mode)}
                      >
                        {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>{option.label}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <select
                        form={formId}
                        name="preferredLanguage"
                        defaultValue={(worker as any).preferredLanguage ?? "DE"}
                        className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                        title={t("admin.colResponseLanguage", currentLang, mode)}
                      >
                        {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>{option.label}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/app/admin/workers/${worker.id}`}>
                            <Eye className="size-4" />
                            {t("admin.profile", currentLang, mode)}
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/app/admin/workers/${worker.id}/day/${reportTodayKey}`}>{t("common.today", currentLang, mode)}</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/app/admin/workers/${worker.id}/month/${reportMonthKey}`}>{t("common.month", currentLang, mode)}</Link>
                        </Button>
                        <form id={formId} action={updateWorkerAction}>
                          <input type="hidden" name="id" value={worker.id} />
                          <Button type="submit" size="sm">
                            {t("common.save", currentLang, mode)}
                          </Button>
                        </form>
                        <form action={deleteWorkerAction}>
                          <input type="hidden" name="id" value={worker.id} />
                          <Button type="submit" size="icon" variant="destructive" aria-label={t("admin.deleteWorker", currentLang, mode)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      </section>

      <section className="space-y-3">
        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.hrFleetLabel", currentLang, mode)}</div>
          <h2 className="mt-2 text-lg font-semibold">{t("admin.hrFleetManagement", currentLang, mode)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.hrFleetManagementSub", currentLang, mode)}
          </p>
        </div>

      <Card id="machines" className="scroll-mt-28">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <BriefcaseBusiness className="size-4" />
            {t("admin.fleetCardTitle", currentLang, mode)}
          </CardTitle>
          <CardDescription>{t("admin.fleetCardDescription", currentLang, mode)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="rounded-2xl border bg-card/50 p-3">
            <summary className="cursor-pointer list-none text-sm font-medium">{t("admin.createMachineToggle", currentLang, mode)}</summary>
            <form action={createMachine} className="mt-4 grid gap-3 md:grid-cols-8">
              <input type="hidden" name="companyId" value={company.id} />
              <div className="space-y-1.5">
                <Label htmlFor="nickname">{t("admin.machineName", currentLang, mode)}</Label>
                <Input id="nickname" name="nickname" required />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="model">{t("admin.machineModel", currentLang, mode)}</Label>
                <Input id="model" name="model" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="targe">{t("admin.machinePlate", currentLang, mode)}</Label>
                <Input id="targe" name="targe" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">{t("admin.machineCategory", currentLang, mode)}</Label>
                <select id="category" name="category" defaultValue="TRUCK" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  {MACHINE_CATEGORY_OPTIONS.map((category) => (
                    <option key={category.value} value={category.value}>
                      {machineCategoryText(category.value, currentLang, mode)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hourlyEur">{t("admin.machineHourly", currentLang, mode)}</Label>
                <Input id="hourlyEur" name="hourlyEur" inputMode="decimal" placeholder={t("admin.moneyPlaceholder", currentLang, mode)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dayEur">{t("admin.machineDaily", currentLang, mode)}</Label>
                <Input id="dayEur" name="dayEur" inputMode="decimal" placeholder={t("common.optional", currentLang, mode)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tuvDate">{t("admin.machineTuv", currentLang, mode)}</Label>
                <Input id="tuvDate" name="tuvDate" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spDate">{t("admin.machineSp", currentLang, mode)}</Label>
                <Input id="spDate" name="spDate" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uvvDate">{t("admin.machineUvv", currentLang, mode)}</Label>
                <Input id="uvvDate" name="uvvDate" type="date" />
              </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                {t("admin.addButton", currentLang, mode)}
              </Button>
              </div>
              <input type="hidden" name="huStatus" value="" />
              <input type="hidden" name="spStatus" value="" />
              <input type="hidden" name="uvvStatus" value="" />
            </form>
          </details>

          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="w-[24%]">{t("admin.machineName", currentLang, mode)}</TableHead>
                <TableHead className="w-[16%]">{t("admin.machinePlate", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.machineTuv", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.machineSp", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.machineUvv", currentLang, mode)}</TableHead>
                <TableHead className="w-[16%] text-right">{t("admin.colActions", currentLang, mode)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.map((machine) => (
                <TableRow key={machine.id} className="h-11">
                  <TableCell className="py-1.5">
                    <div className="font-medium">{machineOptionLabel(machine)}</div>
                    <div className="max-w-xl truncate text-xs text-muted-foreground">{machineCategoryText(machine.category, currentLang, mode)}</div>
                  </TableCell>
                  <TableCell className="py-1.5 text-sm font-medium">{machine.targe ?? "-"}</TableCell>
                  <TableCell className="py-1.5">
                    <InspectionDot label="HU" date={machine.tuvDate} status={machine.huStatus} currentLang={currentLang} mode={mode} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <InspectionDot label="SP" date={machine.spDate} status={machine.spStatus} currentLang={currentLang} mode={mode} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <InspectionDot label="UVV" date={machine.uvvDate} status={machine.uvvStatus} currentLang={currentLang} mode={mode} />
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/app/admin/machines/${machine.id}`}>
                          <Eye className="size-4" />
                          {t("common.open", currentLang, mode)}
                        </Link>
                      </Button>
                      <form action={deleteMachine}>
                        <input type="hidden" name="id" value={machine.id} />
                        <Button type="submit" size="icon" variant="destructive" aria-label={t("admin.deleteMachine", currentLang, mode)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </section>
    </div>
  );
}
