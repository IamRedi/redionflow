"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { sendNotificationToWorkers } from "@/lib/notifications/sendNotification";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

export async function updateWorkzoneAnnouncementAction(formData: FormData) {
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (!admin && !worker) return;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;
  const company = await getOrCreateDefaultCompany();
  if (company.id !== currentCompanyId) return;
  if (worker && worker.companyProfileId !== company.id) return;

  const message = String(formData.get("message") ?? "").trim().slice(0, 220);
  const authorName = admin ? (admin.name ?? admin.email ?? "Admin") : `${worker?.firstName ?? ""} ${worker?.lastName ?? ""}`.trim() || "Worker";

  await prisma.workzoneAnnouncement.updateMany({
    where: { companyProfileId: company.id, isActive: true },
    data: { isActive: false },
  });

  if (message) {
    await prisma.workzoneAnnouncement.create({
      data: {
        companyProfileId: company.id,
        message,
        createdByAdminId: admin?.id ?? null,
        createdByName: authorName,
      },
    });
  }

  revalidatePath("/workzone");
  notifyRealtimeUpdate("announcement.updated", ["announcement-bar"]);
}

export async function notifyTeamAction() {
  const admin = await getCurrentAdmin();
  if (!admin) return;
  const currentLang = await resolveRequestLanguage();

  await sendNotificationToWorkers({
    title: t("workzone.newInfo", currentLang),
    body: t("workzone.dailyPlanTomorrowNotificationBody", currentLang),
    url: "/workzone",
    preference: "adminMessages",
  });
}
