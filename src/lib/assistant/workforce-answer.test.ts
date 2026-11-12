import {expect,it} from 'vitest';
import {createCanonicalWorkforceAnswer,resolveCanonicalWorkforceIntent} from './workforce-answer';

const question='Kush po punon në zyrë dhe kush në kantier tani? Përgjigju shkurt sipas regjistrimeve.';
const stop='Kush e ka ndaluar punën sot? Dallo mbylljet automatike dhe mos e quaj ndalim mungesën e një seance aktive.';
const summary={officeWorking:1,officePaused:0,siteWorking:0,sitePaused:0,factoryWorking:0,factoryPaused:0,workshopWorking:0,workshopPaused:0,unknownLocationWorking:0,unknownLocationPaused:0,needsReview:0};
const row={workerId:'a',name:'Actual Person',status:'working',location:{kind:'office'},lastStopKind:null};
function event(state='activity',items:unknown[]=[row],total=items.length){return {toolName:'adminGetWorkforceStatus',status:'ok' as const,result:{ok:true,data:{filters:{state},summary:{...summary},items,totalMatching:total,returned:items.length,complete:items.length===total}}};}
it('recognizes current global attendance but never turns personal/history/process filters into global reads',()=>{
 expect(resolveCanonicalWorkforceIntent(question)).toMatchObject({state:'activity',groups:['office','site']});
 expect(resolveCanonicalWorkforceIntent(stop)).toMatchObject({state:'stopped'});
 for(const q of ['Kush po punon në zyrë Almet?','Kush po punonte dje në zyrë?','Kush po punon në projektin Alfa?','Kush po punon në procesin e prerjes?','Kush po punon në zyrë më 2026-11-11?'])expect(resolveCanonicalWorkforceIntent(q)).toBeNull();
});
it('replaces prose using exact row identities and never labels a partial list complete',()=>{
 const answer=createCanonicalWorkforceAnswer({intent:resolveCanonicalWorkforceIntent(question),language:'SQ'});
 const e=event();e.result.data.summary.officeWorking=2;e.result.data.totalMatching=2;e.result.data.complete=false;
 answer.observe(e);const text=answer.transformAnswer('Invented Person is in the office');
 expect(text).toContain('Në zyrë: 2 — Actual Person · emra të shfaqur 1/2');expect(text).not.toContain('Invented');
});
it('fails closed on missing, failed, narrowed or malformed source and never reuses a successful earlier result',()=>{
 for(const bad of [{...event(),status:'error' as const}, {...event(),result:{ok:false}}, {...event(),result:{ok:true,data:{...event().result.data,filters:{state:'office'}}}}, {...event(),result:{ok:true,data:{...event().result.data,returned:9}}}]){
  const a=createCanonicalWorkforceAnswer({intent:resolveCanonicalWorkforceIntent(question),language:'SQ'});a.observe(event());a.observe(bad);
  expect(a.transformAnswer('Nobody is working')).toBe('Nuk mund ta konfirmoj gjendjen e punës nga regjistrimet aktuale.');
 }
});
it('keeps automatic stop distinct and never treats no-live-session as stopped',()=>{
 const a=createCanonicalWorkforceAnswer({intent:resolveCanonicalWorkforceIntent(stop),language:'SQ'});
 a.observe(event('stopped',[{...row,status:'stopped',location:{kind:'unknown'},lastStopKind:'system'}]));
 expect(a.transformAnswer('All stopped')).toContain('Actual Person (mbyllje automatike)');
 a.observe(event('stopped',[{...row,status:'no_live_session'}]));expect(a.transformAnswer('All stopped')).toContain('Nuk mund');
});
it('answers who is working in the service workshop separately from factory and repair queues',()=>{
 const intent=resolveCanonicalWorkforceIntent('Kush po punon në oficinë tani?');expect(intent).toMatchObject({state:'workshop',groups:['workshop']});
 const a=createCanonicalWorkforceAnswer({intent,language:'SQ'}),e=event('workshop',[{...row,location:{kind:'workshop'}}]);
 e.result.data.summary.workshopWorking=1;a.observe(e);expect(a.transformAnswer('Wrong Person')).toContain('Në oficinë: 1 — Actual Person.');
});
