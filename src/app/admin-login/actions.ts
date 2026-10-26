"use server";

import { createSessionCookie } from "@/lib/auth/session-cookie";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE, ensureDefaultAdmins } from "@/lib/auth/admin-session";
import { authenticateAdminByCode } from "@/lib/auth/authenticate-admin";
import { DISPLAY_COOKIE } from "@/lib/auth/display-session";
import { prisma } from "@/lib/db/prisma";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { logger } from "@/lib/observability/logger";
import { WORKER_COOKIE } from "@/lib/workzone/worker-session";

type LoginState = { message?: string };

function normalizeCode(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

export async function loginAdminAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const tr = await getActionTranslator("admin");
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
  const code = normalizeCode(formData.get("code"));

  if (!email || code.length !== 6) {
    return { message: tr("loginInvalid") };
  }

  let result: Awaited<ReturnType<typeof authenticateAdminByCode>>;
  try {
    // BDF-P1-001: use the shared verifier so this server action and the
    // API route in `src/app/api/admin-login/route.ts` cannot drift apart.
    result = await authenticateAdminByCode(prisma, email, code);
  } catch (error) {
    logger.error({ event: "admin_login.lookup_failed", email }, "user lookup failed", error);
    return { message: tr("loginUnavailable") };
  }

  if (!result.ok) {
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
