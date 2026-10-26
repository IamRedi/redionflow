"use server";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { t } from "@/lib/i18n";
import { createProjectSchema, updateProjectMetaSchema } from "@/lib/validation/schemas";

async function ownedProject(projectId: string) {
  if (!projectId || !(await getCurrentAdmin())) return null;
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return null;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, companyProfileId: true },
  });
  if (!project || project.companyProfileId !== currentCompanyId) return null;
  return project;
}
import type { ActionResult } from "@/lib/validation/action-result";

export async function createProjectAction(input: unknown): Promise<ActionResult> {
  if (!(await getCurrentAdmin())) return { ok: false, message: t("validation.checkInputs") };
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: t("validation.checkInputs"),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const v = parsed.data;
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId || currentCompanyId !== v.companyId) {
    return { ok: false, message: t("validation.checkInputs") };
  }
  await prisma.project.create({
    data: {
      companyProfileId: v.companyId,
      title: v.title,
      customerName: v.customerName,
      status: "DRAFT",
    },
  });

  revalidatePath("/app/projects");
  revalidatePath("/app/dashboard");
  return { ok: true, message: t("validation.projectCreated") };
}

export async function updateProjectAction(input: unknown): Promise<ActionResult> {
  const parsed = updateProjectMetaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: t("validation.checkInputs"),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const v = parsed.data;
  if (!(await ownedProject(v.projectId))) return { ok: false, message: t("validation.checkInputs") };
  const empty = (s: string | undefined) => (s?.trim() ? s.trim() : null);
  await prisma.project.update({
    where: { id: v.projectId },
    data: {
      title: v.title,
      customerName: v.customerName,
      customerStreet: empty(v.customerStreet),
      customerZip: empty(v.customerZip),
      customerCity: empty(v.customerCity),
      internalNotes: empty(v.internalNotes),
      status: v.status,
    },
  });

  revalidatePath(`/app/projects/${v.projectId}`);
  revalidatePath("/app/dashboard");
  return { ok: true, message: t("validation.saved") };
}

export async function openProjectExecutionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  if (!(await ownedProject(projectId))) return;

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "ACCEPTED" },
  });

  revalidatePath("/app/projects");
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/dashboard");
  redirect(`/app/projects/${projectId}/execution`);
}

export async function finishProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  if (!(await ownedProject(projectId))) return;

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/app/projects");
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/dashboard");
  redirect("/app/projects");
}

