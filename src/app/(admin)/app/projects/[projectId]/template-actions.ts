"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { t } from "@/lib/i18n";
import { applyTemplateSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/validation/action-result";

export async function applyTemplateToProjectAction(input: unknown): Promise<ActionResult> {
  const parsed = applyTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: t("validation.invalidSelection"),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const { projectId, templateId } = parsed.data;

  const [project, template] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.calculationTemplate.findUnique({
      where: { id: templateId },
      include: { templatePositions: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  if (!project || !template) {
    return { ok: false, message: t("validation.projectOrTemplateNotFound") };
  }

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId || project.companyProfileId !== currentCompanyId) {
    return { ok: false, message: t("validation.projectOrTemplateNotFound") };
  }
  if (template.companyProfileId !== project.companyProfileId) {
    return { ok: false, message: t("validation.templateWrongCompany") };
  }

  const existingCount = await prisma.projectPosition.count({ where: { projectId } });
  let sortBase = existingCount;

  for (const preset of template.templatePositions) {
    await prisma.projectPosition.create({
      data: {
        projectId,
        sortOrder: sortBase++,
        title: preset.title,
        description: preset.description,
        quantity: preset.quantity,
        unit: preset.unit,
      },
    });
  }

  revalidatePath(`/app/projects/${projectId}`);
  return {
    ok: true,
    message: `${template.templatePositions.length} ${t("validation.templatePositionsApplied")}`,
  };
}

