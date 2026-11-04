import { expect, it } from 'vitest';
import sharp from 'sharp';
import { compactPhoto, MAX_WEBP_BYTES } from './image';
it('orients a phone photo, keeps its aspect, removes metadata and emits a small WebP', async () => {
  const original = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#cc6611' },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const output = await compactPhoto(original),
    meta = await sharp(output.data).metadata();
  expect(meta.format).toBe('webp');
  expect(meta.width).toBe(683);
  expect(meta.height).toBe(1024);
  expect(meta.exif).toBeUndefined();
  expect(meta.icc).toBeUndefined();
  expect(output.data.length).toBeLessThanOrEqual(MAX_WEBP_BYTES);
});
it('does not enlarge a small raster and rejects vectors, corrupt and oversized input', async () => {
  const input = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#123456' },
  })
    .png()
    .toBuffer();
  expect(await compactPhoto(input)).toMatchObject({ width: 40, height: 30 });
  await expect(
    compactPhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
  ).rejects.toThrow('PHOTO_FILE');
  await expect(compactPhoto(Buffer.from('not a photo'))).rejects.toThrow(
    'PHOTO_FILE',
  );
  await expect(compactPhoto(Buffer.alloc(12_000_001))).rejects.toThrow(
    'PHOTO_FILE',
  );
});
it('rejects a decompression-bomb header before decoding image pixels', async () => {
  const input = await sharp({
    create: { width: 1, height: 1, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  input.writeUInt32BE(100000, 16);
  input.writeUInt32BE(100000, 20);
  await expect(compactPhoto(input)).rejects.toThrow();
});
