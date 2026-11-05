import { afterEach, expect, it, vi } from 'vitest';
import { encryptionReady, seal, unseal } from './crypto';

afterEach(() => vi.unstubAllEnvs());
function setup() {
  vi.stubEnv('WANWAY_ACTIVE_KEY_ID', 'test');
  vi.stubEnv(
    'WANWAY_ENCRYPTION_KEYS',
    JSON.stringify({ test: 'a1'.repeat(32) }),
  );
}
it('fails closed without a valid independent keyring', () => {
  vi.stubEnv('WANWAY_ENCRYPTION_KEYS', '{}');
  vi.stubEnv('WANWAY_ACTIVE_KEY_ID', '');
  expect(encryptionReady()).toBe(false);
  expect(() => seal('synthetic', 'tenant-a', 'key')).toThrow('WANWAY_KEYRING');
});
it('uses randomized authenticated encryption bound to tenant and purpose', () => {
  setup();
  const value = seal('synthetic-key', 'tenant-a', 'key');
  expect(value).not.toContain('synthetic-key');
  expect(seal('synthetic-key', 'tenant-a', 'key')).not.toBe(value);
  expect(unseal(value, 'tenant-a', 'key')).toBe('synthetic-key');
  expect(() => unseal(value, 'tenant-b', 'key')).toThrow();
  expect(() => unseal(value, 'tenant-a', 'token')).toThrow();
  const pieces = value.split('.');
  pieces[4] = Buffer.from('modified-ciphertext').toString('base64url');
  expect(() => unseal(pieces.join('.'), 'tenant-a', 'key')).toThrow();
});
it('reads previous key IDs during rotation while writing with the active key', () => {
  setup();
  const old = seal('synthetic', 'tenant-a', 'key');
  vi.stubEnv('WANWAY_ACTIVE_KEY_ID', 'next');
  vi.stubEnv(
    'WANWAY_ENCRYPTION_KEYS',
    JSON.stringify({ test: 'a1'.repeat(32), next: 'b2'.repeat(32) }),
  );
  expect(unseal(old, 'tenant-a', 'key')).toBe('synthetic');
  expect(seal('synthetic', 'tenant-a', 'key')).toMatch(/^v1.next\./);
});
