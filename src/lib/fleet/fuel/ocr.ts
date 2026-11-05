import { spawn } from 'node:child_process';
import { sniffSiteFileMime } from '@/lib/site-files/validate';

export const FUEL_RECEIPT_MAX_BYTES = 8_000_000;

/** Bound decoded image size before invoking the native reader. Camera JPG/PNG. */
export function receiptImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > FUEL_RECEIPT_MAX_BYTES) return null;
  const mime = sniffSiteFileMime(bytes, 'receipt');
  const b = Buffer.from(bytes);
  let width = 0,
    height = 0;
  if (
    mime === 'image/png' &&
    b.length >= 33 &&
    b.toString('ascii', 12, 16) === 'IHDR'
  ) {
    width = b.readUInt32BE(16);
    height = b.readUInt32BE(20);
  } else if (mime === 'image/jpeg') {
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i++] !== 0xff) break;
      while (b[i] === 0xff) i++;
      const marker = b[i++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (i + 2 > b.length) break;
      const size = b.readUInt16BE(i);
      if (size < 2 || i + size > b.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        size >= 8
      ) {
        height = b.readUInt16BE(i + 3);
        width = b.readUInt16BE(i + 5);
        break;
      }
      i += size;
    }
  }
  return width > 0 &&
    height > 0 &&
    width <= 10000 &&
    height <= 10000 &&
    width * height <= 20_000_000
    ? mime
    : null;
}

/** Local OCR only. No invoice, image or text is sent to an AI/cloud provider. */
export async function readReceiptText(bytes: Uint8Array): Promise<string> {
  if (!receiptImage(bytes)) return '';
  return new Promise((resolve) => {
    const args = ['stdin', 'stdout', '-l', 'eng', '--psm', '6'];
    const child = spawn(
      process.platform === 'linux' ? 'prlimit' : 'tesseract',
      process.platform === 'linux'
        ? ['--as=268435456', '--cpu=10', '--', 'tesseract', ...args]
        : args,
      {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
        env: { ...process.env, OMP_THREAD_LIMIT: '1' },
      },
    );
    let output = '',
      settled = false;
    const finish = (text: string) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(text);
      }
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish('');
    }, 10000);
    child.stdout.on('data', (part) => {
      output += part.toString('utf8');
      if (output.length > 50_000) {
        child.kill('SIGKILL');
        finish('');
      }
    });
    child.on('error', () => finish(''));
    child.stdin.on('error', () => finish(''));
    child.on('close', (code) => finish(code === 0 ? output : ''));
    child.stdin.end(bytes);
  });
}
