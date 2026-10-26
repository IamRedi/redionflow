import { afterEach, beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => {
  const value = request.values.get(name); return value === undefined ? undefined : { value };
} }), headers: async () => new Headers({ "accept-language": "en" }) }));
const storage = vi.hoisted(() => ({ remove: vi.fn(async () => undefined) }));
vi.mock("@/lib/storage/object-storage", () => ({ deleteManagedFileByUrl: storage.remove, deleteManagedFiles: vi.fn(async () => undefined), clearManagedEntityFolder: vi.fn(async () => undefined), uploadManagedFile: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));
import { seedSecurityTenants, removeSecurityTenants } from "../../../tests/security/fixtures";
import { createTestSession as createSessionCookie } from "../../../tests/security/fixtures";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { saveSettingsAction } from "@/app/(admin)/app/settings/actions";
import { createBaustelleAction, deleteBaustelleAction } from "@/app/(admin)/app/baustellen/actions";
import { editTreeItemAction, startWorkingAction, uploadBaustelleDocumentAction, deleteBaustelleDocumentAction } from "@/app/(workzone)/workzone/actions";
import { createProjectAction, updateProjectAction } from "@/app/(admin)/app/projects/actions";
import { updateAdminInventoryItemAction } from "@/app/(workzone)/workzone/inventory-actions";
import { addMachineNoteAction } from "@/app/(workzone)/workzone/machine-actions";
import { moveDailyPlanItemAction, removeDailyPlanItemAction, updateDailyPlanColumnNoteAction } from "@/app/(workzone)/workzone/daily-plan-actions";
import { GET as exportTenant } from "@/app/api/portability/export/route";

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async () => {
  vi.stubEnv("SESSION_SIGNING_SECRET", "synthetic-security-test-signing-key-only-20261001");
  tenants = await seedSecurityTenants(); request.values.clear();
});
afterEach(async () => { await removeSecurityTenants(tenants.map(t => t.company.id)); vi.unstubAllEnvs(); });
function form(data: Record<string, string | File>) { const f = new FormData(); for (const [k,v] of Object.entries(data)) f.set(k,v); return f; }
async function asAdmin(index: number) { request.values.clear(); request.values.set("bk_admin_id", await createSessionCookie("admin", tenants[index].admin.id)); }
const settings = (companyId: string) => ({ companyId, displayName: "Forged", legalName: "Forged", bgkPct: 1, agkPct: 1, riskPct: 1, profitPct: 1, vatPct: 19, bgkBase: "EK_TOTAL", riskProfitMode: "SEPARATE", applyVatByDefault: false, fleetGpsEnabled: false, workerPhoneGpsEnabled: false });

for (const [actor, foreign] of [[0,1],[1,0]]) {
  it(`tenant ${actor} denies forged company settings and create under ${foreign}`, async () => {
    await asAdmin(actor); const b = tenants[foreign];
    expect((await saveSettingsAction(settings(b.company.id))).ok).toBe(false);
    expect((await createProjectAction({ companyId: b.company.id, title: "Forged", customerName: "Forged" })).ok).toBe(false);
    expect((await createBaustelleAction({ companyId: b.company.id, name: "Forged", type: "OTHER", status: "active" })).ok).toBe(false);
    expect((await prisma.companyProfile.findUniqueOrThrow({ where: { id: b.company.id } })).displayName).toBe(b.marker);
    expect(await prisma.project.count({ where: { companyProfileId: b.company.id } })).toBe(1);
    expect(await prisma.baustelle.count({ where: { companyProfileId: b.company.id } })).toBe(1);
  });
  it(`tenant ${actor} denies foreign tree update and site delete ${foreign}`, async () => {
    await asAdmin(actor); const a = tenants[actor]; const b = tenants[foreign];
    expect((await editTreeItemAction({ treeItemId: b.tree.id, workerId: a.admin.id, species: "Forged", diameter: 2 })).ok).toBe(false);
    await deleteBaustelleAction(form({ baustelleId: b.site.id }));
    expect(await prisma.baustelle.findUnique({ where: { id: b.site.id } })).not.toBeNull();
    expect((await prisma.treeItem.findUniqueOrThrow({ where: { id: b.tree.id } })).species).toBe(b.marker);
  });
  it(`tenant ${actor} denies foreign worker/site work session references ${foreign}`, async () => {
    await asAdmin(actor); const a = tenants[actor]; const b = tenants[foreign];
    for (const [workerId, baustelleId] of [[a.worker.id,b.site.id],[b.worker.id,a.site.id]]) {
      expect((await startWorkingAction({ workerId, baustelleId })).ok).toBe(false);
    }
    expect(await prisma.workSession.count({ where: { workerId: { in: tenants.map(t => t.worker.id) } } })).toBe(0);
  });
  it(`tenant ${actor} denies foreign file attachment ${foreign} before storage side effects`, async () => {
    await asAdmin(actor); const b = tenants[foreign];
    const file = new File(["%PDF-1.4\nsynthetic\n%%EOF"], "synthetic.pdf", { type: "application/pdf" });
    expect((await uploadBaustelleDocumentAction(form({ baustelleId: b.site.id, file }))).ok).toBe(false);
    expect((await prisma.baustelle.findUniqueOrThrow({ where: { id: b.site.id } })).documents).toEqual([]);
  });
  it(`tenant ${actor} denies foreign inventory and machine writes ${foreign}`, async () => {
    await asAdmin(actor); const b = tenants[foreign];
    expect((await updateAdminInventoryItemAction(form({ id: b.item.id, itemCode: b.marker, name: "Forged" }))).ok).toBe(false);
    expect((await addMachineNoteAction(form({ machineId: b.machine.id, note: "Forged" }))).ok).toBe(false);
    expect((await prisma.companyInventoryItem.findUniqueOrThrow({ where: { id: b.item.id } })).name).toBe(b.marker);
    expect((await prisma.machine.findUniqueOrThrow({ where: { id: b.machine.id } })).notes).toBeNull();
  });
  it(`tenant ${actor} denies foreign project metadata writes ${foreign}`, async () => {
    await asAdmin(actor); const b=tenants[foreign];
    expect((await updateProjectAction({ projectId:b.project.id,title:"Forged",customerName:"Forged",status:"DRAFT" })).ok).toBe(false);
    expect((await prisma.project.findUniqueOrThrow({where:{id:b.project.id}})).title).toBe(b.marker);
  });
  it(`tenant ${actor} export contains own synthetic data and excludes tenant ${foreign}`, async () => {
    await asAdmin(actor); const response = await exportTenant(); expect(response.status).toBe(200);
    const body = await response.text(); expect(body).toContain(tenants[actor].marker); expect(body).not.toContain(tenants[foreign].marker);
  });
  it(`tenant ${actor} cannot remove tenant ${foreign} plan assignment`, async () => {
    await asAdmin(actor); const b=tenants[foreign];
    expect((await removeDailyPlanItemAction({date:"2026-10-01",assignmentId:b.assignment.id})).ok).toBe(false);
    expect(await prisma.dailyWorkPlanAssignment.findUnique({where:{id:b.assignment.id}})).not.toBeNull();
  });
  it(`tenant ${actor} cannot attach a foreign site or worker to its plan ${foreign}`, async () => {
    await asAdmin(actor); const a=tenants[actor], b=tenants[foreign];
    for (const [columnId,itemId] of [[b.site.id,a.worker.id],[a.site.id,b.worker.id]]) {
      expect((await moveDailyPlanItemAction({date:"2026-10-01",columnId,kind:"WORKER",itemId})).ok).toBe(false);
    }
    expect(await prisma.dailyWorkPlanColumn.count({where:{planId:a.plan.id}})).toBe(1);
    expect(await prisma.dailyWorkPlanAssignment.count({where:{column:{planId:a.plan.id}}})).toBe(1);
  });
  it(`tenant ${actor} cannot attach a foreign machine or note to its plan ${foreign}`, async () => {
    await asAdmin(actor); const a=tenants[actor], b=tenants[foreign];
    expect((await moveDailyPlanItemAction({date:"2026-10-01",columnId:a.site.id,kind:"MACHINE",itemId:b.machine.id})).ok).toBe(false);
    expect((await updateDailyPlanColumnNoteAction({date:"2026-10-01",columnId:b.site.id,note:"Forged"})).ok).toBe(false);
    expect(await prisma.dailyWorkPlanColumn.count({where:{planId:a.plan.id}})).toBe(1);
  });
}
it("worker cannot mutate admin settings or create projects", async () => {
  const a=tenants[0]; request.values.set("bk_worker_id",await createSessionCookie("worker",a.worker.id));
  expect((await saveSettingsAction(settings(a.company.id))).ok).toBe(false);
  expect((await createProjectAction({companyId:a.company.id,title:"Forged",customerName:"Forged"})).ok).toBe(false);
  expect((await prisma.companyProfile.findUniqueOrThrow({where:{id:a.company.id}})).displayName).toBe(a.marker);
});
it("worker and unauthenticated actors cannot export admin data", async () => {
  expect((await exportTenant()).status).toBe(401);
  request.values.set("bk_worker_id",await createSessionCookie("worker",tenants[0].worker.id));
  expect((await exportTenant()).status).toBe(401);
});
it("mixed admin A and worker B cookies cannot select tenant B for admin mutations", async () => {
  await asAdmin(0); request.values.set("bk_worker_id",await createSessionCookie("worker",tenants[1].worker.id));
  expect(await getCurrentCompanyId()).toBeNull();
});
it("own settings and plan assignment remain usable", async () => {
  await asAdmin(0); const a=tenants[0];
  expect((await saveSettingsAction({...settings(a.company.id),displayName:a.marker})).ok).toBe(true);
  expect((await moveDailyPlanItemAction({date:"2026-10-01",columnId:a.site.id,kind:"WORKER",itemId:a.worker.id})).ok).toBe(true);
});

it("cannot delete an unattached foreign document using an owned site", async () => {
  await asAdmin(0); storage.remove.mockClear();
  const foreignUrl = "/uploads/baustellen/" + tenants[1].site.id + "/synthetic.pdf";
  await prisma.baustelle.update({ where: { id: tenants[1].site.id }, data: { documents: [foreignUrl] } });
  expect((await deleteBaustelleDocumentAction(form({ baustelleId: tenants[0].site.id, documentRef: foreignUrl }))).ok).toBe(false);
  expect(storage.remove).not.toHaveBeenCalled();
  expect((await prisma.baustelle.findUniqueOrThrow({where:{id:tenants[1].site.id}})).documents).toEqual([foreignUrl]);
});

it("tenant request cannot auto-close foreign sessions; unauthenticated request does nothing", async () => {
  const { autoCloseForgottenDaySessions } = await import("@/lib/workzone/session-rules");
  const rows = await Promise.all(tenants.map(t => prisma.workSession.create({data:{workerId:t.worker.id,baustelleId:t.site.id,startTime:new Date("2026-09-28T07:00:00"),isLive:true}})));
  request.values.clear(); expect(await autoCloseForgottenDaySessions(new Date("2026-10-01T14:00:00"))).toBe(0);
  await asAdmin(0); expect(await autoCloseForgottenDaySessions(new Date("2026-10-01T14:00:00"))).toBe(1);
  expect((await prisma.workSession.findUniqueOrThrow({where:{id:rows[1].id}})).isLive).toBe(true);
});

it("unauthenticated SaaS callers cannot subscribe to tenant realtime", async () => {
  request.values.clear();
  const { GET } = await import("@/app/api/realtime/updates/route");
  const response = await GET();
  const status = response.status;
  if (status === 200) await response.body?.cancel();
  expect(status).toBe(401);
});

it("resolved company, audit rows and dashboard include only own tenant", async () => {
  const { recordAudit, listAuditEntries } = await import("@/lib/audit/log");
  const { getOrCreateDefaultCompany } = await import("@/lib/db/company");
  const { getDashboardSnapshotForWeek } = await import("@/lib/dashboard/dashboard-snapshot");
  for (const t of tenants) await recordAudit({companyProfileId:t.company.id,actorType:"ADMIN",action:"synthetic.security.probe",payload:{marker:t.marker}});
  for (const index of [0,1]) {
    await asAdmin(index); const company = await getOrCreateDefaultCompany();
    expect(company.id).toBe(tenants[index].company.id);
    const entries = await listAuditEntries(company.id);
    expect(entries).toHaveLength(1); expect(JSON.stringify(entries)).toContain(tenants[index].marker);
    const snapshot = JSON.stringify(await getDashboardSnapshotForWeek(company.id, 0, "en"));
    expect(snapshot).toContain(tenants[index].marker);
    expect(snapshot).not.toContain(tenants[1-index].marker);
  }
});

// Phase 2 demonstrated this role gap; Phase 3 must now deny it.
it("worker cannot create/delete own-tenant sites through admin actions", async () => {
  request.values.clear(); request.values.set("bk_worker_id", await createSessionCookie("worker",tenants[0].worker.id));
  expect((await createBaustelleAction({companyId:tenants[0].company.id,name:"Synthetic worker site",type:"OTHER",status:"active"})).ok).toBe(false);
  await deleteBaustelleAction(form({baustelleId:tenants[0].site.id}));
  expect(await prisma.baustelle.findUnique({where:{id:tenants[0].site.id}})).not.toBeNull();
});

it("worker cannot change/delete another worker or edit calculation positions", async () => {
  const { updateWorkerAction, deleteWorkerAction } = await import("@/app/(admin)/app/admin/worker-admin-actions");
  const { updatePositionMeta } = await import("@/app/(admin)/app/projects/[projectId]/positions/[positionId]/actions");
  const position = await prisma.projectPosition.create({data:{projectId:tenants[0].project.id,title:"Synthetic original",unit:"unit",quantity:1,sortOrder:0}});
  request.values.set("bk_worker_id",await createSessionCookie("worker",tenants[0].worker.id));
  await updateWorkerAction(form({id:tenants[0].worker.id,firstName:"Forged",lastName:"Forged",loginCode:"654321"}));
  expect((await prisma.worker.findUniqueOrThrow({where:{id:tenants[0].worker.id}})).firstName).toBe(tenants[0].marker);
  await updatePositionMeta(form({positionId:position.id,projectId:tenants[0].project.id,title:"Forged",unit:"unit",quantity:"2",manualAdjustmentEur:"0"}));
  expect((await prisma.projectPosition.findUniqueOrThrow({where:{id:position.id}})).title).toBe("Synthetic original");
  await deleteWorkerAction(form({id:tenants[0].worker.id}));
  expect(await prisma.worker.findUnique({where:{id:tenants[0].worker.id}})).not.toBeNull();
});

it("owner admin cannot take over another tenant admin by email upsert", async () => {
  const { upsertTestAdminFormAction } = await import("@/app/(admin)/app/profile/actions");
  await prisma.user.update({where:{id:tenants[0].admin.id},data:{isOwner:true}});
  await asAdmin(0);
  await upsertTestAdminFormAction(form({name:"Forged",email:tenants[1].admin.email,code:"654321",isActive:"on"}));
  const foreign = await prisma.user.findUniqueOrThrow({where:{id:tenants[1].admin.id}});
  expect(foreign.companyProfileId).toBe(tenants[1].company.id);
  expect(foreign.passwordHash).toBe(tenants[1].admin.passwordHash);
});

it("worker credential rotation revokes old session and permits new login/session", async () => {
  const { hashPassword, verifyPassword } = await import("@/lib/auth/password");
  const { getCurrentWorker } = await import("@/lib/workzone/worker-session");
  const { updateWorkerAction } = await import("@/app/(admin)/app/admin/worker-admin-actions");
  const a=tenants[0]; await prisma.worker.update({where:{id:a.worker.id},data:{loginCodeHash:hashPassword("111111")}});
  const old=await createSessionCookie("worker",a.worker.id);
  request.values.set("bk_worker_id",old); expect((await getCurrentWorker())?.id).toBe(a.worker.id);
  await asAdmin(0); await updateWorkerAction(form({id:a.worker.id,firstName:a.worker.firstName,lastName:a.worker.lastName,loginCode:"654321"}));
  request.values.clear(); request.values.set("bk_worker_id",old); expect(await getCurrentWorker()).toBeNull();
  const fresh=await prisma.worker.findUniqueOrThrow({where:{id:a.worker.id}}); expect(verifyPassword("654321",fresh.loginCodeHash!)).toBe(true);
  request.values.set("bk_worker_id",await createSessionCookie("worker",a.worker.id)); expect((await getCurrentWorker())?.id).toBe(a.worker.id);
});
it("admin credential rotation revokes old session and permits new login/session", async () => {
  const { hashPassword } = await import("@/lib/auth/password");
  const { getCurrentAdmin } = await import("@/lib/auth/admin-session");
  const { upsertTestAdminFormAction } = await import("@/app/(admin)/app/profile/actions");
  const { authenticateAdminByCode } = await import("@/lib/auth/authenticate-admin");
  const a=tenants[0]; await prisma.user.update({where:{id:a.admin.id},data:{isOwner:true}});
  const target=await prisma.user.create({data:{companyProfileId:a.company.id,role:"ADMIN",email:`session-target-${a.company.id}@example.test`,passwordHash:hashPassword("111111")}});
  const old=await createSessionCookie("admin",target.id); request.values.set("bk_admin_id",old); expect((await getCurrentAdmin())?.id).toBe(target.id);
  await asAdmin(0); await upsertTestAdminFormAction(form({name:"Synthetic target",email:target.email,code:"654321",isActive:"on"}));
  request.values.set("bk_admin_id",old); expect(await getCurrentAdmin()).toBeNull();
  expect((await authenticateAdminByCode(prisma,target.email,"654321")).ok).toBe(true);
  request.values.set("bk_admin_id",await createSessionCookie("admin",target.id)); expect((await getCurrentAdmin())?.id).toBe(target.id);
});

it("owner admin cannot revoke an unassigned legacy admin outside tenant ownership",async()=>{
  const {removeManagedTestAdminAction}=await import("@/app/(admin)/app/profile/actions");
  const {getCurrentAdmin,isOwnerAdmin}=await import("@/lib/auth/admin-session");
  await prisma.user.update({where:{id:tenants[0].admin.id},data:{isOwner:true}});await asAdmin(0);
  const caller=await getCurrentAdmin();expect(caller?.id).toBe(tenants[0].admin.id);expect(isOwnerAdmin(caller)).toBe(true);
  const owned=await prisma.user.create({data:{companyProfileId:tenants[0].company.id,email:`owned-removal-${tenants[0].marker}@example.test`,role:"ADMIN",isActive:true}});
  expect((await removeManagedTestAdminAction(owned.id)).ok).toBe(true);
  expect((await prisma.user.findUniqueOrThrow({where:{id:owned.id}})).isActive).toBe(false);
  const unassigned=await prisma.user.create({data:{email:`unassigned-${tenants[0].marker}@example.test`,role:"ADMIN",isActive:true}});
  try {
    expect((await removeManagedTestAdminAction(unassigned.id)).ok).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({where:{id:unassigned.id}})).isActive).toBe(true);
  } finally {await prisma.user.delete({where:{id:unassigned.id}});}
});
