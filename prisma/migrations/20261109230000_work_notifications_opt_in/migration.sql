-- Work start/end notices are opt-in: new people do not get them until they switch them on.
ALTER TABLE "NotificationSettings" ALTER COLUMN "workStart" SET DEFAULT false;
ALTER TABLE "NotificationSettings" ALTER COLUMN "workEnd" SET DEFAULT false;
