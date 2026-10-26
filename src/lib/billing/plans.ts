import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * T-027 — SaaS Plan / Subscription helpers.
 *
 * Plans are seeded by the `20260704180000_add_billing_models` migration:
 *   - starter    (default at signup)
 *   - pro
 *   - enterprise
 *
 * Dedicated deployments do not use these tables. Callers must gate any
 * billing behavior behind `isSaasMode` from `src/lib/saas-config`.
 */

export type PlanTier = "starter" | "pro" | "enterprise";

export const DEFAULT_TRIAL_PLAN: PlanTier = "starter";

/**
 * Return the active plan for a Company. `null` when:
 *   - The company has no subscription (dedicated or pre-signup state), OR
 *   - The company's subscription has no plan attached (shouldn't happen in
 *     normal flow, but be defensive — treat it as "no plan").
 */
export async function getCurrentPlan(companyProfileId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { companyProfileId },
    include: { plan: true },
  });
  if (!subscription) return null;
  return subscription.plan;
}

/**
 * Return the full subscription snapshot for a Company. Callers that need
 * both status + plan should use this instead of two lookups.
 */
export async function getCurrentSubscription(companyProfileId: string, db: Prisma.TransactionClient = prisma) {
  return db.subscription.findUnique({
    where: { companyProfileId },
    include: { plan: true },
  });
}

/**
 * Idempotent starter-trial attachment. Used by signup so a new tenant lands
 * with a `trialing` subscription attached to the starter plan. Existing
 * subscriptions are left alone.
 */
export async function ensureTrialSubscription(
  companyProfileId: string,
  trialEndsAt: Date,
): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { companyProfileId },
    select: { id: true },
  });
  if (existing) return;

  const starter = await prisma.plan.findUnique({
    where: { tier: "starter" },
    select: { id: true },
  });

  await prisma.subscription.create({
    data: {
      companyProfileId,
      planId: starter?.id ?? null,
      status: "trialing",
      currentPeriodEnd: trialEndsAt,
    },
  });
}
