import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { assertResetAllowed } from "./env-guard";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const adapter = new PrismaPg({
  connectionString: resolveDatabaseConnectionString() ?? requireEnv("DATABASE_URL"),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  assertResetAllowed("reset-cones-data");

  const company =
    (await prisma.companyProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true },
    })) ?? null;

  if (!company) {
    console.log("No company found. Nothing to reset.");
    return;
  }

  console.log(`Resetting cones data for company: ${company.displayName} (${company.id})`);

  await prisma.$transaction(async (tx) => {
    await tx.machineConeMovement.deleteMany({ where: { companyProfileId: company.id } });
    await tx.machine.updateMany({ where: { companyProfileId: company.id }, data: { coneTotal: 0 } });
  });

  console.log("Done. Cone history cleared and Machine.coneTotal reset to 0.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

