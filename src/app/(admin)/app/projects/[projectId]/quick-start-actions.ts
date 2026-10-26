"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { t } from "@/lib/i18n";
import { normalizeLanguage } from "@/lib/i18n/language";
import { machineOptionLabel } from "@/lib/machines/display";
import type { ActionResult } from "@/lib/validation/action-result";
import { quickBaumfaellungSchema } from "@/lib/validation/schemas";

function quickTreeRemovalText(lang: string) {
  const copy = {
    en: {
      title: "Tree removal (normal)",
      description: "Standard setup with 1 specialist, 1 helper, truck and chipper.",
      unit: "fixed",
    },
    it: {
      title: "Abbattimento albero (normale)",
      description: "Setup standard con 1 specialista, 1 aiutante, camion e biotrituratore.",
      unit: "forfait",
    },
    pl: {
      title: "Wycinka drzewa (normalna)",
      description: "Standardowy zestaw z 1 specjalista, 1 pomocnikiem, ciezarowka i rebakiem.",
      unit: "ryczalt",
    },
    ro: {
      title: "Doborare arbore (normal)",
      description: "Setup standard cu 1 specialist, 1 ajutor, camion si tocator.",
      unit: "forfetar",
    },
    sq: {
      title: "Prerje peme (normale)",
      description: "Setup standard me 1 specialist, 1 ndihmes, kamion dhe grimcues.",
      unit: "paushall",
    },
  } as const;
  return copy[lang as keyof typeof copy] ?? {
    title: "Baumfaellung (normal)",
    description: "Standard-Setup mit 1 Fachkraft, 1 Helfer, LKW und Haechsler.",
    unit: "pauschal",
  };
}

export async function createQuickBaumfaellungAction(input: unknown): Promise<ActionResult> {
  const lang =
    input && typeof input === "object" && "lang" in input
      ? normalizeLanguage(String((input as { lang?: unknown }).lang ?? "")) ?? "de"
      : "de";
  const parsed = quickBaumfaellungSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: t("validation.fillAllFields", lang),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const { projectId, climberRoleId, helperRoleId, truckMachineId, chipperMachineId } = parsed.data;
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: t("validation.projectNotFound", lang) };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.companyProfileId !== currentCompanyId) return { ok: false, message: t("validation.projectNotFound", lang) };

  const [climber, helper, truck, chipper] = await Promise.all([
    prisma.laborRole.findUnique({ where: { id: climberRoleId } }),
    prisma.laborRole.findUnique({ where: { id: helperRoleId } }),
    prisma.machine.findUnique({ where: { id: truckMachineId } }),
    prisma.machine.findUnique({ where: { id: chipperMachineId } }),
  ]);

  if (!climber || !helper || !truck || !chipper) {
    return { ok: false, message: t("validation.referencesNotFound", lang) };
  }

  const sameCompany =
    climber.companyProfileId === project.companyProfileId &&
    helper.companyProfileId === project.companyProfileId &&
    truck.companyProfileId === project.companyProfileId &&
    chipper.companyProfileId === project.companyProfileId;
  if (!sameCompany) {
    return { ok: false, message: t("validation.selectionWrongProjectCompany", lang) };
  }

  const sortOrder = await prisma.projectPosition.count({ where: { projectId } });
  const text = quickTreeRemovalText(lang);

  await prisma.projectPosition.create({
    data: {
      projectId,
      sortOrder,
      title: text.title,
      description: text.description,
      quantity: "1",
      unit: text.unit,
      laborItems: {
        create: [
          {
            laborRoleId: climber.id,
            laborRoleNameSnapshot: climber.name,
            workers: 1,
            hours: "6",
          },
          {
            laborRoleId: helper.id,
            laborRoleNameSnapshot: helper.name,
            workers: 1,
            hours: "6",
          },
        ],
      },
      machineItems: {
        create: [
          {
            machineId: truck.id,
            machineNameSnapshot: machineOptionLabel(truck),
            timeUnit: "HOURS",
            quantity: "4",
          },
          {
            machineId: chipper.id,
            machineNameSnapshot: machineOptionLabel(chipper),
            timeUnit: "HOURS",
            quantity: "3",
          },
        ],
      },
    },
  });

  revalidatePath(`/app/projects/${projectId}`);
  return { ok: true, message: t("validation.standardTreeRemovalCreated", lang) };
}

