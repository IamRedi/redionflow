"use server";

import { createSessionCookie } from "@/lib/auth/session-cookie";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { WORKER_COOKIE } from "@/lib/workzone/worker-session";
import { DISPLAY_COOKIE } from "@/lib/auth/display-session";
import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { ensureLoginAllowed, getClientIp, registerFailedLogin } from "@/lib/auth/login-guard";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit/log";
import { ensureTrialSubscription } from "@/lib/billing/plans";
import { Prisma } from "@/generated/prisma/client";
import { bootstrapSignupTenant } from "@/lib/auth/signup-bootstrap";
import { assertSignupBootstrapAllowed } from "@/lib/db/operation-boundary";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { logger } from "@/lib/observability/logger";
import { resolveMode } from "@/lib/mode-config";
import { isSaasMode } from "@/lib/saas-config";
import type { ActionResult } from "@/lib/validation/action-result";

const signupSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(200),
  mode: z.enum(["baumdienst", "bau", "personal"]),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().min(2).max(120),
});

const TRIAL_DAYS = 14;

/**
 * T-026: Public signup for the SaaS platform.
 *
 * Creates a new tenant Company + primary admin User + 14-day trial. Sets
 * the admin session cookie so the newcomer lands straight in the dashboard.
 *
 * Only enabled when `SAAS_MODE=true`. Dedicated deployments return a hard
 * error so accidental signups never create phantom tenants.
 */
export async function signupAction(input: unknown): Promise<ActionResult> {
  assertSignupBootstrapAllowed();
  const tr = await getActionTranslator("public");
  if (!isSaasMode) {
    return { ok: false, message: tr("signupDisabledDedicated") };
  }

  // BDF-P8-007: gate signup behind the shared LoginAttemptStore so a
  // scripted enumeration attack against known-emails runs into the
  // 15-minute lock after ~10 tries per IP. Legit users retrying a typo
  // stay well under the ceiling.
  const requestHeaders = await headers();
  const clientIp = getClientIp(requestHeaders);
  const access = await ensureLoginAllowed("signup", clientIp);
  if (!access.ok) {
    return {
      ok: false,
      message: tr("loginTooManyAttempts").replace("{seconds}", String(access.retryAfterSeconds)),
    };
  }

  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    await registerFailedLogin("signup", clientIp);
    return {
      ok: false,
      message: tr("signupInvalidFields"),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const v = parsed.data;
  const email = v.email.trim().toLowerCase();
  const mode = resolveMode(v.mode);

  const passwordHash = hashPassword(v.password);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  let created;
  try {
    created = await bootstrapSignupTenant({
      displayName: v.displayName, legalName: v.legalName, fullName: v.fullName,
      email, mode, passwordHash, trialEndsAt,
    });
  } catch (error) {
    // Concurrent duplicate signups roll back company + membership + audit together.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    created = null;
  }
  if (!created) {
    await registerFailedLogin("signup", clientIp);
    return { ok: false, message: tr("signupEmailRegistered"), fieldErrors: { email: [tr("signupEmailRegistered")] } };
  }
  const { admin, companyId } = created;

  // T-027: attach a trialing subscription to the starter plan. This is a
  // separate call so the transaction stays tight; if the trial attach fails
  // the user still has a working tenant and the follow-up cron/repair job
  // can retry.
  try {
    await ensureTrialSubscription(companyId, trialEndsAt);
  } catch (error) {
    logger.error({ event: "signup.trial_attach_failed", companyId }, "ensureTrialSubscription failed", error);
    await recordAudit({
      companyProfileId: companyId,
      actorType: "SYSTEM",
      action: "signup.trial_attach_failed",
      payload: { adminUserId: admin.id },
    }).catch(() => undefined);
  }

  // T-033: audit trail for the tenant landing.
  await recordAudit({
    companyProfileId: companyId,
    actorType: "ADMIN",
    actorId: admin.id,
    action: "signup.completed",
    payload: { mode, trialEndsAt: trialEndsAt.toISOString() },
  }).catch((error) => {
    logger.error({ event: "signup.audit_failed", companyId }, "signup audit failed", error);
  });

  // Start the admin session for the newcomer.
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await createSessionCookie("admin", admin.id, admin.sessionEpoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  jar.delete(WORKER_COOKIE);
  jar.delete(DISPLAY_COOKIE);
  redirect("/app/dashboard");
}
