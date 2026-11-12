import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ToolExecutionOptions } from 'ai';
import { assistantInitialTool, assistantMetaQuestion, groundedStep, groundedTools } from './grounding';

const options: ToolExecutionOptions = { toolCallId:'synthetic', messages:[] };
const clock = () => new Date('2026-11-05T10:00:00Z');
it.each(['Kush po punon në zyrë?','Kush po punon në kantier?','Kush e ka ndaluar punën sot?','Who is working in the office?'])('routes current attendance to recorded workforce evidence: %s',question=>{
 expect(assistantInitialTool(question,true)).toBe('adminGetWorkforceStatus');
});
it('keeps historical attendance and project start questions separate',()=>{
 expect(assistantInitialTool('Kush po punonte dje në zyrë?',true)).not.toBe('adminGetWorkforceStatus');
 expect(assistantInitialTool('Sa kantiere kanë filluar punë?',true)).toBe('adminGetStartedSteelProjects');
});
function guarded(execute: (input: unknown) => Promise<unknown>) {
  return groundedTools({ read: { inputSchema:z.object({}), execute: (input: unknown, _options: ToolExecutionOptions) => execute(input) } }, 'Europe/Tirane', clock).read.execute!;
}

it('requires fresh evidence, permits follow-up reads and reserves the final step for an answer', () => {
  expect(groundedStep({stepNumber:0})).toEqual({toolChoice:'required'});
  expect(groundedStep({stepNumber:1})).toEqual({toolChoice:'auto'});
  expect(groundedStep({stepNumber:3})).toEqual({toolChoice:'none'});
  expect(groundedStep({stepNumber:0},true)).toEqual({toolChoice:{type:'tool',toolName:'getAssistantCapabilities'}});
  expect(groundedStep({stepNumber:1},true)).toEqual({toolChoice:'none'});
});
it.each(['hej','Përshëndetje!','thanks','Çfarë mund të bësh?','What can you do?'])('routes harmless meta turn %s away from private business reads', text => {
  expect(assistantMetaQuestion(text)).toBe(true);
});
it.each(['Hej, sa kg u prenë sot?','Çfarë mund të bësh për projektin Agroni?','Sa fatura ka Megi?'])('does not mistake operational turn %s for a greeting', text => {
  expect(assistantMetaQuestion(text)).toBe(false);
});
it('retains exact totals, original timestamps, missing weights and partial-page provenance', async () => {
  const result={ok:true,generatedAt:'2026-11-05T09:59:00Z',total:34,rows:[{mark:'A1',kg:null}],complete:false,nextCursor:'a1'};
  const run=guarded(async()=>result);
  const output=await run({},options);
  expect(output).toEqual({evidence:{source:'read',retrievedAt:clock().toISOString(),timeZone:'Europe/Tirane',scope:'authenticated_company',readOnly:true,untrustedText:true},result});
});
it('a failed source cannot be silently converted into zero and exception secrets stay private',async()=>{
  const run=guarded(async()=>{throw Error('postgresql://sensitive:key@private/query');});
  const output=await run({},options);
  expect(output).toMatchObject({ok:false,code:'READ_UNAVAILABLE'});
  expect(JSON.stringify(output)).not.toContain('sensitive');
  expect(JSON.stringify(output)).not.toContain('totalHours');
});
it.each([{date:'2026-02-30'},{month:'2026-13'},{rangeFrom:'not-a-date'}])('rejects invalid calendar input before the data query',async input=>{
  const query=vi.fn(async()=>({ok:true})),run=guarded(query);
  expect(await run(input,options)).toMatchObject({ok:false,code:'INVALID_DATE'});
  expect(query).not.toHaveBeenCalled();
});
it('does not truncate an oversized report and pretend it is a complete total',async()=>{
  const run=guarded(async()=>({ok:true,rows:[{notes:'x'.repeat(26*1024)}],total:100}));
  const output=await run({},options);
  expect(output).toMatchObject({ok:false,code:'RESULT_TOO_LARGE'});
  expect(JSON.stringify(output)).not.toContain('"total":100');
});
it('records safe tool failure evidence without SQL or secret exception text', async () => {
  const observe = vi.fn(async () => {});
  const tools = groundedTools({ read: { inputSchema: z.object({}), execute: async (_input: unknown, _options: ToolExecutionOptions) => { throw { name: 'PrismaClientKnownRequestError', code: 'P2022', message: 'private SQL credentials' }; } } }, 'Europe/Tirane', clock, observe);
  const result = await tools.read.execute!({}, options);
  expect(result).toMatchObject({ ok: false, code: 'READ_UNAVAILABLE', diagnostic: { code: 'db' } });
  expect(observe).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'read', status: 'error', failure: expect.objectContaining({ code: 'db' }) }));
  expect(JSON.stringify(observe.mock.calls)).not.toContain('private SQL');
});
it('selects a construction-site source while leaving unrelated worker/quantity questions open', () => {
  expect(assistantInitialTool('Sa kantiere kanë filluar punë?', true)).toBe('adminGetStartedSteelProjects');
  expect(assistantInitialTool('Sa kantier?', true)).toBe('adminSearchSteelProjects');
  expect(assistantInitialTool('Sa punëtorë ka te kantieri?', true)).toBeUndefined();
  expect(assistantInitialTool('Sa kantier?', false)).toBeUndefined();
});
it.each([
  ['Cilat mjete janë në riparim?', 'adminGetCompanyWorkshop'],
  ['Cilat makina janë në oficinë të jashtme?', 'adminGetCompanyWorkshop'],
  ['Which vehicles are being repaired?', 'adminGetCompanyWorkshop'],
  ['Welche Fahrzeuge sind in der Werkstatt?', 'adminGetCompanyWorkshop'],
  ['Kujt i është dorëzuar trapan Bosch?', 'adminSearchCompanyAssets'],
  ['Ku ndodhet vegla te kantieri Agroni?', 'adminSearchCompanyAssets'],
  ['Who has the drill?', 'adminSearchCompanyAssets'],
  ['Who has the drill from the workshop?', 'adminSearchCompanyAssets'],
  ['Wo ist das Werkzeug?', 'adminSearchCompanyAssets'],
])('routes the asset/workshop question %s to its canonical source', (question, tool) => {
  expect(assistantInitialTool(question, true)).toBe(tool);
  expect(assistantInitialTool(question, false)).toBeUndefined();
});
it('leaves worker-specific asset discovery open instead of forcing an invented worker ID', () => {
  expect(assistantInitialTool('Cilat vegla i janë dorëzuar Arditit?', true)).toBeUndefined();
  expect(assistantInitialTool('Sa mjete ka në kantierin Agroni?', true)).toBeUndefined();
  expect(assistantInitialTool('Sa materiale janë dorëzuar në projektin Agroni?', true)).toBeUndefined();
  expect(assistantInitialTool('Si mund të raportoj një defekt?', true)).toBe('getPlatformGuide'); // how-to goes to the app guide, never to workshop data
  expect(assistantInitialTool('Si hap oficinën?', true)).toBe('getPlatformGuide'); // how-to goes to the app guide, never to workshop data
  expect(assistantInitialTool('Where do I report a defect?', true)).toBe('getPlatformGuide'); // how-to goes to the app guide, never to workshop data
  expect(assistantInitialTool('Ku ndodhen veglat e punëtorit Ardit?', true)).toBeUndefined();
});
it('preserves optional Zod arguments instead of letting Responses normalize them to required null', () => {
  const schema = z.object({ query: z.string().optional(), limit: z.number().int().optional() });
  const tools = groundedTools({ read: { inputSchema: schema, execute: async (input: z.infer<typeof schema>) => ({ ok: true, input }) } }, 'Europe/Tirane');
  expect(tools.read).toMatchObject({ strict: false });
  expect(schema.safeParse({}).success).toBe(true);
  expect(schema.safeParse({ query: null, limit: null }).success).toBe(false);
});
