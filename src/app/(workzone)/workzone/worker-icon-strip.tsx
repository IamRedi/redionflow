"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Mail, Phone, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";

const VACATION_DECISION_SEEN_KEY = "workzone:vacation-decision-seen:v2";
const LEGACY_VACATION_DECISION_SEEN_KEY = "workzone:vacation-decision-seen";

type WorkerBadge = {
  id: string;
  firstName: string;
  lastName: string;
  availability: string;
  birthDate: string | null;
  profileImageUrl: string | null;
  phone: string | null;
  emailAccount: string | null;
  live: boolean;
  activeProfile: boolean;
  pendingVacationRequest: boolean;
  vacationDecisionSignal: boolean;
  vacationDecisionSignalKey: string | null;
};

function workerBadgeLabel(lastName: string) {
  const surname = (lastName || "").trim().split(/\s+/)[0] ?? "";
  const compact = surname.replace(/\s+/g, "").toUpperCase().slice(0, 5);
  return compact || "-";
}

function firstNameLabel(firstName: string) {
  const label = firstName.trim().split(/\s+/)[0] ?? "";
  return label.length > 9 ? `${label.slice(0, 8)}.` : label || "-";
}

function availabilityTone(availability: string, live: boolean) {
  if (availability === "SICK") return "border-red-500 bg-red-600 text-white";
  if (availability === "VACATION") return "border-[3px] border-sky-400 bg-sky-500 text-white shadow-[0_0_12px_rgba(14,165,233,0.45)]";
  if (availability === "UNAVAILABLE") return "border-[3px] border-sky-400 bg-zinc-700 text-white shadow-[0_0_12px_rgba(14,165,233,0.45)]";
  return live
    ? "border-[3px] border-emerald-400 bg-emerald-500 text-white shadow-[0_0_12px_rgba(34,197,94,0.45)]"
    : "border-border bg-muted text-muted-foreground";
}

// BDF-P8-007 accessibility: translate the availability enum into a
// screen-reader-friendly label so a keyboard-only user is told why a
// worker chip is coloured (SICK / VACATION / …) rather than having to
// see the tint.
function availabilityAriaLabel(availability: string, currentLang: string): string {
  if (availability === "SICK") return t("workzone.sickStatus", currentLang);
  if (availability === "VACATION") return t("workzone.vacationStatus", currentLang);
  if (availability === "UNAVAILABLE") return t("workzone.unavailableStatus", currentLang);
  return t("workzone.availableStatus", currentLang);
}

function whatsappHref(phone: string | null) {
  const cleaned = phone?.replace(/[^\d+]/g, "") ?? "";
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return `https://wa.me/${cleaned.slice(1)}`;
  if (cleaned.startsWith("00")) return `https://wa.me/${cleaned.slice(2)}`;
  if (cleaned.startsWith("0")) return `https://wa.me/49${cleaned.slice(1)}`;
  return `https://wa.me/${cleaned}`;
}

function telHref(phone: string | null) {
  const cleaned = phone?.replace(/[^\d+]/g, "") ?? "";
  return cleaned ? `tel:${cleaned}` : null;
}

function isBirthdayToday(birthDate: string | null) {
  if (!birthDate) return false;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
}

export function WorkerIconStrip({
  workers,
  admin,
  profileHrefBase,
}: {
  workers: WorkerBadge[];
  admin: boolean;
  profileHrefBase?: string;
}) {
  const { currentLang } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<{ workerId: string; top: number; left: number } | null>(null);
  const [dismissedDecisionKey, setDismissedDecisionKey] = useState<string | null>(null);
  const [decisionStateReady, setDecisionStateReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  function dismissOwnVacationSignal(worker: WorkerBadge) {
    if (!worker.activeProfile || !worker.vacationDecisionSignalKey) return;
    localStorage.setItem(VACATION_DECISION_SEEN_KEY, worker.vacationDecisionSignalKey);
    setDismissedDecisionKey(worker.vacationDecisionSignalKey);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const latestSeen =
      window.localStorage.getItem(VACATION_DECISION_SEEN_KEY) ??
      window.localStorage.getItem(LEGACY_VACATION_DECISION_SEEN_KEY);
    if (latestSeen) {
      window.localStorage.setItem(VACATION_DECISION_SEEN_KEY, latestSeen);
      window.setTimeout(() => setDismissedDecisionKey(latestSeen), 0);
    }
    window.localStorage.removeItem(LEGACY_VACATION_DECISION_SEEN_KEY);
    window.setTimeout(() => setDecisionStateReady(true), 0);
  }, []);

  function popupLeft(rightEdge: number) {
    const menuWidth = 176;
    const minLeft = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - menuWidth - 8);
    const ideal = rightEdge - menuWidth;
    return Math.min(maxLeft, Math.max(minLeft, ideal));
  }

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    function handleResizeOrScroll() {
      setOpenMenu(null);
    }
    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!pathname?.startsWith("/workzone/profile")) return;
    const activeWorker = workers.find((worker) => worker.activeProfile);
    if (!activeWorker?.vacationDecisionSignalKey) {
      return;
    }
    localStorage.setItem(VACATION_DECISION_SEEN_KEY, activeWorker.vacationDecisionSignalKey);
    window.setTimeout(() => setDismissedDecisionKey(activeWorker.vacationDecisionSignalKey), 0);
  }, [pathname, workers]);

  const openWorker = openMenu ? workers.find((worker) => worker.id === openMenu.workerId) ?? null : null;
  const whatsapp = openWorker ? whatsappHref(openWorker.phone) : null;
  const telephone = openWorker ? telHref(openWorker.phone) : null;
  const canContact = Boolean(openWorker?.phone || openWorker?.emailAccount || whatsapp);

  return (
    <div ref={wrapRef} className="no-scrollbar min-h-[58px] w-full min-w-0 overflow-x-auto pb-1">
      <div className="flex min-w-max items-start gap-2 pr-5">
        {workers.map((worker) => {
          const badge = workerBadgeLabel(worker.lastName);
          const nameLabel = firstNameLabel(worker.firstName);
          const birthdayToday = isBirthdayToday(worker.birthDate);
          const hasVacationRequest = worker.pendingVacationRequest;
          const hasVacationDecision =
            decisionStateReady &&
            worker.activeProfile &&
            worker.vacationDecisionSignal &&
            Boolean(worker.vacationDecisionSignalKey) &&
            !(pathname?.startsWith("/workzone/profile") && worker.activeProfile) &&
            (!dismissedDecisionKey || worker.vacationDecisionSignalKey! > dismissedDecisionKey);
          return (
            <div key={worker.id} className="relative flex w-12 shrink-0 flex-col items-center gap-1">
              <button
                type="button"
                title={`${worker.firstName} ${worker.lastName} - ${availabilityAriaLabel(worker.availability, currentLang)}${worker.live ? ` (${t("workzone.live", currentLang)})` : ` (${t("workzone.offline", currentLang)})`}`}
                aria-label={`${worker.firstName} ${worker.lastName} - ${availabilityAriaLabel(worker.availability, currentLang)}${worker.live ? ` (${t("workzone.live", currentLang)})` : ` (${t("workzone.offline", currentLang)})`}`}
                onClick={(event) => {
                  if (worker.activeProfile) {
                    dismissOwnVacationSignal(worker);
                    setOpenMenu(null);
                    router.push("/workzone/profile");
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  setOpenMenu((current) =>
                    current?.workerId === worker.id
                      ? null
                      : {
                          workerId: worker.id,
                          top: rect.bottom + 6,
                          left: popupLeft(rect.right),
                        },
                  );
                }}
                className={cn(
                  "relative flex size-10 flex-col items-center justify-center overflow-visible rounded-full border text-[8px] font-semibold leading-none tracking-tight shadow-sm",
                  availabilityTone(worker.availability, worker.live),
                  worker.live && worker.availability === "AVAILABLE"
                    ? "after:absolute after:inset-0 after:-z-10 after:rounded-full after:bg-brand-green after:opacity-50 after:content-[''] after:animate-[workzone-worker-live-ping_1.6s_cubic-bezier(0,0,0.2,1)_infinite] motion-reduce:after:animate-none"
                    : "",
                  worker.activeProfile ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                )}
              >
                {worker.profileImageUrl ? (
                  <Image
                    src={worker.profileImageUrl} unoptimized={worker.profileImageUrl.startsWith("/api/private-files?")}
                    alt={`${worker.firstName} ${worker.lastName}`}
                    fill
                    sizes="40px"
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span>{badge}</span>
                )}
                {birthdayToday ? (
                  <span
                    className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border bg-background text-[10px] shadow-sm"
                    title={t("workzone.birthdayToday", currentLang)}
                    aria-label={t("workzone.birthdayToday", currentLang)}
                  >
                    🎂
                  </span>
                ) : null}
                {admin && hasVacationRequest ? (
                  <span
                    className="absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-full border bg-amber-400 text-[10px] font-bold text-black shadow-sm"
                    title={t("workzone.openVacationRequest", currentLang)}
                    aria-label={t("workzone.openVacationRequest", currentLang)}
                  >
                    ?
                  </span>
                ) : null}
                {!admin && hasVacationDecision ? (
                  <span
                    className="absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-full border bg-emerald-400 text-[10px] font-bold text-black shadow-sm"
                    title={t("workzone.vacationRequestAnswered", currentLang)}
                    aria-label={t("workzone.vacationRequestAnswered", currentLang)}
                  >
                    !
                  </span>
                ) : null}
              </button>
              <span className="max-w-12 truncate text-center text-[9px] font-medium leading-none text-muted-foreground" title={`${worker.firstName} ${worker.lastName}`}>
                {nameLabel}
              </span>
            </div>
          );
        })}
      </div>
      {openWorker ? (
        <div className="fixed z-40 w-44 rounded-md border bg-card p-2 shadow-lg" style={{ top: openMenu!.top, left: openMenu!.left }}>
          <div className="mb-1 text-[11px] font-semibold">
            {openWorker.firstName} {openWorker.lastName}
          </div>
          <div className="space-y-1">
            {admin ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                onClick={() => {
                  setOpenMenu(null);
                  router.push(profileHrefBase ? `${profileHrefBase}/${openWorker.id}` : `/workzone/admin-workers/${openWorker.id}`);
                }}
              >
                <UserRound className="size-3.5" />
                {t("admin.profile", currentLang)}
              </button>
            ) : null}
            {telephone ? (
              <a href={telephone} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted" onClick={() => setOpenMenu(null)}>
                <Phone className="size-3.5" />
                {t("common.phone", currentLang)}
              </a>
            ) : null}
            {openWorker.emailAccount ? (
              <a
                href={`mailto:${openWorker.emailAccount}`}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                onClick={() => setOpenMenu(null)}
              >
                <Mail className="size-3.5" />
                {t("common.email", currentLang)}
              </a>
            ) : null}
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted" onClick={() => setOpenMenu(null)}>
                <Phone className="size-3.5" />
                {t("common.whatsapp", currentLang)}
              </a>
            ) : null}
            {!canContact ? <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("workzone.noContactAvailable", currentLang)}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
