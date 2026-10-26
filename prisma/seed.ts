import "dotenv/config";
import {
  PrismaClient,
  MachineCategory,
  WageType,
  ProjectStatus,
  MachineTimeUnit,
  Prisma,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";

// Seed is for local/demo bootstrap only, not runtime execution.
const adapter = new PrismaPg({
  connectionString: resolveDatabaseConnectionString(),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // BDF-P1-001: the previous seed wrote three admins with hard-coded
  // plaintext PINs into `passwordHash`. Those literals have been removed.
  // Seed no longer creates any administrator. Use the gated demo bootstrap
  // (`ALLOW_DEMO_ADMIN_BOOTSTRAP=true` + `DEMO_ADMIN_EMAIL` +
  // `DEMO_ADMIN_PASSWORD` under `APP_ENV=local|demo`) to seed one local
  // admin, or wait for the BDF-P1-002 first-boot flow.


  const company =
    (await prisma.companyProfile.findFirst({
      where: { displayName: "BaumKalk Demo GmbH" },
      include: { overheadSettings: true },
    })) ??
    (await prisma.companyProfile.create({
      data: {
        legalName: "BaumKalk Demo GmbH",
        displayName: "BaumKalk Demo GmbH",
        vatId: "DE123456789",
        phone: "+49 30 123456-0",
        email: "office@baumkalk-demo.de",
        street: "Musterstraße 12",
        zip: "10115",
        city: "Berlin",
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
      include: { overheadSettings: true },
    }));

  const roles = [
    {
      name: "Helfer",
      wageType: WageType.HOURLY,
      grossHourlyCents: 1650,
      employerOverheadPct: "0.28",
      productivityPct: "0.80",
      absencePct: "0.06",
      sortOrder: 10,
    },
    {
      name: "Facharbeiter",
      wageType: WageType.HOURLY,
      grossHourlyCents: 2150,
      employerOverheadPct: "0.30",
      productivityPct: "0.85",
      absencePct: "0.06",
      sortOrder: 20,
    },
    {
      name: "Vorarbeiter",
      wageType: WageType.HOURLY,
      grossHourlyCents: 2550,
      employerOverheadPct: "0.32",
      productivityPct: "0.88",
      absencePct: "0.06",
      sortOrder: 30,
    },
    {
      name: "Kletterer",
      wageType: WageType.HOURLY,
      grossHourlyCents: 2850,
      employerOverheadPct: "0.34",
      productivityPct: "0.90",
      absencePct: "0.06",
      sortOrder: 40,
    },
    {
      name: "Maschinist",
      wageType: WageType.HOURLY,
      grossHourlyCents: 2450,
      employerOverheadPct: "0.30",
      productivityPct: "0.87",
      absencePct: "0.06",
      sortOrder: 50,
    },
  ] as const;

  for (const r of roles) {
    await prisma.laborRole.upsert({
      where: { companyProfileId_name: { companyProfileId: company.id, name: r.name } },
      update: {
        wageType: r.wageType,
        grossHourlyCents: r.grossHourlyCents,
        employerOverheadPct: new Prisma.Decimal(r.employerOverheadPct),
        productivityPct: new Prisma.Decimal(r.productivityPct),
        absencePct: new Prisma.Decimal(r.absencePct),
        isActive: true,
        sortOrder: r.sortOrder,
      },
      create: {
        companyProfileId: company.id,
        name: r.name,
        wageType: r.wageType,
        grossHourlyCents: r.grossHourlyCents,
        employerOverheadPct: new Prisma.Decimal(r.employerOverheadPct),
        productivityPct: new Prisma.Decimal(r.productivityPct),
        absencePct: new Prisma.Decimal(r.absencePct),
        isActive: true,
        sortOrder: r.sortOrder,
      },
    });
  }

  const machines = [
    {
      name: "Häcksler",
      category: MachineCategory.CHIPPER,
      hourlyRateCents: 6500,
      dayRateCents: 42000,
      sortHint: 10,
    },
    {
      name: "LKW",
      category: MachineCategory.TRUCK,
      hourlyRateCents: 4500,
      dayRateCents: 32000,
      sortHint: 20,
    },
    {
      name: "Hubarbeitsbühne",
      category: MachineCategory.AWP,
      hourlyRateCents: 9800,
      dayRateCents: 65000,
      sortHint: 30,
    },
    {
      name: "Motorsäge",
      category: MachineCategory.CHAINSAW,
      hourlyRateCents: 1200,
      dayRateCents: null,
      sortHint: 40,
    },
  ] as const;

  for (const m of machines) {
    await prisma.machine.upsert({
      where: { companyProfileId_name: { companyProfileId: company.id, name: m.name } },
      update: {
        category: m.category,
        hourlyRateCents: m.hourlyRateCents,
        dayRateCents: m.dayRateCents ?? undefined,
        isActive: true,
      },
      create: {
        companyProfileId: company.id,
        name: m.name,
        category: m.category,
        hourlyRateCents: m.hourlyRateCents,
        dayRateCents: m.dayRateCents ?? undefined,
        isActive: true,
      },
    });
  }

  const template =
    (await prisma.calculationTemplate.findFirst({
      where: { companyProfileId: company.id, name: "Standard: Baumfällung (einfach)" },
      include: { templatePositions: true },
    })) ??
    (await prisma.calculationTemplate.create({
      data: {
        companyProfileId: company.id,
        name: "Standard: Baumfällung (einfach)",
        description:
          "Typische Positionen als Startpunkt. Inhalte und Mengen sind bewusst editierbar.",
        templatePositions: {
          create: [
            {
              sortOrder: 10,
              title: "Baum fällen und abtragen",
              description: "Fällung, Entastung, Abschnittbildung, Verladen",
              quantity: new Prisma.Decimal("1"),
              unit: "pauschal",
            },
            {
              sortOrder: 20,
              title: "Häckselgut entsorgen",
              description: "Abtransport / Entsorgung gemäß Vorgabe",
              quantity: new Prisma.Decimal("1"),
              unit: "pauschal",
            },
          ],
        },
      },
      include: { templatePositions: true },
    }));

  // Demo project (optional, internal-friendly)
  const existingProject = await prisma.project.findFirst({
    where: { companyProfileId: company.id, title: "Anfrage: Gartenbaum – Musterkunde" },
    include: { positions: true },
  });

  if (!existingProject) {
    const helper = await prisma.laborRole.findFirstOrThrow({
      where: { companyProfileId: company.id, name: "Helfer" },
    });
    const climber = await prisma.laborRole.findFirstOrThrow({
      where: { companyProfileId: company.id, name: "Kletterer" },
    });
    const chipper = await prisma.machine.findFirstOrThrow({
      where: { companyProfileId: company.id, name: "Häcksler" },
    });

    await prisma.project.create({
      data: {
        companyProfileId: company.id,
        title: "Anfrage: Gartenbaum – Musterkunde",
        customerName: "Musterkunde GmbH",
        customerStreet: "Beispielweg 8",
        customerZip: "10559",
        customerCity: "Berlin",
        status: ProjectStatus.DRAFT,
        internalNotes: "Demo-Projekt aus Seed. Positionen dienen als realistischer Startpunkt.",
        positions: {
          create: [
            {
              sortOrder: 10,
              title: template.templatePositions[0]?.title ?? "Baum fällen und abtragen",
              description: template.templatePositions[0]?.description ?? undefined,
              quantity: new Prisma.Decimal("1"),
              unit: "pauschal",
              laborItems: {
                create: [
                  {
                    laborRoleId: climber.id,
                    laborRoleNameSnapshot: climber.name,
                    workers: 1,
                    hours: new Prisma.Decimal("6.0"),
                  },
                  {
                    laborRoleId: helper.id,
                    laborRoleNameSnapshot: helper.name,
                    workers: 1,
                    hours: new Prisma.Decimal("6.0"),
                  },
                ],
              },
              machineItems: {
                create: [
                  {
                    machineId: chipper.id,
                    machineNameSnapshot: chipper.name,
                    timeUnit: MachineTimeUnit.HOURS,
                    quantity: new Prisma.Decimal("3.0"),
                  },
                ],
              },
              materialItems: {
                create: [
                  {
                    title: "Sicherungs-/Absperrmaterial",
                    quantity: new Prisma.Decimal("1"),
                    unit: "pauschal",
                    unitPriceCents: 1500,
                  },
                ],
              },
              externalServiceItems: {
                create: [
                  {
                    title: "Entsorgungsgebühr Grünabfall",
                    amountCents: 4500,
                    notes: "Kann je nach Menge/Container variieren.",
                  },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // Workzone stress demo data (Baustellen + 10–30 Trees each)
  const worker =
    (await prisma.user.findFirst({ where: { email: "worker@baumkalk.local" } })) ??
    (await prisma.user.create({
      data: {
        email: "worker@baumkalk.local",
        name: "Worker",
        role: "STAFF",
        isActive: true,
      },
    }));

  const BAUSTELLEN: Array<{
    key: string;
    name: string;
    type: "TRUCK_PLATFORM" | "TRUCK_CRANE" | "CLIMBING" | "WATERING" | "EXCAVATOR";
    description: string;
    street: string;
    zip: string;
    city: string;
    base: { lat: number; lng: number };
    docs: string[];
  }> = [
    {
      key: "essen_b",
      name: "Stadtgarten Essen – Sektor B",
      type: "TRUCK_PLATFORM",
      description: "Pflege- und Verkehrssicherungsmaßnahmen an Bestandsbäumen. Abschnittweise Sperrung.",
      street: "Huyssenallee 53",
      zip: "45128",
      city: "Essen",
      base: { lat: 51.4509, lng: 7.0072 },
      docs: ["leje-policie.pdf", "skica-rruges.pdf", "plan-sigurie.pdf"],
    },
    {
      key: "a40_nord",
      name: "Autostrada A40 – Mirëmbajtja Veriore",
      type: "TRUCK_CRANE",
      description: "Krasitje dhe heqje degësh rrezikuese përgjatë segmentit verior. Koordinim me policinë.",
      street: "A40 Anschlussstelle Essen-Zentrum",
      zip: "45141",
      city: "Essen",
      base: { lat: 51.4722, lng: 7.0121 },
      docs: ["leje-ndertimi.pdf", "skica-segmentit.pdf", "orari-bllokimit.pdf"],
    },
    {
      key: "duisburg_hafen",
      name: "Duisburg Hafen – Terminal 3",
      type: "EXCAVATOR",
      description: "Prerje selektive dhe pastrim i zonës së ngarkesës. Qasje e kufizuar për makineri.",
      street: "Hafenkai 3",
      zip: "47119",
      city: "Duisburg",
      base: { lat: 51.4432, lng: 6.7421 },
      docs: ["hyrje-port.pdf", "skica-terminalit.pdf"],
    },
    {
      key: "koeln_sued",
      name: "Köln Süd – Parkanlage Rheinufer",
      type: "CLIMBING",
      description: "Kontroll stuhie, prerje degësh të thyera dhe sigurim shtigjesh për këmbësorë.",
      street: "Rheinuferstraße 12",
      zip: "50679",
      city: "Köln",
      base: { lat: 50.9296, lng: 6.9712 },
      docs: ["leje-policie.pdf", "plan-evakuimi.pdf", "skica-zones.pdf"],
    },
    {
      key: "berlin_ost",
      name: "Berlin Ost – Wohnanlage Lindenhof",
      type: "WATERING",
      description: "Baumpflege në kompleks banimi; fokus te pemët pranë parkimeve dhe hyrjeve.",
      street: "Lindenstraße 18",
      zip: "10315",
      city: "Berlin",
      base: { lat: 52.5109, lng: 13.5172 },
      docs: ["njoftim-banoreve.pdf", "skica-parkimit.pdf"],
    },
  ];

  const SPECIES = ["Eiche", "Ahorn", "Linde", "Buche", "Kiefer", "Birke", "Platane", "Ulme"] as const;
  const BLOCKED_NOTES = [
    "Zonë e bllokuar – prit leje shtesë.",
    "Kabllo nën tokë të dyshuara – kërko verifikim.",
    "Qasje e kufizuar – makineria s’mund të hyjë sot.",
  ] as const;

  function hashToUnit(seed: string) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619;
    // 0..1
    return ((h >>> 0) % 10000) / 10000;
  }

  function pick<T>(arr: readonly T[], seed: string) {
    const idx = Math.floor(hashToUnit(seed) * arr.length) % arr.length;
    return arr[idx];
  }

  function jitter(base: { lat: number; lng: number }, seed: string) {
    const a = hashToUnit(seed + ":a") - 0.5;
    const b = hashToUnit(seed + ":b") - 0.5;
    // ~ +/- 0.002 deg ≈ up to ~200m
    return { lat: base.lat + a * 0.004, lng: base.lng + b * 0.004 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const b of BAUSTELLEN) {
    const baustelle =
      (await prisma.baustelle.findFirst({
        where: { companyProfileId: company.id, name: b.name },
      })) ??
      (await prisma.baustelle.create({
        data: {
          companyProfileId: company.id,
          name: b.name,
          type: b.type,
          status: "active",
          description: `${b.description}\nAdresse: ${b.street}, ${b.zip} ${b.city}`,
          documents: b.docs,
          coordinates: b.base,
        },
      }));

    const existingTrees = await prisma.treeItem.count({ where: { baustelleId: baustelle.id } });
    if (existingTrees === 0) {
      const count = 10 + Math.floor(hashToUnit(b.key + ":count") * 21); // 10..30
      const blockedCount = 1 + Math.floor(hashToUnit(b.key + ":blocked") * 2); // 1..2
      const doneTarget = Math.floor(count * (0.25 + hashToUnit(b.key + ":done") * 0.35)); // ~25..60%

      const startNo = 1000 + Math.floor(hashToUnit(b.key + ":start") * 700); // spread ids
      const blockedIdx = new Set<number>();
      while (blockedIdx.size < blockedCount) blockedIdx.add(Math.floor(hashToUnit(b.key + ":bi:" + blockedIdx.size) * count));

      const trees: Array<{
        treeId: string;
        baustelleId: string;
        species: string;
        diameter: number;
        coordinates: unknown;
        status: "todo" | "done" | "blocked";
        notes?: string;
        completedAt?: Date | null;
        completedBy?: string | null;
      }> = [];

      for (let i = 0; i < count; i++) {
        const treeNo = startNo + i + 1;
        const treeId = `E-${treeNo}`;
        const species = pick(SPECIES, `${b.key}:sp:${i}`);
        const diameter = 18 + Math.floor(hashToUnit(`${b.key}:d:${i}`) * 63); // 18..80
        const coords = jitter(b.base, `${b.key}:gps:${i}`);

        let status: "todo" | "done" | "blocked" = i < doneTarget ? "done" : "todo";
        let notes: string | undefined;

        if (blockedIdx.has(i)) {
          status = "blocked";
          notes = pick(BLOCKED_NOTES, `${b.key}:note:${i}`);
        }

        trees.push({
          treeId,
          baustelleId: baustelle.id,
          species,
          diameter,
          coordinates: coords,
          status,
          notes,
          completedAt: status === "done" ? new Date(today.getTime() + 1000 * 60 * 60) : null,
          completedBy: status === "done" ? worker.id : null,
        });
      }

      await prisma.treeItem.createMany({ data: trees });
    }

    // Always ensure at least one flagged ManualTask exists
    const hasTask = await prisma.manualTask.count({ where: { baustelleId: baustelle.id } });
    if (hasTask === 0) {
      await prisma.manualTask.create({
        data: {
          baustelleId: baustelle.id,
          userId: worker.id,
          description: "Vendosja e tabelave të parkimit",
          isFlagged: true,
        },
      });
    }

    // WorkLog for today (unlocked) and yesterday (should auto-lock in UI)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.workLog.upsert({
      where: { id: `seed-${baustelle.id}-${worker.id}-today` },
      update: {},
      create: {
        id: `seed-${baustelle.id}-${worker.id}-today`,
        userId: worker.id,
        baustelleId: baustelle.id,
        date: today,
        breakMinutes: 30,
        isLocked: false,
        notes: "Demo-WorkLog (heute).",
      },
    });

    await prisma.workLog.upsert({
      where: { id: `seed-${baustelle.id}-${worker.id}-yesterday` },
      update: {},
      create: {
        id: `seed-${baustelle.id}-${worker.id}-yesterday`,
        userId: worker.id,
        baustelleId: baustelle.id,
        date: yesterday,
        breakMinutes: 30,
        isLocked: false,
        notes: "Demo-WorkLog (gestern – sollte auto-locken).",
      },
    });
  }

  // T-026: link any existing (properly hashed) admin users to the seed
  // company so tenancy resolution works. BDF-P1-001: no admin is created
  // here; admins now come from the gated demo bootstrap or BDF-P1-002.
  await prisma.user.updateMany({
    where: {
      role: "ADMIN",
      companyProfileId: null,
    },
    data: { companyProfileId: company.id },
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

