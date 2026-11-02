/**
 * Test data for a pilot company, once: three "Muster" workers and three
 * "Muster" construction sites with ordered material on the factory line, so
 * the office can try the processes before real data arrives.
 *
 *   PILOT_SAMPLES_COMPANY  legal name of the company
 *   PILOT_SAMPLES_CODES    three 6-digit login codes, comma separated
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
import { steelPhasesFor } from "../src/lib/workzone/steel-phases";

type Level = "MEISTER" | "VORARBEITER" | "WORKER";

const WORKERS: Array<{ firstName: string; lastName: string; level: Level; position: string }> = [
  { firstName: "Arben", lastName: "Muster", level: "MEISTER", position: "Përgjegjës prodhimi" },
  { firstName: "Dritan", lastName: "Muster", level: "VORARBEITER", position: "Kryepunëtor montimi" },
  { firstName: "Elton", lastName: "Muster", level: "WORKER", position: "Saldator" },
];

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
  if (!legalName || codes.length < WORKERS.length) {
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
    for (const [index, w] of WORKERS.entries()) {
      const exists = await prisma.worker.findFirst({ where: { companyProfileId: company.id, firstName: w.firstName, lastName: w.lastName }, select: { id: true } });
      if (exists) continue;
      await prisma.worker.create({
        data: {
          companyProfileId: company.id,
          firstName: w.firstName,
          lastName: w.lastName,
          position: w.position,
          level: w.level,
          loginCodeHash: hashPassword(codes[index]!),
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
    console.log(`[samples] added ${workers} workers and ${sites} sites.`);
  } finally {
    await prisma.$disconnect();
  }
}
