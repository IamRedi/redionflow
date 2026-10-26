import { prisma } from "@/lib/db/prisma";

export async function autoLockPastWorkLogs() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  await prisma.workLog.updateMany({
    where: { isLocked: false, date: { lt: startOfToday } },
    data: { isLocked: true },
  });
}

