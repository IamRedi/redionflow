import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseConnectionString } from "@/lib/db/connection-string";

declare global {
  var __bk_prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: resolveDatabaseConnectionString(),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__bk_prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__bk_prisma = prisma;
}

