import type { Prisma } from '@/generated/prisma/client';
import { factoryEnabled, readBlueprint } from './blueprints';

/** Must run in a transaction already bound to the authenticated tenant. No first-company fallback. */
export async function companyBlueprint(tx: Prisma.TransactionClient, companyId: string) {
  const company = await tx.companyProfile.findUnique({ where: { id: companyId }, select: { setupProfile: true, mode: true } });
  if (!company) throw new Error('COMPANY_NOT_FOUND');
  const profile = readBlueprint(company.setupProfile);
  if (profile && profile.mode !== company.mode) throw new Error('BLUEPRINT_MODE_MISMATCH');
  return profile;
}
export async function companyFactoryEnabled(tx: Prisma.TransactionClient, companyId: string) {
  return factoryEnabled(await companyBlueprint(tx, companyId));
}
