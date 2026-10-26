import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type NotificationSettingsRow = {
  tagesplan: boolean;
  workStart: boolean;
  workEnd: boolean;
  adminMessages: boolean;
};

export type NotificationPreference = keyof NotificationSettingsRow;

export const defaultNotificationSettings: NotificationSettingsRow = {
  tagesplan: true,
  workStart: true,
  workEnd: true,
  adminMessages: true,
};

export async function ensureNotificationSettings(userId: string): Promise<NotificationSettingsRow> {
  await prisma.$executeRaw`
    INSERT INTO "NotificationSettings" ("id", "userId", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING
  `;

  const rows = await prisma.$queryRaw<NotificationSettingsRow[]>`
    SELECT "tagesplan", "workStart", "workEnd", "adminMessages"
    FROM "NotificationSettings"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? defaultNotificationSettings;
}

export async function updateNotificationSettings(userId: string, settings: NotificationSettingsRow) {
  await prisma.$executeRaw`
    INSERT INTO "NotificationSettings" ("id", "userId", "tagesplan", "workStart", "workEnd", "adminMessages", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${settings.tagesplan}, ${settings.workStart}, ${settings.workEnd}, ${settings.adminMessages}, NOW(), NOW())
    ON CONFLICT ("userId") DO UPDATE SET
      "tagesplan" = EXCLUDED."tagesplan",
      "workStart" = EXCLUDED."workStart",
      "workEnd" = EXCLUDED."workEnd",
      "adminMessages" = EXCLUDED."adminMessages",
      "updatedAt" = NOW()
  `;
}

export async function registerNotificationSubscription(userId: string, fcmToken: string) {
  return prisma.$transaction(async tx=>{
    // Atomic conflict check: possession of a client-supplied token must not
    // delete or reassign another identity's subscription, even in a race.
    const rows = await tx.$queryRaw<Array<{id:string}>>`
      INSERT INTO "NotificationSubscription" ("id", "userId", "fcmToken", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${userId}, ${fcmToken}, NOW(), NOW())
      ON CONFLICT ("fcmToken") DO UPDATE SET
        "updatedAt" = NOW()
      WHERE "NotificationSubscription"."userId" = EXCLUDED."userId"
      RETURNING "id"
    `;
    if(!rows.length) return false;
    await tx.$executeRaw`
      INSERT INTO "NotificationSettings" ("id", "userId", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${userId}, NOW(), NOW())
      ON CONFLICT ("userId") DO NOTHING
    `;
    return true;
  });
}

export async function getAllowedNotificationUserIds(userIds: string[], preference?: NotificationPreference) {
  if (!preference || userIds.length === 0) return userIds;

  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT input."userId"
    FROM (SELECT UNNEST(${userIds}::text[]) AS "userId") input
    LEFT JOIN "NotificationSettings" settings ON settings."userId" = input."userId"
    WHERE settings."userId" IS NULL OR settings.${Prisma.raw(`"${preference}"`)} = true
  `;

  return rows.map((row) => row.userId);
}

export async function getNotificationSubscriptions(userIds: string[]) {
  if (userIds.length === 0) return [];

  return prisma.$queryRaw<Array<{ id: string; fcmToken: string }>>`
    SELECT "id", "fcmToken"
    FROM "NotificationSubscription"
    WHERE "userId" = ANY(${userIds}::text[])
      -- Fail closed for IDs shared by User and Worker; neither identity may receive
      -- the other's subscription through the normal privileged application connection.
      AND (EXISTS (SELECT 1 FROM "User" u WHERE u.id="NotificationSubscription"."userId"))
        <> (EXISTS (SELECT 1 FROM "Worker" w WHERE w.id="NotificationSubscription"."userId"))
  `;
}

export async function deleteNotificationSubscriptions(subscriptionIds: string[]) {
  if (subscriptionIds.length === 0) return;

  await prisma.$executeRaw`
    DELETE FROM "NotificationSubscription"
    WHERE "id" = ANY(${subscriptionIds}::text[])
  `;
}
