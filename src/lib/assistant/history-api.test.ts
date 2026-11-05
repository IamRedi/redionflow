import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ role: 'admin', read: vi.fn() }));
vi.mock('./requester', () => ({ getRequesterContext: async () => ({ kind: state.role, adminId: 'admin-demo', companyId: 'company-demo' }) }));
vi.mock('./history', () => ({ AssistantHistoryError: class extends Error { constructor(readonly status: number, readonly code: string) { super(code); } } }));
import { assistantHistoryPage, assistantHistoryRead } from './history-api';
import { AssistantHistoryError } from './history';
beforeEach(() => { state.role = 'admin'; state.read = vi.fn(async () => ({ conversations: [] })); });
it.each(['anonymous', 'worker'])('denies %s before archive access', async role => {
  state.role = role;
  expect((await assistantHistoryRead(state.read)).status).toBe(403);
  expect(state.read).not.toHaveBeenCalled();
});
it('binds reads to the authenticated admin and never caches private history', async () => {
  const response = await assistantHistoryRead(state.read);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('vary')).toBe('Cookie');
  expect(state.read).toHaveBeenCalledWith({ kind: 'admin', adminId: 'admin-demo', companyId: 'company-demo' });
});
it('hides database failures and returns the same missing-history result for a foreign owner', async () => {
  state.read.mockRejectedValueOnce(new AssistantHistoryError(404, 'HISTORY_NOT_FOUND'));
  const missing = await assistantHistoryRead(state.read);
  expect(missing.status).toBe(404);
  state.read.mockRejectedValueOnce(Error('postgresql://private:secret@internal/db'));
  const unavailable = await assistantHistoryRead(state.read);
  expect(unavailable.status).toBe(503); expect(await unavailable.text()).not.toContain('secret');
});
it('bounds page size independently of client input', () => {
  expect(assistantHistoryPage(new Request('https://example.test/?cursor=old&limit=50'), 10)).toEqual({ cursor: 'old', limit: 50 });
  expect(assistantHistoryPage(new Request('https://example.test/'), 10)).toEqual({ cursor: undefined, limit: 10 });
  for (const limit of ['0', '51', '1.5', '-1', 'Infinity', '0001']) expect(() => assistantHistoryPage(new Request(`https://example.test/?limit=${limit}`), 10)).toThrow();
});
