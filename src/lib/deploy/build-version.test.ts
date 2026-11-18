import { afterEach, expect, it, vi } from 'vitest';
const read = vi.hoisted(() => vi.fn());
vi.mock('node:fs', () => ({ readFileSync: read }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); read.mockReset(); });

it('exposes only a bounded public production build ID and memoizes the local read', async () => {
  vi.stubEnv('NODE_ENV', 'production'); read.mockReturnValue('public-build_123\n');
  const { appBuildVersion } = await import('./build-version');
  expect(appBuildVersion()).toBe('public-build_123'); expect(appBuildVersion()).toBe('public-build_123');
  expect(read).toHaveBeenCalledTimes(1);
});
it('stays disabled for dev and does not turn a missing or malformed file into an update', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect((await import('./build-version')).appBuildVersion()).toBeNull(); expect(read).not.toHaveBeenCalled();
  vi.resetModules(); vi.stubEnv('NODE_ENV', 'production'); read.mockImplementation(() => { throw Error('missing'); });
  expect((await import('./build-version')).appBuildVersion()).toBeNull();
  vi.resetModules(); read.mockReturnValue('not/a/version');
  expect((await import('./build-version')).appBuildVersion()).toBeNull();
});
it('serves an uncached version probe without auth, tenant, customer or credential fields', async () => {
  vi.stubEnv('NODE_ENV', 'production'); read.mockReturnValue('public-release');
  const { GET } = await import('@/app/api/app-version/route');
  const response = GET();
  expect(await response.json()).toEqual({ version: 'public-release' });
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('cdn-cache-control')).toBe('no-store');
  expect(response.headers.has('set-cookie')).toBe(false);
});
