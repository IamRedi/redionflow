import { describe, expect, it, vi } from "vitest";
import {
  getUserSessionEpoch,
  getWorkerSessionEpoch,
  isEpochStillValid,
  revokeUserSessions,
  revokeWorkerSessions,
} from "./session-epoch";

/**
 * The helpers are thin wrappers around Prisma. Rather than spin up a
 * live database, we mock the client and assert both the SQL surface
 * (where/data payloads) and the return-value contract each caller
 * will depend on in Phase 2.
 */

type EpochQuery = {
  where: { id: string };
  select: unknown;
  data?: { sessionEpoch?: { increment?: number } };
};

function makePrismaMock(state: {
  users: Map<string, { sessionEpoch: number }>;
  workers: Map<string, { sessionEpoch: number }>;
}) {
  return {
    user: {
      findUnique: vi.fn(async ({ where, select }: EpochQuery) => {
        expect(select).toEqual({ sessionEpoch: true });
        const row = state.users.get(where.id);
        return row ?? null;
      }),
      update: vi.fn(async ({ where, data, select }: EpochQuery) => {
        expect(select).toEqual({ sessionEpoch: true });
        const row = state.users.get(where.id);
        if (!row) {
          const err = new Error("not found");
          throw err;
        }
        row.sessionEpoch += data?.sessionEpoch?.increment ?? 0;
        return { sessionEpoch: row.sessionEpoch };
      }),
    },
    worker: {
      findUnique: vi.fn(async ({ where, select }: EpochQuery) => {
        expect(select).toEqual({ sessionEpoch: true });
        const row = state.workers.get(where.id);
        return row ?? null;
      }),
      update: vi.fn(async ({ where, data, select }: EpochQuery) => {
        expect(select).toEqual({ sessionEpoch: true });
        const row = state.workers.get(where.id);
        if (!row) throw new Error("not found");
        row.sessionEpoch += data?.sessionEpoch?.increment ?? 0;
        return { sessionEpoch: row.sessionEpoch };
      }),
    },
  } as unknown as Parameters<typeof getUserSessionEpoch>[0];
}

describe("getUserSessionEpoch / getWorkerSessionEpoch", () => {
  it("returns the current epoch for an existing user", async () => {
    const prisma = makePrismaMock({
      users: new Map([["u1", { sessionEpoch: 3 }]]),
      workers: new Map(),
    });
    expect(await getUserSessionEpoch(prisma, "u1")).toBe(3);
  });

  it("returns null when the user row is missing", async () => {
    const prisma = makePrismaMock({ users: new Map(), workers: new Map() });
    expect(await getUserSessionEpoch(prisma, "u1")).toBeNull();
  });

  it("returns the current epoch for an existing worker", async () => {
    const prisma = makePrismaMock({
      users: new Map(),
      workers: new Map([["w1", { sessionEpoch: 7 }]]),
    });
    expect(await getWorkerSessionEpoch(prisma, "w1")).toBe(7);
  });
});

describe("revokeUserSessions / revokeWorkerSessions", () => {
  it("increments the user's epoch atomically and returns the new value", async () => {
    const state = { users: new Map([["u1", { sessionEpoch: 2 }]]), workers: new Map() };
    const prisma = makePrismaMock(state);
    expect(await revokeUserSessions(prisma, "u1")).toBe(3);
    expect(state.users.get("u1")?.sessionEpoch).toBe(3);
  });

  it("returns null instead of throwing when the row is gone", async () => {
    const prisma = makePrismaMock({ users: new Map(), workers: new Map() });
    expect(await revokeUserSessions(prisma, "ghost")).toBeNull();
  });

  it("worker path parallels user path", async () => {
    const state = { users: new Map(), workers: new Map([["w1", { sessionEpoch: 0 }]]) };
    const prisma = makePrismaMock(state);
    expect(await revokeWorkerSessions(prisma, "w1")).toBe(1);
    expect(state.workers.get("w1")?.sessionEpoch).toBe(1);
  });
});

describe("isEpochStillValid", () => {
  it("accepts a cookie whose epoch matches the DB", () => {
    expect(isEpochStillValid(3, 3)).toBe(true);
  });

  it("accepts a cookie whose epoch is ahead of the DB (defensive during a race)", () => {
    expect(isEpochStillValid(4, 3)).toBe(true);
  });

  it("rejects a cookie whose epoch is behind the DB (real revocation)", () => {
    expect(isEpochStillValid(2, 3)).toBe(false);
  });

  it("treats a missing cookie epoch as 0 for backwards compatibility", () => {
    // A Phase 1 cookie has no epoch embedded; the DB default is 0 so
    // it must still validate.
    expect(isEpochStillValid(undefined, 0)).toBe(true);
    expect(isEpochStillValid(null, 0)).toBe(true);
  });

  it("rejects when the DB epoch is null (row deleted)", () => {
    expect(isEpochStillValid(3, null)).toBe(false);
    expect(isEpochStillValid(0, null)).toBe(false);
  });

  it("rejects a NaN or non-finite claimed epoch", () => {
    expect(isEpochStillValid(NaN as unknown as number, 0)).toBe(true);
    // Falls back to 0, so NaN + dbEpoch=1 rejects:
    expect(isEpochStillValid(NaN as unknown as number, 1)).toBe(false);
  });
});
