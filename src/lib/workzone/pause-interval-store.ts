import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type PauseInterval = {
  id: string;
  workSessionId: string;
  workerId: string;
  startedAt: Date;
  endedAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaWithOptionalPause = typeof prisma & {
  workSessionPauseInterval?: {
    findMany: typeof prisma.workSessionPauseInterval.findMany;
    create: typeof prisma.workSessionPauseInterval.create;
    update: typeof prisma.workSessionPauseInterval.update;
  };
};

function pauseDelegate() {
  return (prisma as PrismaWithOptionalPause).workSessionPauseInterval;
}

function isPauseSchemaUnavailable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("WorkSessionPauseInterval") || message.includes("pauseIntervals");
}

export async function findPauseIntervalsForSession(workSessionId: string): Promise<PauseInterval[]> {
  const delegate = pauseDelegate();
  if (!delegate) return [];
  try {
    return await delegate.findMany({
      where: { workSessionId },
      orderBy: { startedAt: "asc" },
    });
  } catch (error) {
    if (isPauseSchemaUnavailable(error)) return [];
    throw error;
  }
}

export async function findPauseIntervalsForSessions(workSessionIds: string[]) {
  const map = new Map<string, PauseInterval[]>();
  if (workSessionIds.length === 0) return map;

  const delegate = pauseDelegate();
  if (!delegate) return map;
  try {
    const rows = await delegate.findMany({
      where: { workSessionId: { in: workSessionIds } },
      orderBy: { startedAt: "asc" },
    });
    for (const row of rows) {
      const current = map.get(row.workSessionId) ?? [];
      current.push(row);
      map.set(row.workSessionId, current);
    }
    return map;
  } catch (error) {
    if (isPauseSchemaUnavailable(error)) return map;
    throw error;
  }
}

export async function createPauseInterval(data: { workSessionId: string; workerId: string; startedAt: Date; note?: string | null }) {
  const delegate = pauseDelegate();
  if (!delegate) return null;
  return delegate.create({ data });
}

export async function closePauseInterval(id: string, endedAt: Date) {
  const delegate = pauseDelegate();
  if (!delegate) return null;
  return delegate.update({ where: { id }, data: { endedAt } });
}
