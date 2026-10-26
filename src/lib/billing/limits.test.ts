import { beforeEach, describe, expect, it, vi } from "vitest";

const countMocks = vi.hoisted(() => ({
  baustelle: vi.fn(),
}));

vi.mock("@/lib/saas-config", () => ({
  isSaasMode: true,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    baustelle: {
      count: countMocks.baustelle,
    },
    machine: {
      count: vi.fn(),
    },
    worker: {
      count: vi.fn(),
    },
  },
}));

vi.mock("./plans", () => ({
  getCurrentSubscription: vi.fn(async () => ({
    plan: { tier: "starter" },
  })),
}));

describe("billing limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts active Baustellen by status only", async () => {
    const { checkLimit } = await import("./limits");
    countMocks.baustelle.mockResolvedValue(0);

    await expect(checkLimit("company-1", "activeBaustellen")).resolves.toEqual({ ok: true });

    expect(countMocks.baustelle).toHaveBeenCalledWith({
      where: { companyProfileId: "company-1", status: "active" },
    });
  });
});
