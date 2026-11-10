import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { LANGUAGE_COOKIE, normalizeLanguage, pickLanguageFromAcceptHeader, profileUiLanguage, type SupportedLanguage } from "./language";

export async function resolveRequestLanguage(): Promise<SupportedLanguage> {
  const jar = await cookies();
  const override = normalizeLanguage(jar.get(LANGUAGE_COOKIE)?.value);
  if (override) return override;

  const currentWorker = await getCurrentWorker();
  const workerId = currentWorker?.id;
  if (workerId) {
    try {
      const worker = await prisma.worker.findUnique({
        where: { id: workerId },
        select: { motherTongue: true, preferredLanguage: true },
      });
      if (worker) return profileUiLanguage(worker.preferredLanguage, worker.motherTongue);
    } catch (error) {
      console.error("[i18n] resolveRequestLanguage failed", error);
    }
  }

  // An office admin's profile language beats the phone's language (Megi 10.11.2026).
  const currentAdmin = workerId ? null : await getCurrentAdmin();
  if (currentAdmin) {
    try {
      const admin = await prisma.user.findUnique({ where: { id: currentAdmin.id }, select: { motherTongue: true, preferredLanguage: true } });
      if (admin) return profileUiLanguage(admin.preferredLanguage, admin.motherTongue);
    } catch (error) {
      console.error("[i18n] admin language failed", error);
    }
  }

  try {
    const headerBag = await headers();
    const acceptLanguage = pickLanguageFromAcceptHeader(headerBag.get("accept-language"));
    if (acceptLanguage) return acceptLanguage;
  } catch (error) {
    console.error("[i18n] accept-language read failed", error);
  }

  return "de";
}

/** After someone saves their own profile language, use it right away (also over an older choice on this phone). */
export async function rememberProfileLanguage(preferred: string | null | undefined, motherTongue: string | null | undefined) {
  (await cookies()).set(LANGUAGE_COOKIE, profileUiLanguage(preferred, motherTongue), { path: "/", maxAge: 31_536_000, sameSite: "lax" });
}
