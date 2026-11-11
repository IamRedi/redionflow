import sharp from 'sharp';
import { MAX_PHOTO_BYTES } from './image-limits';
export { MAX_PHOTO_BYTES } from './image-limits';
export const MAX_WEBP_BYTES = 180_000;
/** Decode bounded raster images only; auto-orient, remove EXIF/GPS, keep aspect. */
export async function compactPhoto(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  const raster =
    (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP');
  if (!raster || !b.length || b.length > MAX_PHOTO_BYTES)
    throw new Error('PHOTO_FILE');
  const image = sharp(b, {
    limitInputPixels: 24_000_000,
    sequentialRead: true,
    failOn: 'error',
  });
  const meta = await image.metadata();
  if (
    !['jpeg', 'png', 'webp'].includes(meta.format ?? '') ||
    (meta.pages ?? 1) > 1
  )
    throw new Error('PHOTO_FILE');
  for (const [size, quality] of [
    [1024, 78],
    [768, 68],
    [512, 58],
  ]) {
    const { data, info } = await image
      .clone()
      .rotate()
      .resize({
        width: size,
        height: size,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, alphaQuality: 70, effort: 4 })
      .timeout({ seconds: 5 })
      .toBuffer({ resolveWithObject: true });
    if (data.length <= MAX_WEBP_BYTES)
      return { data, width: info.width, height: info.height };
  }
  throw new Error('PHOTO_FILE');
}
