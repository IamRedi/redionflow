import { expect, it } from 'vitest';
import { isMutationRequest, observeBuildVersion, UPDATE_RELOAD_WINDOW_MS, updateReloadAllowed, validBuildVersion } from './update-policy';
import { hasAppUpdateBlockers, holdAppUpdate } from './update-activity';

it('requires the same other release twice and resets on the current or malformed version', () => {
  expect(observeBuildVersion('old', null, 'new')).toEqual({ candidate: 'new', ready: false });
  expect(observeBuildVersion('old', 'new', 'new')).toEqual({ candidate: 'new', ready: true });
  expect(observeBuildVersion('old', 'new', 'third')).toEqual({ candidate: 'third', ready: false });
  for (const invalid of [null, {}, '', '<html>', 'x'.repeat(129), 'old']) expect(observeBuildVersion('old', 'new', invalid)).toEqual({ candidate: null, ready: false });
  expect(validBuildVersion('build-1_2')).toBe(true);
});

it('bounds refreshes across rollbacks and alternating hosts, not just one target', () => {
  const at = 1_000_000, raw = JSON.stringify({ version: 'new', at });
  expect(updateReloadAllowed(null, 'new', at)).toBe(true);
  expect(updateReloadAllowed(raw, 'new', at + 30_000)).toBe(false);
  expect(updateReloadAllowed(raw, 'other-host', at + 30_000)).toBe(false);
  expect(updateReloadAllowed(raw, 'new', at + UPDATE_RELOAD_WINDOW_MS)).toBe(true);
  expect(updateReloadAllowed(raw, 'new', at - 1)).toBe(false);
  expect(updateReloadAllowed('invalid json', 'new', at)).toBe(true);
  expect(updateReloadAllowed(null, '../invalid', at)).toBe(false);
});

it('tracks only same-origin writes without reading request bodies or changing them', async () => {
  const origin = 'https://example.test';
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(isMutationRequest('/save', { method }, origin)).toBe(true);
  for (const method of ['GET', 'HEAD', 'OPTIONS']) expect(isMutationRequest('/save', { method }, origin)).toBe(false);
  expect(isMutationRequest('https://other.test/save', { method: 'POST' }, origin)).toBe(false);
  const request = new Request(`${origin}/save`, { method: 'POST', body: 'private draft' });
  expect(isMutationRequest(request, undefined, origin)).toBe(true);
  expect(isMutationRequest(request, { method: 'GET' }, origin)).toBe(false);
  expect(await request.text()).toBe('private draft');
});

it('holds React-only work until all owners release it, with idempotent cleanup', () => {
  const a = holdAppUpdate(), b = holdAppUpdate();
  expect(hasAppUpdateBlockers()).toBe(true); a(); a();
  expect(hasAppUpdateBlockers()).toBe(true); b();
  expect(hasAppUpdateBlockers()).toBe(false);
});
