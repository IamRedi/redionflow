import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actor: vi.fn(), requester: vi.fn(), tenant: vi.fn(), compact: vi.fn(), quota: vi.fn(), generation: vi.fn(), stream: vi.fn(), generateText: vi.fn(), warn: vi.fn(), settle: vi.fn(),
  tx: { $queryRaw: vi.fn(), steelWorkDefinition: { findFirst: vi.fn(), updateMany: vi.fn() }, steelWorkVisual: { upsert: vi.fn(), findFirst: vi.fn() }, auditLog: { create: vi.fn() } },
}));
vi.mock('ai', () => ({ streamText: mocks.stream, generateText: mocks.generateText }));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: mocks.tenant }));
vi.mock('@/lib/fleet/access', () => ({ fleetActor: mocks.actor }));
vi.mock('@/lib/asset-photos/image', () => ({ compactPhoto: mocks.compact, MAX_PHOTO_BYTES: 12_000_000 }));
vi.mock('@/lib/assistant/requester', () => ({ getRequesterContext: mocks.requester }));
vi.mock('@/lib/assistant/quota', () => ({ reserveAssistantQuota: mocks.quota }));
vi.mock('@/lib/assistant/generation', () => ({ assistantGeneration: mocks.generation }));
vi.mock('@/lib/observability/logger', () => ({ logger: { warn: mocks.warn } }));

import { generateSteelWorkVisual, readSteelWorkVisual, uploadSteelWorkVisual } from './media';

const companyId = 'company-fixture-a', definitionId = 'definition-fixture-0001', revision = 7;
const now = new Date('2026-11-05T12:00:00Z');
const scene = { v: 1, shapes: [{ type: 'rect', x: 30, y: 90, width: 200, height: 15, color: 'steel' }] };
const permissions = { office: true, siteSteps: false, factorySteps: false, reportMissing: true };
const actor = { companyId, workerId: null, userId: 'admin-fixture-a', can: permissions };
const requester = { kind: 'admin', companyId, userId: 'admin-fixture-a' };
const definition = { key: 'assembly', kind: 'factory', label: 'Fixture support frame', description: 'Join the steel supports', visualStatus: 'fallback', visualUpdatedAt: null, updatedAt: new Date('2026-11-05T10:00:00Z') };

function setStream(parts: Array<Record<string, unknown>>) {
  mocks.stream.mockReturnValue({ fullStream: (async function* () { for (const part of parts) yield part; })() });
}

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  vi.stubEnv('OPENAI_API_KEY', 'fictional-test-value-never-sent');
  mocks.actor.mockResolvedValue(actor); mocks.requester.mockResolvedValue(requester);
  mocks.tenant.mockImplementation(async (_company: string, work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx));
  mocks.tx.$queryRaw.mockResolvedValue([{ locked: true }]);
  mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue(definition);
  mocks.tx.steelWorkDefinition.updateMany.mockResolvedValue({ count: 1 });
  mocks.quota.mockResolvedValue({ ok: true, settle: mocks.settle });
  mocks.generation.mockReturnValue({ model: 'guarded-fixture-model', maxRetries: 0 });
  mocks.compact.mockResolvedValue({ data: new Uint8Array([1, 2, 3]), width: 64, height: 32 });
  setStream([{ type: 'text-delta', text: JSON.stringify(scene) }, { type: 'finish', finishReason: 'stop' }]);
});
afterEach(() => { expect(mocks.generateText).not.toHaveBeenCalled(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('visual generation authorization and bounded execution', () => {
  it.each([
    ['role', 'VISUAL_DENIED'], ['requester tenant', 'VISUAL_DENIED'], ['anonymous requester', 'VISUAL_DENIED'], ['invalid id', 'VISUAL_NOT_FOUND'],
  ])('denies %s before quota, tenant reads or provider calls', async (caseName, error) => {
    if (caseName === 'role') mocks.actor.mockResolvedValue({ ...actor, can: { office: false, siteSteps: false, factorySteps: false, reportMissing: true } });
    if (caseName === 'requester tenant') mocks.requester.mockResolvedValue({ ...requester, companyId: 'company-fixture-b' });
    if (caseName === 'anonymous requester') mocks.requester.mockResolvedValue({ kind: 'anonymous' });
    await expect(generateSteelWorkVisual(caseName === 'invalid id' ? '../other' : definitionId, revision)).rejects.toThrow(error);
    expect(mocks.tenant).not.toHaveBeenCalled(); expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('does not reserve quota or construct a provider model without a configured key', async () => {
    vi.stubEnv('OPENAI_API_KEY', '  ');
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('VISUAL_UNAVAILABLE');
    expect(mocks.tenant).not.toHaveBeenCalled(); expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.generation).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('scopes a foreign or stale definition lookup to the actor company and revision before any paid call', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue(null);
    await expect(generateSteelWorkVisual('foreign-definition-0001', revision)).rejects.toThrow('VISUAL_CONFLICT');
    expect(mocks.tenant).toHaveBeenCalledWith(companyId, expect.any(Function));
    expect(mocks.tx.steelWorkDefinition.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign-definition-0001', companyProfileId: companyId, revision, archivedAt: null } }));
    expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('keeps an uploaded photo and skips quota and generation', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue({ ...definition, visualStatus: 'photo', visualUpdatedAt: now });
    await expect(generateSteelWorkVisual(definitionId, revision)).resolves.toEqual({ status: 'photo', url: `/api/steel-work-visuals/${definitionId}?v=${now.getTime()}` });
    expect(mocks.tx.steelWorkDefinition.updateMany).not.toHaveBeenCalled(); expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled(); expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled();
  });

  it('does not start a second job while a recent generation is pending', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue({ ...definition, visualStatus: 'pending', updatedAt: now });
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('PHOTO_BUSY');
    expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('retains the previous image when quota reservation fails', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue({ ...definition, visualStatus: 'generated', visualUpdatedAt: new Date('2026-11-04T10:00:00Z') });
    mocks.quota.mockResolvedValue({ ok: false });
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('VISUAL_UNAVAILABLE');
    expect(mocks.generation).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled(); expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.steelWorkDefinition.updateMany).toHaveBeenLastCalledWith({ where: { id: definitionId, companyProfileId: companyId, revision, archivedAt: null, visualStatus: 'pending', updatedAt: now }, data: { visualStatus: 'error' } });
  });

  it('uses one guarded worker stream with only the definition text and saves validated scene geometry', async () => {
    await expect(generateSteelWorkVisual(definitionId, revision)).resolves.toMatchObject({ status: 'generated' });
    expect(mocks.quota).toHaveBeenCalledExactlyOnceWith(requester);
    expect(mocks.generation).toHaveBeenCalledExactlyOnceWith(expect.any(Request), 'worker', mocks.settle);
    expect(mocks.stream).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ model: 'guarded-fixture-model', maxRetries: 0, temperature: 0, prompt: JSON.stringify({ label: definition.label, kind: definition.kind, description: definition.description }) }));
    expect(mocks.tx.steelWorkVisual.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { companyProfileId_definitionId: { companyProfileId: companyId, definitionId } }, update: { data: null, scene, mime: 'image/svg+xml' } }));
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ companyProfileId: companyId, actorId: actor.userId, action: 'steel.visual_generated', payload: { definitionId, revision } }) }));
    expect(mocks.tenant.mock.calls.every(([tenant]) => tenant === companyId)).toBe(true);
  });

  it('supplies the trusted canonical key when a builtin keeps its per-language label empty', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue({ ...definition, label: '' });
    await generateSteelWorkVisual(definitionId, revision);
    expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({ prompt: JSON.stringify({ label: definition.key, kind: definition.kind, description: definition.description }) }));
  });

  it('cannot overwrite a newer photo or edit when the fenced job update matches no row', async () => {
    mocks.tx.steelWorkDefinition.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(generateSteelWorkVisual(definitionId, revision)).resolves.toEqual({ status: 'superseded', url: undefined });
    expect(mocks.tx.steelWorkDefinition.updateMany).toHaveBeenLastCalledWith({ where: { id: definitionId, companyProfileId: companyId, revision, archivedAt: null, visualStatus: 'pending', updatedAt: now }, data: { visualStatus: 'generated', visualUpdatedAt: now } });
    expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled(); expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid JSON', [{ type: 'text-delta', text: '<svg onload="unsafe"></svg>' }, { type: 'finish', finishReason: 'stop' }]],
    ['no finish', [{ type: 'text-delta', text: JSON.stringify(scene) }]],
    ['truncated finish', [{ type: 'text-delta', text: JSON.stringify(scene) }, { type: 'finish', finishReason: 'length' }]],
    ['stream error', [{ type: 'error', error: new Error('fixture provider failure') }]],
    ['stream abort', [{ type: 'abort' }]],
    ['oversized text', [{ type: 'text-delta', text: 'x'.repeat(13_000) }, { type: 'finish', finishReason: 'stop' }]],
  ])('does not persist a scene after %s', async (_name, parts) => {
    setStream(parts);
    await expect(generateSteelWorkVisual(definitionId, revision)).rejects.toThrow('VISUAL_UNAVAILABLE');
    expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled(); expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.tx.steelWorkDefinition.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyProfileId: companyId, revision, visualStatus: 'pending', updatedAt: now }), data: { visualStatus: 'error' } }));
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });
});

describe('tenant-owned bounded photo storage', () => {
  it('uses the compact WebP pipeline and records upload attribution without invoking AI', async () => {
    const file = new File([new Uint8Array([5, 6, 7])], 'fixture.png', { type: 'image/png' });
    await expect(uploadSteelWorkVisual(definitionId, revision, file)).resolves.toMatchObject({ status: 'photo' });
    expect(mocks.compact).toHaveBeenCalledExactlyOnceWith(new Uint8Array([5, 6, 7]));
    expect(mocks.tx.steelWorkVisual.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { companyProfileId_definitionId: { companyProfileId: companyId, definitionId } }, create: { companyProfileId: companyId, definitionId, data: new Uint8Array([1, 2, 3]), mime: 'image/webp' }, update: expect.objectContaining({ data: new Uint8Array([1, 2, 3]), mime: 'image/webp' }) }));
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ companyProfileId: companyId, actorType: 'ADMIN', actorId: actor.userId, action: 'steel.visual_uploaded', payload: { definitionId, bytes: 3 } }) }));
    expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('rejects a photo targeting another tenant or revision before conversion or writes', async () => {
    mocks.tx.steelWorkDefinition.findFirst.mockResolvedValue(null);
    await expect(uploadSteelWorkVisual('foreign-definition-0001', revision, new File(['fixture'], 'fixture.png', { type: 'image/png' }))).rejects.toThrow('VISUAL_CONFLICT');
    expect(mocks.tx.steelWorkDefinition.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign-definition-0001', companyProfileId: companyId, revision, archivedAt: null } }));
    expect(mocks.compact).not.toHaveBeenCalled(); expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('keeps the existing photo on compacting failure', async () => {
    mocks.compact.mockRejectedValue(new Error('PHOTO_FILE'));
    await expect(uploadSteelWorkVisual(definitionId, revision, new File(['fixture'], 'fixture.png', { type: 'image/png' }))).rejects.toThrow('PHOTO_FILE');
    expect(mocks.tx.steelWorkVisual.upsert).not.toHaveBeenCalled(); expect(mocks.tx.steelWorkDefinition.updateMany).not.toHaveBeenCalled(); expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('reads only actor-company media and renders validated stored geometry', async () => {
    mocks.tx.steelWorkVisual.findFirst.mockResolvedValue({ mime: 'image/svg+xml', scene, data: null });
    const result = await readSteelWorkVisual(definitionId);
    expect(mocks.tx.steelWorkVisual.findFirst).toHaveBeenCalledWith({ where: { companyProfileId: companyId, definitionId }, select: { data: true, scene: true, mime: true } });
    expect(result?.mime).toBe('image/svg+xml'); expect(new TextDecoder().decode(result?.data)).toContain('viewBox="0 0 320 160"');
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
