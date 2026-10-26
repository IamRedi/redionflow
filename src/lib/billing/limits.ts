import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isSaasMode } from "@/lib/saas-config";

import { getCurrentSubscription, type PlanTier } from "./plans";

/**
 * T-028 — Plan-based feature limits.
 *
 * `mode` (from `modeConfig`) decides which features exist. `plan` decides how
 * much of them a tenant may consume. Limits are checked at the server-action
 * boundary before we insert new rows.
 *
 * Dedicated deployments (`SAAS_MODE=false`) bypass every check.
 *
 * When over-quota, `checkLimit` returns a structured result so the caller
 * can surface a clean `ActionResult` with an "upgrade plan" prompt.
 */

export type LimitedResource = "workers" | "machines" | "activeBaustellen";

export type PlanLimits = Record<LimitedResource, number>;

/**
 * Central limits table. Keyed by plan tier. `Infinity` means the resource
 * is uncapped for that tier — currently only `enterprise` uses it.
 *
 * Numbers below are placeholders that mirror common SaaS tier ranges. They
 * are safe to tweak later; the check helpers read them at request time.
 */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    workers: 5,
    machines: 5,
    activeBaustellen: 3,
  },
  pro: {
    workers: 25,
    machines: 25,
    activeBaustellen: 20,
  },
  enterprise: {
    workers: Number.POSITIVE_INFINITY,
    machines: Number.POSITIVE_INFINITY,
    activeBaustellen: Number.POSITIVE_INFINITY,
  },
};

/**
 * Fallback used when a SaaS tenant has no subscription attached (edge case
 * only). Applies the starter caps so a broken billing state cannot become a
 * free unlimited seat.
 */
const SAAS_DEFAULT_LIMITS = PLAN_LIMITS.starter;

export type LimitCheckResult =
  | { ok: true }
  | {
      ok: false;
      resource: LimitedResource;
      currentCount: number;
      limit: number;
      tier: PlanTier | null;
    };

async function currentCount(companyProfileId: string, resource: LimitedResource, db: Prisma.TransactionClient): Promise<number> {
  switch (resource) {
    case "workers":
      return db.worker.count({
        where: { companyProfileId, status: "active" },
      });
    case "machines":
      return db.machine.count({
        where: { companyProfileId, isActive: true },
      });
    case "activeBaustellen":
      return db.baustelle.count({
        where: { companyProfileId, status: "active" },
      });
  }
}

async function resolveLimits(companyProfileId: string, db: Prisma.TransactionClient): Promise<{
  limits: PlanLimits;
  tier: PlanTier | null;
}> {
  const subscription = await getCurrentSubscription(companyProfileId, db);
  const tier = subscription?.plan?.tier ?? null;
  const limits = tier ? PLAN_LIMITS[tier] : SAAS_DEFAULT_LIMITS;
  return { limits, tier };
}

/**
 * Check whether the tenant may create one more of `resource`. Call before
 * the insert; block on `ok: false`.
 *
 * On dedicated deployments this always returns `{ ok: true }` without
 * touching the database.
 */
export async function checkLimit(
  companyProfileId: string,
  resource: LimitedResource,
  db: Prisma.TransactionClient = prisma,
): Promise<LimitCheckResult> {
  if (!isSaasMode) return { ok: true };

  const { limits, tier } = await resolveLimits(companyProfileId, db);
  const limit = limits[resource];
  if (!Number.isFinite(limit)) return { ok: true };

  const count = await currentCount(companyProfileId, resource, db);
  if (count < limit) return { ok: true };

  return { ok: false, resource, currentCount: count, limit, tier };
}

type LimitMessageLang = "de" | "en" | "it" | "sq" | "ro" | "pl";

function normalizeLimitMessageLang(lang?: string): LimitMessageLang {
  return lang === "en" || lang === "it" || lang === "sq" || lang === "ro" || lang === "pl" ? lang : "de";
}

/**
 * Localized fallback message for server actions that need a direct string.
 * UI callers should still prefer the localized `saas.upgradePlan` key when
 * they render a richer upgrade prompt.
 */
export function overLimitMessage(result: Extract<LimitCheckResult, { ok: false }>, lang?: string): string {
  const resourceLabels: Record<LimitMessageLang, Record<LimitedResource, string>> = {
    de: {
      workers: "Mitarbeiter",
      machines: "Maschinen",
      activeBaustellen: "aktive Baustellen",
    },
    en: {
      workers: "workers",
      machines: "machines",
      activeBaustellen: "active sites",
    },
    it: {
      workers: "worker",
      machines: "macchine",
      activeBaustellen: "cantieri attivi",
    },
    sq: {
      workers: "worker",
      machines: "makina",
      activeBaustellen: "kantiere aktive",
    },
    ro: {
      workers: "lucratori",
      machines: "utilaje",
      activeBaustellen: "santiere active",
    },
    pl: {
      workers: "pracownicy",
      machines: "maszyny",
      activeBaustellen: "aktywne budowy",
    },
  };
  const templates: Record<LimitMessageLang, string> = {
    de: "Plan-Limit erreicht: {count}/{limit} {resource}. Bitte Plan upgraden.",
    en: "Plan limit reached: {count}/{limit} {resource}. Please upgrade the plan.",
    it: "Limite del piano raggiunto: {count}/{limit} {resource}. Aggiorna il piano.",
    sq: "Limiti i planit u arrit: {count}/{limit} {resource}. Te lutem perditeso planin.",
    ro: "Limita planului a fost atinsa: {count}/{limit} {resource}. Te rugam sa actualizezi planul.",
    pl: "Osiagnieto limit planu: {count}/{limit} {resource}. Uaktualnij plan.",
  };
  const selected = normalizeLimitMessageLang(lang);
  return templates[selected]
    .replace("{count}", String(result.currentCount))
    .replace("{limit}", String(result.limit))
    .replace("{resource}", resourceLabels[selected][result.resource]);
}
