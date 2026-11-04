import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => request.values.has(key) ? { value: request.values.get(key) } : undefined, set: () => undefined }), headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
import { prisma } from '@/lib/db/prisma';
import { addElementWorkAction, removeElementWorkAction } from '@/app/(workzone)/workzone/element-actions';
import { seedSecurityTenants, removeSecurityTenants, createTestSession } from '../../../tests/security/fixtures';
import { productionAudience } from './steel-access';
import { steelDashboardData } from './steel-data';
import { dayKey } from './steel-metrics';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
async function as(kind: 'admin' | 'worker' | 'display', id: string) { request.values.clear(); request.values.set(`bk_${kind}_id`, await createTestSession(kind, id)); }
beforeEach(async () => {
    vi.stubEnv('SESSION_SIGNING_SECRET', 'synthetic-steel-dashboard-signing-key-only');
    vi.stubEnv('APP_ENV', 'saas');
    vi.stubEnv('SAAS_MODE', 'true');
    tenants = await seedSecurityTenants();
    for (const t of tenants) {
        await prisma.companyProfile.update({ where: { id: t.company.id }, data: { mode: 'bau', country: 'AL' } });
        await prisma.baustelle.update({ where: { id: t.site.id }, data: { type: 'STEEL_ASSEMBLY' } });
    }
    await as('admin', tenants[0].admin.id);
});
afterEach(async () => { request.values.clear(); await removeSecurityTenants(tenants.map(t => t.company.id)); vi.unstubAllEnvs(); });
async function add(list = 'assembly', mark = 'B/01') { return prisma.siteElement.create({ data: { companyProfileId: tenants[0].company.id, baustelleId: tenants[0].site.id, list, mark, quantity: 4, weightKg: 125 } }); }
async function read(display = false, params = {}) {
    const actor = await productionAudience(display);
    if (!actor)
        throw new Error('DENIED');
    return steelDashboardData(actor.company, params, display);
}
it('captures weight through the real action, resists reimport drift and excludes a cancelled confirmation', async () => {
    const e = await add();
    const saved = await addElementWorkAction({ elementId: e.id, stage: 'assembly', workerIds: [tenants[0].worker.id], pieces: 2 });
    expect(saved.ok).toBe(true);
    const entry = await prisma.siteElementWork.findUniqueOrThrow({ where: { id: saved.workId! } });
    expect(entry.productionSnapshot).toEqual({ v: 1, list: 'assembly', mark: 'B/01', quantity: 4, unitWeightKg: 125 });
    await prisma.siteElement.update({ where: { id: e.id }, data: { weightKg: 999 } });
    const d = await read();
    expect(d.totals.assembled.kg).toBe(250);
    expect(d.evidence[0]).toMatchObject({ kg: 250, legacy: false, pieces: 2 });
    expect((await removeElementWorkAction({ workId: entry.id })).ok).toBe(true);
    expect((await read()).totals.assembled.kg).toBe(0);
});
it('serializes simultaneous checks so two engineers cannot duplicate the remaining production kg', async () => {
    const e = await add();
    const results = await Promise.all([1, 2].map(() => addElementWorkAction({ elementId: e.id, stage: 'assembly', workerIds: [tenants[0].worker.id], pieces: 3 })));
    expect(results.every(r => r.ok)).toBe(true);
    expect(results.map(r => r.pieces).sort()).toEqual([1, 3]);
    expect((await read()).totals.assembled).toMatchObject({ pieces: 4, kg: 500 });
});
it('scopes totals, project filters and paginated evidence to one company and the local day', async () => {
    const e = await add('part');
    const other = await prisma.siteElement.create({ data: { companyProfileId: tenants[1].company.id, baustelleId: tenants[1].site.id, list: 'assembly', mark: 'FOREIGN', quantity: 1, weightKg: 9876 } });
    await prisma.siteElementWork.createMany({ data: [
            { companyProfileId: tenants[0].company.id, elementId: e.id, stage: 'cutting', pieces: 1, workerIds: [], checkedByName: 'Synthetic checker', checkedAt: new Date('2026-10-31T23:30Z') },
            { companyProfileId: tenants[1].company.id, elementId: other.id, stage: 'assembly', pieces: 1, workerIds: [], checkedByName: 'FOREIGN', checkedAt: new Date('2026-10-31T23:30Z') },
        ] });
    const d = await read(false, { month: '2026-11', day: '2026-11-01' });
    expect(d.totals.cutParts.kg).toBe(125);
    expect(d.totals.assembled.kg).toBe(0);
    expect(d.dayChecks).toBe(1);
    expect(JSON.stringify(d)).not.toContain('FOREIGN');
    const assembly = await add('assembly', 'WELD-ONLY');
    await prisma.siteElementWork.create({ data: { companyProfileId: tenants[0].company.id, elementId: assembly.id, stage: 'welding', pieces: 1, workerIds: [], checkedByName: 'Synthetic checker', checkedAt: new Date('2026-11-02T12:00Z') } });
    const weldDay = await read(false, { month: '2026-11', day: '2026-11-02' });
    expect(weldDay.dayChecks).toBe(1);
    expect(weldDay.dayProjects[0]).toMatchObject({ checks: 1, operations: [{ stage: 'welding', metric: { kg: 125, pieces: 1 } }] });
    await expect(read(false, { project: tenants[1].site.id })).rejects.toThrow('PRODUCTION_PROJECT_NOT_FOUND');
});
it('keeps the display payload free of personal evidence and never grants it admin access', async () => {
    const e = await add();
    await addElementWorkAction({ elementId: e.id, stage: 'assembly', workerIds: [tenants[0].worker.id], pieces: 1 });
    await prisma.siteElementWork.updateMany({ where: { elementId: e.id }, data: { workerNames: 'PRIVATE_OPERATOR', checkedByName: 'PRIVATE_REVIEWER' } });
    const screen = await prisma.user.create({ data: { email: `screen-${e.id}@example.test`, role: 'STAFF', companyProfileId: tenants[0].company.id, passwordHash: tenants[0].admin.passwordHash } });
    await as('display', screen.id);
    expect(await productionAudience()).toBeNull();
    const d = await read(true);
    expect(d.totals.assembled.kg).toBe(125);
    expect(d.evidence).toEqual([]);
    expect(JSON.stringify(d)).not.toContain('PRIVATE_');
    await prisma.user.update({ where: { id: screen.id }, data: { sessionEpoch: { increment: 1 } } });
    expect(await productionAudience(true)).toBeNull();
});
it('pages day evidence by confirmation time without hiding totals or accepting a foreign cursor', async () => {
    const e = await add();
    await prisma.siteElementWork.createMany({ data: Array.from({ length: 52 }, (_, i) => ({
            companyProfileId: tenants[0].company.id, elementId: e.id, stage: 'cutting', pieces: 1, workerIds: [], checkedByName: 'Synthetic pagination', checkedAt: new Date(Date.parse('2026-10-22T12:00Z') - i * 1000),
        })) });
    const params = { month: '2026-10', day: '2026-10-22' };
    const first = await read(false, params), second = await read(false, { ...params, cursor: first.nextCursor! });
    expect(first.evidence).toHaveLength(50);
    expect(second.evidence).toHaveLength(2);
    expect(new Set([...first.evidence, ...second.evidence].map(row => row.id)).size).toBe(52);
    expect(first.dayChecks).toBe(52);
    expect(second.totals.cutAssemblies.kg).toBe(first.totals.cutAssemblies.kg);
    expect(first.evidence.map(row => row.checkedAt)).toEqual([...first.evidence.map(row => row.checkedAt)].sort().reverse());
    await expect(read(false, { ...params, cursor: 'foreign-cursor' })).rejects.toThrow('PRODUCTION_PROJECT_NOT_FOUND');
});
it('denies anonymous, worker and mixed signed sessions instead of taking a company from the URL', async () => {
    request.values.clear();
    expect(await productionAudience(true)).toBeNull();
    await as('worker', tenants[0].worker.id);
    expect(await productionAudience(true)).toBeNull();
    request.values.set('bk_admin_id', await createTestSession('admin', tenants[1].admin.id));
    expect(await productionAudience()).toBeNull();
    expect(dayKey(new Date('2026-10-31T23:30Z'), 'Europe/Tirane')).toBe('2026-11-01');
});
