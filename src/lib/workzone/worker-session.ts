import { readSessionCookie } from "@/lib/auth/session-cookie";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { findPauseIntervalsForSessions } from "./pause-interval-store";

export const WORKER_COOKIE = "bk_worker_id";

export async function getCurrentWorker() {
  const jar = await cookies();
  const claims = readSessionCookie(jar.get(WORKER_COOKIE)?.value, "worker");
  if (!claims) return null;

  const worker = await prisma.worker.findUnique({
    where: { id: claims.id },
    include: {
      sessions: {
        orderBy: { startTime: "desc" },
        take: 20,
      },
      assetItems: {
        where: { status: { not: "DELETED" } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!worker || worker.status !== "active" || worker.sessionEpoch !== claims.epoch) return null;
  const company = await prisma.companyProfile.findUnique({
    where: { id: worker.companyProfileId },
    select: { id: true, workerPhoneGpsEnabled: true },
  });
  const pauseBySessionId = await findPauseIntervalsForSessions(worker.sessions.map((session) => session.id));
  return {
    ...worker,
    companyProfile: { workerPhoneGpsEnabled: company?.workerPhoneGpsEnabled ?? false },
    sessions: worker.sessions.map((session) => ({
      ...session,
      pauseIntervals: pauseBySessionId.get(session.id) ?? [],
    })),
  };
}
