import { prisma } from "../../src/lib/db/prisma";
import { DEMO_WORKSPACE_KEY } from "../../src/lib/workshop/shared-store";

export async function resetWorkshopFixture() {
  const url = new URL(process.env.DATABASE_URL ?? "http://not-a-fixture");
  if (url.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55435" || url.pathname !== "/baumdemo_test") throw new Error("Shared workshop tests require the dedicated disposable loopback fixture.");
  const companies = await prisma.companyProfile.findMany({ select: { mode: true, displayName: true } });
  if (companies.length !== 1 || companies[0].mode !== "baumdienst" || companies[0].displayName !== "Baumdienst Musterstadt GmbH") throw new Error("Unexpected fixture company");
  // Only this new demo store is cleared; source/pilot/customer data is unreachable.
  await prisma.baumdienstDemoWorkspace.deleteMany({ where: { key: DEMO_WORKSPACE_KEY } });
  await prisma.baumdienstDemoWorkspace.deleteMany({ where: { key: "baumdienst-media:v1" } });
}
export { prisma };
