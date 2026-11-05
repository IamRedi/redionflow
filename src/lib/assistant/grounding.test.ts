import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ToolExecutionOptions } from 'ai';
import { assistantMetaQuestion, groundedStep, groundedTools } from './grounding';

const options: ToolExecutionOptions = { toolCallId:'synthetic', messages:[] };
const clock = () => new Date('2026-11-05T10:00:00Z');
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
