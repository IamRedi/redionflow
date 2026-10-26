"use server";

import { createSessionCookie } from "@/lib/auth/session-cookie";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { DISPLAY_COOKIE } from "@/lib/auth/display-session";
import { clearFailedLogin, ensureLoginAllowed, getClientIp, registerFailedLogin } from "@/lib/auth/login-guard";
import { isHashedPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n";
import { normalizeLanguage } from "@/lib/i18n/language";
import { isSaasMode } from "@/lib/saas-config";
import type { ActionResult } from "@/lib/validation/action-result";
import { WORKER_COOKIE } from "@/lib/workzone/worker-session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  lang: z.string().optional(),
});

/**
 * T-026: SaaS admin login via email + password.
 *
 * Dedicated deployments continue to use the code-based `/admin-login`
 * endpoint. This action is only exposed when `SAAS_MODE=true`.
 */
export async function loginAction(input: unknown): Promise<ActionResult> {
  const requestedLang =
    input && typeof input === "object" && "lang" in input
      ? normalizeLanguage(String((input as { lang?: unknown }).lang ?? ""))
      : null;
  const lang = requestedLang ?? "de";

  if (!isSaasMode) {
    return { ok: false, message: t("public.loginDisabledDedicated", lang) };
  }

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t("public.loginInvalidFields", lang) };
  }

  const headersModule = await import("next/headers");
  const requestHeaders = await headersModule.headers();
  const clientIp = getClientIp(requestHeaders);
  const access = await ensureLoginAllowed("admin", clientIp);
  if (!access.ok) {
    return {
      ok: false,
      message: t("public.loginTooManyAttempts", lang).replace("{seconds}", String(access.retryAfterSeconds)),
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email, role: "ADMIN", isActive: true },
    select: { id: true, passwordHash: true, sessionEpoch: true },
  });

  const passwordMatches =
    user &&
    typeof user.passwordHash === "string" &&
    isHashedPassword(user.passwordHash) &&
    verifyPassword(parsed.data.password, user.passwordHash);

  if (!user || !passwordMatches) {
    await registerFailedLogin("admin", clientIp);
    return { ok: false, message: t("public.loginInvalidCredentials", lang) };
  }

  await clearFailedLogin("admin", clientIp);
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await createSessionCookie("admin", user.id, user.sessionEpoch), {
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
