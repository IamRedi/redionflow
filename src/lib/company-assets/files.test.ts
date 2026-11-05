import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('./access', () => ({ assetActor: vi.fn(), assetActorKey: vi.fn(), assetFail: (code: string) => { throw new Error(code); } }));
vi.mock('./service', () => ({ assertAssetVisible: vi.fn(), lockOwnedAsset: vi.fn(), readOwnedAsset: vi.fn() }));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: vi.fn() }));
import { prepareAssetFile } from './files';

afterEach(() => { vi.unstubAllEnvs(); });
describe('private asset file content', () => {
  it('converts a phone photo to compact WebP and removes orientation/private metadata', async () => {
    const original = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#ff7100' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const result = await prepareAssetFile(new File([new Uint8Array(original)], '../repair.jpg', { type: 'text/plain' }), 'photo');
    const meta = await sharp(result.bytes).metadata();
    expect(result.mime).toBe('image/webp');
    expect(result.bytes.length).toBeLessThanOrEqual(180000);
    expect(meta.width).toBe(683);
    expect(meta.height).toBe(1024);
    expect(meta.exif).toBeUndefined();
    expect(result.name).not.toContain('/');
  });
  it('accepts bounded PDFs only for documents/invoices regardless of claimed extension', async () => {
    const pdf = new File(['%PDF-1.7\nfixture'], 'service.png', { type: 'image/png' });
    expect(await prepareAssetFile(pdf, 'invoice')).toMatchObject({ mime: 'application/pdf', name: 'service.pdf' });
    await expect(prepareAssetFile(pdf, 'photo')).rejects.toThrow('FILE_INVALID');
    await expect(prepareAssetFile(pdf, 'cover')).rejects.toThrow('FILE_INVALID');
    await expect(prepareAssetFile(new File(['%PDF-' + 'x'.repeat(5000000)], 'large.pdf'), 'document')).rejects.toThrow('FILE_INVALID');
  });
  it('refuses scripts, forged raster files, empty/oversized files and unsupported scanners', async () => {
    for (const content of ['<svg onload="alert(1)"/>', '<html>hello</html>', '\xff\xd8\xffbroken', '']) {
      await expect(prepareAssetFile(new File([content], 'image.webp', { type: 'image/webp' }), 'photo')).rejects.toThrow('FILE_INVALID');
    }
    await expect(prepareAssetFile(new File([new Uint8Array(12000001)], 'oversize.jpg'), 'photo')).rejects.toThrow('FILE_INVALID');
    vi.stubEnv('CONTENT_SCANNER', 'missing-adapter');
    await expect(prepareAssetFile(new File(['%PDF-1.7'], 'private.pdf'), 'invoice')).rejects.toThrow('FILE_REFUSED');
  });
});
