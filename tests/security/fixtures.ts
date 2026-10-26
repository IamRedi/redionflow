import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function seedSecurityTenants() {
  return Promise.all(["A", "B"].map(async (label) => {
    const marker = `security-${label}-${randomUUID()}`;
    const company = await prisma.companyProfile.create({ data: { displayName: marker, legalName: marker } });
    const admin = await prisma.user.create({ data: {
      email: `${marker.toLowerCase()}@example.test`, name: marker, companyProfileId: company.id,
      role: "ADMIN", passwordHash: hashPassword("synthetic-test-password-only"),
    } });
    const worker = await prisma.worker.create({ data: {
      firstName: marker, lastName: "Synthetic", companyProfileId: company.id,
      loginCodeHash: hashPassword("synthetic-worker-code-only"),
    } });
    const site = await prisma.baustelle.create({ data: { companyProfileId: company.id, name: marker, documents: [] } });
    const tree = await prisma.treeItem.create({ data: { baustelleId: site.id, treeId: marker, species: marker, diameter: 1 } });
    const machine = await prisma.machine.create({ data: { companyProfileId: company.id, name: marker, hourlyRateCents: 100 } });
    const item = await prisma.companyInventoryItem.create({ data: {
      companyProfileId: company.id, category: "WORK_TOOL", itemCode: marker, name: marker, barcode: marker,
    } });
    const project = await prisma.project.create({ data: { companyProfileId: company.id, title: marker, customerName: marker } });
    const plan = await prisma.dailyWorkPlan.create({ data: { companyProfileId: company.id, planDate: new Date("2026-10-01T00:00:00"), createdByAdminId: admin.id } });
    const column = await prisma.dailyWorkPlanColumn.create({ data: { planId: plan.id, baustelleId: site.id, title: marker } });
    const assignment = await prisma.dailyWorkPlanAssignment.create({ data: { columnId: column.id, kind: "WORKER", workerId: worker.id, labelSnapshot: marker } });
    return { marker, company, admin, worker, site, tree, machine, item, project, plan, column, assignment };
  }));
}
export async function removeSecurityTenants(ids: string[]) {
  await prisma.user.deleteMany({ where: { companyProfileId: { in: ids } } });
  await prisma.companyProfile.deleteMany({ where: { id: { in: ids } } });
}

/** Test-only authority: mint a synthetic session from the fixture's current DB epoch. */
export async function createTestSession(kind: import("@/lib/auth/session-cookie").SessionKind, id: string) {
  const { createSessionCookie } = await import("@/lib/auth/session-cookie");
  const row = kind === "worker"
    ? await prisma.worker.findUniqueOrThrow({ where: { id }, select: { sessionEpoch: true } })
    : await prisma.user.findUniqueOrThrow({ where: { id }, select: { sessionEpoch: true } });
  return createSessionCookie(kind, id, row.sessionEpoch);
}
