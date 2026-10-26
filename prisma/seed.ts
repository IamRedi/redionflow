import "dotenv/config";
import {
  PrismaClient,
  MachineTimeUnit,
  Prisma,
  ProjectStatus,
  WageType,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { BAUMDIENST_DEMO, type DemoDataset, type DemoSite } from "./seed-data";
import { BAU_DEMO } from "./seed-data-bau";

// Seed is for local/demo bootstrap only, not runtime execution. It creates
// no administrator: use the gated demo bootstrap (`ALLOW_DEMO_ADMIN_BOOTSTRAP`)
// or the first-boot flow for that.
const adapter = new PrismaPg({
  connectionString: resolveDatabaseConnectionString({ preferDirect: true }),
});
const prisma = new PrismaClient({ adapter });

// `DEMO_SEED_MODE=bau` seeds the BauFlow demo company, anything else BaumdienstFlow.
const data: DemoDataset = process.env.DEMO_SEED_MODE?.trim().toLowerCase() === "bau" ? BAU_DEMO : BAUMDIENST_DEMO;

// Deterministic pseudo-random numbers so every reset produces the same demo.
function hashToUnit(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function pick<T>(items: readonly T[], seed: string): T {
  return items[Math.floor(hashToUnit(seed) * items.length) % items.length] as T;
}

/** Point at fraction `t` (0..1) along the site's polyline, nudged a few metres sideways. */
function pointAlong(path: DemoSite["path"], t: number, seed: string) {
  const segments = path.length - 1;
  const scaled = Math.min(t * segments, segments - 1e-9);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const a = path[index]!;
  const b = path[index + 1]!;
  const offset = (hashToUnit(seed) - 0.5) * 0.0003;
  return {
    lat: Number((a.lat + (b.lat - a.lat) * local + offset).toFixed(6)),
    lng: Number((a.lng + (b.lng - a.lng) * local - offset).toFixed(6)),
  };
}

function atTime(day: Date, hours: number, minutes = 0) {
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** Closed 07:00 shifts on the last 15 weekdays, so hour charts have history. */
function pastSessions(crew: Array<{ id: string }>, baustelleId: string, today: Date) {
  const sessions: Prisma.WorkSessionCreateManyInput[] = [];
  const day = new Date(today);
  for (let workdays = 0; workdays < 15; ) {
    day.setDate(day.getDate() - 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    workdays++;
    for (const member of crew) {
      const endMinutes = 15 * 60 + 30 + Math.floor(hashToUnit(`${member.id}:${day.toDateString()}`) * 90);
      const startTime = atTime(day, 7);
      const endTime = atTime(day, 0, endMinutes);
      const totalHours = (endTime.getTime() - startTime.getTime()) / 3_600_000 - 0.5;
      sessions.push({
        workerId: member.id,
        baustelleId,
        startTime,
        endTime,
        totalHours: Math.round(totalHours * 100) / 100,
      });
    }
  }
  return sessions;
}

async function main() {
  const existing = await prisma.companyProfile.findFirst({ where: { displayName: data.company.displayName } });
  if (existing) {
    console.log("Demo data already present. Run `npm run demo:reset` for a fresh copy.");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Live sessions start at 07:00, or half an hour ago when seeding earlier.
  const shiftStart = new Date(Math.min(atTime(today, 7).getTime(), Date.now() - 30 * 60 * 1000));

  const company = await prisma.companyProfile.create({
    data: {
      ...data.company,
      mode: data.mode,
      overheadSettings: {
        create: {
          bgkPct: new Prisma.Decimal("0.18"),
          agkPct: new Prisma.Decimal("0.10"),
          riskPct: new Prisma.Decimal("0.03"),
          profitPct: new Prisma.Decimal("0.06"),
          vatPct: new Prisma.Decimal("0.19"),
          bgkBase: "EK_TOTAL",
          riskProfitMode: "SEPARATE",
          applyVatByDefault: true,
        },
      },
    },
  });

  const systemUser = await prisma.user.upsert({
    where: { email: data.systemUser.email },
    update: { companyProfileId: company.id },
    create: {
      ...data.systemUser,
      role: "STAFF",
      isActive: false,
      companyProfileId: company.id,
    },
  });

  for (const role of data.laborRoles) {
    await prisma.laborRole.create({
      data: {
        companyProfileId: company.id,
        name: role.name,
        wageType: WageType.HOURLY,
        grossHourlyCents: role.grossHourlyCents,
        employerOverheadPct: new Prisma.Decimal(role.employerOverheadPct),
        productivityPct: new Prisma.Decimal(role.productivityPct),
        absencePct: new Prisma.Decimal("0.06"),
        sortOrder: role.sortOrder,
      },
    });
  }

  const machineIds = new Map<string, { id: string; name: string }>();
  for (const machine of data.machines) {
    const created = await prisma.machine.create({
      data: {
        companyProfileId: company.id,
        name: machine.name,
        category: machine.category,
        hourlyRateCents: machine.hourlyRateCents,
        dayRateCents: machine.dayRateCents ?? undefined,
        model: machine.model,
        targe: machine.targe ?? undefined,
        coneTotal: machine.coneTotal,
      },
    });
    machineIds.set(machine.key, { id: created.id, name: created.name });
  }

  const workerIds = new Map<string, { id: string; name: string }>();
  for (const worker of data.workers) {
    const created = await prisma.worker.create({
      data: {
        companyProfileId: company.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        position: worker.position,
        licenses: worker.licenses,
        level: worker.level,
        preferredLanguage: worker.language,
        motherTongue: worker.language,
        availability: worker.availability ?? "AVAILABLE",
        startedAtCompany: new Date(Date.UTC(worker.startedYear, 3, 1)),
      },
    });
    workerIds.set(worker.key, { id: created.id, name: `${worker.firstName} ${worker.lastName}` });
  }

  const onVacation = workerIds.get(data.vacationWorker)!;
  const vacationStart = new Date(today);
  vacationStart.setDate(vacationStart.getDate() - 2);
  const vacationEnd = new Date(today);
  vacationEnd.setDate(vacationEnd.getDate() + 7);
  await prisma.vacationRequest.create({
    data: {
      companyProfileId: company.id,
      workerId: onVacation.id,
      startDate: vacationStart,
      endDate: vacationEnd,
      requestedDays: 7,
      status: "APPROVED",
      reviewedAt: vacationStart,
    },
  });
  const nextMonth = new Date(today);
  nextMonth.setDate(nextMonth.getDate() + 30);
  const nextMonthEnd = new Date(nextMonth);
  nextMonthEnd.setDate(nextMonthEnd.getDate() + 4);
  await prisma.vacationRequest.create({
    data: {
      companyProfileId: company.id,
      workerId: workerIds.get(data.plannedVacationWorker)!.id,
      startDate: nextMonth,
      endDate: nextMonthEnd,
      requestedDays: 5,
      workerNote: data.plannedVacationNote,
    },
  });

  const plan = await prisma.dailyWorkPlan.create({
    data: { companyProfileId: company.id, planDate: today, createdByAdminId: systemUser.id },
  });

  let treeTotal = 0;
  for (const [siteIndex, site] of data.sites.entries()) {
    const baustelle = await prisma.baustelle.create({
      data: {
        companyProfileId: company.id,
        name: site.name,
        type: site.type,
        address: site.address,
        description: site.description,
        documents: site.documents,
        coordinates: site.path[Math.floor(site.path.length / 2)],
      },
    });

    const crew = site.crew.map((key) => workerIds.get(key)!);
    const doneCount = Math.round(site.treeCount * site.doneShare);
    const blocked = new Set([Math.floor(site.treeCount * 0.7), Math.floor(site.treeCount * 0.85)]);
    await prisma.treeItem.createMany({
      data: Array.from({ length: site.treeCount }, (_, i) => {
        const status = blocked.has(i) ? "blocked" : i < doneCount ? "done" : "todo";
        const finisher = crew[i % crew.length]!;
        return {
          baustelleId: baustelle.id,
          treeId: `${site.treePrefix}-${String(i + 1).padStart(3, "0")}`,
          species: pick(site.species, `${site.key}:species:${i}`),
          diameter: 20 + Math.floor(hashToUnit(`${site.key}:dbh:${i}`) * 70),
          coordinates: pointAlong(site.path, i / Math.max(site.treeCount - 1, 1), `${site.key}:gps:${i}`),
          status,
          // Same JSON shape the Workzone writes ({ note, haltverbot, ... }).
          notes: status === "blocked" ? JSON.stringify({ note: pick(data.blockedNotes, `${site.key}:note:${i}`) }) : undefined,
          completedAt: status === "done" ? new Date(shiftStart.getTime() + i * 6 * 60 * 1000) : null,
          completedByWorkerId: status === "done" ? finisher.id : null,
        };
      }),
    });
    treeTotal += site.treeCount;

    for (const description of site.tasks) {
      await prisma.manualTask.create({
        data: { baustelleId: baustelle.id, userId: systemUser.id, workerId: crew[0]!.id, description },
      });
    }

    for (const member of crew) {
      await prisma.workSession.create({
        data: { workerId: member.id, baustelleId: baustelle.id, startTime: shiftStart, isLive: true },
      });
    }
    await prisma.workSession.createMany({ data: pastSessions(crew, baustelle.id, today) });

    await prisma.dailyWorkPlanColumn.create({
      data: {
        planId: plan.id,
        baustelleId: baustelle.id,
        title: site.name,
        sortOrder: siteIndex,
        assignments: {
          create: [
            ...crew.map((member, i) => ({
              kind: "WORKER" as const,
              workerId: member.id,
              labelSnapshot: member.name,
              sortOrder: i,
            })),
            ...site.machines.map((key, i) => {
              const machine = machineIds.get(key)!;
              return {
                kind: "MACHINE" as const,
                machineId: machine.id,
                labelSnapshot: machine.name,
                sortOrder: crew.length + i,
              };
            }),
          ],
        },
      },
    });
  }

  await prisma.workzoneAnnouncement.create({
    data: { companyProfileId: company.id, message: data.announcement, createdByName: "Büro" },
  });

  await createDemoProject(company.id, machineIds.get(data.offer.project.position.machineKey)!);

  // Link admins created earlier by the gated bootstrap to the demo company.
  await prisma.user.updateMany({
    where: { role: "ADMIN", companyProfileId: null },
    data: { companyProfileId: company.id },
  });

  console.log(
    `Seed completed: ${data.company.displayName}, ${data.workers.length} workers, ${data.sites.length} sites, ${treeTotal} ${data.itemLabel}, ${data.machines.length} machines.`,
  );
}

async function createDemoProject(companyProfileId: string, machine: { id: string; name: string }) {
  const { template, project } = data.offer;
  const roles = await prisma.laborRole.findMany({ where: { companyProfileId } });
  const roleByName = new Map(roles.map((role) => [role.name, role]));

  await prisma.calculationTemplate.create({
    data: {
      companyProfileId,
      name: template.name,
      description: template.description,
      templatePositions: {
        create: template.positions.map((position, i) => ({
          sortOrder: (i + 1) * 10,
          title: position.title,
          description: position.description,
          quantity: new Prisma.Decimal("1"),
          unit: position.unit,
        })),
      },
    },
  });

  const { position } = project;
  await prisma.project.create({
    data: {
      companyProfileId,
      title: project.title,
      customerName: project.customerName,
      customerStreet: project.customerStreet,
      customerZip: project.customerZip,
      customerCity: project.customerCity,
      status: ProjectStatus.DRAFT,
      internalNotes: project.internalNotes,
      positions: {
        create: [
          {
            sortOrder: 10,
            title: position.title,
            description: position.description,
            quantity: new Prisma.Decimal("1"),
            unit: position.unit,
            laborItems: {
              create: position.labor.map((item) => {
                const role = roleByName.get(item.roleName);
                if (!role) throw new Error(`Seed offer uses unknown labor role "${item.roleName}"`);
                return { laborRoleId: role.id, laborRoleNameSnapshot: role.name, workers: 1, hours: new Prisma.Decimal(item.hours) };
              }),
            },
            machineItems: {
              create: [{ machineId: machine.id, machineNameSnapshot: machine.name, timeUnit: MachineTimeUnit.HOURS, quantity: new Prisma.Decimal(position.machineHours) }],
            },
            materialItems: {
              create: [{ title: position.material.title, quantity: new Prisma.Decimal("1"), unit: "pauschal", unitPriceCents: position.material.unitPriceCents }],
            },
            externalServiceItems: {
              create: [{ title: position.externalService.title, amountCents: position.externalService.amountCents, notes: position.externalService.notes }],
            },
          },
        ],
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
