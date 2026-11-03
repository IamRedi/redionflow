/**
 * Imports a company's real staff and fleet once (see src/lib/provision/roster-input.ts).
 *
 *   ROSTER_IMPORT_JSON  base64 of gzipped JSON with the rows; remove it after the run.
 *
 * Runs again without changing anything: workers are matched by name, machines by
 * plate (or by name when there is none); existing rows only get empty fields filled.
 * New workers get no login code; the office gives codes when the rollout starts.
 * With retireSamples, every "Muster" test worker, site and machine and every "(test)" site is deleted.
 * Each run ends with a check of what the company holds (counts, workers not on the list, all sites).
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { resolveDatabaseConnectionString } from '../src/lib/db/connection-string';
import { parseRosterInput } from '../src/lib/provision/roster-input';
import { regionConfig } from '../src/lib/region';

export async function runRosterImport() {
  const input = parseRosterInput(process.env.ROSTER_IMPORT_JSON);
  if (!input) {
    console.log('[roster] ROSTER_IMPORT_JSON not set, nothing to do.');
    return;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: resolveDatabaseConnectionString({ preferDirect: true }),
    }),
  });
  try {
    const company = await prisma.companyProfile.findFirst({
      where: { legalName: input.company },
      select: { id: true, country: true },
    });
    if (!company) {
      console.log('[roster] company not found, nothing changed.');
      return;
    }
    const vacationDays = regionConfig(company.country).defaultVacationDays;
    const stats = {
      workersAdded: 0,
      workersFilled: 0,
      machinesAdded: 0,
      machinesFilled: 0,
      samplesRetired: 0,
    };

    for (const w of input.workers) {
      const existing = await prisma.worker.findFirst({
        where: {
          companyProfileId: company.id,
          firstName: { equals: w.firstName, mode: 'insensitive' },
          lastName: { equals: w.lastName, mode: 'insensitive' },
        },
        select: {
          id: true,
          birthDate: true,
          position: true,
          licenses: true,
          nationalId: true,
          crewRole: true,
        },
      });
      if (existing) {
        const fill = {
          ...(existing.birthDate || !w.birthDate
            ? {}
            : { birthDate: w.birthDate }),
          ...(existing.position || !w.position ? {} : { position: w.position }),
          ...(existing.licenses || !w.licenses ? {} : { licenses: w.licenses }),
          ...(existing.crewRole || !w.crewRole ? {} : { crewRole: w.crewRole }),
          ...(existing.nationalId || !w.nationalId ? {} : { nationalId: w.nationalId }),
        };
        if (Object.keys(fill).length > 0) {
          await prisma.worker.update({
            where: { id: existing.id },
            data: fill,
          });
          stats.workersFilled += 1;
        }
        continue;
      }
      await prisma.worker.create({
        data: {
          companyProfileId: company.id,
          firstName: w.firstName,
          lastName: w.lastName,
          birthDate: w.birthDate,
          position: w.position,
          licenses: w.licenses,
          nationalId: w.nationalId,
          crewRole: w.crewRole,
          level: w.level,
          vacationAllowanceDays: vacationDays,
          preferredLanguage: w.language,
          motherTongue: w.language === 'SQ' ? 'SQ' : 'EN',
        },
      });
      stats.workersAdded += 1;
    }

    for (const m of input.machines) {
      const existing = await prisma.machine.findFirst({
        where: {
          companyProfileId: company.id,
          ...(m.targe ? { targe: m.targe } : { name: m.name }),
        },
        select: {
          id: true,
          tuvDate: true,
          insuranceDate: true,
          taxDate: true,
          transportPermitDate: true,
          tachographDate: true,
          ownership: true,
          tonnage: true,
        },
      });
      const papers = {
        tuvDate: m.tuvDate,
        insuranceDate: m.insuranceDate,
        taxDate: m.taxDate,
        transportPermitDate: m.transportPermitDate,
        tachographDate: m.tachographDate,
        ownership: m.ownership,
        tonnage: m.tonnage,
      };
      if (existing) {
        const fill = Object.fromEntries(
          Object.entries(papers).filter(
            ([key, value]) =>
              value !== null && existing[key as keyof typeof existing] === null,
          ),
        );
        if (Object.keys(fill).length > 0) {
          await prisma.machine.update({
            where: { id: existing.id },
            data: fill,
          });
          stats.machinesFilled += 1;
        }
        continue;
      }
      await prisma.machine.create({
        data: {
          companyProfileId: company.id,
          name: m.name,
          nickname: m.nickname,
          funksioni: m.funksioni,
          category: m.category,
          targe: m.targe,
          model: m.model,
          hourlyRateCents: 0,
          notes: m.notes,
          ...papers,
        },
      });
      stats.machinesAdded += 1;
    }

    if (input.retireSamples) {
      // Real data has arrived: every test row goes, not just out of sight.
      // Sites cascade to their factory groups, files, logs and tasks; workers
      // to their sessions and notes; machines to their site presence.
      const sample = { contains: 'Muster', mode: 'insensitive' as const };
      const sites = await prisma.baustelle.deleteMany({
        where: {
          companyProfileId: company.id,
          OR: [{ name: sample }, { name: { contains: '(test)', mode: 'insensitive' } }],
        },
      });
      const workers = await prisma.worker.deleteMany({
        where: { companyProfileId: company.id, OR: [{ lastName: sample }, { firstName: sample }] },
      });
      const machines = await prisma.machine.deleteMany({
        where: { companyProfileId: company.id, OR: [{ name: sample }, { notes: sample }] },
      });
      stats.samplesRetired = workers.count + sites.count + machines.count;
      console.log(`[roster] deleted samples: sites ${sites.count}, workers ${workers.count}, machines ${machines.count}.`);
    }

    // What the company now holds, for checking against its lists.
    const listed = new Set(input.workers.map((w) => `${w.firstName} ${w.lastName}`.toLowerCase()));
    const [allWorkers, allMachines, allSites] = await Promise.all([
      prisma.worker.findMany({ where: { companyProfileId: company.id }, select: { firstName: true, lastName: true, status: true, crewRole: true, nationalId: true, birthDate: true, loginCodeHash: true } }),
      prisma.machine.findMany({ where: { companyProfileId: company.id }, select: { name: true, isActive: true, tuvDate: true } }),
      prisma.baustelle.findMany({ where: { companyProfileId: company.id }, select: { name: true, status: true, productionBatches: { select: { title: true } } }, orderBy: { name: 'asc' } }),
    ]);
    const notListed = allWorkers.filter((w) => !listed.has(`${w.firstName} ${w.lastName}`.toLowerCase()));
    const roles = allWorkers.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.crewRole ?? 'none']: (acc[w.crewRole ?? 'none'] ?? 0) + 1 }), {});
    console.log(
      `[roster] check: workers ${allWorkers.length} (active ${allWorkers.filter((w) => w.status === 'active').length}, with ID ${allWorkers.filter((w) => w.nationalId).length}, with birth date ${allWorkers.filter((w) => w.birthDate).length}, with login code ${allWorkers.filter((w) => w.loginCodeHash).length}), roles ${JSON.stringify(roles)}; not on the list: ${notListed.map((w) => `${w.firstName} ${w.lastName}`).join(', ') || 'none'}.`,
    );
    console.log(`[roster] check: machines ${allMachines.length} (active ${allMachines.filter((m) => m.isActive).length}, with kolaudim ${allMachines.filter((m) => m.tuvDate).length}).`);
    console.log(`[roster] check: sites ${allSites.length}: ${allSites.map((site) => `${site.name} [${site.status}${site.productionBatches.length ? `, groups: ${site.productionBatches.map((b) => b.title).join(' / ')}` : ''}]`).join('; ')}.`);

    console.log(
      `[roster] workers +${stats.workersAdded} (filled ${stats.workersFilled}), machines +${stats.machinesAdded} (filled ${stats.machinesFilled}), sample rows retired ${stats.samplesRetired}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
