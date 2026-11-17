import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ identity: vi.fn(), snapshot: vi.fn(), command: vi.fn() }));
vi.mock('@/lib/company-chat/identity', () => ({ companyChatIdentity: api.identity }));
vi.mock('@/lib/company-chat/service', () => ({ companyChatSnapshot: api.snapshot, applyCompanyChatCommand: api.command }));
import { GET, POST } from './route';
import { ChatError } from '@/lib/company-chat/contract';
const actor = { companyId: 'fictional', key: 'worker:demo', name: 'Crew Demo', demo: false };
const input = () => ({ type: 'send', actorKey: actor.key, requestId: randomUUID(), body: 'Synthetic text' });
function post(value: unknown, origin = 'https://fixture.example') {
  return POST(new Request('http://fixture.example/api/company-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Host: 'fixture.example', Origin: origin }, body: JSON.stringify(value) }));
}
beforeEach(() => { vi.clearAllMocks(); api.identity.mockResolvedValue(actor); api.command.mockResolvedValue({ created: true }); api.snapshot.mockResolvedValue({ actor, messages: [], unread: 0 }); });
it('rejects anonymous or disabled installations and never reaches chat storage', async () => {
  api.identity.mockResolvedValue(null);
  expect((await GET(new Request('https://fixture.example/api/company-chat'))).status).toBe(404);
  expect((await post(input())).status).toBe(404);
  expect(api.snapshot).not.toHaveBeenCalled(); expect(api.command).not.toHaveBeenCalled();
});
it('never reads a restricted demo persona through the unscoped ordinary endpoint', async () => {
  expect((await GET(new Request('https://fixture.example/api/company-chat?demo=1'))).status).toBe(404);
  expect(api.identity).not.toHaveBeenCalled(); expect(api.snapshot).not.toHaveBeenCalled();
});
it('accepts same browser host across HTTPS termination, rejects missing, foreign and malformed origins', async () => {
  expect((await post(input())).status).toBe(200);
  for (const origin of ['', 'null', 'https://other.example', 'https://fixture.example:123', 'file://fixture.example']) expect((await post(input(), origin)).status).toBe(403);
  expect(api.command).toHaveBeenCalledTimes(1);
});
it('prevents caller-controlled author, tenant, unsafe body and read cursor inputs', async () => {
  for (const body of [{ ...input(), authorName: 'Spoof' }, { ...input(), companyId: 'foreign' }, { ...input(), body: '\u0000' }, { type: 'read', actorKey: actor.key, through: '9223372036854775808' }]) expect((await post(body)).status).toBe(400);
  expect((await GET(new Request('https://fixture.example/api/company-chat?before=1.5'))).status).toBe(400);
  expect(api.command).not.toHaveBeenCalled(); expect(api.snapshot).not.toHaveBeenCalled();
});
it('keeps responses private and no-store, uses server identity and hides internal errors', async () => {
  const request = new Request('https://fixture.example/api/company-chat?summary=1&before=0');
  const response = await GET(request);
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie');
  expect(api.snapshot).toHaveBeenCalledWith(actor, { summary: true, before: BigInt(0) });
  api.command.mockRejectedValueOnce(new ChatError('profile', 409)); expect((await post(input())).status).toBe(409);
  api.command.mockRejectedValueOnce(new Error('Internal database detail'));
  const failed = await post(input()); expect(failed.status).toBe(503); expect(await failed.json()).toEqual({ error: 'unavailable' });
});
