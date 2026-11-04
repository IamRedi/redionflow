import { prisma } from '../../src/lib/db/prisma';
import { hashPassword } from '../../src/lib/auth/password';
/** Fictional production only. Called by the guarded disposable E2E runner. */
export async function seedSteelProduction(companyId: string, month: string) {
    await prisma.companyProfile.update({ where: { id: companyId }, data: { displayName: 'Mira Steel · DEMO', mode: 'bau', country: 'AL' } });
    await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Punishtja demonstrative', type: 'STEEL_WORKSHOP' } });
    const sites = [];
    for (const [index, name] of ['Aurora · Hangar demo', 'Vega · Strukturë demo'].entries()) {
        const site = await prisma.baustelle.create({ data: { companyProfileId: companyId, name, type: 'STEEL_ASSEMBLY' } });
        sites.push(site);
        for (let i = 0; i < 8; i++) {
            const e = await prisma.siteElement.create({ data: { companyProfileId: companyId, baustelleId: site.id, list: 'assembly', mark: `B/${10 + i}`, quantity: 8, weightKg: 140 + i * 24 + index * 41, factoryDoneAt: i < 3 + index ? new Date(`${month}-24T14:00Z`) : null } });
            const stages = ['cutting', 'assembly', 'welding', 'cleaning', 'coating', 'loading', 'received', 'mounted', 'bolted', 'touchup'];
            await prisma.siteElementWork.createMany({ data: stages.flatMap((stage, s) => {
                    if (i >= 3 + index && s >= 2 + i % 4)
                        return [];
                    return [
                        { companyProfileId: companyId, elementId: e.id, stage, pieces: 2, workerIds: [], workerNames: 'Operator Demo A', checkedByName: 'Inxhinier Demo', checkedAt: new Date(`${month}-${String(s < 6 ? 3 + s * 2 + i % 3 : 25 + (s - 6)).padStart(2, '0')}T09:15:00Z`), productionSnapshot: { v: 1, list: 'assembly', mark: e.mark, quantity: 8, unitWeightKg: e.weightKg } },
                        ...(s < 6 || i < 1 + index ? [{ companyProfileId: companyId, elementId: e.id, stage, pieces: 6, workerIds: [], workerNames: 'Operator Demo B', checkedByName: 'Inxhinier Demo', checkedAt: new Date(`${month}-${String(s < 6 ? 10 + s * 2 + i % 3 : 26 + (s - 6)).padStart(2, '0')}T13:45:00Z`), productionSnapshot: { v: 1, list: 'assembly', mark: e.mark, quantity: 8, unitWeightKg: e.weightKg } }] : []),
                    ];
                }) });
        }
        for (let i = 0; i < 12; i++) {
            const e = await prisma.siteElement.create({ data: { companyProfileId: companyId, baustelleId: site.id, list: 'part', mark: `P/${100 + i}`, quantity: 24, weightKg: 10 + i * 3 + index * 4 } });
            await prisma.siteElementWork.createMany({ data: [2, 6, 11, 16].map(day => ({ companyProfileId: companyId, elementId: e.id, stage: 'cutting', pieces: 6, workerIds: [], workerNames: 'Operator Demo A', checkedByName: 'Inxhinier Demo', checkedAt: new Date(`${month}-${String(day + i % 3).padStart(2, '0')}T11:20:00Z`), productionSnapshot: { v: 1, list: 'part', mark: e.mark, quantity: 24, unitWeightKg: e.weightKg } })) });
        }
    }
    const displayEmail = `screen-${companyId}@example.test`;
    await prisma.user.create({ data: { companyProfileId: companyId, email: displayEmail, name: 'Synthetic Monitor', role: 'STAFF', passwordHash: hashPassword('715038') } });
    return { sites, displayEmail };
}
