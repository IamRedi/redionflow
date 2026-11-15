import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => request.values.has(key) ? { value: request.values.get(key) } : undefined }), headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
import { prisma } from '@/lib/db/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { withTenantContext } from '@/lib/db/tenant-context';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { createTestSession, removeSecurityTenants, seedSecurityTenants } from '../../../tests/security/fixtures';
import { applyCompanySetup } from './create-company';
import { planCompanySetup } from './onboarding';
import { resolveBlueprint } from './blueprints';
import { currentCompanyActor } from '@/lib/site-files/actor';
import { createProductionBatchAction } from '@/app/(workzone)/workzone/factory-actions';
import { getSteelWorkCatalogAction, saveSteelWorkDefinitionAction } from '@/app/(workzone)/workzone/steel-catalog-actions';
import { addElementWorkAction, setElementProcessesAction } from '@/app/(workzone)/workzone/element-actions';
import { importElementList } from '@/lib/elements/import';
import { onFieldList } from '@/lib/elements/stages';
import { steelDashboardData } from '@/lib/dashboard/steel-data';
import { isSteelCompany, isSteelProductionCompany, productionAudience } from '@/lib/dashboard/steel-access';

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const created: string[] = [];
const password = 'synthetic-setup-password-only';
const input = () => { const key = `test-${randomUUID()}`; created.push(`company-${key}`); return { key, blueprint: { id: 'steel-assembly', version: 1 }, company: {
  displayName: key, legalName: key, mode: 'bau', country: 'DE', plan: 'starter', owner: { name: 'Synthetic Owner', email: `${key}@example.test` },
  sites: [{ name: 'Synthetic assembly site', type: 'STEEL_ASSEMBLY' }],
} }; };
beforeEach(async () => {
  assertAssistantTestDatabase();
  vi.stubEnv('SESSION_SIGNING_SECRET', 'synthetic-blueprint-tests-signing-key-only'); request.values.clear();
  tenants = await seedSecurityTenants();
  await prisma.plan.upsert({ where: { tier: 'starter' }, create: { tier: 'starter', displayName: 'Synthetic Starter' }, update: {} });
});
afterEach(async () => {
  await removeSecurityTenants([...created.splice(0), ...tenants.map(t => t.company.id)]); vi.unstubAllEnvs();
});
async function withoutFactory() {
  const a = tenants[0];
  await prisma.companyProfile.update({ where: { id: a.company.id }, data: { mode: 'bau', setupProfile: resolveBlueprint({ id: 'steel-assembly', version: 1 }), setupDigest: 'a'.repeat(64) } });
  await prisma.baustelle.update({ where: { id: a.site.id }, data: { type: 'STEEL_ASSEMBLY' } });
  request.values.set('bk_admin_id', await createTestSession('admin', a.admin.id));
  return a;
}
it('creates only the reviewed tenant with its own owner and zero copied client records', async () => {
  const raw = input(), plan = planCompanySetup(raw), before = await prisma.companyProfile.findUnique({ where: { id: tenants[0].company.id } });
  const result = await applyCompanySetup(prisma, raw, plan.digest, hashPassword(password));
  expect(result.created).toBe(true);
  const company = await prisma.companyProfile.findUniqueOrThrow({ where: { id: result.companyId }, include: { users: true, subscription: true, baustellen: true, workers: true, machines: true } });
  expect(company.setupProfile).toEqual(plan.profile); expect(company.setupDigest).toBe(plan.digest);
  expect(company.users).toHaveLength(1); expect(verifyPassword(password, company.users[0].passwordHash!)).toBe(true);
  expect(company.subscription?.status).toBe('trialing'); expect(company.trialEndsAt).not.toBeNull();
  expect(company.baustellen.map(s => s.type)).toEqual(['STEEL_ASSEMBLY']);
  expect(company.workers).toEqual([]); expect(company.machines).toEqual([]);
  expect(await prisma.companyInventoryItem.count({ where: { companyProfileId: result.companyId } })).toBe(0);
  expect(await prisma.companyProfile.findUnique({ where: { id: tenants[0].company.id } })).toEqual(before);
});
it('saves a reviewed company visual profile without changing another firm or enabling manufacturing', async () => {
  const base=input(),raw={...base,company:{...base.company,uiIdentity:'crane-red-blue-v1'}},plan=planCompanySetup(raw);
  const before=await prisma.companyProfile.findUnique({where:{id:tenants[0].company.id}});
  const result=await applyCompanySetup(prisma,raw,plan.digest,hashPassword(password));
  const company=await prisma.companyProfile.findUniqueOrThrow({where:{id:result.companyId}});
  expect(company.uiIdentity).toBe('crane-red-blue-v1');
  expect(company.setupProfile).toMatchObject({id:'steel-assembly',factory:false});
  expect(await prisma.companyProfile.findUnique({where:{id:tenants[0].company.id}})).toEqual(before);
  await expect(prisma.companyProfile.update({where:{id:result.companyId},data:{uiIdentity:'unreviewed-css'}})).rejects.toThrow();
});
it('serializes retries and concurrent calls without duplicate tenants, audits or password resets', async () => {
  const raw = input(), { digest } = planCompanySetup(raw), hashed = hashPassword(password);
  const results = await Promise.all([applyCompanySetup(prisma, raw, digest, hashed), applyCompanySetup(prisma, raw, digest, hashed)]);
  expect(results.filter(r => r.created)).toHaveLength(1);
  const retried = await applyCompanySetup(prisma, raw, digest, hashPassword('different-synthetic-password'));
  expect(retried.created).toBe(false);
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: raw.company.owner.email } });
  expect(owner.passwordHash).toBe(hashed);
  expect(await prisma.auditLog.count({ where: { companyProfileId: retried.companyId, action: 'company.provisioned' } })).toBe(1);
});
it('rejects changed review data, occupied setup keys and existing owners with no partial tenant', async () => {
  const raw = input(), plan = planCompanySetup(raw), hashed = hashPassword(password);
  await expect(applyCompanySetup(prisma, raw, '0'.repeat(64), hashed)).rejects.toThrow('SETUP_REVIEW_CHANGED');
  expect(await prisma.companyProfile.findUnique({ where: { id: `company-${raw.key}` } })).toBeNull();
  await applyCompanySetup(prisma, raw, plan.digest, hashed);
  const changed = { ...raw, company: { ...raw.company, displayName: 'Changed synthetic name' } };
  await expect(applyCompanySetup(prisma, changed, planCompanySetup(changed).digest, hashed)).rejects.toThrow('SETUP_KEY_CONFLICT');
  const duplicate = input(); duplicate.company.owner.email = tenants[0].admin.email;
  await expect(applyCompanySetup(prisma, duplicate, planCompanySetup(duplicate).digest, hashed)).rejects.toThrow('OWNER_ALREADY_EXISTS');
  expect(await prisma.companyProfile.findUnique({ where: { id: `company-${duplicate.key}` } })).toBeNull();
});
it('does not duplicate a legal company when two operators use different keys concurrently', async () => {
  const a = input(), b = input(); b.company.legalName = a.company.legalName.toUpperCase();
  const hashed = hashPassword(password);
  const results = await Promise.allSettled([a, b].map(raw => applyCompanySetup(prisma, raw, planCompanySetup(raw).digest, hashed)));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(await prisma.companyProfile.count({ where: { id: { in: [`company-${a.key}`, `company-${b.key}`] } } })).toBe(1);
});
it('denies factory commands to an owner while preserving another legacy company', async () => {
  const a = await withoutFactory();
  const actor = await currentCompanyActor(a.company.id);
  expect(await isSteelCompany(a.company.id)).toBe(true);
  expect(await isSteelProductionCompany(a.company.id)).toBe(false);
  expect((await productionAudience(true))?.company.id).toBe(a.company.id);
  expect(actor?.isAdmin).toBe(true); expect(actor?.allows('factory.steps', a.site.id)).toBe(false);
  await expect(steelDashboardData({ id: a.company.id, displayName: 'Synthetic', country: 'DE' }, {}, false)).rejects.toThrow('FACTORY_MODULE_DISABLED');
  expect((await createProductionBatchAction({ baustelleId: a.site.id, title: 'Synthetic', unit: 't' })).ok).toBe(false);
  expect((await saveSteelWorkDefinitionAction({ kind: 'factory', label: 'Forbidden synthetic process' })).ok).toBe(false);
  expect((await saveSteelWorkDefinitionAction({ kind: 'site', phaseGroup: 'production', label: 'Prerje' })).ok).toBe(false);
  expect(await prisma.productionBatch.count({ where: { companyProfileId: a.company.id } })).toBe(0);
  const catalog = await getSteelWorkCatalogAction({}); expect(catalog.ok).toBe(true);
  expect(catalog.definitions?.some(d => d.kind === 'factory')).toBe(false);
  request.values.set('bk_admin_id', await createTestSession('admin', tenants[1].admin.id));
  expect((await currentCompanyActor(tenants[1].company.id))?.allows('factory.steps')).toBe(true);
  expect(await currentCompanyActor(a.company.id)).toBeNull();
});
it('rolls back company, owner and sites if the final audit write fails', async () => {
  const raw = input(), plan = planCompanySetup(raw);
  const db = { $transaction: (callback: (tx: unknown) => Promise<unknown>) => prisma.$transaction(tx => callback(new Proxy(tx, {
    get(target, name) { return name === 'auditLog' ? { create: async () => { throw new Error('SYNTHETIC_AUDIT_UNAVAILABLE'); } } : Reflect.get(target, name); },
  }))) } as unknown as Parameters<typeof applyCompanySetup>[0];
  await expect(applyCompanySetup(db, raw, plan.digest, hashPassword(password))).rejects.toThrow('SYNTHETIC_AUDIT_UNAVAILABLE');
  expect(await prisma.companyProfile.findUnique({ where: { id: `company-${raw.key}` } })).toBeNull();
  expect(await prisma.user.findUnique({ where: { email: raw.company.owner.email } })).toBeNull();
  expect(await prisma.baustelle.count({ where: { companyProfileId: `company-${raw.key}` } })).toBe(0);
});
it('rejects incomplete snapshots in SQL and malformed profiles during permission loading', async () => {
  const a = tenants[0];
  await expect(prisma.$executeRaw`UPDATE "CompanyProfile" SET "setupProfile"='{}'::jsonb WHERE "id"=${a.company.id}`).rejects.toThrow();
  await prisma.companyProfile.update({ where: { id: a.company.id }, data: { setupProfile: { schema: 999 }, setupDigest: 'a'.repeat(64) } });
  request.values.set('bk_admin_id', await createTestSession('admin', a.admin.id));
  await expect(currentCompanyActor(a.company.id)).rejects.toThrow();
});
it('keeps externally supplied material usable in the field and prevents restoring factory routes', async () => {
  const a = await withoutFactory();
  const imported = await withTenantContext(a.company.id, tx => importElementList(tx, { companyId: a.company.id, baustelleId: a.site.id, fileName: 'synthetic.xls', parsed: {
    list: 'assembly', projectNumber: 'SYNTHETIC', projectName: 'Synthetic', totalPieces: 2, totalKg: 20,
    elements: [{ mark: 'B/1', kind: 'BEAM', profile: 'HEA100', material: 'S235', quantity: 2, weightKg: 10, lengthMm: 1000, areaM2: 1 }],
  } }));
  const elementId = imported.addedIds[0];
  const element = await prisma.siteElement.findUniqueOrThrow({ where: { id: elementId }, include: { work: true } });
  expect(onFieldList(element as typeof element & { list: 'assembly' })).toBe(true); expect(element.factoryDoneAt).toBeNull(); expect(element.work).toEqual([]);
  expect((await addElementWorkAction({ elementId, stage: 'received', pieces: 1, workerIds: [a.worker.id] })).ok).toBe(true);
  expect((await addElementWorkAction({ elementId, stage: 'cutting', pieces: 1, workerIds: [a.worker.id] })).ok).toBe(false);
  expect((await setElementProcessesAction({ siteId: a.site.id, elementIds: [elementId], side: 'factory', stages: ['cutting'] })).ok).toBe(false);
  expect(await prisma.siteElementWork.count({ where: { elementId, stage: 'received' } })).toBe(1);
  expect(await prisma.productionEvent.count({ where: { companyProfileId: a.company.id } })).toBe(0);
});
