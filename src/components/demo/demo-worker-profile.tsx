import Image from "next/image";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { isReportableSession } from "@/lib/workzone/session-rules";

type WorkerDocument = {
  id: string;
  label: string;
  url: string;
  uploadedAt: string;
};

type DemoWorkerProfile = {
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
    createdByName: string | null;
  }>;
  sessions: Array<{
    id: string;
    startTime: Date;
    endTime: Date | null;
    breakMinutes: number;
    totalHours: number;
    isLive: boolean;
    baustelle?: { id: string; name: string } | null;
  }>;
  vacationRequests: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    requestedDays: number;
    status: string;
    workerNote: string | null;
    adminMessage: string | null;
    reviewedAt: Date | null;
  }>;
  inventoryMovements: Array<{
    id: string;
    action: string;
    actorName: string | null;
    barcode: string | null;
    note: string | null;
    createdAt: Date;
    item: { id: string; name: string; itemCode: string } | null;
  }>;
};

function localeForLanguage(lang: string) {
  return lang === "de" ? "de-DE" : lang;
}

function formatDateTime(date: Date | null, lang: string) {
  return date ? date.toLocaleString(localeForLanguage(lang), { dateStyle: "short", timeStyle: "short" }) : "-";
}

function formatProfileDate(date: Date | null, lang: string) {
  return date ? date.toLocaleDateString(localeForLanguage(lang), { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
}

function availabilityLabel(value: string, lang: string) {
  if (value === "SICK") return t("workzone.sickStatus", lang);
  if (value === "VACATION") return t("workzone.vacationStatus", lang);
  if (value === "UNAVAILABLE") return t("workzone.unavailableStatus", lang);
  return t("workzone.availableStatus", lang);
}

function inventoryStatusLabel(item: { isPrivate: boolean; status: string }, lang: string) {
  if (item.isPrivate) return t("workzone.inventoryStatusPrivate", lang);
  if (item.status === "DELETED" || item.status === "RETURNED") return t("workzone.inventoryStatusReturned", lang);
  return t("workzone.inventoryStatusActive", lang);
}

function inventoryActionLabel(action: string, lang: string) {
  if (action === "TAKE") return t("workzone.inventoryMovementTake", lang);
  if (action === "RETURN") return t("workzone.inventoryMovementReturn", lang);
  if (action === "CREATE_PRIVATE") return t("workzone.inventoryMovementCreatePrivate", lang);
  return action;
}

function parseDocuments(value: unknown): WorkerDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => typeof item?.url === "string")
    .map((item: any) => ({
      id: String(item.id ?? item.url),
      label: String(item.label ?? item.filename ?? "Dokument"),
      url: String(item.url),
      uploadedAt: String(item.uploadedAt ?? ""),
    }));
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

export async function DemoWorkerProfileView({ worker }: { worker: DemoWorkerProfile }) {
  const currentLang = await resolveRequestLanguage();
  const activeSession = worker.sessions.find((session) => session.isLive && !session.endTime) ?? null;
  const history = worker.sessions.filter((session) => (!session.isLive || session.endTime) && isReportableSession(session)).slice(0, 15);
  const documents = parseDocuments(worker.documents);
  const approvedVacationDays = worker.vacationRequests.filter((request) => request.status === "APPROVED").reduce((sum, request) => sum + request.requestedDays, 0);
  const pendingVacationDays = worker.vacationRequests.filter((request) => request.status === "PENDING").reduce((sum, request) => sum + request.requestedDays, 0);
  const remainingVacationDays = Math.max(0, worker.vacationAllowanceDays - approvedVacationDays);
  const initials = `${worker.firstName[0] ?? ""}${worker.lastName[0] ?? ""}`.toUpperCase();
  const whatsappUrl = whatsappHref(worker.phone);

  return (
    <div className="mx-auto min-w-[430px] max-w-6xl space-y-5 sm:min-w-0">
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="h-28 bg-[#163328]" />
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-6">
          <div className="-mt-12 flex items-end gap-4">
            <div className="relative size-28">
              <div className="relative flex size-28 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted text-3xl font-semibold shadow-sm">
                {worker.profileImageUrl ? (
                  <Image src={worker.profileImageUrl} alt={`${worker.firstName} ${worker.lastName}`} fill sizes="112px" className="object-cover" />
                ) : (
                  initials
                )}
              </div>
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-semibold">
                {worker.firstName} {worker.lastName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {worker.position ?? t("workzone.workerDefaultRole", currentLang)} · {worker.level} · {availabilityLabel(worker.availability, currentLang)}
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/demo/workzone">{t("report.back", currentLang)}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("workzone.liveStatusTitle", currentLang)}</CardTitle>
            <CardDescription>{t("workzone.liveStatusDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("workzone.live", currentLang)}</div>
              <div className="mt-1 font-medium">
                {activeSession ? `${formatDateTime(activeSession.startTime, currentLang)} · ${activeSession.baustelle?.name ?? "-"}` : t("workzone.offline", currentLang)}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{t("admin.motherTongue", currentLang)}</div>
                <div className="mt-1 font-medium">{worker.motherTongue ?? "-"}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{t("admin.responseLanguage", currentLang)}</div>
                <div className="mt-1 font-medium">{worker.preferredLanguage ?? "-"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("workzone.documentsTitle", currentLang)}</CardTitle>
            <CardDescription>{t("workzone.documentsDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.none", currentLang)}</p>
            ) : (
              documents.map((document) => (
                <a
                  key={document.id}
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="font-medium">{document.label}</div>
                  <div className="text-xs text-muted-foreground">{document.uploadedAt || "-"}</div>
                </a>
              ))
            )}
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("workzone.equipmentClothingTitle", currentLang)}</CardTitle>
          <CardDescription>{t("workzone.equipmentClothingDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 px-4 py-3">
            <div className="text-sm font-semibold">{t("workzone.clothingSizes", currentLang)}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>{t("workzone.clothingTop", currentLang)}: <span className="font-medium text-foreground">{worker.clothingTopSize ?? "-"}</span></span>
              <span>{t("workzone.clothingBottom", currentLang)}: <span className="font-medium text-foreground">{worker.clothingBottomSize ?? "-"}</span></span>
              <span>{t("workzone.shoes", currentLang)}: <span className="font-medium text-foreground">{worker.shoeSize ?? "-"}</span></span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("workzone.inventoryArticle", currentLang)}</TableHead>
                    <TableHead>{t("workzone.inventoryBarcode", currentLang)}</TableHead>
                    <TableHead>{t("workzone.inventorySize", currentLang)}</TableHead>
                    <TableHead>{t("workzone.inventoryStatus", currentLang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worker.assetItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        {t("common.none", currentLang)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    worker.assetItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.itemName}</div>
                          {item.note ? <div className="text-xs text-muted-foreground">{item.note}</div> : null}
                        </TableCell>
                        <TableCell>{item.itemCode ?? item.barcode ?? "-"}</TableCell>
                        <TableCell>{item.sizeLabel ?? "-"}</TableCell>
                        <TableCell>{inventoryStatusLabel(item, currentLang)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("workzone.inventoryMovementHistory", currentLang)}</TableHead>
                    <TableHead>{t("workzone.inventoryArticle", currentLang)}</TableHead>
                    <TableHead>{t("common.time", currentLang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worker.inventoryMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        {t("common.none", currentLang)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    worker.inventoryMovements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <div className="font-medium">{inventoryActionLabel(movement.action, currentLang)}</div>
                          {movement.note ? <div className="text-xs text-muted-foreground">{movement.note}</div> : null}
                        </TableCell>
                        <TableCell>{movement.item?.name ?? movement.barcode ?? "-"}</TableCell>
                        <TableCell>{formatDateTime(movement.createdAt, currentLang)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workzone.hoursHistoryTitle", currentLang)}</CardTitle>
          <CardDescription>{t("workzone.hoursHistoryDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-4">
            <div>
              <div className="text-sm font-semibold">{t("workzone.ticketsReportsTitle", currentLang)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("workzone.demoReadonlyReportsDescription", currentLang)}
              </div>
            </div>
          </div>

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
                    <TableCell>
                      {session.baustelle ? <Link className="hover:underline" href={`/demo/baustellen/${session.baustelle.id}`}>{session.baustelle.name}</Link> : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{session.breakMinutes} {t("common.minutes", currentLang)}</TableCell>
                    <TableCell className="text-right tabular-nums">{session.totalHours.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
                  {t("workzone.totalLabel", currentLang)} {worker.vacationAllowanceDays} {t("workzone.daysLabel", currentLang)} / {t("workzone.approvedStatus", currentLang)} {approvedVacationDays} / {t("workzone.pendingStatus", currentLang)} {pendingVacationDays} / {t("workzone.remainingLabel", currentLang)} {remainingVacationDays}
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("workzone.period", currentLang)}</TableHead>
                    <TableHead className="text-right">{t("workzone.daysLabel", currentLang)}</TableHead>
                    <TableHead>{t("workzone.statusLabel", currentLang)}</TableHead>
                    <TableHead>{t("workzone.messageLabel", currentLang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worker.vacationRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        {t("workzone.noVacationRequests", currentLang)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    worker.vacationRequests.map((request) => (
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
                        <TableCell className="text-sm text-muted-foreground">{request.adminMessage ?? (request.reviewedAt ? formatProfileDate(request.reviewedAt, currentLang) : "-")}</TableCell>
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
