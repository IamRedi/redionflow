CREATE TABLE "NotificationSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tagesplan" BOOLEAN NOT NULL DEFAULT true,
    "workStart" BOOLEAN NOT NULL DEFAULT true,
    "workEnd" BOOLEAN NOT NULL DEFAULT true,
    "adminMessages" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationSubscription_fcmToken_key" ON "NotificationSubscription"("fcmToken");
CREATE INDEX "NotificationSubscription_userId_idx" ON "NotificationSubscription"("userId");
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");
