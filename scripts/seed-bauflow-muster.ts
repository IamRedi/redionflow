import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/lib/auth/password';
import { companyLogoDataUrl } from '../src/lib/company-logo';
import { scanCodeKey } from '../src/lib/inventory/scan-code';
import { compactPhoto } from '../src/lib/asset-photos/image';
import { ensureSteelWorkCatalog } from '../src/lib/steel-work/catalog';
import { dateKey, dayRange } from '../src/lib/workzone/date-utils';
import { assertE2ETestDatabase } from './lib/e2e-target';
import { BAUFLOW_MUSTER_COMPANY_ID as companyId, BAUFLOW_MUSTER_OWNER_ID as ownerId, bauflowMusterConfigured } from '../src/lib/demo/bauflow-muster';

// Deliberately separate from ordinary seed/reset. Never imports customer data,
// resets an installation, changes existing profiles or calls an external API.
async function main() {
  if (!bauflowMusterConfigured()) throw new Error('Explicit local/demo Muster installation required.');
  assertE2ETestDatabase(process.env);
  const password = process.env.DEMO_ADMIN_PASSWORD ?? '';
  if (password.length < 12) throw new Error('Set a private local demo password of at least 12 characters.');
  const pinBase = Number(process.env.DEMO_WORKER_PIN_BASE);
  if (!Number.isInteger(pinBase) || pinBase < 100000 || pinBase > 999980) throw new Error('Explicit six-digit local worker PIN base required.');
  const logo = companyLogoDataUrl('image/webp', await readFile('public/bauflow-muster-v1/brand-profile.webp'));
  if (!logo.ok) throw new Error('Invalid original BauFlow profile derivative.');
  const cover = (await compactPhoto(await readFile('public/bauflow-muster-v1/workzone-campus-day.webp'))).data;
  const projectCovers = await Promise.all(['nordpark', 'westtor', 'hafenblick'].map(async name => (await compactPhoto(await readFile(`public/bauflow-muster-v1/site-${name}.webp`))).data));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const existing = await prisma.companyProfile.findMany({ select: { id: true, legalName: true } });
    if (existing.length) {
      if (existing.length === 1 && existing[0].id === companyId && existing[0].legalName === 'BauFlow Musterbau GmbH · Fiktive Demofirma') {
        console.log('Muster template already exists; preserving all changes.');
        return;
      }
      throw new Error('Refusing seed: database contains another installation.');
    }
    const todayKey = dateKey(new Date());
    const today = new Date(`${todayKey}T00:00:00.000Z`);
    const past = (days: number, hour = 9) => new Date(today.getTime() - days * 86_400_000 + hour * 3_600_000);
    const workday = (days: number, hour: number) => {
      const date = new Date(today);
      while (days > 0) { date.setUTCDate(date.getUTCDate() - 1); if (![0, 6].includes(date.getUTCDay())) days--; }
      date.setUTCHours(hour); return date;
    };
    const productionPhases = [['cutting', 'Zuschnitt'], ['assembly', 'Zusammenbau'], ['welding', 'Schweißen'], ['cleaning', 'Reinigen'], ['coating', 'Lackieren'], ['loading', 'Verladen']] as const;
    await prisma.$transaction(async tx => {
      await tx.companyProfile.create({ data: {
        id: companyId, displayName: 'BauFlow Musterbau · DEMO', legalName: 'BauFlow Musterbau GmbH · Fiktive Demofirma',
        mode: 'bau', country: 'DE', logoDataUrl: logo.dataUrl, email: 'kontakt@bauflow-muster.example',
        street: 'Musterweg 12', zip: '00000', city: 'Musterstadt',
      } });
      await tx.user.create({ data: { id: ownerId, companyProfileId: companyId, email: 'leitung@bauflow-muster.example', name: 'Nora König', role: 'ADMIN', isOwner: true, passwordHash: hashPassword(password), preferredLanguage: 'DE' } });
      const team = [
        ['finance', 'Mira', 'Weber', 'Buchhaltung', 'OFFICE'],
        ['projects', 'Lukas', 'Fischer', 'Projektorganisation', 'OFFICE'],
        ['clients', 'Elena', 'Novak', 'Kunden & Angebote', 'OFFICE'],
        ['buying', 'Tim', 'Hoffmann', 'Einkauf & Disposition', 'OFFICE'],
        ['factory-chief', 'Markus', 'Bauer', 'Fertigungsleitung', 'FACTORY_ENGINEER'],
        ['site-chief', 'Arben', 'Krasniqi', 'Bauleitung', 'FIELD_ENGINEER'],
        ['site-a', 'Luca', 'Rossi', 'Stahlbaumontage', 'FIELD_WORKER'],
        ['site-b', 'Jonas', 'Becker', 'Stahlbaumontage', 'FIELD_WORKER'],
        ['site-c', 'Sophie', 'Lang', 'Stahlbaumontage', 'FIELD_WORKER'],
        ['factory-a', 'Deniz', 'Yilmaz', 'Metallbau', 'FACTORY_WORKER'],
        ['factory-b', 'Felix', 'Wagner', 'Schweißtechnik', 'FACTORY_WORKER'],
        ['mechanic', 'Emma', 'Schulz', 'Werkstatt', 'MECHANIC'],
      ];
      const workers = new Map<string, { id: string; name: string }>();
      for (const [index, [key, firstName, lastName, position, crewRole]] of team.entries()) {
        const id = `bauflow-muster-${key}`;
        await tx.worker.create({ data: { id, companyProfileId: companyId, firstName, lastName, position, crewRole, loginCodeHash: hashPassword(String(pinBase + index)), preferredLanguage: 'DE', motherTongue: 'DE', status: 'active' } });
        workers.set(key, { id, name: `${firstName} ${lastName}` });
      }
      await tx.officeMember.create({ data: { id: ownerId, companyProfileId: companyId, userId: ownerId, title: 'Geschäftsleitung', enabled: true, workbooksEnabled: true } });
      for (const [key, profile] of [['finance', 'GENERAL'], ['projects', 'GENERAL'], ['clients', 'GENERAL'], ['buying', 'PURCHASING']]) {
        const worker = workers.get(key)!;
        const office = await tx.officeMember.create({ data: { companyProfileId: companyId, workerId: worker.id, title: team.find(t => t[0] === key)![3], workProfile: profile, enabled: true, workbooksEnabled: key === 'finance', assistantEnabled: false } });
        await tx.officeTask.create({ data: { id: randomUUID(), companyProfileId: companyId, ownerId: office.id, createdById: office.id, kind: 'PERSONAL', title: ({ finance: 'Wochenstunden und Belege prüfen', projects: 'Montageplan Nordpark abstimmen', clients: 'Angebot Westtor vorbereiten', buying: 'Materiallieferung für Montag bestätigen' } as Record<string, string>)[key], status: 'TODO', dueDate: today.toISOString().slice(0, 10) } });
      }
      for (const name of ['Finanzen', 'Kunden & Angebote', 'Projektorganisation', 'Einkauf', 'Technik']) await tx.officeCategory.create({ data: { companyProfileId: companyId, name } });
      await tx.steelWorkDefinition.createMany({ data: productionPhases.map(([stage, label], sortOrder) => ({ companyProfileId: companyId, kind: 'site', key: `steel-task-muster-${stage}`, label, phaseGroup: 'production', linkedProcessKey: stage, sortOrder })) });
      const factory = await tx.baustelle.create({ data: { companyProfileId: companyId, name: 'Werkhalle · Musterbau', type: 'STEEL_WORKSHOP', documents: [], description: 'Fiktive Musterfirma: Zuschnitt, Zusammenbau, Schweißen und Versand.', coverPhotoAt: new Date() } });
      await tx.assetPhoto.create({ data: { companyProfileId: companyId, baustelleId: factory.id, data: cover } });
      const sites = [];
      for (const [index, name] of ['Nordpark · Logistikhalle', 'Westtor · Hallenerweiterung', 'Hafenblick · Bürostruktur'].entries()) {
        const site = await tx.baustelle.create({ data: { companyProfileId: companyId, name, type: 'STEEL_ASSEMBLY', documents: [], address: `${['Nordpark', 'Westtor', 'Hafenblick'][index]} ${index + 1}, 00000 Musterstadt`, description: 'Fiktives Musterprojekt. Material und Fortschritt sind nachvollziehbare Beispieldaten.', coordinates: { lat: 51.45 + index * .01, lng: 7.01 + index * .01 }, canvasX: 45 + index * 420, canvasY: 110, coverPhotoAt: new Date() } });
        sites.push(site);
        await tx.assetPhoto.create({ data: { companyProfileId: companyId, baustelleId: site.id, data: projectCovers[index] } });
        const text = Buffer.from(`${name}\nFIKTIVE MUSTERFIRMA\nArbeitsumfang: Stahlkonstruktion, Fertigung, Lieferung und Montage.\nNur Demonstration, kein freigegebener Bauplan oder Auftrag.\n`);
        await tx.siteFile.create({ data: { companyProfileId: companyId, baustelleId: site.id, kind: 'document', fileName: 'Projektuebersicht-MUSTER.txt', mime: 'text/plain', size: text.length, data: text, uploadedByName: 'Nora König' } });
        for (const phase of ['foundation', 'columns', 'trusses', 'painting']) {
          const done = phase === 'foundation' && index < 2;
          await tx.treeItem.create({ data: { baustelleId: site.id, treeId: `steel-${phase}`, species: phase, diameter: 0, status: done ? 'done' : 'todo', completedAt: done ? past(4, 14) : null, completedBy: done ? ownerId : null, notes: JSON.stringify({ doneBy: done ? 'Nora König' : '', note: 'Fiktive Musterphase', label: '' }) } });
        }
        for (const [stage, label] of productionPhases) await tx.treeItem.create({ data: { baustelleId: site.id, treeId: `steel-task-muster-${stage}`, species: 'task', diameter: 0, notes: JSON.stringify({ label }) } });
        for (let row = 0; row < 4; row++) {
          const element = await tx.siteElement.create({ data: { companyProfileId: companyId, baustelleId: site.id, list: 'assembly', mark: `${['N', 'W', 'H'][index]}-${100 + row}`, kind: row % 2 ? 'COLUMN' : 'BEAM', profile: row % 2 ? 'HEB 240' : 'IPE 300', material: 'S355', quantity: 12, lengthMm: 4200 + row * 600, weightKg: 180 + row * 45, sortIndex: row, factoryDoneAt: row === 0 ? past(2, 14) : null, factoryDoneBy: row === 0 ? workers.get('factory-chief')!.name : null } });
          const stages = ['cutting', 'assembly', 'welding', 'cleaning', 'coating', 'loading', 'received', 'mounted', 'bolted', 'touchup'];
          for (const [stageIndex, stage] of stages.entries()) {
            const pieces = row === 0 ? stageIndex < 7 ? 12 : stageIndex < 9 ? 6 : 0 : row === 1 ? stageIndex < 4 ? 12 : 0 : row === 2 ? stageIndex === 0 ? 12 : stageIndex === 1 ? 6 : 0 : stageIndex === 0 ? 4 : 0;
            if (!pieces) continue;
            const who = workers.get(stageIndex < 6 ? 'factory-a' : ['site-a', 'site-b', 'site-c'][index])!;
            await tx.siteElementWork.create({ data: { companyProfileId: companyId, elementId: element.id, stage, pieces, workerIds: [who.id], workerNames: who.name, checkedByName: 'Nora König', checkedByUserId: ownerId, checkedAt: past(8 - Math.min(stageIndex, 7), 10), productionSnapshot: { v: 1, list: 'assembly', mark: element.mark, quantity: 12, unitWeightKg: element.weightKg } } });
          }
          const part = await tx.siteElement.create({ data: { companyProfileId: companyId, baustelleId: site.id, list: 'part', mark: `${['N', 'W', 'H'][index]}-P${row + 1}`, profile: 'PL 12', material: 'S355', quantity: 24, weightKg: 8 + row * 2, sortIndex: row } });
          await tx.siteElementWork.create({ data: { companyProfileId: companyId, elementId: part.id, stage: 'cutting', pieces: row < 2 ? 24 : 12, workerIds: [workers.get('factory-b')!.id], workerNames: workers.get('factory-b')!.name, checkedByName: 'Nora König', checkedByUserId: ownerId, checkedAt: past(3, 11), productionSnapshot: { v: 1, list: 'part', mark: part.mark, quantity: 24, unitWeightKg: part.weightKg } } });
        }
      }
      await ensureSteelWorkCatalog(companyId, tx);
      for (const [key, stage, kind] of [['steel-columns', 'mounted', 'COLUMN'], ['steel-trusses', 'mounted', 'BEAM'], ['steel-painting', 'touchup', null]]) {
        await tx.steelWorkDefinition.update({ where: { companyProfileId_key: { companyProfileId: companyId, key: key! } }, data: { linkedProcessKey: stage, linkedList: 'assembly', linkedKind: kind, phaseGroup: 'assembly' } });
      }
      await tx.steelWorkDefinition.update({ where: { companyProfileId_key: { companyProfileId: companyId, key: 'steel-foundation' } }, data: { phaseGroup: 'concrete' } });
      const chosenPhases = ['steel-foundation', ...productionPhases.map(([stage]) => `steel-task-muster-${stage}`), 'steel-columns', 'steel-trusses', 'steel-painting'];
      for (const site of sites) for (const [position, key] of chosenPhases.entries()) {
        const definition = await tx.steelWorkDefinition.findUniqueOrThrow({ where: { companyProfileId_key: { companyProfileId: companyId, key } } });
        await tx.steelSiteTask.update({ where: { companyProfileId_baustelleId_definitionId: { companyProfileId: companyId, baustelleId: site.id, definitionId: definition.id } }, data: { position: position + 1 } });
      }
      const plan = await tx.dailyWorkPlan.create({ data: { companyProfileId: companyId, planDate: dayRange(todayKey).start, createdByAdminId: ownerId } });
      const savedRows: Array<{ workerNames: string; machineNames: string; baustelleName: string; sortOrder: number }> = [];
      for (const [index, site] of [factory, ...sites].entries()) {
        const crew = (index === 0 ? ['factory-chief', 'factory-a', 'factory-b'] : index === 1 ? ['site-chief', 'site-a'] : index === 2 ? ['site-b'] : ['site-c']).map(key => workers.get(key)!);
        await tx.dailyWorkPlanColumn.create({ data: { planId: plan.id, baustelleId: site.id, title: site.name, sortOrder: index, assignments: { create: crew.map((w, n) => ({ kind: 'WORKER' as const, workerId: w.id, labelSnapshot: w.name, sortOrder: n })) } } });
        savedRows.push({ workerNames: crew.map(w => w.name).join(', '), machineNames: '', baustelleName: site.name, sortOrder: index });
        for (const worker of crew) {
          for (let day = 1; day <= 5; day++) await tx.workSession.create({ data: { workerId: worker.id, baustelleId: site.id, startTime: workday(day, 7), endTime: workday(day, 15), totalHours: 7.5, breakMinutes: 30 } });
          await tx.workSession.create({ data: { workerId: worker.id, baustelleId: site.id, startTime: new Date(Date.now() - 45 * 60_000), isLive: true } });
        }
      }
      await tx.dailyWorkPlanSavedRow.createMany({ data: savedRows.map(row => ({ ...row, planId: plan.id })) });
      await tx.dailyWorkPlanSnapshot.create({ data: { planId: plan.id, versionNumber: 1, createdByAdminId: ownerId, rows: { create: savedRows } } });
      for (const key of ['finance', 'projects', 'clients', 'buying']) {
        const worker = workers.get(key)!;
        for (let day = 1; day <= 5; day++) await tx.workSession.create({ data: { workerId: worker.id, workplace: 'OFFICE', startTime: workday(day, 7), endTime: workday(day, 15), totalHours: 7.5, breakMinutes: 30 } });
      }
      for (const [index, name] of ['Montage-Transporter', 'LKW 7,5 t', 'Teleskopstapler', 'Scherenbühne 12 m'].entries()) {
        const machine = await tx.machine.create({ data: { companyProfileId: companyId, name, category: index < 2 ? 'TRUCK' : 'OTHER', targe: index < 2 ? `MU BF ${101 + index}` : null, hourlyRateCents: 3500 + index * 500, isActive: true } });
        const asset = await tx.companyOperationalAsset.create({ data: { companyProfileId: companyId, machineId: machine.id } });
        await tx.companyAssetEvent.create({ data: { companyProfileId: companyId, assetId: asset.id, type: 'registered', actorKey: 'muster-seed-v1', actorName: 'Musterfirma', note: 'Fiktiver Anfangsbestand des Templates.' } });
        if (index === 2) await tx.companyAssetRepair.create({ data: { companyProfileId: companyId, assetId: asset.id, phase: 'received', problem: 'Hydraulikleitung prüfen · Musterfall', reportedByKey: 'muster-seed-v1', reportedByName: 'Emma Schulz' } });
      }
      for (const [index, name] of ['Akku-Schlagschrauber', 'Winkelschleifer', 'Rotationslaser', 'Schweißgerät MIG/MAG', 'Drehmomentschlüssel'].entries()) {
        const code = `BF-MU-${String(index + 1).padStart(3, '0')}`;
        const item = await tx.companyInventoryItem.create({ data: { companyProfileId: companyId, category: 'WORK_TOOL', itemCode: code, barcode: code, name } });
        const asset = await tx.companyOperationalAsset.create({ data: { companyProfileId: companyId, inventoryItemId: item.id } });
        await tx.companyAssetCode.create({ data: { companyProfileId: companyId, assetId: asset.id, kind: 'label', value: code, matchValue: scanCodeKey(code), createdByKey: 'muster-seed-v1', createdByName: 'Musterfirma' } });
        await tx.companyAssetEvent.create({ data: { companyProfileId: companyId, assetId: asset.id, type: 'registered', actorKey: 'muster-seed-v1', actorName: 'Musterfirma', note: 'Fiktiver Anfangsbestand des Templates.' } });
      }
      await tx.workzoneAnnouncement.create({ data: { companyProfileId: companyId, message: 'Musterfirma: Alle Personen, Projekte und Geschäftsdaten sind frei erfunden. Bilder sind illustrative Entwürfe.', createdByName: 'BauFlow' } });
    }, { timeout: 30_000 });
    console.log('BauFlow Muster template created: 12 employees, 5 offices, 3 sites, 1 factory, 9 linked assets. No existing installation changed.');
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Muster seed failed.'); process.exitCode = 1; });
