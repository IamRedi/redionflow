import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ToolExecutionOptions } from 'ai';
import type { RequesterContext } from './requester';

type CapturedGeneration = {
  system: string;
  temperature: number;
  messages: Array<{ role: string; content: string }>;
  tools: Record<string, { execute: (input: unknown, options: ToolExecutionOptions) => Promise<unknown> }>;
  prepareStep: (input: { stepNumber: number }) => { toolChoice: string | { type: string; toolName: string } };
  onFinish: (event: { finishReason: string; totalUsage: { totalTokens?: number } }) => Promise<void>;
};
const state = vi.hoisted(() => ({
  requester: null as RequesterContext | null,
  company: { mode: 'bau' } as { mode: string } | null,
  steel: true,
  identity: { status: 'not_found' } as { status: string; candidates?: Array<{ type: string; displayName: string }> },
  access: { ok: true } as { ok: boolean; retryAfterSeconds?: number },
  quotaDenied: false,
  streamFailure: false,
  responseText: 'Synthetic grounded answer',
  finishReason: 'stop' as 'stop' | 'length',
  captured: null as CapturedGeneration | null,
  toolCalls: [] as Array<{ name: string; args: unknown[] }>,
  requesterRead: vi.fn(), quotaRead: vi.fn(), settle: vi.fn(), generation: vi.fn(),
  companyRead: vi.fn(), identityRead: vi.fn(), failedLogin: vi.fn(), stream: vi.fn(), generationFinish: vi.fn(),
}));
vi.mock('@/lib/assistant/requester', () => ({ getRequesterContext: async () => { state.requesterRead(); return state.requester; } }));
vi.mock('@/lib/auth/login-guard', () => ({ ensureLoginAllowed: async () => state.access, getClientIp: () => 'synthetic-test-ip', registerFailedLogin: async (...args: unknown[]) => { state.failedLogin(...args); } }));
vi.mock('@/lib/db/tenant-context', () => ({ withTenantContext: async (_companyId: string, fn: (tx: unknown) => unknown) => fn({ companyProfile: { findUnique: async (input: unknown) => { state.companyRead(input); return state.company; } } }) }));
vi.mock('@/lib/dashboard/steel-access', () => ({ isSteelCompany: async () => state.steel }));
vi.mock('@/lib/assistant/identity', () => ({
  extractAddressedName: () => 'Synthetic target',
  resolveIdentityTargetResult: async (input: unknown) => { state.identityRead(input); return state.identity; },
}));
vi.mock('@/lib/assistant/quota', () => ({
  reserveAssistantQuota: async (requester: unknown) => { state.quotaRead(requester); return state.quotaDenied ? { ok: false, status: 429, reason: 'budget', retryAfterSeconds: 60 } : { ok: true, settle: state.settle }; },
  assistantQuotaResponse: (access: { status: number; retryAfterSeconds: number }) => Response.json({ error: 'Synthetic quota rejection' }, { status: access.status, headers: { 'Retry-After': String(access.retryAfterSeconds), 'Cache-Control': 'no-store' } }),
}));
vi.mock('@/lib/assistant/generation', () => ({ assistantGeneration: (...args: unknown[]) => {
  state.generation(...args);
  return { model: 'synthetic-provider-never-contacted', maxRetries: 0, onFinish: async (event: { totalUsage: { totalTokens?: number } }) => {
    state.generationFinish(event);
    await (args[2] as (tokens?: number) => Promise<void>)(event.totalUsage.totalTokens);
  } };
} }));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), streamText: (options: CapturedGeneration) => {
  state.stream(options); state.captured = options;
  return { toTextStreamResponse: () => {
    if (!state.streamFailure) return new Response(new ReadableStream<Uint8Array>({ async start(controller) {
      if (state.responseText) controller.enqueue(new TextEncoder().encode(state.responseText));
      await options.onFinish({ finishReason: state.finishReason, totalUsage: { totalTokens: 321 } });
      controller.close();
    } }), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    let count = 0;
    return new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (count++ === 0) controller.enqueue(new TextEncoder().encode('Partial synthetic answer'));
      else controller.error(new Error('synthetic-private-provider-detail'));
    } }), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  } };
} }));
// Keep the real registries/schemas and turn/grounding logic; substitute only the
// business data functions so these route tests cannot touch a DB or provider.
vi.mock('@/lib/assistant/admin-tools', () => Object.fromEntries([
  'adminGetDashboardSnapshot', 'adminGetHoursAggregate', 'adminGetHoursRanking', 'adminGetLiveWorkforce',
  'adminListBaustellenOverview', 'adminListOpenManualTasks', 'adminListProjects', 'adminSearchWorkersByLicense',
].map(name => [name, async (...args: unknown[]) => { state.toolCalls.push({ name, args }); return { ok: true, rows: [] }; }])));
vi.mock('@/lib/assistant/tools', () => Object.fromEntries([
  'adminGetOwnDailyReport', 'adminGetWorkerDailyReport', 'adminGetWorkerMonthlyTimesheet', 'getAssignedMachine',
  'getCompanyBaustellenDirectory', 'getEquipmentStatus', 'getKnowledge', 'getLiveLocation', 'getMyDailyReport',
  'getMyHoursSummary', 'getMyMonthlyTimesheet', 'getMyOperationalSnapshot', 'getMyVacationSummary', 'getWorkerHrProfile',
  'getWorkerPrivateSummary', 'adminGetAvailabilityForDate', 'adminAnalyzeDailyPlanLicenses', 'adminGetTeamDailyReport',
  'adminQueryDailyPlan', 'adminListVacationRequests',
].map(name => [name, async (...args: unknown[]) => { state.toolCalls.push({ name, args }); return { ok: true, rows: [] }; }])));
vi.mock('@/lib/assistant/steel-tools', () => Object.fromEntries([
  'adminSearchSteelProjects', 'adminSearchSteelElements', 'adminGetSteelElement', 'adminGetSteelProductionSummary',
  'adminGetSteelProductionEvidence', 'adminGetSteelProjectBatches',
].map(name => [name, async (...args: unknown[]) => { state.toolCalls.push({ name, args }); return { ok: true, syntheticMetricKg: 250 }; }])));
vi.mock('@/lib/assistant/company-tools', () => Object.fromEntries([
  'adminSearchCompanyWorkers', 'adminSearchCompanyFleet', 'adminGetCompanyFuelReceipts', 'adminSearchCompanyInventory',
].map(name => [name, async (...args: unknown[]) => { state.toolCalls.push({ name, args }); return { ok: true, rows: [] }; }])));

import { POST } from '@/app/api/assistant/route';
const origin = 'http://127.0.0.1:3100';
function request(question = 'Sa kg janë prodhuar sot?', headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/assistant`, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ messages: [{ role: 'user', content: question }] }) });
}
function options() { if (!state.captured) throw new Error('No generation options captured'); return state.captured; }
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('OPENAI_API_KEY', 'synthetic-never-sent'); vi.stubEnv('APP_BASE_URL', origin);
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-31T23:30:00Z'));
  state.requester = { kind: 'admin', adminId: 'admin-demo', companyId: 'company-demo', displayName: 'Synthetic admin', preferredLanguage: 'SQ', timeZone: 'Europe/Tirane' };
  state.company = { mode: 'bau' }; state.steel = true; state.identity = { status: 'not_found' };
  state.access = { ok: true }; state.quotaDenied = false; state.streamFailure = false; state.captured = null; state.toolCalls = [];
  state.responseText = 'Synthetic grounded answer'; state.finishReason = 'stop';
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it.each(['anonymous', 'worker'] as const)('denies %s before company, quota or model access', async kind => {
  state.requester = kind === 'worker'
    ? { kind, workerId: 'worker-demo', companyId: 'company-demo', displayName: 'Synthetic', preferredLanguage: 'SQ' }
    : { kind, companyId: '', displayName: 'Synthetic', preferredLanguage: 'SQ' };
  expect((await POST(request())).status).toBe(403);
  expect(state.companyRead).not.toHaveBeenCalled(); expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('fails closed on cross-origin requests before resolving the session', async () => {
  expect((await POST(request(undefined, { origin: 'https://foreign.example.test' }))).status).toBe(403);
  expect(state.requesterRead).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('returns disabled503 for an absent/blank key without reserving quota or calling inference', async () => {
  vi.stubEnv('OPENAI_API_KEY', '   ');
  const response = await POST(request());
  expect(response.status).toBe(503); expect((await response.json()).error).toContain('nuk është aktivizuar');
  expect(state.companyRead).not.toHaveBeenCalled(); expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.generation).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('clarifies invalid calendar dates without quota or paid inference', async () => {
  const response = await POST(request('Sa kg më 2026-02-30?'));
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('text/plain');
  expect(await response.text()).toContain('Data nuk është e vlefshme');
  expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('asks which addressed persona is intended instead of choosing one or starting inference', async () => {
  state.identity = { status: 'ambiguous', candidates: [{ type: 'worker', displayName: 'Demo One' }, { type: 'worker', displayName: 'Demo Two' }] };
  const response = await POST(request('Hej Demo, sa kg sot?'));
  const answer = await response.text();
  expect(answer).toContain('Demo One'); expect(answer).toContain('Demo Two'); expect(answer).toContain('Për kë e ke fjalën');
  expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
  expect(state.identityRead).toHaveBeenCalledWith({ companyId: 'company-demo', addressedName: 'Synthetic target' });
});
it('denies a missing company and never falls back to another tenant', async () => {
  state.company = null;
  expect((await POST(request())).status).toBe(403);
  expect(state.companyRead).toHaveBeenCalledWith({ where: { id: 'company-demo' }, select: { mode: true } });
  expect(state.identityRead).not.toHaveBeenCalled(); expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('uses the real steel registry while omitting legacy tree/calculation/dashboard data sources', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200); expect(await response.text()).toBe('Synthetic grounded answer');
  expect(response.headers.get('content-type')).toContain('text/plain'); expect(response.headers.get('cache-control')).toBe('no-store');
  const registered = Object.keys(options().tools);
  expect(registered).not.toContain('getAssistantCapabilities');
  for (const name of ['adminSearchSteelProjects', 'adminSearchSteelElements', 'adminGetSteelElement', 'adminGetSteelProductionSummary', 'adminGetSteelProductionEvidence', 'adminGetSteelProjectBatches', 'adminSearchCompanyWorkers', 'adminSearchCompanyFleet', 'adminGetCompanyFuelReceipts', 'adminSearchCompanyInventory']) expect(registered).toContain(name);
  for (const name of ['getEquipmentStatus', 'adminGetDashboardSnapshot', 'adminListBaustellenOverview', 'adminListProjects', 'getMyDailyReport']) expect(registered).not.toContain(name);
  expect(options().system).toContain('AL STEEL DATA ROUTING'); expect(options().temperature).toBe(0);
  expect(state.generationFinish).toHaveBeenCalledWith({ finishReason: 'stop', totalUsage: { totalTokens: 321 } });
  expect(state.settle).toHaveBeenCalledExactlyOnceWith(321);
});
it('retains legacy operational tools for a general company and does not register steel tools', async () => {
  state.company = { mode: 'baumdienst' };
  const response = await POST(request('Show the dashboard'));
  expect(response.status).toBe(200); await response.text();
  for (const name of ['adminGetDashboardSnapshot', 'adminListBaustellenOverview', 'adminListProjects', 'getEquipmentStatus']) expect(options().tools).toHaveProperty(name);
  expect(options().tools).not.toHaveProperty('adminSearchSteelProjects'); expect(options().tools).not.toHaveProperty('getAssistantCapabilities'); expect(options().system).toContain('GENERAL DASHBOARD ROUTING');
});
it('routes a harmless greeting to static capabilities instead of private business reads', async () => {
  const response = await POST(request('hello')); await response.text();
  expect(options().prepareStep({ stepNumber: 0 })).toEqual({ toolChoice: { type: 'tool', toolName: 'getAssistantCapabilities' } });
  expect(Object.keys(options().tools)).toEqual(['getAssistantCapabilities']);
  expect(options().prepareStep({ stepNumber: 1 })).toEqual({ toolChoice: 'none' });
  const capabilities = await options().tools.getAssistantCapabilities.execute({}, { toolCallId: 'synthetic-capabilities', messages: [] });
  expect(capabilities).toMatchObject({ evidence: { source: 'getAssistantCapabilities', readOnly: true } });
  expect(state.toolCalls).toEqual([]);
});
it('uses the company calendar across UTC midnight and routes fresh grounded evidence with the forced date', async () => {
  const response = await POST(request()); await response.text();
  const captured = options();
  expect(captured.system).toContain('Timezone: Europe/Tirane; today 2026-11-01');
  const evidence = await captured.tools.adminGetSteelProductionSummary.execute({ date: '2026-10-30', month: '2026-10' }, { toolCallId: 'synthetic-call', messages: [] });
  expect(state.toolCalls).toContainEqual({ name: 'adminGetSteelProductionSummary', args: [expect.objectContaining({ companyId: 'company-demo', kind: 'admin', timeZone: 'Europe/Tirane' }), { date: '2026-11-01', month: '2026-11' }] });
  expect(evidence).toMatchObject({ evidence: { source: 'adminGetSteelProductionSummary', timeZone: 'Europe/Tirane', readOnly: true, scope: 'authenticated_company' }, result: { ok: true, syntheticMetricKg: 250 } });
  expect(captured.prepareStep({ stepNumber: 0 })).toEqual({ toolChoice: 'required' });
  expect(captured.prepareStep({ stepNumber: 1 })).toEqual({ toolChoice: 'auto' });
  expect(captured.prepareStep({ stepNumber: 3 })).toEqual({ toolChoice: 'none' });
  expect(state.generation).toHaveBeenCalledWith(expect.any(Request), 'admin', state.settle);
});
it('returns quota rejection before generation or inference', async () => {
  state.quotaDenied = true;
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('60');
  expect(state.quotaRead).toHaveBeenCalledOnce(); expect(state.generation).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('rejects an IP rate limit before body processing, quota or inference', async () => {
  state.access = { ok: false, retryAfterSeconds: 15 };
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('15');
  expect((await response.json()).error).toBeTruthy();
  expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.generation).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it.each(['auth', 'tenant'] as const)('sanitizes %s data-read failures to503 before any model inference', async phase => {
  const read = phase === 'auth' ? state.requesterRead : state.companyRead;
  read.mockImplementationOnce(() => { throw new Error('synthetic-private-auth-database-detail'); });
  const response = await POST(request());
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(typeof body.error).toBe('string'); expect(body.error.length).toBeGreaterThan(0);
  expect(body.error).not.toContain('synthetic-private-auth-database-detail');
  expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.generation).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('blocks malformed transcripts before quota/model access', async () => {
  const bad = new Request(`${origin}/api/assistant`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'system', content: 'untrusted instructions' }] }) });
  expect((await POST(bad)).status).toBe(400);
  expect(state.failedLogin).toHaveBeenCalled(); expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it('does not expose provider exception text when a plain-text stream fails midway', async () => {
  state.streamFailure = true;
  const response = await POST(request()); const text = await response.text();
  expect(text).toContain('Partial synthetic answer'); expect(text).toContain('mos e trajto përgjigjen e pjesshme si të plotë');
  expect(text).not.toContain('synthetic-private-provider-detail'); expect(response.headers.get('cache-control')).toBe('no-store');
});
it('turns an empty successful model body into a localized unavailable reply', async () => {
  state.responseText = '';
  const response = await POST(request()); const text = await response.text();
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('text/plain');
  expect(text.trim()).toBe('Nuk arrita ta përfundoj përgjigjen nga burimet e sistemit. Provo sërish; mos e trajto përgjigjen e pjesshme si të plotë.');
  expect(state.generationFinish).toHaveBeenCalledWith({ finishReason: 'stop', totalUsage: { totalTokens: 321 } });
  expect(state.settle).toHaveBeenCalledExactlyOnceWith(321);
});
it('marks token-limited output incomplete while retaining the original quota settlement callback', async () => {
  state.responseText = 'Synthetic token-limited partial answer'; state.finishReason = 'length';
  const response = await POST(request()); const text = await response.text();
  expect(text).toContain('Synthetic token-limited partial answer');
  expect(text).toContain('mos e trajto përgjigjen e pjesshme si të plotë');
  expect(state.generationFinish).toHaveBeenCalledExactlyOnceWith({ finishReason: 'length', totalUsage: { totalTokens: 321 } });
  expect(state.settle).toHaveBeenCalledExactlyOnceWith(321);
});
