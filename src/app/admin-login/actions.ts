"use server";

import { createSessionCookie } from "@/lib/auth/session-cookie";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE, ensureDefaultAdmins } from "@/lib/auth/admin-session";
import { authenticateAdmin, readAdminPassword } from "@/lib/auth/authenticate-admin";
import { DISPLAY_COOKIE } from "@/lib/auth/display-session";
import { clearFailedLogin, ensureLoginAllowed, getClientIp, registerFailedLogin } from "@/lib/auth/login-guard";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { logger } from "@/lib/observability/logger";
import { WORKER_COOKIE } from "@/lib/workzone/worker-session";

type LoginState = { message?: string };

export async function loginAdminAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const tr = await getActionTranslator("admin");
  // Same limiter as the API route, so the form action is not a way around it.
  const clientIp = getClientIp(await headers());
  const access = await ensureLoginAllowed("admin", clientIp);
  if (!access.ok) {
    const lang = await resolveRequestLanguage();
    return { message: t("public.loginTooManyAttempts", lang).replace("{seconds}", String(access.retryAfterSeconds)) };
  }
  try {
    await ensureDefaultAdmins();
  } catch (error) {
    logger.error(
      { event: "admin_login.bootstrap_failed" },
      "ensureDefaultAdmins failed during login",
      error,
    );
    return { message: tr("loginUnavailable") };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = readAdminPassword(formData.get("password"));

  if (!email || !password) {
    await registerFailedLogin("admin", clientIp);
    return { message: tr("loginInvalid") };
  }

  let result: Awaited<ReturnType<typeof authenticateAdmin>>;
  try {
    // BDF-P1-001: use the shared verifier so this server action and the
    // API route in `src/app/api/admin-login/route.ts` cannot drift apart.
    result = await authenticateAdmin(prisma, email, password);
  } catch (error) {
    logger.error({ event: "admin_login.lookup_failed", email }, "user lookup failed", error);
    return { message: tr("loginUnavailable") };
  }

  if (!result.ok) {
    await registerFailedLogin("admin", clientIp);
    if (result.reason === "legacy_plaintext") {
      logger.warn(
        { event: "admin_login.legacy_plaintext", email },
        "legacy plaintext admin record cannot authenticate; operator must reset credentials via BDF-P1-002 flow",
      );
    }
    // Every non-OK reason maps to the same message so the client cannot
    // enumerate whether an account exists or how its hash is shaped.
    return { message: tr("loginInvalid") };
  }
  await clearFailedLogin("admin", clientIp);
  const admin = { id: result.adminId };

  const jar = await cookies();
  // BDF-P8-007: `secure` must match the other login paths so the session
  // cookie is HTTPS-only in production. Missing here would let an
  // MITM on plain HTTP steal the admin session on shared networks.
  jar.set(ADMIN_COOKIE, await createSessionCookie("admin", admin.id, result.sessionEpoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.delete(WORKER_COOKIE);
  jar.delete(DISPLAY_COOKIE);

  redirect("/app/admin");
}

export async function loginAdminFormAction(formData: FormData) {
  const result = await loginAdminAction({}, formData);
  if (result.message) {
    redirect("/admin-login");
  }
}

export async function logoutAdminAction() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  jar.delete(WORKER_COOKIE);
  jar.delete(DISPLAY_COOKIE);
  redirect("/admin-login");
}
