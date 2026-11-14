import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ToolExecutionOptions } from 'ai';
import type { RequesterContext } from './requester';
vi.mock('@/lib/assistant/workforce-status',async original=>({...await original<typeof import('./workforce-status')>(),adminGetWorkforceStatus:async(...args:unknown[])=>{state.toolCalls.push({name:'adminGetWorkforceStatus',args});return state.workforceResult??{ok:true,data:{items:[],totalMatching:0,complete:true}};}}));

type CapturedGeneration = {
  system: string;
  temperature: number;
  messages: Array<{ role: string; content: string }>;
  tools: Record<string, { execute: (input: unknown, options: ToolExecutionOptions) => Promise<unknown> }>;
  prepareStep: (input: { stepNumber: number }) => { toolChoice: string | { type: string; toolName: string }; activeTools: string[] };
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
  historyStart: vi.fn(), historyFinish: vi.fn(), trace: vi.fn(), checkpoint: vi.fn(),
  replayed: false, archiveUnavailable: false,
  summaryResult: null as unknown,
  sourceCall: null as { input: Record<string, unknown> } | null,
  workforceResult: null as unknown,
  assetSourceCall: null as { toolName: 'adminSearchCompanyAssets' | 'adminGetCompanyWorkshop' | 'adminGetWorkforceStatus'; input: Record<string, unknown> } | null,
  assetResult: null as unknown,
  documentResult: null as unknown,
  dailyResult: null as unknown,
  dailySourceCall: false,
  documentReceipts: vi.fn(),
}));
// Access per person is covered by access.integration.test.ts.
vi.mock('@/lib/assistant/access', async original => ({ ...await original<typeof import('./access')>(), hasAssistantAccess: async () => true }));
vi.mock('@/lib/assistant/document-tools', async original => ({ ...await original<typeof import('./document-tools')>(),
  adminGetSitePhaseDocuments: async () => state.documentResult ?? { ok: true, documents: [], totalMatching: 0 },
  adminGetSitePhaseDocumentReceipts: async (...args: unknown[]) => { state.documentReceipts(...args); return { ok: true, received: [] }; },
}));
vi.mock('@/lib/assistant/history', () => {
  class AssistantHistoryError extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }
  return { AssistantHistoryError,
    startRun: async (...args: unknown[]) => { state.historyStart(...args); if (state.archiveUnavailable) throw new AssistantHistoryError(503, 'HISTORY_UNAVAILABLE'); return { conversationId: 'conversation-demo', runId: 'run-demo', replayed: state.replayed, status: state.replayed ? 'completed' : 'running', answer: state.replayed ? 'Previously archived answer' : '' }; },
    finishRun: async (...args: unknown[]) => { state.historyFinish(...args); return true; },
    appendTrace: async (...args: unknown[]) => { state.trace(...args); return true; },
    checkpointRun: async (...args: unknown[]) => { state.checkpoint(...args); return true; },
  };
});
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
  return { fullStream: (async function* () {
    if (state.sourceCall) {
      await options.tools.adminGetSteelProductionSummary.execute(state.sourceCall.input, { toolCallId: 'synthetic-production', messages: [] });
    }
    if (state.assetSourceCall) {
      await options.tools[state.assetSourceCall.toolName].execute(state.assetSourceCall.input, { toolCallId: 'synthetic-asset', messages: [] });
    }
    if (state.dailySourceCall) await options.tools.adminGetSteelDailyReport.execute({ workerId: 'model-invented-filter', date: '2020-01-01' }, { toolCallId: 'synthetic-daily', messages: [] });
    yield { type: 'start-step' };
    if (state.streamFailure) {
      yield { type: 'text-delta', text: 'Partial synthetic answer' };
      yield { type: 'error', error: new Error('synthetic-private-provider-detail') };
      return;
    }
    if (state.responseText) yield { type: 'text-delta', text: state.responseText };
    yield { type: 'finish-step', finishReason: state.finishReason };
    await options.onFinish({ finishReason: state.finishReason, totalUsage: { totalTokens: 321 } });
    yield { type: 'finish', finishReason: state.finishReason };
  })() };
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
].map(name => [name, async (...args: unknown[]) => { state.toolCalls.push({ name, args }); return name === 'adminGetSteelProductionSummary' && state.summaryResult !== null ? state.summaryResult : { ok: true, syntheticMetricKg: 250 }; }])));
vi.mock('@/lib/assistant/company-tools', () => Object.fromEntries([
  'adminSearchCompanyWorkers', 'adminSearchCompanyFleet', 'adminGetCompanyFuelReceipts', 'adminSearchCompanyInventory',
].map(name => [name, async (...args: unknown[]) => { state.toolCalls.push({ name, args }); return { ok: true, rows: [] }; }])));
vi.mock('@/lib/assistant/daily-report', () => ({ adminGetSteelDailyReport: async (...args: unknown[]) => { state.toolCalls.push({ name: 'adminGetSteelDailyReport', args }); return state.dailyResult ?? { ok: false }; } }));
vi.mock('@/lib/assistant/project-activity', () => ({ adminGetStartedSteelProjects: async (...args: unknown[]) => { state.toolCalls.push({ name: 'adminGetStartedSteelProjects', args }); return { ok: true, totalMatches: 2, projects: [{ name: 'Synthetic site' }] }; } }));
vi.mock('@/lib/assistant/asset-tools', () => Object.fromEntries([
  'adminSearchCompanyAssets', 'adminGetCompanyWorkshop',
].map(name => [name, async (...args: unknown[]) => { state.toolCalls.push({ name, args }); return state.assetResult ?? { ok: true, data: { totalMatching: 1, complete: true, items: [{ name: 'Synthetic drill', availability: 'reported' }] } }; }])));

import { POST } from '@/app/api/assistant/route';
const origin = 'http://127.0.0.1:3100';
function request(question = 'Sa kg janë prodhuar sot?', headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/assistant`, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ messages: [{ role: 'user', content: question }] }) });
}
function options() { if (!state.captured) throw new Error('No generation options captured'); return state.captured; }
it('starts office/site/stopped questions with fresh canonical attendance in the current admin scope',async()=>{
 await (await POST(request('Kush po punon në zyrë dhe kush e ka ndaluar punën sot?'))).text();
 expect(options().prepareStep({stepNumber:0}).toolChoice).toEqual({type:'tool',toolName:'adminGetWorkforceStatus'});
 await options().tools.adminGetWorkforceStatus.execute({state:'office'},{toolCallId:'attendance-demo',messages:[]});
 expect(state.toolCalls.at(-1)).toMatchObject({name:'adminGetWorkforceStatus',args:[{kind:'admin',adminId:'admin-demo',companyId:'company-demo'},{state:'office'}]});
});
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('OPENAI_API_KEY', 'synthetic-never-sent'); vi.stubEnv('APP_BASE_URL', origin);
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-31T23:30:00Z'));
  state.requester = { kind: 'admin', adminId: 'admin-demo', companyId: 'company-demo', displayName: 'Synthetic admin', preferredLanguage: 'SQ', timeZone: 'Europe/Tirane' };
  state.company = { mode: 'bau' }; state.steel = true; state.identity = { status: 'not_found' };
  state.access = { ok: true }; state.quotaDenied = false; state.streamFailure = false; state.captured = null; state.toolCalls = [];
  state.responseText = 'Synthetic grounded answer'; state.finishReason = 'stop';
  state.replayed = false; state.archiveUnavailable = false;
  state.summaryResult = null; state.sourceCall = null;
  state.assetResult = null; state.assetSourceCall = null; state.workforceResult = null;
  state.documentResult = null;
  state.dailyResult = null; state.dailySourceCall = false;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it('resolves document IDs before offering receipt calls, blocks guessed versions and resets each turn', async () => {
  const id = '60000000-0000-4000-8000-000000000001', foreign = '60000000-0000-4000-8000-000000000002';
  await (await POST(request('Kush i mori dokumentet e kantierit Synthetic?'))).text();
  const initial = options(), execution = { toolCallId: 'synthetic-doc', messages: [] };
  expect(initial.prepareStep({ stepNumber: 0 }).activeTools).not.toContain('adminGetSitePhaseDocumentReceipts');
  await initial.tools.adminGetSitePhaseDocuments.execute({ projectName: 'Synthetic' }, execution);
  expect(initial.prepareStep({ stepNumber: 1 }).activeTools).not.toContain('adminGetSitePhaseDocumentReceipts');
  state.documentResult = { ok: true, documents: [{ id, supersedesId: foreign }] };
  await initial.tools.adminGetSitePhaseDocuments.execute({ projectName: 'Synthetic' }, execution);
  expect(initial.prepareStep({ stepNumber: 2 }).activeTools).toContain('adminGetSitePhaseDocumentReceipts');
  await initial.tools.adminGetSitePhaseDocumentReceipts.execute({ documentId: foreign }, execution);
  expect(state.documentReceipts).not.toHaveBeenCalled();
  await initial.tools.adminGetSitePhaseDocumentReceipts.execute({ documentId: id, status: 'received' }, execution);
  expect(state.documentReceipts).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'company-demo' }), { documentId: id, status: 'received' });
  expect(initial.prepareStep({ stepNumber: 3 }).toolChoice).toBe('none');
  await (await POST(request('Po versioni i ri?'))).text();
  expect(options().prepareStep({ stepNumber: 0 }).activeTools).not.toContain('adminGetSitePhaseDocumentReceipts');
});

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
  for (const name of ['adminSearchSteelProjects', 'adminSearchSteelElements', 'adminGetSteelElement', 'adminGetSteelProductionSummary', 'adminGetSteelProductionEvidence', 'adminGetSteelProjectBatches', 'adminSearchCompanyWorkers', 'adminSearchCompanyFleet', 'adminGetCompanyFuelReceipts', 'adminSearchCompanyInventory', 'adminSearchCompanyAssets', 'adminGetCompanyWorkshop']) expect(registered).toContain(name);
  for (const name of ['getEquipmentStatus', 'adminGetDashboardSnapshot', 'adminListBaustellenOverview', 'adminListProjects', 'getMyDailyReport', 'adminGetTeamDailyReport', 'adminGetWorkerDailyReport', 'adminGetOwnDailyReport']) expect(registered).not.toContain(name);
  expect(registered).toContain('adminGetSteelDailyReport');
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
  expect(options().tools).not.toHaveProperty('adminSearchCompanyAssets'); expect(options().tools).not.toHaveProperty('adminGetCompanyWorkshop');
  expect(options().tools).toHaveProperty('adminGetTeamDailyReport'); expect(options().tools).not.toHaveProperty('adminGetSteelDailyReport');
});

it('forces a broad dated report through steel facts, discards invented narrowing and archives the same canonical answer', async () => {
  state.dailySourceCall = true; state.responseText = '**4 trees**, 6.25 hours';
  state.dailyResult = { ok: true, date: '2026-10-31', worker: null, source: { readOnly: true, snapshot: 'repeatable-read' },
    attendance: { recordedWorkers: 3, sessionRows: 3, closedRows: 3, openRows: 0, totalHours: 23.5, complete: true, workers: [], workersComplete: false },
    production: { checks: 0, projectCount: 0, projects: [], projectsComplete: true, processCount: 0, processes: [], processesComplete: true }, selectedPhasesConfirmed: 4 };
  const response = await POST(request('Me jep nje raport per dje')), answer = await response.text();
  expect(options().prepareStep({ stepNumber: 0 }).toolChoice).toEqual({ type: 'tool', toolName: 'adminGetSteelDailyReport' });
  expect(state.toolCalls).toContainEqual({ name: 'adminGetSteelDailyReport', args: [expect.objectContaining({ adminId: 'admin-demo', companyId: 'company-demo' }), { date: '2026-10-31' }] });
  expect(answer).toContain('23,5'); expect(answer).not.toMatch(/trees|6[.,]25|\*\*/u);
  expect(state.historyFinish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ answer, diagnostics: expect.objectContaining({ canonicalDailyReport: { canonicalDailyReportApplied: true, canonicalDailyReportVerified: true } }) }));
});
it('does not pass a made-up daily report through when the new source fails', async () => {
  state.dailySourceCall = true; state.responseText = 'Everything is complete, 999 trees';
  const answer = await (await POST(request('Me jep nje raport per dje'))).text();
  expect(answer).toContain('Nuk mund ta konfirmoj'); expect(answer).not.toContain('999');
});
it('does not let the provider invent a historical date for an undated company report', async () => {
  state.dailySourceCall = true;
  await (await POST(request('Raporti ditor'))).text();
  expect(state.toolCalls).toContainEqual({ name: 'adminGetSteelDailyReport', args: [expect.anything(), { date: '2026-11-01' }] });
});
it.each([
  ['Kujt i është dorëzuar trapan Bosch?', 'adminSearchCompanyAssets'],
  ['Cilat mjete janë në riparim?', 'adminGetCompanyWorkshop'],
])('routes %s through fresh tenant-scoped read-only evidence and private diagnostics', async (question, toolName) => {
  const response = await POST(request(question)); await response.text();
  const captured = options();
  expect(captured.prepareStep({ stepNumber: 0 })).toMatchObject({ toolChoice: { type: 'tool', toolName } });
  expect(captured.prepareStep({ stepNumber: 3 })).toMatchObject({ toolChoice: 'none' });
  const result = await captured.tools[toolName].execute({ query: 'Synthetic drill' }, { toolCallId: 'synthetic-asset-read', messages: [] });
  expect(result).toMatchObject({ evidence: { source: toolName, readOnly: true, scope: 'authenticated_company' }, result: { ok: true, data: { totalMatching: 1 } } });
  expect(state.toolCalls).toContainEqual({ name: toolName, args: [expect.objectContaining({ kind: 'admin', companyId: 'company-demo' }), toolName === 'adminGetCompanyWorkshop' ? expect.objectContaining({ assetKind: 'machine', category: 'vehicle', repairPhase: 'repairing' }) : { query: 'Synthetic drill' }] });
  expect(state.trace).toHaveBeenCalledWith(expect.objectContaining({ kind: 'admin', companyId: 'company-demo' }), expect.objectContaining({ runId: 'run-demo', toolName, status: 'ok' }));
  expect(captured.system).toContain('Pending issue/return/transfer is not a completed handover');
  expect(captured.system).toContain('no bin/shelf location is tracked');
});
it('routes a harmless greeting to static capabilities instead of private business reads', async () => {
  const response = await POST(request('hello')); await response.text();
  expect(options().prepareStep({ stepNumber: 0 })).toMatchObject({ toolChoice: { type: 'tool', toolName: 'getAssistantCapabilities' } });
  expect(Object.keys(options().tools)).toEqual(['getAssistantCapabilities']);
  expect(options().prepareStep({ stepNumber: 1 })).toMatchObject({ toolChoice: 'none' });
  const capabilities = await options().tools.getAssistantCapabilities.execute({}, { toolCallId: 'synthetic-capabilities', messages: [] });
  expect(capabilities).toMatchObject({ evidence: { source: 'getAssistantCapabilities', readOnly: true } });
  expect(state.toolCalls).toEqual([]);
});
function assetRead(items: Array<Record<string, unknown>>, filters: Record<string, unknown>, totalMatching = items.length) {
  return { ok: true, readOnly: true, source: 'Canonical current company asset custody and workshop records', retrievedAt: new Date().toISOString(), data: {
    items, filters: { query: null, assetKind: null, assetId: null, category: null, holderWorkerId: null, repairPhase: null, repairLocation: null, ...filters },
    totalMatching, returned: items.length, hasMore: items.length < totalMatching, complete: items.length === totalMatching,
    countsScope: 'all_matching_assets_before_pagination',
    nextCursor: items.length < totalMatching ? 'inventory:tool-c' : null, scope: items.length < totalMatching ? 'first_page' : 'all_matching_rows',
    countsByRepairPhase: { reported: 0, received: 0, repairing: 0 },
  } };
}
it('enforces the requested repair phase and delivers/archives canonical zero instead of model phase conflation', async () => {
  state.assetSourceCall = { toolName: 'adminGetCompanyWorkshop', input: { limit: 20, repairPhase: 'active' } };
  state.assetResult = assetRead([], { assetKind: 'machine', category: 'vehicle', repairPhase: 'repairing' });
  state.responseText = 'Dy mjete janë në riparim: Synthetic van dhe Synthetic loader.';
  const response = await POST(request('Cilat mjete janë tani në riparim? Përgjigju shkurt me emrat dhe targat, nëse ka.'));
  const answer = await response.text();
  expect(answer).not.toContain('Synthetic van'); expect(answer).not.toContain('Dy mjete');
  expect(answer.toLowerCase()).toContain('riparim');
  expect(state.toolCalls).toContainEqual({ name: 'adminGetCompanyWorkshop', args: [expect.objectContaining({ kind: 'admin' }), expect.objectContaining({ repairPhase: 'repairing', assetKind: 'machine', category: 'vehicle' })] });
  expect(state.historyFinish).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ answer, diagnostics: expect.objectContaining({ canonicalAsset: expect.objectContaining({ applied: true }) }) }));
});
it('enforces inventory tool scope and preserves a partial list instead of an all-company no-holder claim', async () => {
  state.assetSourceCall = { toolName: 'adminSearchCompanyAssets', input: { limit: 3, query: '' } };
  const items = ['a', 'b', 'c'].map(id => ({ kind: 'inventory', id: `tool-${id}`, name: `Synthetic tool ${id}`, category: 'tool', code: `D-${id}`, plate: null, size: null,
    baseRecordActive: true, operationalAvailability: 'available', usable: true, recordedHolder: null, assignedSite: null, custodyBasis: 'no_recorded_holder', activeRepair: null,
    pendingHandover: null, latestCompletedHandover: null, truncatedFields: [] }));
  state.assetResult = assetRead(items, { assetKind: 'inventory', category: 'tool' }, 37);
  state.responseText = 'Të gjitha veglat janë pa mbajtës të regjistruar.';
  const response = await POST(request('Kujt i janë dorëzuar veglat e regjistruara? Jep deri në 3 emra me kodet dhe kantierin e caktuar, nëse figuron. Pa hamendësime.'));
  const answer = await response.text();
  expect(answer).not.toContain('Të gjitha'); expect(answer).toContain('37'); expect(answer).toContain('Synthetic tool a');
  expect(state.toolCalls).toContainEqual({ name: 'adminSearchCompanyAssets', args: [expect.any(Object), expect.objectContaining({ assetKind: 'inventory', category: 'tool', limit: 3 })] });
  expect(state.historyFinish).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ answer, diagnostics: expect.objectContaining({ canonicalAsset: expect.objectContaining({ applied: true }) }) }));
});
it('uses the company calendar across UTC midnight and routes fresh grounded evidence with the forced date', async () => {
  const response = await POST(request()); await response.text();
  const captured = options();
  expect(captured.system).toContain('Timezone: Europe/Tirane; today 2026-11-01');
  const evidence = await captured.tools.adminGetSteelProductionSummary.execute({ date: '2026-10-30', month: '2026-10' }, { toolCallId: 'synthetic-call', messages: [] });
  expect(state.toolCalls).toContainEqual({ name: 'adminGetSteelProductionSummary', args: [expect.objectContaining({ companyId: 'company-demo', kind: 'admin', timeZone: 'Europe/Tirane' }), { date: '2026-11-01', month: '2026-11' }] });
  expect(evidence).toMatchObject({ evidence: { source: 'adminGetSteelProductionSummary', timeZone: 'Europe/Tirane', readOnly: true, scope: 'authenticated_company' }, result: { ok: true, syntheticMetricKg: 250 } });
  expect(captured.prepareStep({ stepNumber: 0 })).toMatchObject({ toolChoice: 'required' });
  expect(captured.prepareStep({ stepNumber: 1 })).toMatchObject({ toolChoice: 'auto' });
  expect(captured.prepareStep({ stepNumber: 3 })).toMatchObject({ toolChoice: 'none' });
  expect(state.generation).toHaveBeenCalledWith(expect.any(Request), 'admin', state.settle, expect.objectContaining({ onProviderCall: expect.any(Function), onFailure: expect.any(Function) }));
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
it('archives the question before inference and exactly the delivered answer including a failure notice', async () => {
  state.streamFailure = true;
  const response = await POST(request()); const answer = await response.text();
  expect(response.headers.get('x-assistant-conversation-id')).toBe('conversation-demo');
  expect(response.headers.get('x-assistant-run-id')).toBe('run-demo');
  expect(state.historyStart.mock.invocationCallOrder[0]).toBeLessThan(state.generation.mock.invocationCallOrder[0]);
  expect(state.historyFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ adminId: 'admin-demo', companyId: 'company-demo' }), expect.objectContaining({ runId: 'run-demo', answer, status: 'partial', diagnostics: expect.objectContaining({ hasFinalAnswer: false }) }));
});
it('fails closed before paid generation if the conversation cannot be saved', async () => {
  state.archiveUnavailable = true;
  const response = await POST(request());
  expect(response.status).toBe(503); expect((await response.json()).error).toContain('nuk u ruajt');
  expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.generation).not.toHaveBeenCalled();
});
it('replays the existing message without another quota reservation or model call', async () => {
  state.replayed = true;
  const response = await POST(request());
  expect(await response.text()).toBe('Previously archived answer');
  expect(state.historyFinish).not.toHaveBeenCalled(); expect(state.quotaRead).not.toHaveBeenCalled(); expect(state.stream).not.toHaveBeenCalled();
});
it.each([
  ['sa projekte kan filluar pune', 'adminGetStartedSteelProjects'],
  ['sa kantier', 'adminSearchSteelProjects'],
] as const)('routes %s to its canonical steel source', async (question, toolName) => {
  await (await POST(request(question))).text();
  expect(options().prepareStep({ stepNumber: 0 })).toMatchObject({ toolChoice: { type: 'tool', toolName } });
  expect(options().system).toContain('normally one or two sentences');
  expect(options().system).toContain('Expand only when the user explicitly asks for details');
});
it('archives a quota rejection as a rejected run, not a successful business answer', async () => {
  state.quotaDenied = true;
  const response = await POST(request()); const body = await response.json();
  expect(state.historyFinish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ answer: body.error, status: 'rejected', errorCode: 'QUOTA_REJECTED', httpStatus: 429 }));
});

function productionSource() {
  const zero = { kg: 0, pieces: 0, legacyPieces: 0, missingPieces: 0 };
  const metrics = {
    cutParts: zero,
    cutAssemblies: { kg: 123.45, pieces: 5, legacyPieces: 5, missingPieces: 0 },
    assembled: { kg: 67.89, pieces: 2, legacyPieces: 0, missingPieces: 0 },
  };
  return { ok: true, month: '2026-10', selectedDate: '2026-10-31', dailyProduction: [{ key: '2026-10-31', metrics }],
    monthlyProduction: metrics, projectCount: 1, projectPageComplete: true,
    selectedDayProjectsPageComplete: true, selectedDayProjects: [{ id: 'synthetic-site', name: 'Demo site', metrics }],
  };
}
it('replaces a model sum with separate canonical factory metrics and archives exactly that answer', async () => {
  state.summaryResult = productionSource(); state.sourceCall = { input: {} };
  state.responseText = 'Fabrika prodhoi 191.34 kg gjithsej.';
  const response = await POST(request('Sa materiale ka bërë fabrika dje? Përgjigju shkurt me një fjali.'));
  const answer = await response.text();
  expect(options().prepareStep({ stepNumber: 0 })).toMatchObject({ toolChoice: { type: 'tool', toolName: 'adminGetSteelProductionSummary' } });
  expect(answer).toContain('Prerje asamblesh: 5 copë, ≈123,45 kg');
  expect(answer).toContain('Asambluar: 2 copë, 67,89 kg');
  expect(answer).not.toContain('191.34'); expect(answer).not.toContain('gjithsej');
  expect(state.checkpoint).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ answer }));
  expect(state.historyFinish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ answer, diagnostics: expect.objectContaining({ canonicalProduction: { applied: true, unavailable: false } }) }));
});
it('uses daily project facts for a detail follow-up instead of returning the invented model answer', async () => {
  state.summaryResult = productionSource(); state.sourceCall = { input: {} }; state.responseText = 'Invented combined total';
  const req = new Request(`${origin}/api/assistant`, { method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [
      { role: 'user', content: 'Sa materiale ka bërë fabrika dje?' },
      { role: 'assistant', content: 'Untrusted older answer' },
      { role: 'user', content: 'Më jep detajet sipas projektit për dje.' },
    ] }),
  });
  const answer = await (await POST(req)).text();
  expect(answer).toContain('"Demo site":'); expect(answer).toContain('≈123,45 kg'); expect(answer).toContain('67,89 kg');
  expect(answer).not.toContain('Invented');
  expect(options().prepareStep({ stepNumber: 0 })).toMatchObject({ toolChoice: { type: 'tool', toolName: 'adminGetSteelProductionSummary' } });
});
it('does not turn a failed factory source into a guessed total or zero confirmations', async () => {
  state.summaryResult = { ok: false, error: 'unavailable' }; state.sourceCall = { input: {} };
  state.responseText = 'Nuk ka prodhim: 0 kg.';
  const answer = await (await POST(request('Sa materiale ka bërë fabrika dje?'))).text();
  expect(answer).toContain('Nuk kam konfirmime të plota'); expect(answer).not.toContain('0 kg');
  expect(state.historyFinish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ answer, diagnostics: expect.objectContaining({ canonicalProduction: { applied: true, unavailable: true } }) }));
});


it('replaces invented attendance names before emitting and archiving, and discards model-invented filters',async()=>{
 state.workforceResult={ok:true,data:{filters:{state:'activity',limit:30},summary:{activeWorkers:3,working:3,officeWorking:1,officePaused:0,siteWorking:1,sitePaused:0,factoryWorking:0,factoryPaused:0,workshopWorking:0,workshopPaused:0,unknownLocationWorking:1,unknownLocationPaused:0,needsReview:0},items:[{workerId:'a',name:'Office Person',status:'working',location:{kind:'office'}},{workerId:'b',name:'Site Person',status:'working',location:{kind:'site'}},{workerId:'c',name:'Unknown Person',status:'working',location:{kind:'unknown'}}],totalMatching:3,returned:3,complete:true}};
 state.assetSourceCall={toolName:'adminGetWorkforceStatus',input:{state:'office',query:'Invented Person',limit:1}};
 state.responseText='In the office: Invented Person and Unknown Person.';
 const answer=await (await POST(request('Kush po punon në zyrë dhe kush në kantier tani? Përgjigju shkurt sipas regjistrimeve.'))).text();
 expect(answer).toContain('Në zyrë: 1 — Office Person.');expect(answer).toContain('Në kantier: 1 — Site Person.');expect(answer).toContain('1 punonjës kanë punë aktive pa vend të konfirmuar.');
 expect(answer).not.toContain('Invented');expect(answer).not.toContain('Unknown Person');
 expect(state.toolCalls.at(-1)?.args[1]).toEqual({state:'activity',limit:30});
 expect(state.historyFinish).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({answer,status:'completed',diagnostics:expect.objectContaining({canonicalWorkforce:{applied:true,unavailable:false}})}));
});
