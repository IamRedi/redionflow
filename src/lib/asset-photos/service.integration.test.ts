import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) => {
      const value = request.values.get(key);
      return value === undefined ? undefined : { value };
    },
  }),
  headers: async () => new Headers(),
}));
import { prisma } from '@/lib/db/prisma';
import {
  createTestSession,
  seedSecurityTenants,
  removeSecurityTenants,
} from '../../../tests/security/fixtures';
import { saveAssetPhoto, readAssetPhoto } from './service';
import { GET } from '@/app/api/asset-photos/[kind]/[id]/route';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const file = async (color = '#cc6611') =>
  new File(
    [
      new Uint8Array(
        await sharp({
          create: { width: 1500, height: 1000, channels: 3, background: color },
        })
          .withMetadata({ orientation: 6 })
          .jpeg()
          .toBuffer(),
      ),
    ],
    'synthetic-photo.jpg',
    { type: 'image/jpeg' },
  );
async function as(kind: 'admin' | 'worker', index = 0) {
  request.values.clear();
  request.values.set(
    kind === 'admin' ? 'bk_admin_id' : 'bk_worker_id',
    await createTestSession(kind, tenants[index][kind].id),
  );
}
const get = (kind: string, id: string) =>
  GET(new Request('http://127.0.0.1'), {
    params: Promise.resolve({ kind, id }),
  });
beforeEach(async () => {
  vi.stubEnv(
    'SESSION_SIGNING_SECRET',
    'synthetic-asset-photo-session-key-20261104',
  );
  vi.stubEnv('APP_ENV', 'saas');
  vi.stubEnv('DEMO_MODE', 'false');
  tenants = await seedSecurityTenants();
  await as('admin');
});
afterEach(async () => {
  await removeSecurityTenants(tenants.map((t) => t.company.id));
  request.values.clear();
  vi.unstubAllEnvs();
});
it('stores only the bounded WebP separately, updates the cover marker and serves exact private bytes', async () => {
  const saved = await saveAssetPhoto(
    'machine',
    tenants[0].machine.id,
    await file(),
  );
  expect(saved.url).toContain(`/machine/${tenants[0].machine.id}?v=`);
  expect(saved.bytes).toBeLessThanOrEqual(180000);
  const row = await prisma.assetPhoto.findFirstOrThrow({
    where: { companyProfileId: tenants[0].company.id },
  });
  const meta = await sharp(row.data).metadata();
  expect(meta.format).toBe('webp');
  expect(meta.height).toBe(1024);
  expect(meta.exif).toBeUndefined();
  expect(
    (
      await prisma.machine.findUniqueOrThrow({
        where: { id: tenants[0].machine.id },
      })
    ).coverPhotoAt,
  ).not.toBeNull();
  const response = await get('machine', tenants[0].machine.id);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-type')).toBe('image/webp');
  expect(Buffer.from(await response.arrayBuffer())).toEqual(
    Buffer.from(row.data),
  );
});
it('denies foreign/mixed/anonymous access and keeps an existing photo when replacement fails', async () => {
  await saveAssetPhoto('machine', tenants[0].machine.id, await file());
  const before = await readAssetPhoto('machine', tenants[0].machine.id);
  await expect(
    saveAssetPhoto(
      'machine',
      tenants[0].machine.id,
      new File(['invalid'], 'bad.jpg'),
    ),
  ).rejects.toThrow();
  expect(await readAssetPhoto('machine', tenants[0].machine.id)).toEqual(
    before,
  );
  await expect(
    saveAssetPhoto('site', tenants[1].site.id, await file()),
  ).rejects.toThrow('PHOTO_NOT_FOUND');
  await as('admin', 1);
  expect((await get('machine', tenants[0].machine.id)).status).toBe(404);
  request.values.set(
    'bk_worker_id',
    await createTestSession('worker', tenants[0].worker.id),
  );
  expect((await get('machine', tenants[0].machine.id)).status).toBe(404);
  request.values.clear();
  expect((await get('machine', tenants[0].machine.id)).status).toBe(404);
});
it('keeps office, field and factory photo edits within the existing role permissions', async () => {
  await saveAssetPhoto('machine', tenants[0].machine.id, await file());
  await prisma.worker.update({
    where: { id: tenants[0].worker.id },
    data: { crewRole: 'FIELD_WORKER' },
  });
  await as('worker');
  expect(await readAssetPhoto('machine', tenants[0].machine.id)).not.toBeNull();
  await expect(
    saveAssetPhoto('machine', tenants[0].machine.id, await file()),
  ).rejects.toThrow('PHOTO_DENIED');
  await expect(
    saveAssetPhoto('site', tenants[0].site.id, await file()),
  ).rejects.toThrow('PHOTO_DENIED');
  await prisma.worker.update({
    where: { id: tenants[0].worker.id },
    data: { crewRole: 'FIELD_ENGINEER' },
  });
  await saveAssetPhoto('site', tenants[0].site.id, await file());
  await prisma.baustelle.update({
    where: { id: tenants[0].site.id },
    data: { type: 'STEEL_WORKSHOP' },
  });
  await expect(
    saveAssetPhoto('site', tenants[0].site.id, await file()),
  ).rejects.toThrow('PHOTO_DENIED');
  await prisma.worker.update({
    where: { id: tenants[0].worker.id },
    data: { crewRole: 'FACTORY_ENGINEER' },
  });
  await saveAssetPhoto('site', tenants[0].site.id, await file('#339966'));
  expect(
    await prisma.assetPhoto.count({
      where: {
        companyProfileId: tenants[0].company.id,
        baustelleId: tenants[0].site.id,
      },
    }),
  ).toBe(1);
});
it('enforces composite target keys, size limits and no-context forced RLS on the new table', async () => {
  await saveAssetPhoto('machine', tenants[0].machine.id, await file());
  await expect(
    prisma.assetPhoto.create({
      data: {
        companyProfileId: tenants[0].company.id,
        machineId: tenants[1].machine.id,
        data: new Uint8Array([1]),
      },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.assetPhoto.create({
      data: {
        companyProfileId: tenants[0].company.id,
        baustelleId: tenants[0].site.id,
        data: new Uint8Array(180001),
      },
    }),
  ).rejects.toThrow();
  await prisma.$executeRawUnsafe(
    'CREATE ROLE asset_photo_rls_probe NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  try {
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA public TO asset_photo_rls_probe',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON "AssetPhoto" TO asset_photo_rls_probe',
    );
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE asset_photo_rls_probe');
      expect(await tx.assetPhoto.count()).toBe(0);
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${tenants[1].company.id},true)`;
      expect(await tx.assetPhoto.count()).toBe(0);
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${tenants[0].company.id},true)`;
      expect(await tx.assetPhoto.count()).toBe(1);
    });
  } finally {
    await prisma.$executeRawUnsafe('DROP OWNED BY asset_photo_rls_probe');
    await prisma.$executeRawUnsafe('DROP ROLE asset_photo_rls_probe');
  }
});

it('saves administrator and self-service worker photos without Supabase, retaining private bounded WebP', async () => {
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  const id = tenants[0].worker.id;
  const saved = await saveAssetPhoto('worker', id, await file());
  expect((await prisma.worker.findUniqueOrThrow({ where: { id } })).profileImageUrl).toBe(saved.url);
  const row = await prisma.assetPhoto.findUniqueOrThrow({ where: { companyProfileId_workerId: { companyProfileId: tenants[0].company.id, workerId: id } } });
  const metadata = await sharp(row.data).metadata();
  expect(metadata.format).toBe('webp');
  expect(metadata.exif).toBeUndefined();
  expect(row.data.length).toBeLessThanOrEqual(180000);
  expect(row.machineId).toBeNull();
  expect(row.baustelleId).toBeNull();
  const response = await get('worker', id);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-type')).toBe('image/webp');
  expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from(row.data));
  await as('worker');
  for (const crewRole of ['FIELD_WORKER', 'FIELD_ENGINEER', 'FACTORY_ENGINEER', 'OFFICE', 'MECHANIC']) {
    await prisma.worker.update({ where: { id }, data: { crewRole } });
    await saveAssetPhoto('worker', id, await file('#336699'));
  }
  expect(await prisma.assetPhoto.count({ where: { workerId: id } })).toBe(1);
  await as('admin');
  const imported = await prisma.worker.create({ data: { id: 'worker-photo-fixture-with-hyphens-and-long-identifier', companyProfileId: tenants[0].company.id, firstName: 'Imported', lastName: 'Synthetic' } });
  await saveAssetPhoto('worker', imported.id, await file());
  expect((await get('worker', imported.id)).status).toBe(200);
});

it('denies another worker, foreign tenant and anonymous photo edits/reads and preserves a failed replacement', async () => {
  const id = tenants[0].worker.id;
  const other = await prisma.worker.create({ data: { companyProfileId: tenants[0].company.id, firstName: 'Other', lastName: 'Synthetic' } });
  await saveAssetPhoto('worker', id, await file());
  const before = await prisma.worker.findUniqueOrThrow({ where: { id } });
  const bytes = await readAssetPhoto('worker', id);
  await as('worker');
  await expect(saveAssetPhoto('worker', other.id, await file())).rejects.toThrow('PHOTO_DENIED');
  await expect(saveAssetPhoto('worker', tenants[1].worker.id, await file())).rejects.toThrow('PHOTO_NOT_FOUND');
  await expect(saveAssetPhoto('worker', id, new File(['not an image'], 'bad.jpg'))).rejects.toThrow('PHOTO_FILE');
  expect((await prisma.worker.findUniqueOrThrow({ where: { id } })).profileImageUrl).toBe(before.profileImageUrl);
  expect(await readAssetPhoto('worker', id)).toEqual(bytes);
  expect((await get('worker', id)).status).toBe(200);
  await as('admin', 1);
  expect((await get('worker', id)).status).toBe(404);
  await expect(saveAssetPhoto('worker', id, await file())).rejects.toThrow('PHOTO_NOT_FOUND');
  request.values.clear();
  expect((await get('worker', id)).status).toBe(404);
});

it('keeps worker photo ownership enforced by the database target and tenant constraints', async () => {
  await expect(prisma.assetPhoto.create({ data: { companyProfileId: tenants[0].company.id, workerId: tenants[1].worker.id, data: new Uint8Array([1]) } })).rejects.toThrow();
  await expect(prisma.assetPhoto.create({ data: { companyProfileId: tenants[0].company.id, workerId: tenants[0].worker.id, machineId: tenants[0].machine.id, data: new Uint8Array([1]) } })).rejects.toThrow();
});
