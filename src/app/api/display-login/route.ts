import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextResponse } from "next/server";

import { createSessionCookie } from "@/lib/auth/session-cookie";

import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { authenticateDisplayByCode } from "@/lib/auth/authenticate-display";
import { DISPLAY_COOKIE, ensureDefaultDisplayUsers, isDisplayLoginEmail } from "@/lib/auth/display-session";
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
  const access = await ensureLoginAllowed("display", clientIp);
  if (!access.ok) {
    return redirectWithPublicOrigin(req, `/display-login?error=locked&retry=${access.retryAfterSeconds}`);
  }

  try {
    await ensureDefaultDisplayUsers();
  } catch (error) {
    logger.error({ event: "display_login.bootstrap_failed" }, "ensureDefaultDisplayUsers failed", error);
    return redirectWithPublicOrigin(req, "/display-login?error=db");
  }

  const formData = await req.formData();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = normalizeCode(formData.get("code"));

  if (!email || code.length !== 6 || !isDisplayLoginEmail(email)) {
    await registerFailedLogin("display", clientIp);
    return redirectWithPublicOrigin(req, "/display-login?error=invalid");
  }

  try {
    // BDF-P1-005: identity-only lookup via the shared verifier so this
    // route and any future caller cannot drift on the scrypt-only policy.
    const result = await authenticateDisplayByCode(prisma, email, code);

    if (!result.ok) {
      await registerFailedLogin("display", clientIp);
      if (result.reason === "legacy_plaintext") {
        logger.warn(
          { event: "display_login.legacy_plaintext", email },
          "legacy plaintext display record cannot authenticate; operator must reset credentials via the admin UI",
        );
        return redirectWithPublicOrigin(req, "/display-login?error=reset");
      }
      return redirectWithPublicOrigin(req, "/display-login?error=invalid");
    }

    await clearFailedLogin("display", clientIp);
    const response = redirectWithPublicOrigin(req, "/display/workzone");
    response.cookies.set(DISPLAY_COOKIE, await createSessionCookie("display", result.userId, result.sessionEpoch), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.delete(ADMIN_COOKIE);
    response.cookies.delete(WORKER_COOKIE);
    return response;
  } catch (error) {
    logger.error({ event: "display_login.lookup_failed" }, "user lookup failed", error);
    return redirectWithPublicOrigin(req, "/display-login?error=db");
  }
}
