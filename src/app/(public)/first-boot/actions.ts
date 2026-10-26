"use server";

import { createSessionCookie } from "@/lib/auth/session-cookie";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import {
  clearFailedLogin,
  ensureLoginAllowed,
  getClientIp,
  registerFailedLogin,
} from "@/lib/auth/login-guard";
import { performFirstBootSetup } from "@/lib/auth/first-boot-setup-service";
import { logger } from "@/lib/observability/logger";

/**
 * BDF-P1-002 server action.
 *
 * Consumes `FormData` (token + email + password + confirmation) from the
 * POST-only `/first-boot` form. The action:
 *
 *   1. rate-limits by client IP under the dedicated `firstBoot` scope;
 *   2. delegates verification, validation, and atomic creation to
 *      `performFirstBootSetup`;
 *   3. maps every non-OK reason to the same generic external response
 *      (`?error=denied`), only logging an operational reason server-side;
 *   4. on success, sets the admin session cookie and redirects to
 *      `/app/dashboard`.
 *
 * The submitted token is never logged, never returned in the redirect URL,
 * and never persisted.
 */
export async function firstBootSetupAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers();
  const clientIp = getClientIp(requestHeaders);

  const access = await ensureLoginAllowed("firstBoot", clientIp);
  if (!access.ok) {
    // Non-enumerating: the caller receives the same "denied" outcome as
    // any other failure so an attacker cannot distinguish rate-lockout
    // from "setup not enabled".
    redirect("/first-boot?error=denied");
  }

  const result = await performFirstBootSetup({
    token: formData.get("token"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
    name: formData.get("name"),
  });

  if (!result.ok) {
    // Log an operational reason but never the token/email/password. Every
    // caller-visible response is the same "denied" redirect.
    const level = result.reason === "database_error" ? "error" : "warn";
    logger[level](
      { event: "first_boot.rejected", reason: result.reason },
      `first-boot rejected: ${result.reason}`,
    );
    await registerFailedLogin("firstBoot", clientIp);
    redirect("/first-boot?error=denied");
  }

  await clearFailedLogin("firstBoot", clientIp);

  // Set the admin cookie so the operator lands straight in the dashboard.
  // We import cookies lazily to keep this server action pure until now.
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await createSessionCookie("admin", result.adminId, result.sessionEpoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/app/dashboard");
}
