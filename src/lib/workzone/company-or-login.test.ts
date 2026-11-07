import { beforeEach, expect, it, vi } from "vitest";

const company = vi.hoisted(() => ({ get: vi.fn() }));
const nav = vi.hoisted(() => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));
vi.mock("@/lib/db/company", () => ({ getOrCreateDefaultCompany: company.get }));
vi.mock("next/navigation", () => ({ redirect: nav.redirect }));

import { TenantUnauthorizedError } from "@/lib/db/tenant";
import { companyOrLogin } from "./company-or-login";

beforeEach(() => { company.get.mockReset(); nav.redirect.mockClear(); });

it("sends a visitor without a session to the login screen instead of an error page", async () => {
  company.get.mockRejectedValue(new TenantUnauthorizedError());
  await expect(companyOrLogin()).rejects.toThrow("REDIRECT /workzone/login");
});

it("returns the company for a signed-in caller", async () => {
  company.get.mockResolvedValue({ id: "c1" });
  await expect(companyOrLogin()).resolves.toEqual({ id: "c1" });
  expect(nav.redirect).not.toHaveBeenCalled();
});

it("does not hide other failures", async () => {
  company.get.mockRejectedValue(new Error("database down"));
  await expect(companyOrLogin()).rejects.toThrow("database down");
  expect(nav.redirect).not.toHaveBeenCalled();
});
