import { assertWorkshopSeedEnv } from "./lib/workshop-fixture-env";
assertWorkshopSeedEnv(process.env);
const { prisma } = await import("../src/lib/db/prisma");
try {
  if (await prisma.companyProfile.count() !== 0) throw new Error("Non-empty fixture; existing data preserved");
  const company = await prisma.companyProfile.create({ data: { legalName: "Baumdienst Musterstadt GmbH", displayName: "Baumdienst Musterstadt GmbH", country: "DE", mode: "baumdienst" } });
  await prisma.worker.create({ data: { companyProfileId: company.id, firstName: "DEMO", lastName: "Musterarbeiter" } });
  await prisma.baustelle.create({ data: { companyProfileId: company.id, name: "DEMO Musterbaustelle", address: "Fiktive Testadresse", documents: [] } });
  console.log("Dedicated synthetic workshop company created");
} finally { await prisma.$disconnect(); }
