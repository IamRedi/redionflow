import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => request.values.has(key) ? { value: request.values.get(key) } : undefined }), headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
import { prisma } from '@/lib/db/prisma';
import { assertAssistantTestDatabase } from '../../../tests/fixtures/assistant-database';
import { createTestSession, seedSecurityTenants, removeSecurityTenants } from '../../../tests/security/fixtures';
import { saveSteelWorkDefinitionAction } from '@/app/(workzone)/workzone/steel-catalog-actions';
import { getSteelPhaseNotesAction, updateSteelPhaseAction } from '@/app/(workzone)/workzone/steel-phase-actions';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
let task: { id: string; treeItemId: string };
async function login(index = 0, worker = false) {
 request.values.clear();
 request.values.set(worker ? 'bk_worker_id' : 'bk_admin_id', await createTestSession(worker ? 'worker' : 'admin', worker ? tenants[index].worker.id : tenants[index].admin.id));
}
beforeEach(async () => {
 assertAssistantTestDatabase(); vi.stubEnv('SESSION_SIGNING_SECRET', 'synthetic-phase-diary-session-signing-key-only');
 tenants = await seedSecurityTenants();
 await prisma.companyProfile.update({ where: { id: tenants[0].company.id }, data: { mode: 'bau', country: 'AL' } });
 await prisma.baustelle.update({ where: { id: tenants[0].site.id }, data: { type: 'STEEL_ASSEMBLY' } });
 await login();
 const result = await saveSteelWorkDefinitionAction({ kind: 'site', label: 'Synthetic diary process', siteId: tenants[0].site.id });
 expect(result.ok).toBe(true);
 task = await prisma.steelSiteTask.findFirstOrThrow({ where: { definitionId: result.definitionId! } });
});
afterEach(async () => { request.values.clear(); if (tenants) await removeSecurityTenants(tenants.map(t => t.company.id)); vi.unstubAllEnvs(); });
const add = (text: string, noteRequestId = randomUUID()) => updateSteelPhaseAction({ phaseItemId: task.treeItemId, command: 'note', text, noteRequestId });
const read = (extra = {}) => getSteelPhaseNotesAction({ phaseItemId: task.treeItemId, ...extra });

it('shows old evidence read-only, appends authors/dates and keeps completion, materials and previous notes', async () => {
 const old = { note: 'Old original', noteBy: 'Original Demo', noteAt: '2026-11-17T10:00:00Z', doneBy: 'Checker Demo', label: 'Old label' };
 const completedAt = new Date('2026-11-16T10:00:00Z');
 await prisma.treeItem.update({ where: { id: task.treeItemId }, data: { notes: JSON.stringify(old), status: 'done', completedAt, completedBy: tenants[0].admin.id } });
 const before = await prisma.treeItem.findUniqueOrThrow({ where: { id: task.treeItemId } });
 expect((await read()).page?.entries).toMatchObject([{ text: old.note, authorName: old.noteBy, writtenAt: '2026-11-17T10:00:00.000Z', legacy: true }]);
 expect(await prisma.steelPhaseNote.count()).toBe(0);
 expect(await prisma.treeItem.findUniqueOrThrow({ where: { id: task.treeItemId } })).toEqual(before);
 expect((await add('Admin new')).ok).toBe(true);
 await prisma.worker.update({ where: { id: tenants[0].worker.id }, data: { crewRole: 'FIELD_ENGINEER' } });
 await login(0, true); expect((await add('Engineer new')).ok).toBe(true);
 const page = (await read()).page!;
 expect(page.entries.map(n => n.text)).toEqual(['Engineer new', 'Admin new', 'Old original']);
 expect(page.entries[0]).toMatchObject({ authorKey: `worker:${tenants[0].worker.id}`, legacy: false });
 expect(page.entries[0].writtenAt).toBeTruthy(); expect(page.authors).toHaveLength(3);
 expect(await prisma.treeItem.findUniqueOrThrow({ where: { id: task.treeItemId } })).toMatchObject({ status: 'done', completedAt, completedBy: before.completedBy });
 expect((await read({ author: page.entries[1].authorKey })).page?.entries.map(n => n.text)).toEqual(['Admin new']);
 expect((await read({ day: '2026-11-17', author: 'legacy:Original Demo' })).page?.entries.map(n => n.text)).toEqual(['Old original']);
});
it('keeps unknown legacy author/time unknown and cannot erase history with blank or forged input', async () => {
 await prisma.treeItem.update({ where: { id: task.treeItemId }, data: { notes: 'Original plain note', status: 'blocked' } });
 expect((await read()).page?.entries[0]).toMatchObject({ text: 'Original plain note', authorName: '', writtenAt: null });
 expect((await add('   ')).ok).toBe(false);
 expect((await updateSteelPhaseAction({ phaseItemId: task.treeItemId, command: 'note', text: 'Forged', actor: 'Boss' })).ok).toBe(false);
 expect((await add('Second note')).ok).toBe(true);
 const history = (await read()).page!.entries;
 expect(history).toHaveLength(2); expect(history[1]).toMatchObject({ text: 'Original plain note', writtenAt: null, authorName: '' });
 expect((await read({ day: '2026-02-30' })).ok).toBe(false);
 expect(await prisma.treeItem.findUniqueOrThrow({ where: { id: task.treeItemId } })).toMatchObject({ status: 'blocked' });
});
it('serializes concurrent appends and makes a retried note request idempotent', async () => {
 const noteRequestId = randomUUID();
 const results = await Promise.all([add('Concurrent A', noteRequestId), add('Concurrent A', noteRequestId), add('Concurrent B')]);
 expect(results.every(r => r.ok)).toBe(true);
 expect((await read()).page!.entries.map(n => n.text).sort()).toEqual(['Concurrent A', 'Concurrent B']);
 expect((await add('Changed retry', noteRequestId)).ok).toBe(false);
 expect(await prisma.steelPhaseNote.count({ where: { taskId: task.id } })).toBe(2);
});
it('denies anonymous, foreign-company, mixed and read-only writers; retains scoped readers', async () => {
 await add('Private process note'); await login(1); expect((await read()).ok).toBe(false); expect((await add('Foreign')).ok).toBe(false);
 request.values.clear(); expect((await read()).ok).toBe(false);
 await login(0, true);
 await prisma.worker.update({ where: { id: tenants[0].worker.id }, data: { accessLevel: 'BASE', crewRole: 'FIELD_WORKER' } });
 expect((await read()).ok).toBe(false); expect((await add('Denied')).ok).toBe(false);
 await prisma.accessGrant.create({ data: { companyProfileId: tenants[0].company.id, workerId: tenants[0].worker.id, place: 'site', scopeId: tenants[0].site.id, level: 'view' } });
 expect((await read()).page?.entries[0].text).toBe('Private process note'); expect((await add('Read-only')).ok).toBe(false);
 request.values.set('bk_admin_id', await createTestSession('admin', tenants[0].admin.id)); expect((await read()).ok).toBe(false);
});
it('paginates without duplicates, filters company-local days and rejects foreign cursors/FKs', async () => {
 await prisma.steelPhaseNote.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ companyProfileId: tenants[0].company.id, taskId: task.id, entryKey: `fixture-${i}`, text: `Note ${i}`, authorKey: i % 2 ? 'fixture:a' : 'fixture:b', authorName: 'Demo', writtenAt: new Date(i ? '2026-11-18T23:30Z' : '2026-11-17T23:30Z'), createdAt: new Date(Date.UTC(2026, 10, 18, 10, i)) })) });
 const first = (await read()).page!; expect(first.entries).toHaveLength(20); expect(first.hasMore).toBe(true);
 const second = (await read({ cursor: first.nextCursor })).page!; expect(second.entries).toHaveLength(5); expect(second.hasMore).toBe(false);
 expect(new Set([...first.entries, ...second.entries].map(n => n.id)).size).toBe(25);
 expect((await read({ day: '2026-11-18' })).page?.entries.map(n => n.text)).toEqual(['Note 0']);
 expect((await read({ author: 'fixture:a' })).page?.entries).toHaveLength(12);
 expect((await read({ cursor: 'unknown-foreign-cursor' })).ok).toBe(false);
 await expect(prisma.steelPhaseNote.create({ data: { companyProfileId: tenants[1].company.id, taskId: task.id, entryKey: 'bad', text: 'Denied', authorKey: 'x', authorName: 'x' } })).rejects.toThrow();
 // Real tenant-role connection, forced RLS and a wrongly scoped transaction cannot see this tenant.
 const runtimeUrl = new URL(process.env.TENANT_DATABASE_URL ?? ''), sourceUrl = new URL(process.env.DATABASE_URL!);
 if (runtimeUrl.hostname !== '127.0.0.1' || runtimeUrl.port !== sourceUrl.port || runtimeUrl.pathname !== '/baumkalk_integration' || runtimeUrl.username !== 'bk_saas_pilot_runtime') throw new Error('Disposable restricted runtime required');
 const db = new Client({ connectionString: runtimeUrl.toString() });
 await prisma.$executeRawUnsafe('GRANT SELECT ON "SteelPhaseNote" TO bk_saas_pilot_runtime');
 try {
  await db.connect();
  expect((await db.query('SELECT current_user AS role')).rows[0].role).toBe('bk_saas_pilot_runtime');
  expect((await db.query('SELECT id FROM "SteelPhaseNote"')).rows).toEqual([]);
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.current_tenant_id',$1,true)", [tenants[1].company.id]);
  expect((await db.query('SELECT id FROM "SteelPhaseNote"')).rows).toEqual([]);
  await db.query("SELECT set_config('app.current_tenant_id',$1,true)", [tenants[0].company.id]);
  expect((await db.query('SELECT id FROM "SteelPhaseNote"')).rows).toHaveLength(25);
  await db.query('COMMIT');
 } finally { await db.end(); await prisma.$executeRawUnsafe('REVOKE SELECT ON "SteelPhaseNote" FROM bk_saas_pilot_runtime'); }
});
