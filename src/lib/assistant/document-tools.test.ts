import { beforeEach, expect, it, vi } from 'vitest';
import type { RequesterContext } from './requester';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/lib/site-phase-documents/access', () => ({ documentActor: mocks.actor }));
import { adminGetSitePhaseDocuments, adminGetSitePhaseDocumentReceipts } from './document-tools';
const requester: RequesterContext = { kind: 'admin', companyId: 'tenant-a', adminId: 'admin-a', preferredLanguage: 'SQ', displayName: 'Synthetic chief' };
const actor = { companyId: 'tenant-a', userId: 'admin-a', workerId: null, name: 'Synthetic chief', office: true };
const tx = { $executeRaw: vi.fn(), user: { findFirst: vi.fn() }, companyProfile: { findUnique: vi.fn() },
  baustelle: { findMany: vi.fn() }, sitePhaseDocument: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.actor.mockResolvedValue(actor); mocks.transaction.mockImplementation(fn => fn(tx));
  tx.user.findFirst.mockResolvedValue({ id: 'admin-a' }); tx.companyProfile.findUnique.mockResolvedValue({ country: 'AL' });
  tx.baustelle.findMany.mockResolvedValue([{ id: 'site-a', name: 'Synthetic site' }]);
  tx.sitePhaseDocument.count.mockResolvedValue(0); tx.sitePhaseDocument.groupBy.mockResolvedValue([]); tx.sitePhaseDocument.findMany.mockResolvedValue([]);
});
it.each(['worker', 'anonymous'] as const)('denies %s before any private read', async kind => {
  const who = kind === 'worker' ? { kind, workerId: 'worker-a', companyId: 'tenant-a', preferredLanguage: 'SQ' as const, displayName: 'Synthetic' }
    : { kind, companyId: 'tenant-a', preferredLanguage: 'SQ' as const, displayName: 'Synthetic' };
  expect(await adminGetSitePhaseDocuments(who, { projectId: 'site-a' })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  expect(mocks.actor).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
});
it.each([{ companyId: 'foreign' }, { userId: 'different' }, { workerId: 'worker-a' }, { office: false }])('refuses a mismatched or mixed fresh identity: %j', async change => {
  mocks.actor.mockResolvedValue({ ...actor, ...change });
  expect(await adminGetSitePhaseDocuments(requester, { projectId: 'site-a' })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it('rechecks current administrator membership inside the repeatable-read tenant snapshot', async () => {
  tx.user.findFirst.mockResolvedValue(null);
  expect(await adminGetSitePhaseDocuments(requester, { projectId: 'site-a' })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  expect(tx.baustelle.findMany).not.toHaveBeenCalled();
  expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'RepeatableRead' }));
});
it('uses only bounded metadata selects and labels a genuinely empty current-document query', async () => {
  expect(await adminGetSitePhaseDocuments(requester, { projectId: 'site-a', query: '' })).toMatchObject({ ok: true, totalMatching: 0, complete: true, documents: [], readOnly: true, timeZone: 'Europe/Tirane' });
  const query = tx.sitePhaseDocument.findMany.mock.calls[0][0];
  expect(query).toMatchObject({ where: { companyProfileId: 'tenant-a', baustelleId: 'site-a', archivedAt: null }, take: 9 });
  expect(JSON.stringify(query.select)).not.toMatch(/dataBytes|sha256|password|loginCode/);
});
it('does not turn query failures or raw exception text into empty business facts', async () => {
  tx.sitePhaseDocument.findMany.mockRejectedValue(new Error('PRIVATE_DATABASE_URL_DO_NOT_EXPORT'));
  const result = await adminGetSitePhaseDocuments(requester, { projectId: 'site-a' });
  expect(result).toMatchObject({ ok: false, code: 'DATA_UNAVAILABLE' });
  expect(JSON.stringify(result)).not.toContain('PRIVATE_DATABASE_URL');
});
it('rejects unbounded/forged arguments and unknown document IDs without other tenant reads', async () => {
  expect(await adminGetSitePhaseDocuments(requester, { projectId: 'site-a', limit: 21 })).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
  expect(await adminGetSitePhaseDocuments(requester, { projectId: 'site-a', companyProfileId: 'foreign' } as never)).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
  expect(await adminGetSitePhaseDocumentReceipts(requester, { documentId: 'guessed-id' })).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
  expect(mocks.actor).not.toHaveBeenCalled();
  tx.sitePhaseDocument.findFirst.mockResolvedValue(null);
  expect(await adminGetSitePhaseDocumentReceipts(requester, { documentId: '60000000-0000-4000-8000-000000000001' })).toMatchObject({ ok: false, code: 'DOCUMENT_NOT_FOUND' });
});
