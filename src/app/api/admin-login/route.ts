import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextResponse } from "next/server";

import { createSessionCookie } from "@/lib/auth/session-cookie";

import { ADMIN_COOKIE, ensureDefaultAdmins } from "@/lib/auth/admin-session";
import { authenticateAdminByCode } from "@/lib/auth/authenticate-admin";
import { DISPLAY_COOKIE } from "@/lib/auth/display-session";
import { clearFailedLogin, ensureLoginAllowed, getClientIp, registerFailedLogin } from "@/lib/auth/login-guard";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";
import { WORKER_COOKIE } from "@/lib/workzone/worker-session";

function normalizeCode(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

export const runtime = "nodejs";

function redirectWithPublicOrigin(req: Request, path: string) {
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    process.env.APP_DOMAIN ??
    "localhost:3000";

  return NextResponse.redirect(new URL(path, `${forwardedProto}://${forwardedHost}`));
}

export async function POST(req: Request) {
  const originDenied = rejectCrossOriginMutation(req);
  if (originDenied) return originDenied;
  const clientIp = getClientIp(req.headers);
  const access = await ensureLoginAllowed("admin", clientIp);
  if (!access.ok) {
    return redirectWithPublicOrigin(req, `/admin-login?error=locked&retry=${access.retryAfterSeconds}`);
  }

  try {
    await ensureDefaultAdmins();
  } catch (error) {
    logger.error({ event: "admin_login.bootstrap_failed", route: "api" }, "ensureDefaultAdmins failed", error);
    return redirectWithPublicOrigin(req, "/admin-login?error=db");
  }

  const formData = await req.formData();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = normalizeCode(formData.get("code"));

  if (!email || code.length !== 6) {
    await registerFailedLogin("admin", clientIp);
    return redirectWithPublicOrigin(req, "/admin-login?error=invalid");
  }

  try {
    // BDF-P1-001: identity-only lookup + scrypt-only verification via the
    // shared helper so this route and the parallel server action in
    // `src/app/admin-login/actions.ts` cannot diverge on policy.
    const result = await authenticateAdminByCode(prisma, email, code);

    if (!result.ok) {
      await registerFailedLogin("admin", clientIp);
      if (result.reason === "legacy_plaintext") {
        logger.warn(
          { event: "admin_login.legacy_plaintext", route: "api", email },
          "legacy plaintext admin record cannot authenticate; operator must reset credentials via BDF-P1-002 flow",
        );
        return redirectWithPublicOrigin(req, "/admin-login?error=reset");
      }
      // All other reasons (`not_found`, `no_hash`, `invalid_password`) map
      // to the same generic response so the client cannot enumerate
      // whether the account exists.
      return redirectWithPublicOrigin(req, "/admin-login?error=invalid");
    }

    await clearFailedLogin("admin", clientIp);
    const response = redirectWithPublicOrigin(req, "/app/dashboard");
    response.cookies.set(ADMIN_COOKIE, await createSessionCookie("admin", result.adminId, result.sessionEpoch), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.delete(WORKER_COOKIE);
    response.cookies.delete(DISPLAY_COOKIE);
    return response;
  } catch (error) {
    logger.error({ event: "admin_login.lookup_failed", route: "api" }, "user lookup failed", error);
    return redirectWithPublicOrigin(req, "/admin-login?error=db");
  }
}
