import { expect, type Page } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { hashPassword } from '../../src/lib/auth/password';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { INITIAL_OFFICE_CATEGORIES } from '../../src/lib/offices/work-policy';

/** Each office scenario owns its prerequisites instead of depending on file
 * order, a previous successful test, or an operator's manually seeded DB. */
export async function seedOfficeE2E() {
  assertE2ETestDatabase(process.env);
  const companyId = 'office-e2e-company';
  await prisma.companyProfile.upsert({ where: { id: companyId }, update: { mode: 'bau', country: 'AL' }, create: { id: companyId, displayName: 'Office Studio · DEMO', legalName: 'Synthetic local only', mode: 'bau', country: 'AL' } });
  await prisma.companyProfile.upsert({ where: { id: 'office-e2e-other-company' }, update: {}, create: { id: 'office-e2e-other-company', displayName: 'Other · DEMO', legalName: 'Synthetic only', mode: 'bau' } });
  for (const [id, name, tenant] of [['office-e2e-megi','Megi Demo',companyId], ['office-e2e-almet','Almet Demo',companyId], ['office-e2e-other','Other Admin',companyId], ['office-e2e-foreign','Foreign Demo','office-e2e-other-company']]) {
    const data = { name, email: `${id}@example.test`, companyProfileId: tenant, role: 'ADMIN' as const, isActive: true, passwordHash: hashPassword('synthetic-only-unused') };
    await prisma.user.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  for (const [id, firstName] of [['office-e2e-worker-megi','Megi'], ['office-team-demo-worker','Lea']]) {
    const data = { companyProfileId: companyId, firstName, lastName: 'Demo', status: 'active', availability: 'AVAILABLE' as const, crewRole: 'OFFICE' as const };
    await prisma.worker.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  const member = { companyProfileId: companyId, workerId: 'office-team-demo-worker', title: 'Projektim · DEMO', enabled: true, workbooksEnabled: false, assistantEnabled: false, workProfile: 'GENERAL' as const };
  await prisma.officeMember.upsert({ where: { companyProfileId_workerId: { companyProfileId: companyId, workerId: member.workerId } }, update: member, create: member });
  await prisma.baustelle.upsert({ where: { id: 'office-e2e-factory' }, update: {}, create: { id: 'office-e2e-factory', companyProfileId: companyId, name: 'Factory · DEMO', type: 'STEEL_WORKSHOP' } });
  for (const name of INITIAL_OFFICE_CATEGORIES) await prisma.officeCategory.upsert({ where: { companyProfileId_name: { companyProfileId: companyId, name } }, update: { archivedAt: null }, create: { companyProfileId: companyId, name } });
}

/** Owner-PIN scenarios must use the configured disposable installation. A
 * different tenant's PIN is intentionally rejected by the production policy. */
export async function signInSyntheticInstallationOwner(page: Page) {
  assertE2ETestDatabase(process.env);
  const companyId = 'office-e2e-company';
  if (process.env.INSTALLATION_COMPANY_ID !== companyId) throw new Error('Synthetic installation mismatch');
  await seedOfficeE2E();
  await prisma.user.update({ where: { id: 'office-e2e-megi' }, data: { isOwner: true } });
  await page.goto('/login');
  await page.locator('input[name=email]').fill('office-e2e-megi@example.test');
  await page.locator('input[name=password]').fill('synthetic-only-unused');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  return companyId;
}
