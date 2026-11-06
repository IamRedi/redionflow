import sharp from 'sharp';

/** Keep the company's existing logo intact inside Android's maskable safe area. */
export async function installationIcon(logo: string, size: number) {
  const bytes = Buffer.from(logo.slice(logo.indexOf(',') + 1), 'base64');
  const mark = await sharp(bytes, { limitInputPixels: 16_000_000 }).rotate()
    .resize({ width: Math.round(size * .56), height: Math.round(size * .56), fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
}
