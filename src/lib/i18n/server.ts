import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { LANGUAGE_COOKIE, normalizeLanguage, pickLanguageFromAcceptHeader, resolveDefaultLanguageForUser, type SupportedLanguage } from "./language";

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
      if (worker) return resolveDefaultLanguageForUser(String(worker.motherTongue ?? worker.preferredLanguage ?? ""));
    } catch (error) {
      console.error("[i18n] resolveRequestLanguage failed", error);
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
