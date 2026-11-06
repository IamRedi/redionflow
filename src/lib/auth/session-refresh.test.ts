import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ token: '', identity: null as null | { id: string; companyProfileId: string; kind: 'admin' | 'worker' } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
vi.mock('@/lib/auth/pilot-session', () => ({ resolvePilotIdentity: async () => state.identity }));
import { POST } from '@/app/api/session/refresh/route';
import { createSessionCookie, readSessionCookie, sessionMaxAge } from './session-cookie';

const day = 24 * 60 * 60 * 1000;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T00:00:00Z')); vi.stubEnv('SESSION_SIGNING_SECRET', 'synthetic-test-signing-key-only-123456789'); state.identity = null; state.token = ''; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const request = (origin = 'http://localhost') => new Request('http://localhost/api/session/refresh', { method: 'POST', headers: { origin } });
it.each(['admin', 'worker'] as const)('keeps %s login persistent and renews only after fresh account validation', async kind => {
  state.identity = { kind, id: 'synthetic-account', companyProfileId: 'synthetic-company' };
  state.token = await createSessionCookie(kind, state.identity.id, 7);
  expect(readSessionCookie(state.token, kind)?.expiresAt).toBe(Date.now() + 365 * day);
  expect((await POST(request())).headers.has('set-cookie')).toBe(false);
  vi.advanceTimersByTime(32 * day);
  expect(readSessionCookie(state.token, kind)).not.toBeNull();
  const response = await POST(request()), cookie = response.headers.get('set-cookie')!;
  expect(response.status).toBe(204);
  expect(cookie).toContain(`bk_${kind}_id=`);
  expect(cookie).toContain(`Max-Age=${sessionMaxAge(kind)}`);
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=lax/i);
  const renewed = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
  expect(readSessionCookie(renewed, kind)).toMatchObject({ id: state.identity.id, epoch: 7, expiresAt: Date.now() + 365 * day });
  state.identity = null; // inactive, revoked, mixed or absent verified identity
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request())).headers.has('set-cookie')).toBe(false);
});
it('rejects cross-origin refresh, tampering and expired tokens, without extending display accounts', async () => {
  expect((await POST(request('https://foreign.example'))).status).toBe(403);
  state.identity = { kind: 'admin', id: 'synthetic-account', companyProfileId: 'synthetic-company' };
  state.token = 'forged';
  expect((await POST(request())).status).toBe(401);
  state.token = await createSessionCookie('admin', state.identity.id, 0);
  vi.advanceTimersByTime(366 * day);
  expect((await POST(request())).status).toBe(401);
  const display = await createSessionCookie('display', 'synthetic-display', 0);
  vi.advanceTimersByTime(31 * day);
  expect(readSessionCookie(display, 'display')).toBeNull();
});
