import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  actor: vi.fn(), requester: vi.fn(), tenant: vi.fn(), compact: vi.fn(), quota: vi.fn(), image: vi.fn(), reference: vi.fn(), warn: vi.fn(), info: vi.fn(),
  tx: { $queryRaw: vi.fn(), $executeRaw: vi.fn(), steelWorkDefinition: { findFirst: vi.fn(), updateMany: vi.fn() }, steelWorkVisual: { upsert: vi.fn(), findFirst: vi.fn() }, auditLog: { create: vi.fn() } },
}));
vi.mock('node:fs/promises', () => ({ readFile: mocks.reference }));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: mocks.tenant }));
vi.mock('@/lib/fleet/access', () => ({ fleetActor: mocks.actor }));
vi.mock('@/lib/asset-photos/image', () => ({ compactPhoto: mocks.compact, MAX_PHOTO_BYTES: 12_000_000 }));
vi.mock('@/lib/assistant/requester', () => ({ getRequesterContext: mocks.requester }));
vi.mock('./image-quota', () => ({ reserveSteelImageQuota: mocks.quota }));
vi.mock('./image-generation', async original => ({ ...await original<typeof import('./image-generation')>(), generateSteelImage: mocks.image }));
vi.mock('@/lib/observability/logger', () => ({ logger: { warn: mocks.warn, info: mocks.info } }));
import { generateSteelWorkVisual, readSteelWorkVisual, uploadSteelWorkVisual } from './media';

const companyId = 'company-fixture-a', definitionId = 'definition-fixture-0001', revision = 7, now = new Date('2026-11-05T12:00:00Z');
const scene = { v: 1, shapes: [{ type: 'rect', x: 30, y: 90, width: 200, height: 15, color: 'steel' }] };
const actor = { companyId, workerId: null, userId: 'admin-fixture-a', can: { office: true, siteSteps: false, factorySteps: false, reportMissing: true } };
const requester = { kind: 'admin', companyId, adminId: 'admin-fixture-a' };
const definition = { key: 'steel-task-fixture', kind: 'site', label: 'Montim borde', description: '', linkedProcessKey: null, linkedList: null, linkedKind: null, visualStatus: 'generated', visualUpdatedAt: new Date('2026-11-05T09:00:00Z'), updatedAt: new Date('2026-11-05T10:00:00Z') };
const reference = new Uint8Array([137, 80, 78, 71]), generated = new Uint8Array([10, 20, 30]), stored = new Uint8Array([1, 2, 3]);
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv('OPENAI_API_KEY', 'fictional-test-value-never-sent');
  mocks.actor.mockResolvedValue(actor); mocks.requester.mockResolvedValue(requester);
  mocks.tenant.mockImplementation(async (_company: string, work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx));
  mocks.tx.$queryRaw.mockResolvedValue([{ locked: true }]); mocks.tx.$executeRaw.mockResolvedValue(1);
  mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue(definition); mocks.tx.steelWorkDefinition.updateMany.mockResolvedValue({ count: 1 });
  mocks.quota.mockResolvedValue({ ok: true }); mocks.reference.mockResolvedValue(reference);
  mocks.image.mockResolvedValue({ bytes: generated, mime: 'image/webp', usage: { totalTokens: 100 } });
  mocks.compact.mockResolvedValue({ data: stored, width: 768, height: 576 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('specific private and fenced illustrations', () => {
  it.each(['role', 'tenant', 'anonymous', 'id', 'revision'])('rejects invalid %s before quota or provider access', async name => {
    if (name === 'role') mocks.actor.mockResolvedValue({ ...actor, can: { office: false, factorySteps: false, siteSteps: false } });
    if (name === 'tenant') mocks.requester.mockResolvedValue({ ...requester, companyId: 'company-fixture-b' });
    if (name === 'anonymous') mocks.requester.mockResolvedValue({ kind: 'anonymous' });
    await expect(generateSteelWorkVisual(name === 'id' ? '../foreign' : definitionId, name === 'revision' ? NaN : revision)).rejects.toThrow();
    expect(mocks.tenant).not.toHaveBeenCalled(); expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled();
  });
  it('does not write without a configured provider key', async () => {
    vi.stubEnv('OPENAI_API_KEY', ' '); await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('VISUAL_UNAVAILABLE');
    expect(mocks.tenant).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled();
  });
  it('scopes stale or foreign definitions before any paid call', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue(null);
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('VISUAL_CONFLICT');
    expect(mocks.tx.steelWorkDefinition.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: definitionId, companyProfileId: companyId, revision, archivedAt: null } }));
    expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled();
  });
  it('keeps an original photo without reading the reference or reserving quota', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue({ ...definition, visualStatus: 'photo' });
    await expect(generateSteelWorkVisual(definitionId, revision)).resolves.toMatchObject({ status: 'photo' });
    expect(mocks.reference).not.toHaveBeenCalled(); expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled(); expect(mocks.tx.steelWorkDefinition.updateMany).not.toHaveBeenCalled();
  });
  it('does not overlap a pending job during the full image deadline', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue({ ...definition, visualStatus: 'pending', updatedAt: new Date(now.getTime() - 180_000) });
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('PHOTO_BUSY'); expect(mocks.quota).not.toHaveBeenCalled();
  });
  it('recovers an older pending job after five minutes', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue({ ...definition, visualStatus: 'pending', updatedAt: new Date(now.getTime() - 301_000) });
    await expect(generateSteelWorkVisual(definitionId, revision)).resolves.toMatchObject({ status: 'generated' }); expect(mocks.image).toHaveBeenCalledTimes(1);
  });
  it('makes one image call with the native reference and precise trim meaning, then stores compact WebP', async () => {
    await expect(generateSteelWorkVisual(definitionId, revision)).resolves.toMatchObject({ status: 'generated' });
    expect(mocks.image).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('folded sheet-metal trims at roof or facade edges'), reference, expect.any(AbortSignal));
    expect(mocks.compact).toHaveBeenCalledExactlyOnceWith(generated);
    expect(mocks.tx.steelWorkVisual.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { companyProfileId_definitionId: { companyProfileId: companyId, definitionId } }, create: expect.objectContaining({ companyProfileId: companyId, definitionId, data: stored, mime: 'image/webp' }), update: expect.objectContaining({ data: stored, mime: 'image/webp' }) }));
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'steel.visual_generated', payload: { definitionId, revision, style: 'alsteel-industrial-photo-v2', bytes: 3 } }) }));
  });
  it.each(['rate', 'budget', 'unavailable'])('fails closed for %s quota denial', async reason => {
    mocks.quota.mockResolvedValue({ ok: false, reason, retryAfterSeconds: 60 });
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow(reason === 'unavailable' ? 'VISUAL_UNAVAILABLE' : 'VISUAL_QUOTA');
    expect(mocks.image).not.toHaveBeenCalled(); expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled();
  });
  it('does not charge quota if the trusted reference cannot be loaded', async () => {
    mocks.reference.mockRejectedValue(new Error('fixture-private-filesystem-path'));
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('VISUAL_UNAVAILABLE');
    expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled(); expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('fixture-private');
  });
  it('cannot overwrite a newer edit or photo after a valid image', async () => {
    mocks.tx.steelWorkDefinition.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(generateSteelWorkVisual(definitionId, revision)).resolves.toEqual({ status: 'superseded', url: undefined });
    expect(mocks.tx.steelWorkDefinition.updateMany).toHaveBeenLastCalledWith({ where: { id: definitionId, companyProfileId: companyId, revision, archivedAt: null, visualStatus: 'pending', updatedAt: now }, data: { visualStatus: 'generated', visualUpdatedAt: now } });
    expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled(); expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(['generated', 'expired with image', 'expired without image'])('discards changed linked context without restoring an orphan job: %s', async originalStatus => {
    const linked = { id: 'linked-definition-fixture', key: 'field-installation', revision: 4, label: 'Fixture fixing', description: 'Fasten the specified pieces' };
    const original = originalStatus === 'generated' ? definition : { ...definition, visualStatus: 'pending', updatedAt: new Date(now.getTime() - 301_000), visualUpdatedAt: originalStatus === 'expired with image' ? definition.visualUpdatedAt : null };
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValueOnce({ ...original, linkedProcessKey: linked.key, linkedList: 'assembly', linkedKind: 'COLUMN' }).mockResolvedValueOnce(linked).mockResolvedValueOnce(null);
    await expect(generateSteelWorkVisual(definitionId, revision)).resolves.toMatchObject({ status: 'superseded' });
    const prompt = mocks.image.mock.calls[0][0] as string;
    expect(prompt).toContain(linked.description); expect(prompt).toContain('COLUMN'); expect(prompt).not.toContain(linked.id); expect(prompt).not.toContain(companyId); expect(prompt).not.toContain(actor.userId);
    expect(mocks.tx.steelWorkDefinition.findFirst).toHaveBeenLastCalledWith({ where: { id: linked.id, companyProfileId: companyId, revision: 4 }, select: { id: true } });
    expect(mocks.tx.steelWorkDefinition.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { visualStatus: originalStatus === 'expired without image' ? 'fallback' : 'generated' } })); expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled();
  });
  it.each(['provider', 'validation', 'storage'])('keeps the prior image after %s failure with sanitized diagnostics', async phase => {
    const error = new Error('fixture-private-provider-body-and-label');
    if (phase === 'provider') mocks.image.mockRejectedValue(error);
    if (phase === 'validation') mocks.compact.mockRejectedValue(error);
    if (phase === 'storage') mocks.tx.steelWorkVisual.upsert.mockRejectedValue(error);
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('VISUAL_UNAVAILABLE'); expect(mocks.image).toHaveBeenCalledTimes(1);
    expect(mocks.tx.steelWorkDefinition.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyProfileId: companyId, revision, visualStatus: 'pending', updatedAt: now }), data: { visualStatus: 'error' } }));
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled(); expect(mocks.warn).toHaveBeenCalledWith(expect.objectContaining({ phase: phase === 'provider' ? 'image' : phase, providerCalls: 1 }), expect.any(String)); expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(error.message);
  });
  it('records the original safe failure when resetting the status also fails', async () => {
    mocks.image.mockRejectedValue(new Error('fixture-private-provider-failure')); mocks.tx.steelWorkDefinition.updateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(new Error('fixture-private-status-error'));
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('VISUAL_UNAVAILABLE');
    expect(mocks.warn).toHaveBeenCalledWith({ event: 'steel.visual_status_update_failed' }, expect.any(String)); expect(mocks.warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'steel.visual_generation_failed', phase: 'image' }), expect.any(String)); expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('fixture-private');
  });
});

describe('private original photos and legacy assets', () => {
  it('compresses original photos without image-model calls', async () => {
    const file = new File([new Uint8Array([5, 6, 7])], 'fixture.png', { type: 'image/png' }); await expect(uploadSteelWorkVisual(definitionId, revision, file)).resolves.toMatchObject({ status: 'photo' });
    expect(mocks.compact).toHaveBeenCalledExactlyOnceWith(new Uint8Array([5, 6, 7])); expect(mocks.tx.steelWorkVisual.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ data: stored, mime: 'image/webp' }) }));
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'steel.visual_uploaded', payload: { definitionId, bytes: 3 } }) })); expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled();
  });
  it('rejects stale/foreign photo targets before conversion', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue(null); await expect(uploadSteelWorkVisual(definitionId, revision, new File(['fixture'], 'fixture.png', { type: 'image/png' }))).rejects.toThrow('VISUAL_CONFLICT'); expect(mocks.compact).not.toHaveBeenCalled(); expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled();
  });
  it('does not replace existing media with an invalid uploaded photo', async () => {
    mocks.compact.mockRejectedValue(new Error('PHOTO_FILE')); await expect(uploadSteelWorkVisual(definitionId, revision, new File(['fixture'], 'fixture.png', { type: 'image/png' }))).rejects.toThrow('PHOTO_FILE'); expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled(); expect(mocks.tx.steelWorkDefinition.updateMany).not.toHaveBeenCalled();
  });
  it.each(['image/svg+xml', 'image/webp'])('shows a photographic default for legacy %s without rewriting it or making a model request', async mime => {
    mocks.tx.steelWorkVisual.findFirst.mockResolvedValue({ mime, scene, data: stored, definition });
    await expect(readSteelWorkVisual(definitionId)).resolves.toEqual({ data: reference, mime: 'image/webp' });
    expect(mocks.reference).toHaveBeenCalledWith(expect.stringContaining('site.webp'));
    expect(mocks.tx.steelWorkVisual.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { companyProfileId: companyId, definitionId } }));
    expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled(); expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled();
  });
  it.each(['photo', 'generated'])('reads %s WebP for the authenticated company and preserves photos', async status => {
    mocks.tx.steelWorkVisual.findFirst.mockResolvedValue({ mime: 'image/webp', scene: status === 'generated' ? { style: 'alsteel-industrial-photo-v2' } : null, data: stored, definition: { ...definition, visualStatus: status } });
    await expect(readSteelWorkVisual(definitionId)).resolves.toEqual({ data: stored, mime: 'image/webp' }); expect(mocks.reference).not.toHaveBeenCalled(); expect(mocks.image).not.toHaveBeenCalled();
  });
});