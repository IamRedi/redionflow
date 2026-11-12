import sharp from 'sharp';
import { PHOTO_WIDTHS, type PhotoShape } from './rendition';

let active = 0;
const waiting: Array<() => void> = [];
async function acquire() {
  if (active < 2) { active++; return true; }
  if (waiting.length >= 16) return false;
  return new Promise<boolean>(resolve => {
    const resume = () => { clearTimeout(timer); active++; resolve(true); };
    const timer = setTimeout(() => {
      const index = waiting.indexOf(resume);
      if (index >= 0) waiting.splice(index, 1);
      resolve(false);
    }, 200);
    waiting.push(resume);
  });
}
/** Ephemeral lossless preview, after authorization. No disk/cache/DB writes. */
export async function previewPhoto(bytes: Uint8Array, width: number, shape: PhotoShape | null = null) {
  if (!PHOTO_WIDTHS.some(value => value === width) || !await acquire()) return bytes;
  try {
    const image = sharp(bytes, { limitInputPixels: 24_000_000, sequentialRead: true, failOn: 'error' });
    const meta = await image.metadata();
    const height = shape ? Math.round(width * (shape === 'square' ? 1 : shape === '4x3' ? 3 / 4 : 5 / 6)) : undefined;
    if (meta.format !== 'webp' || (meta.pages ?? 1) > 1 || !meta.width || meta.width <= width || (height && (meta.height ?? 0) < height)) return bytes;
    // Match the existing centered object-cover frame before downsampling. A wide
    // photo must still supply all Retina pixels of a square avatar, not a short strip.
    const data = await image.resize({ width, height, fit: 'cover', position: 'centre', withoutEnlargement: true, kernel: 'lanczos3' })
      .webp({ lossless: true, effort: 2 }).timeout({ seconds: 3 }).toBuffer();
    // A preview is optional. Keep the original if it is cheaper or conversion fails.
    return data.length < bytes.length ? data : bytes;
  } catch {
    return bytes;
  } finally {
    active--;
    waiting.shift()?.();
  }
}
