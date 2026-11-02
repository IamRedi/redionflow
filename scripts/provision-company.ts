/**
 * Create one real customer company on the SaaS platform, once.
 *
 *   PROVISION_COMPANY_JSON   company, owner and first sites (see src/lib/provision/company-input.ts)
 *   PROVISION_OWNER_PASSWORD first password of the owner admin (12+ characters)
 *
 * Without PROVISION_COMPANY_JSON the script does nothing, so it can sit in the
 * start command. When a company with the same legal name already exists it
 * changes nothing. Remove both variables after the first successful run.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { hashPassword } from "../src/lib/auth/password";
import { safeCompanyLogo } from "../src/lib/company-logo";
import { regionConfig } from "../src/lib/region";
import { parseProvisionInput } from "../src/lib/provision/company-input";

async function main() {
  const input = parseProvisionInput(process.env.PROVISION_COMPANY_JSON, process.env.PROVISION_OWNER_PASSWORD);
  if (!input) {
    console.log("[provision] PROVISION_COMPANY_JSON not set, nothing to do.");
    return;
  }
  const { company: c, ownerPassword } = input;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const existing = await prisma.companyProfile.findFirst({ where: { legalName: c.legalName }, select: { id: true } });
    if (existing) {
      console.log(`[provision] ${c.legalName} already exists (${existing.id}), nothing changed.`);
      return;
    }
    const ownerTaken = await prisma.user.findUnique({ where: { email: c.owner.email }, select: { id: true } });
    if (ownerTaken) throw new Error(`Owner e-mail ${c.owner.email} is already used by another account.`);

    const region = regionConfig(c.country);
    const language = region.defaultLanguage === "sq" ? "SQ" : "DE";
    const plan = await prisma.plan.findUnique({ where: { tier: c.plan }, select: { id: true } });

    const created = await prisma.$transaction(async (tx) => {
      const company = await tx.companyProfile.create({
        data: {
          displayName: c.displayName,
          legalName: c.legalName,
          mode: c.mode,
          country: c.country,
          vatId: c.vatId,
          phone: c.phone,
          email: c.email,
          street: c.street,
          zip: c.zip,
          city: c.city,
          logoDataUrl: safeCompanyLogo(c.logoDataUrl),
          overheadSettings: {
            create: {
              bgkPct: 0.18,
              agkPct: 0.1,
              riskPct: 0.03,
              profitPct: 0.06,
              vatPct: region.defaultVatPct / 100,
              bgkBase: "EK_TOTAL",
              riskProfitMode: "SEPARATE",
              applyVatByDefault: true,
            },
          },
        },
        select: { id: true },
      });
      const owner = await tx.user.create({
        data: {
          email: c.owner.email,
          name: c.owner.name,
          role: "ADMIN",
          isOwner: true,
          isActive: true,
          passwordHash: hashPassword(ownerPassword),
          preferredLanguage: language,
          motherTongue: language,
          companyProfileId: company.id,
        },
        select: { id: true },
      });
      await tx.subscription.create({
        data: { companyProfileId: company.id, planId: plan?.id ?? null, status: "active" },
      });
      for (const site of c.sites) {
        await tx.baustelle.create({
          data: {
            companyProfileId: company.id,
            name: site.name,
            type: site.type,
            status: site.status,
            address: site.address,
            description: site.description,
          },
        });
      }
      for (const entry of c.knowledge) {
        await tx.companyKnowledge.create({
          data: { companyProfileId: company.id, key: entry.key, language: entry.language, title: entry.title, content: entry.content, tags: entry.tags },
        });
      }
      await tx.auditLog.create({
        data: {
          companyProfileId: company.id,
          actorType: "SYSTEM",
          action: "company.provisioned",
          payload: { ownerUserId: owner.id, plan: c.plan, sites: c.sites.length, knowledge: c.knowledge.length },
        },
      });
      return company;
    });
    console.log(`[provision] created ${c.displayName} (${created.id}) with owner ${c.owner.email} and ${c.sites.length} sites.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Never block the app start: log and continue.
  console.error("[provision] failed:", error instanceof Error ? error.message : error);
});
