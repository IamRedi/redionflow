import { expect,it } from 'vitest';
import { generateAssetLabelCode, normalizeScanCode, scanCodeCandidates, scanCodeKey, validScanCode } from './scan-code';
it('preserves exact factory QR payloads instead of applying Code39 normalization',()=>{
  const value='https://factory.example.test/a/B?serial=00-ab&part=Drill_7';
  expect(normalizeScanCode(` ${value} `)).toBe(value);expect(scanCodeKey(value)).not.toBe(scanCodeKey(value.toUpperCase()));
  expect(validScanCode(value)).toBe(true);expect(validScanCode('a\0b')).toBe(false);expect(validScanCode('x'.repeat(2049))).toBe(false);
  const gs1='0101234567890128\u001d21AbC_123';expect(validScanCode(gs1)).toBe(true);expect(scanCodeKey(gs1)).toBe(`raw:${gs1}`);
});
it('equates checksum-valid UPC/EAN variants without guessing arbitrary numeric identities',()=>{
  expect(scanCodeKey('012345678905')).toBe(scanCodeKey('0012345678905'));
  expect(scanCodeCandidates('0012345678905')).toContain('012345678905');
  expect(scanCodeKey('012345678906')).toBe('raw:012345678906');
  expect(scanCodeCandidates('12345678')).toEqual(['12345678']);
});
it('generates short individual Code39 labels and preserves old AS UUID identities',()=>{
  const values=Array.from({length:100},generateAssetLabelCode);expect(new Set(values).size).toBe(100);expect(values.every(v=>/^AS-[A-F0-9]{12}$/.test(v))).toBe(true);
  expect(scanCodeKey('as-abcdef123456')).toBe(scanCodeKey('AS-ABCDEF123456'));
  expect(scanCodeKey('AS-123e4567-e89b-12d3-a456-426614174000')).toBe('unit:AS-123E4567-E89B-12D3-A456-426614174000');
});
