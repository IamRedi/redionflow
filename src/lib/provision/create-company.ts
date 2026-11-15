import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { safeCompanyLogo } from '@/lib/company-logo';
import { regionConfig } from '@/lib/region';
import type { ProvisionCompany } from './company-input';
import { planCompanySetup, type CompanySetupPlan } from './onboarding';

/** Shared record writer: both the legacy provisioner and the clean onboarding path use it. */
export async function createCompanyRecords(tx: Prisma.TransactionClient, c: ProvisionCompany, passwordHash: string,
  setup?: { id: string; plan: CompanySetupPlan }) {
  const region = regionConfig(c.country), language = region.defaultLanguage === 'sq' ? 'SQ' : 'DE';
  const plan = await tx.plan.findUnique({ where: { tier: c.plan }, select: { id: true } });
  if (setup && !plan) throw new Error('PLAN_NOT_CONFIGURED');
  const trialEndsAt = setup ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined;
  const company = await tx.companyProfile.create({ data: {
    ...(setup ? { id: setup.id, setupProfile: setup.plan.profile, setupDigest: setup.plan.digest } : {}),
    displayName: c.displayName, legalName: c.legalName, mode: c.mode, country: c.country,
    vatId: c.vatId, phone: c.phone, email: c.email, street: c.street, zip: c.zip, city: c.city,
    logoDataUrl: safeCompanyLogo(c.logoDataUrl),
    ...(setup ? { trialEndsAt } : {}),
    overheadSettings: { create: { bgkPct: 0.18, agkPct: 0.1, riskPct: 0.03, profitPct: 0.06,
      vatPct: region.defaultVatPct / 100, bgkBase: 'EK_TOTAL', riskProfitMode: 'SEPARATE', applyVatByDefault: true } },
  }, select: { id: true } });
  const owner = await tx.user.create({ data: { email: c.owner.email, name: c.owner.name, role: 'ADMIN', isOwner: true,
    isActive: true, passwordHash, preferredLanguage: language, motherTongue: language, companyProfileId: company.id }, select: { id: true } });
  await tx.subscription.create({ data: { companyProfileId: company.id, planId: plan?.id ?? null, status: setup ? 'trialing' : 'active', ...(setup ? { currentPeriodEnd: trialEndsAt } : {}) } });
  for (const site of c.sites) await tx.baustelle.create({ data: { companyProfileId: company.id, ...site } });
  for (const entry of c.knowledge) await tx.companyKnowledge.create({ data: { companyProfileId: company.id, ...entry } });
  await tx.auditLog.create({ data: { companyProfileId: company.id, actorType: 'SYSTEM', action: 'company.provisioned',
    payload: { ownerUserId: owner.id, plan: c.plan, sites: c.sites.length, knowledge: c.knowledge.length,
      ...(setup ? { blueprint: setup.plan.profile.id, version: setup.plan.profile.version, digest: setup.plan.digest, copiedClientRecords: 0 } : {}) } } });
  return company;
}

/** A new tenant only; never updates an existing company, its modules or owner credentials. */
export async function applyCompanySetup(db: PrismaClient, raw: unknown, expectedDigest: string, passwordHash: string) {
  const plan = planCompanySetup(raw);
  if (plan.digest !== expectedDigest) throw new Error('SETUP_REVIEW_CHANGED');
  if (!passwordHash.startsWith('scrypt$')) throw new Error('HASHED_PASSWORD_REQUIRED');
  const companyId = `company-${plan.input.key}`;
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company-setup:${companyId}`}))`;
    // Different setup keys must not race to create the same visible legal company.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company-name:${plan.input.company.legalName.toLocaleLowerCase('en')}`}))`;
    const existing = await tx.companyProfile.findUnique({ where: { id: companyId }, select: { id: true, setupDigest: true } });
    if (existing) {
      if (existing.setupDigest !== plan.digest) throw new Error('SETUP_KEY_CONFLICT');
      return { companyId, created: false, digest: plan.digest };
    }
    // Never attach a new blueprint to a company discovered by its legal name or owner's email.
    if (await tx.companyProfile.findFirst({ where: { legalName: { equals: plan.input.company.legalName, mode: 'insensitive' } }, select: { id: true } })) throw new Error('COMPANY_ALREADY_EXISTS');
    if (await tx.user.findUnique({ where: { email: plan.input.company.owner.email }, select: { id: true } })) throw new Error('OWNER_ALREADY_EXISTS');
    await createCompanyRecords(tx, plan.input.company, passwordHash, { id: companyId, plan });
    return { companyId, created: true, digest: plan.digest };
  }, { timeout: 15_000 });
}
