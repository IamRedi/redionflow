/** Explicit operator recovery for an expired private import journal. No scheduler. */
import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { reconcilePendingImport } from "../src/lib/storage/object-storage";

const id = process.argv[2];
if (!id || !/^[0-9a-f-]{36}$/i.test(id) || process.argv.length !== 3) {
  console.error("Usage: npx tsx scripts/reconcile-import.ts <pending-import-uuid>");
  process.exitCode = 1;
} else {
  try {
    await reconcilePendingImport(id, async (companyProfileId, entityId) => {
      const site = await prisma.baustelle.findFirst({ where: { id: entityId, companyProfileId }, select: { documents: true } });
      return site?.documents ?? [];
    });
    console.log("Import reconciliation completed", id);
  } catch (error) {
    console.error("Import reconciliation failed; journal retained for retry", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
