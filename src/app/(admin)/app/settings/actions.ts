"use server";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { t, type Language } from "@/lib/i18n";
import { settingsFormSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/validation/action-result";

function isGpsColumnMissing(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2022";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("fleetGpsEnabled") || message.includes("workerPhoneGpsEnabled");
}

export async function saveSettingsAction(input: unknown, lang?: Language): Promise<ActionResult> {
  if (!(await getCurrentAdmin())) return { ok: false, message: t("validation.noCompanyAccess", lang) };
  const parsed = settingsFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: t("validation.checkInputs", lang),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const v = parsed.data;

  // T-025b: settings can only be saved for the caller's own tenant.
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId || currentCompanyId !== v.companyId) {
    return { ok: false, message: t("validation.noCompanyAccess", lang) };
  }

  const baseData = {
    displayName: v.displayName,
    legalName: v.legalName,
    overheadSettings: {
      upsert: {
        create: {
          bgkPct: v.bgkPct / 100,
          agkPct: v.agkPct / 100,
          riskPct: v.riskPct / 100,
          profitPct: v.profitPct / 100,
          vatPct: v.vatPct / 100,
          bgkBase: v.bgkBase,
          riskProfitMode: v.riskProfitMode,
          applyVatByDefault: v.applyVatByDefault,
        },
        update: {
          bgkPct: v.bgkPct / 100,
          agkPct: v.agkPct / 100,
          riskPct: v.riskPct / 100,
          profitPct: v.profitPct / 100,
          vatPct: v.vatPct / 100,
          bgkBase: v.bgkBase,
          riskProfitMode: v.riskProfitMode,
          applyVatByDefault: v.applyVatByDefault,
        },
      },
    },
  };

  try {
    await prisma.companyProfile.update({
      where: { id: v.companyId },
      select: { id: true },
      data: {
        ...baseData,
        fleetGpsEnabled: v.fleetGpsEnabled,
        workerPhoneGpsEnabled: v.workerPhoneGpsEnabled,
      },
    });
  } catch (error) {
    if (!isGpsColumnMissing(error)) throw error;
    await prisma.companyProfile.update({
      where: { id: v.companyId },
      select: { id: true },
      data: baseData,
    });

    revalidatePath("/app/settings");
    return { ok: true, message: t("validation.savedGpsAfterMigration", lang) };
  }

  revalidatePath("/app/settings");
  return { ok: true, message: t("validation.saved", lang) };
}
