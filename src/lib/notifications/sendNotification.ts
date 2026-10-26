import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { isSaasMode } from "@/lib/saas-config";
import {
  deleteNotificationSubscriptions,
  getAllowedNotificationUserIds,
  getNotificationSubscriptions,
  type NotificationPreference,
} from "@/lib/notifications/notification-store";

type SendNotificationInput = {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  preference?: NotificationPreference;
};

function adminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_CONFIG) {
    return initializeApp({ credential: applicationDefault() });
  }

  return null;
}

export async function sendNotification({ userIds, title, body, url = "/workzone", preference }: SendNotificationInput) {
  let uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return { sent: 0, failed: 0 };

  if (isSaasMode) {
    const companyProfileId = await getCurrentCompanyId();
    if (!companyProfileId) return { sent: 0, failed: 0 };
    const [admins, workers] = await Promise.all([
      prisma.user.findMany({where:{id:{in:uniqueUserIds},companyProfileId,role:"ADMIN",isActive:true},select:{id:true}}),
      prisma.worker.findMany({where:{id:{in:uniqueUserIds},companyProfileId,status:"active"},select:{id:true}}),
    ]);
    uniqueUserIds = [...admins,...workers].map(row=>row.id);
    if (!uniqueUserIds.length) return { sent: 0, failed: 0 };
  }

  const allowedUserIds = await getAllowedNotificationUserIds(uniqueUserIds, preference);
  if (allowedUserIds.length === 0) return { sent: 0, failed: 0 };

  const subscriptions = await getNotificationSubscriptions(allowedUserIds);
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const app = adminApp();
  if (!app) return { sent: 0, failed: subscriptions.length };

  const messaging = getMessaging(app);
  const response = await messaging.sendEachForMulticast({
    tokens: subscriptions.map((item) => item.fcmToken),
    data: { title, body, url },
    webpush: {
      fcmOptions: { link: url },
      notification: {
        title,
        body,
        icon: "/branding/logoholz.png",
      },
    },
  });

  const invalidTokenIds = response.responses
    .map((item, index) => ({ item, subscription: subscriptions[index] }))
    .filter(({ item }) => {
      const code = item.error?.code ?? "";
      return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
    })
    .map(({ subscription }) => subscription?.id)
    .filter(Boolean) as string[];

  if (invalidTokenIds.length > 0) {
    await deleteNotificationSubscriptions(invalidTokenIds);
  }

  return { sent: response.successCount, failed: response.failureCount };
}

export async function sendNotificationToAdmins(input: Omit<SendNotificationInput, "userIds">) {
  const companyProfileId = isSaasMode ? await getCurrentCompanyId() : null;
  if (isSaasMode && !companyProfileId) return {sent:0,failed:0};
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true, ...(companyProfileId ? {companyProfileId} : {}) },
    select: { id: true },
  });
  return sendNotification({ ...input, userIds: admins.map((admin) => admin.id) });
}

export async function sendNotificationToWorkers(input: Omit<SendNotificationInput, "userIds"> & { workerIds?: string[] }) {
  const companyProfileId = isSaasMode ? await getCurrentCompanyId() : null;
  if (isSaasMode && !companyProfileId) return {sent:0,failed:0};
  const workers = await prisma.worker.findMany({
    where: { id: input.workerIds ? { in: input.workerIds } : undefined, status: "active", ...(companyProfileId ? {companyProfileId} : {}) },
    select: { id: true },
  });
  return sendNotification({ ...input, userIds: workers.map((worker) => worker.id) });
}
