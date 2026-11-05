/**
 * Test data for a pilot company, once: one "Muster" worker per crew role,
 * three "Muster" construction sites with ordered material on the factory line
 * and four "Muster" machines, so
 * the office can try the processes before real data arrives.
 *
 *   PILOT_SAMPLES_COMPANY  legal name of the company
 *   PILOT_SAMPLES_CODES    6-digit login codes, comma separated, one per worker
 *                          (workers without a code are skipped)
 *
 * Without both variables it does nothing. Everything it creates carries
 * "Muster" in the name, so it is easy to find and delete. Running it again
 * changes nothing. Remove the variables after the first run.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { initialFactorySteps, type FactoryStep } from "../src/lib/factory/production";
import { type CrewRole } from "../src/lib/workzone/crew-roles";
import { steelPhasesFor } from "../src/lib/workzone/steel-phases";

type Level = "MEISTER" | "VORARBEITER" | "WORKER";

/** One worker per crew role, so every role can be tried. The code at the same index logs them in. */
const WORKERS: Array<{ firstName: string; lastName: string; level: Level; position: string; crewRole: CrewRole }> = [
  { firstName: "Arben", lastName: "Muster", level: "MEISTER", position: "Inxhinier fabrike", crewRole: "FACTORY_ENGINEER" },
  { firstName: "Dritan", lastName: "Muster", level: "VORARBEITER", position: "Inxhinier terreni", crewRole: "FIELD_ENGINEER" },
  { firstName: "Elton", lastName: "Muster", level: "WORKER", position: "Montator", crewRole: "FIELD_WORKER" },
  { firstName: "Besnik", lastName: "Muster", level: "WORKER", position: "Saldator në fabrikë", crewRole: "FACTORY_WORKER" },
  { firstName: "Klea", lastName: "Muster", level: "WORKER", position: "Zyra teknike", crewRole: "OFFICE" },
];

function inMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  date.setHours(12, 0, 0, 0);
  return date;
}

const MACHINES = [
  { name: "Autovinç 50 t (Muster)", category: "OTHER", hourlyRateCents: 1_200_000, model: "Liebherr LTM 1050-3.1", targe: "TR 501 AL", funksioni: "Vinç montimi", patentaEnevojshme: "C + operator vinçi", vitiProdhimit: 2016, tuv: 8, sp: 2, uvv: 5 },
  { name: "Platformë ngritëse 18 m (Muster)", category: "AWP", hourlyRateCents: 350_000, model: "Genie GS-5390", targe: null, funksioni: "Punë në lartësi", patentaEnevojshme: "Trajnim IPAF", vitiProdhimit: 2019, tuv: 11, sp: 6, uvv: -1 },
  { name: "Kamion me vinç (Muster)", category: "TRUCK", hourlyRateCents: 600_000, model: "MAN TGS 26.440 + Palfinger", targe: "AA 744 KT", funksioni: "Transport materiali", patentaEnevojshme: "CE", vitiProdhimit: 2018, tuv: 3, sp: 9, uvv: 7 },
  { name: "Aparat saldimi MIG 400 (Muster)", category: "OTHER", hourlyRateCents: 80_000, model: "Fronius TPS 400i", targe: null, funksioni: "Saldim në kantier", patentaEnevojshme: "Certifikatë saldatori", vitiProdhimit: 2021, tuv: null, sp: null, uvv: 10 },
] as const;

type Batch = { title: string; quantity: number; unit: string; doneSteps: number; activeStep?: boolean };

const SITES: Array<{ name: string; address: string; description: string; doneShare: number; order: string; batches: Batch[] }> = [
  {
    name: "Kapanoni Logjistik Vorë (Muster)",
    address: "Rruga e Industrisë, Vorë, Tiranë",
    description: "Kantier prove. Kapanon 60 × 30 m për magazinim. Klienti: Logjistika Shembull shpk.",
    doneShare: 1,
    order: "M-101",
    batches: [
      { title: "Kolona HEA 300 · aksi A–D", quantity: 12.5, unit: "t", doneSteps: 1, activeStep: true },
      { title: "Kapriata K1–K8", quantity: 9, unit: "t", doneSteps: 0 },
      { title: "Trarë IPE 360 për urën e vinçit", quantity: 6.4, unit: "t", doneSteps: 3, activeStep: true },
    ],
  },
  {
    name: "Ura e Lanës (Muster)",
    address: "Bulevardi Bajram Curri, Tiranë",
    description: "Kantier prove. Urë këmbësorësh 24 m mbi Lanë. Klienti: Bashkia (shembull).",
    doneShare: 0,
    order: "M-102",
    batches: [
      { title: "Trarë kryesorë HEA 400 L=12 m", quantity: 14.2, unit: "t", doneSteps: 2 },
      { title: "Profile parapeti RHS 80×40", quantity: 2.8, unit: "t", doneSteps: 0 },
      { title: "Pllaka ankorimi 500×500", quantity: 24, unit: "pcs", doneSteps: 4 },
    ],
  },
  {
    name: "Hotel Rivera Durrës (Muster)",
    address: "Shëtitorja Taulantia, Durrës",
    description: "Kantier prove. Strukturë metalike 5 kate për hotel. Klienti: Rivera Shembull shpk.",
    doneShare: 2,
    order: "M-103",
    batches: [
      { title: "Kolona HEB 260 · kati 1–3", quantity: 22, unit: "t", doneSteps: 4 },
      { title: "Trarë IPE 300 · soletat", quantity: 16, unit: "t", doneSteps: 1, activeStep: true },
      { title: "Shkallë metalike + parmakë", quantity: 3.1, unit: "t", doneSteps: 0 },
    ],
  },
];

function stepsWith(doneSteps: number, activeStep: boolean | undefined, now: Date): FactoryStep[] {
  return initialFactorySteps().map((step, index) => {
    if (index < doneSteps) return { ...step, status: "done", by: "Arben Muster", at: now.toISOString() };
    if (index === doneSteps && activeStep) return { ...step, status: "active", by: "Arben Muster", at: now.toISOString() };
    return step;
  });
}

export async function runPilotSamples() {
  const legalName = process.env.PILOT_SAMPLES_COMPANY?.trim();
  const codes = (process.env.PILOT_SAMPLES_CODES ?? "").split(",").map((code) => code.trim()).filter((code) => /^\d{6}$/.test(code));
  if (!legalName || codes.length < 3) {
    console.log("[samples] PILOT_SAMPLES_* not set, nothing to do.");
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const company = await prisma.companyProfile.findFirst({ where: { legalName }, select: { id: true } });
    if (!company) {
      console.log(`[samples] company not found, nothing changed.`);
      return;
    }
    const now = new Date();
    let workers = 0;
    let sites = 0;
    let roles = 0;
    let machines = 0;
    for (const [index, w] of WORKERS.entries()) {
      const exists = await prisma.worker.findFirst({
        where: { companyProfileId: company.id, firstName: w.firstName, lastName: w.lastName },
        select: { id: true, crewRole: true },
      });
      if (exists) {
        if (!exists.crewRole) {
          await prisma.worker.update({ where: { id: exists.id }, data: { crewRole: w.crewRole, position: w.position } });
          roles += 1;
        }
        continue;
      }
      const code = codes[index];
      if (!code) continue;
      await prisma.worker.create({
        data: {
          companyProfileId: company.id,
          firstName: w.firstName,
          lastName: w.lastName,
          position: w.position,
          level: w.level,
          crewRole: w.crewRole,
          loginCodeHash: hashPassword(code),
          vacationAllowanceDays: 20,
          preferredLanguage: "SQ",
          motherTongue: "SQ",
          startedAtCompany: now,
        },
      });
      workers += 1;
    }
    for (const s of SITES) {
      const exists = await prisma.baustelle.findFirst({ where: { companyProfileId: company.id, name: s.name }, select: { id: true } });
      if (exists) continue;
      await prisma.$transaction(async (tx) => {
        const site = await tx.baustelle.create({
          data: { companyProfileId: company.id, name: s.name, type: "STEEL_ASSEMBLY", status: "active", address: s.address, description: s.description },
          select: { id: true },
        });
        const phases = steelPhasesFor("STEEL_ASSEMBLY");
        await tx.treeItem.createMany({
          data: phases.map((phase, index) => ({
            baustelleId: site.id,
            treeId: phase.treeId,
            species: phase.key,
            diameter: 0,
            status: index < s.doneShare ? ("done" as const) : ("todo" as const),
            notes: index < s.doneShare ? JSON.stringify({ doneBy: "Dritan Muster" }) : null,
            completedAt: index < s.doneShare ? now : null,
          })),
        });
        for (const b of s.batches) {
          const steps = stepsWith(b.doneSteps, b.activeStep, now);
          const batch = await tx.productionBatch.create({
            data: {
              companyProfileId: company.id,
              baustelleId: site.id,
              title: b.title,
              quantity: b.quantity,
              unit: b.unit,
              steps,
              readyAt: steps.every((step) => step.status === "done") ? now : null,
              createdByName: "Muster",
              orderRef: s.order,
            },
            select: { id: true },
          });
          await tx.productionEvent.create({
            data: { companyProfileId: company.id, batchId: batch.id, action: "create", toStatus: "waiting", note: `Porosi prove ${s.order}`, actorName: "Muster" },
          });
        }
      });
      sites += 1;
    }
    for (const m of MACHINES) {
      const exists = await prisma.machine.findFirst({ where: { companyProfileId: company.id, name: m.name }, select: { id: true } });
      if (exists) continue;
      await prisma.machine.create({
        data: {
          companyProfileId: company.id,
          name: m.name,
          category: m.category,
          hourlyRateCents: m.hourlyRateCents,
          model: m.model,
          targe: m.targe,
          funksioni: m.funksioni,
          patentaEnevojshme: m.patentaEnevojshme,
          vitiProdhimit: m.vitiProdhimit,
          tuvDate: m.tuv === null ? null : inMonths(m.tuv),
          spDate: m.sp === null ? null : inMonths(m.sp),
          uvvDate: m.uvv === null ? null : inMonths(m.uvv),
          notes: "Mjet prove (Muster).",
        },
      });
      machines += 1;
    }
    console.log(`[samples] added ${workers} workers (${roles} roles set), ${sites} sites and ${machines} machines.`);
  } finally {
    await prisma.$disconnect();
  }
}
