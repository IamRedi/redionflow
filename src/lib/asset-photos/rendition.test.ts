import { expect, it } from 'vitest';
import { photoSrcSet, photoWidth, photoShape } from './rendition';

it('bounds preview work and leaves original requests as original', () => {
  expect(photoWidth('192')).toBe(192);
  expect(photoShape('square')).toBe('square');
  expect(photoShape('4x3')).toBe('4x3');
  expect(photoShape('6x5')).toBe('6x5');
  expect(photoShape('999x1')).toBeNull();
  for (const value of [null, '', '0', '-1', '191', '192.0', '384', '768', '999999', '192junk']) expect(photoWidth(value)).toBeNull();
});
it('preserves photo version changes, original fallback and opaque external URLs', () => {
  const src='/api/asset-photos/worker/demo-worker?v=123';
  expect(photoSrcSet(src)).toContain(`${src}&w=192&shape=square 192w`);
  expect(photoSrcSet(src)?.endsWith(`${src} 1024w`)).toBe(true);
  expect(photoSrcSet(src.replace('123','456'))).not.toContain('v=123');
  for (const value of ['https://example.test/photo.webp', 'data:image/webp;base64,AA', '//example.test/api/asset-photos/worker/demo', '/api/fuel-receipts/abc', '/api/asset-photos/worker/../secret']) expect(photoSrcSet(value)).toBeUndefined();
});
