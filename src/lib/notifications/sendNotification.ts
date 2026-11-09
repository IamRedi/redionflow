import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { isSaasMode } from "@/lib/saas-config";
import { decodeBrowserSubscription, deliverBrowserPush, isBrowserSubscription } from './web-push';
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
  tag?: string;
  onlyToken?: string;
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

export async function sendNotification({ userIds, title, body, url = "/workzone", preference, tag, onlyToken }: SendNotificationInput) {
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

  const subscriptions = (await getNotificationSubscriptions(allowedUserIds)).filter(row => !onlyToken || row.fcmToken === onlyToken);
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  // Native Web Push works without a Firebase project. Keep existing FCM devices.
  let sent = 0, failed = 0;
  const expired: string[] = [];
  const native = subscriptions.filter(item => isBrowserSubscription(item.fcmToken));
  for (let i = 0; i < native.length; i += 50) {
    await Promise.all(native.slice(i, i + 50).map(async item => {
      const subscription = decodeBrowserSubscription(item.fcmToken);
      if (!subscription) { failed++; return; }
      const result = await deliverBrowserPush(subscription, { title, body, url, tag });
      if (result.ok) sent++; else failed++;
      if (result.expired) expired.push(item.id);
    }));
  }
  if (expired.length) await deleteNotificationSubscriptions(expired);
  const legacy = subscriptions.filter(item => !isBrowserSubscription(item.fcmToken));
  if (!legacy.length) return { sent, failed };
  const app = adminApp();
  if (!app) return { sent, failed: failed + legacy.length };

  const messaging = getMessaging(app);
  for (let i = 0; i < legacy.length; i += 500) {
  const batch = legacy.slice(i, i + 500);
  try {
  const response = await messaging.sendEachForMulticast({
    tokens: batch.map((item) => item.fcmToken),
    data: { title, body, url },
    webpush: {
      fcmOptions: { link: url },
      notification: {
        title,
        body,
        icon: "/branding/logo-192.png",
      },
    },
  });

  const invalidTokenIds = response.responses
    .map((item, index) => ({ item, subscription: batch[index] }))
    .filter(({ item }) => {
      const code = item.error?.code ?? "";
      return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
    })
    .map(({ subscription }) => subscription?.id)
    .filter(Boolean) as string[];

  if (invalidTokenIds.length > 0) {
    await deleteNotificationSubscriptions(invalidTokenIds);
  }

  sent += response.successCount; failed += response.failureCount;
  } catch { failed += batch.length; }
  }
  return { sent, failed };
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

/**
 * "X started/finished work": only people who switched it on in their profile
 * (admins or workers, e.g. the site managers), never the person themselves.
 */
export async function sendWorkEventNotification(input: Omit<SendNotificationInput, "userIds" | "preference"> & { preference: "workStart" | "workEnd"; actorWorkerId?: string }) {
  const companyProfileId = isSaasMode ? await getCurrentCompanyId() : null;
  if (isSaasMode && !companyProfileId) return {sent:0,failed:0};
  const scope = companyProfileId ? {companyProfileId} : {};
  const [admins, workers] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN", isActive: true, ...scope }, select: { id: true } }),
    prisma.worker.findMany({ where: { status: "active", ...scope }, select: { id: true } }),
  ]);
  const { actorWorkerId, ...rest } = input;
  const userIds = [...admins, ...workers].map((row) => row.id).filter((id) => id !== actorWorkerId);
  return sendNotification({ ...rest, userIds });
}
