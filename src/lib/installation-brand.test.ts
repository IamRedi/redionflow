import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const db = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { companyProfile: { findMany: db.findMany } } }));
import { installationBrand } from './installation-brand';
import { installationIcon } from './installation-icon';
import manifest from '@/app/manifest';

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('PROVISION_COMPANY_JSON', ''); vi.stubEnv('INSTALLATION_COMPANY_ID', ''); });
afterEach(() => vi.unstubAllEnvs());
it('keeps generic deployments separate and exposes no arbitrary company', async () => {
  for (const value of ['', '{bad', '{}', '{"legalName":""}']) {
    vi.stubEnv('PROVISION_COMPANY_JSON', value);
    expect(await installationBrand()).toBeNull();
  }
  expect(db.findMany).not.toHaveBeenCalled();
  expect((await manifest()).icons?.[0].src).toBe('/branding/logo-512.png');
});
it('publishes only the explicitly provisioned public name/logo and language', async () => {
  const logo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect width="160" height="60" fill="#bc5428"/></svg>').toString('base64');
  vi.stubEnv('PROVISION_COMPANY_JSON', JSON.stringify({ legalName: 'Synthetic Steel', owner: { email: 'PRIVATE_CONTACT' }, phone: 'PRIVATE_PHONE', logoDataUrl: 'obsolete' }));
  db.findMany.mockResolvedValue([{ displayName: 'Synthetic Steel', logoDataUrl: logo, country: 'AL' }]);
  expect(await installationBrand()).toEqual({ name: 'Synthetic Steel', logo, lang: 'sq' });
  expect(db.findMany).toHaveBeenCalledWith({ where: { legalName: 'Synthetic Steel' }, take: 2, select: { displayName: true, logoDataUrl: true, country: true } });
  const result = await manifest();
  expect(result).toMatchObject({ name: 'Synthetic Steel', id: '/start', scope: '/', start_url: '/start', display: 'standalone', lang: 'sq' });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|logoDataUrl|owner/);
  expect(result.icons?.map(icon => [icon.src, icon.sizes])).toEqual([['/app-icon/512', '512x512'], ['/app-icon/192', '192x192'], ['/app-icon/512', '512x512']]);
  for (const size of [48, 180, 192, 512]) {
    const image = sharp(await installationIcon(logo, size)), metadata = await image.metadata();
    expect(metadata).toMatchObject({ format: 'png', width: size, height: size });
    const pixel = await image.extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    expect([...pixel]).toEqual([255, 255, 255, 255]);
  }
});
it('fails closed for ambiguous, missing, malformed-logo and unavailable provisioning matches', async () => {
  vi.stubEnv('PROVISION_COMPANY_JSON', '{"legalName":"Synthetic Steel"}');
  for (const rows of [[], [{}, {}], [{ displayName: 'Synthetic', logoDataUrl: 'https://private.example/logo', country: 'AL' }]]) {
    db.findMany.mockResolvedValue(rows);
    expect(await installationBrand()).toBeNull();
  }
  db.findMany.mockRejectedValue(new Error('PRIVATE_DB_ERROR'));
  expect(await installationBrand()).toBeNull();
});
it('uses the explicit installation company when one-time provisioning has been cleared, with no tenant fallback', async () => {
  vi.stubEnv('INSTALLATION_COMPANY_ID', 'synthetic-company');
  db.findMany.mockResolvedValue([{ displayName: 'Synthetic Steel', country: 'AL', logoDataUrl: 'data:image/png;base64,aGVsbG8=' }]);
  expect(await installationBrand()).toMatchObject({ name: 'Synthetic Steel', lang: 'sq' });
  expect(db.findMany.mock.calls[0][0].where).toEqual({ id: 'synthetic-company' });
  db.findMany.mockResolvedValue([]);
  expect(await installationBrand()).toBeNull();
  vi.stubEnv('INSTALLATION_COMPANY_ID', '../foreign'); db.findMany.mockClear();
  expect(await installationBrand()).toBeNull(); expect(db.findMany).not.toHaveBeenCalled();
});
