import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ worker: { findMany: vi.fn() }, user: { findMany: vi.fn() } }));
vi.mock('@/lib/db/prisma', () => ({ prisma: db }));
import { extractAddressedName, resolveIdentityTarget, resolveIdentityTargetResult } from './identity';
import { findWorkerByName, resolveWorkerByName, startOfLocalDay, endOfLocalDay, workerByNameFilter } from './tools/shared';
import { dayRange } from '@/lib/workzone/date-utils';

const worker = (id: string, firstName = 'Ardit', lastName = 'Laci') => ({ id, firstName, lastName, phone: null, emailAccount: null, aiPersonalityNote: null, preferredLanguage: 'SQ' });
beforeEach(() => { vi.clearAllMocks(); db.worker.findMany.mockResolvedValue([]); db.user.findMany.mockResolvedValue([]); });

it('never selects the first of several workers with the same first name', async () => {
  db.worker.findMany.mockResolvedValue([worker('one'), worker('two', 'Ardit', 'Kola')]);
  expect(await resolveWorkerByName('company-a', 'Ardit')).toMatchObject({ status: 'ambiguous', candidates: [{ id: 'one', name: 'Ardit Laci' }, { id: 'two', name: 'Ardit Kola' }] });
  expect(await findWorkerByName('company-a', 'Ardit')).toBeNull();
});
it('restricts worker matches to the authenticated tenant and uses every full-name word', async () => {
  db.worker.findMany.mockResolvedValue([worker('one', 'John Paul', 'Smith')]);
  expect(await findWorkerByName('company-a', 'John Paul Smith')).toMatchObject({ id: 'one' });
  expect(db.worker.findMany.mock.calls[0][0].where).toEqual(workerByNameFilter('company-a', 'John Paul Smith'));
  expect(workerByNameFilter('company-a', 'John Paul Smith')).toMatchObject({ companyProfileId: 'company-a', OR: expect.arrayContaining([{ firstName: { equals: 'John Paul', mode: 'insensitive' }, lastName: { equals: 'Smith', mode: 'insensitive' } }]) });
});
it('does no directory query for an empty company or worker name', async () => {
  expect(await resolveWorkerByName('', 'Ardit')).toEqual({ status: 'not_found' });
  expect(await resolveWorkerByName('company-a', '   ')).toEqual({ status: 'not_found' });
  expect(db.worker.findMany).not.toHaveBeenCalled();
});
it('scopes both persona types to the current tenant instead of searching all admins', async () => {
  db.user.findMany.mockResolvedValue([{ id: 'admin-one', name: 'Megi Demo', aiPersonalityNote: null, preferredLanguage: 'SQ' }]);
  expect(await resolveIdentityTarget({ companyId: 'company-a', addressedName: 'Megi' })).toMatchObject({ type: 'admin', adminId: 'admin-one' });
  expect(db.user.findMany.mock.calls[0][0].where).toMatchObject({ companyProfileId: 'company-a', role: 'ADMIN', isActive: true });
  expect(db.worker.findMany.mock.calls[0][0].where).toMatchObject({ companyProfileId: 'company-a' });
});
it('asks for disambiguation when a worker and admin share the addressed name', async () => {
  db.worker.findMany.mockResolvedValue([worker('one')]);
  db.user.findMany.mockResolvedValue([{ id: 'admin-one', name: 'Ardit Demo', aiPersonalityNote: null, preferredLanguage: 'SQ' }]);
  expect(await resolveIdentityTargetResult({ companyId: 'company-a', addressedName: 'Ardit' })).toMatchObject({ status: 'ambiguous', candidates: [{ type: 'worker', displayName: 'Ardit Laci' }, { type: 'admin', displayName: 'Ardit Demo' }] });
  expect(await resolveIdentityTarget({ companyId: 'company-a', addressedName: 'Ardit' })).toBeNull();
});
it('recognizes Albanian names without treating an incidental greeting as persona selection', () => {
  expect(extractAddressedName('Hej Çlirim, ku je?')).toBe('Çlirim');
  expect(extractAddressedName('Përshëndetje, Ëndri')).toBe('Ëndri');
  expect(extractAddressedName('Raporti thotë hej Ardit')).toBeNull();
});
it('rejects normalized and trailing-junk dates in legacy calendar-key lookups', () => {
  expect(startOfLocalDay('2026-02-30')).toBeNull();
  expect(startOfLocalDay('2026-11-01-extra')).toBeNull();
});
it('uses the same daily-plan key as the UI even when the server clock is UTC', () => {
  const day = startOfLocalDay('2026-11-05', 'Europe/Tirane')!;
  expect(day).toEqual(dayRange('2026-11-05').start);
  expect(day.toISOString()).toBe('2026-11-04T23:00:00.000Z');
  expect(endOfLocalDay(day, 'Europe/Tirane').toISOString()).toBe('2026-11-05T22:59:59.999Z');
});
