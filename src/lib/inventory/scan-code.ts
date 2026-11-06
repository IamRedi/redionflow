/** Preserve factory QR payloads (including case, punctuation and leading zeroes). */
export function normalizeScanCode(value: string) {
  return value.normalize('NFC').trim();
}

export const MAX_SCAN_CODE_LENGTH = 2048;
export function validScanCode(value: string) {
  // GS1 DataMatrix / GS1-128 use ASCII 29 (FNC1) between variable-length fields.
  return value.length > 0 && value.length <= MAX_SCAN_CODE_LENGTH && !/[\u0000-\u001c\u001e-\u001f\u007f]/.test(value);
}

/** Only checksum-valid GTINs share an EAN/UPC zero-padded identity. */
export function scanCodeKey(raw: string) {
  const value = normalizeScanCode(raw);
  if (/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) {
    const digits = [...value].map(Number), check = digits.pop()!;
    const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
    if ((10 - sum % 10) % 10 === check) return `gtin:${value.padStart(14, '0')}`;
  }
  // Legacy internal labels were printed in uppercase Code39. Factory QR case is significant.
  if (/^(?:AS-[A-F0-9-]{10,36}|INV-[A-Z0-9-]{6,36})$/i.test(value)) return `unit:${value.toUpperCase()}`;
  return `raw:${value}`;
}

export function generateAssetLabelCode() {
  return `AS-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

export function scanCodeCandidates(raw: string) {
  const value = normalizeScanCode(raw), key = scanCodeKey(value);
  if (!key.startsWith('gtin:')) return [value];
  const digits = key.slice(5);
  return [...new Set([value, ...[8,12,13,14].filter(length => /^0*$/.test(digits.slice(0,14-length))).map(length => digits.slice(-length))])];
}
