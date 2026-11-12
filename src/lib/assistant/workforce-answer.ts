import type { AssistantToolObservation } from './grounding';
import { assistantInitialTool } from './grounding';
import type { AssistantLanguageCode } from './language';
import type { adminGetWorkforceStatus } from './workforce-status';

type Success = Extract<Awaited<ReturnType<typeof adminGetWorkforceStatus>>, {ok:true}>;
export type WorkforceIntent = {state:'activity'|'office'|'site'|'factory'|'stopped'; groups:string[]; details:boolean};
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const allowed=new Set(('kush cilet cilat sa po punon punojne punonjes punonjesit punetore punetoret duke punuar jane eshte ne zyre zyra kantier kantiere kantieret fabrike fabrika ka e i te qe dhe apo ose tani aktualisht sot ndaluar ndal ndalu punen ndaloi ndalur perfunduar pergjigju shkurt sipas regjistrimeve dhenave reale trego listo emrat vetem me jep detaje detajet hollesisht per te gjithe gjith kushdo dallo mbylljet automatike mos quaj ndalim mungesen nje seance aktive pa hamendje '
 +'who which how many is are working workers employees at in office site sites factory and or now currently today stopped work clocked out answer briefly short according to records recorded data show list names only give details detailed all distinguish automatic closures do not treat missing active session as stop without guessing').split(/\s+/));

/** Narrow current/global questions only; unfamiliar names, dates and filters keep normal tools. */
export function resolveCanonicalWorkforceIntent(question:string):WorkforceIntent|null {
 const text=fold(question);
 if(assistantInitialTool(question,true)!=='adminGetWorkforceStatus'||/\d/u.test(text))return null;
 if((text.match(/\p{L}+/gu)??[]).some(w=>!allowed.has(w)))return null;
 const stopped=/\b(ndalu\w*|ndal\w*|stopped|clocked out)\b/u.test(text);
 const groups=[/\b(zyr\w*|office)\b/u.test(text)?'office':'',/\b(kantier\w*|sites?)\b/u.test(text)?'site':'',/\b(fabrik\w*|factory)\b/u.test(text)?'factory':''].filter(Boolean);
 if(stopped&&groups.length)return null;
 return {state:stopped?'stopped':groups.length===1?groups[0] as 'office'|'site'|'factory':'activity',groups,details:/\b(detaj\w*|hollesisht|details|detailed)\b/u.test(text)};
}

const record=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const validCount=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const clean=(s:string)=>s.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu,' ').replace(/\s+/gu,' ').trim().slice(0,100);

/** Render verified row identities before delivery AND archive; model prose cannot relabel people. */
export function createCanonicalWorkforceAnswer({intent,language}:{intent:WorkforceIntent|null;language:AssistantLanguageCode}) {
 const sq=language==='SQ',unavailable=sq?'Nuk mund ta konfirmoj gjendjen e punës nga regjistrimet aktuale.':'I cannot confirm current attendance from the records.';
 let canonical:string|null=null,applied=false;
 return {
  observe(event:Pick<AssistantToolObservation,'toolName'|'status'|'result'>){
   if(!intent||event.toolName!=='adminGetWorkforceStatus')return;
   canonical=null;
   const result=record(event.result),data=record(result?.data),filters=record(data?.filters),summary=record(data?.summary);
   if(event.status!=='ok'||result?.ok!==true||!data||!filters||!summary||filters.state!==intent.state||filters.workerId||filters.query||filters.cursor)return;
   if(!Array.isArray(data.items)||!validCount(data.totalMatching)||data.returned!==data.items.length||data.returned>data.totalMatching||typeof data.complete!=='boolean')return;
   if(!['officeWorking','officePaused','siteWorking','sitePaused','factoryWorking','factoryPaused','unknownLocationWorking','unknownLocationPaused','needsReview'].every(k=>validCount(summary[k]))||data.complete&&data.returned!==data.totalMatching)return;
   const rows=data.items as Success['data']['items'],seen=new Set<string>();
   for(const row of rows){
    if(typeof row.workerId!=='string'||seen.has(row.workerId)||typeof row.name!=='string'||!clean(row.name)||!['working','paused','stopped','no_live_session','needs_review'].includes(row.status)||!row.location||!['office','site','factory','unknown'].includes(row.location.kind))return;
    seen.add(row.workerId);
   }
   const lines:string[]=[],cap=intent.details?12:5;
   const names=(selected:typeof rows,total:number)=>{
    const shown=selected.slice(0,cap).map(r=>`${clean(r.name)}${r.status==='paused'?(sq?' (pauzë)':' (paused)'):''}${r.status==='stopped'&&r.lastStopKind==='system'?(sq?' (mbyllje automatike)':' (automatic closure)'):''}`);
    return shown.join(', ')+(shown.length<total?` · ${sq?'emra të shfaqur':'names shown'} ${shown.length}/${total}`:'');
   };
   if(intent.state==='stopped'){
    if(rows.some(r=>r.status!=='stopped'||!['system','recorded'].includes(r.lastStopKind??'')))return;
    lines.push(data.totalMatching?`${sq?'Me ndalim të regjistruar sot':'With a recorded stop today'}: ${data.totalMatching} — ${names(rows,data.totalMatching)}.`:sq?'Sot nuk figuron ndalim i regjistruar pa një seancë tjetër aktive.':'No stop is recorded today without another active session.');
   }else{
    for(const group of intent.groups.length?intent.groups:['office','site','factory']){
     const selected=rows.filter(r=>(r.status==='working'||r.status==='paused')&&r.location.kind===group);
     const total=Number(summary[`${group}Working`])+Number(summary[`${group}Paused`]);
     if(!Number.isSafeInteger(total)||total<selected.length)return;
     const title=group==='office'?(sq?'Në zyrë':'Office'):group==='site'?(sq?'Në kantier':'Site'):(sq?'Në fabrikë':'Factory');
     lines.push(`${title}: ${total}${total?` — ${names(selected,total)}`:''}.`);
    }
    const unknown=Number(summary.unknownLocationWorking)+Number(summary.unknownLocationPaused);
    if(unknown)lines.push(sq?`${unknown} punonjës kanë punë aktive pa vend të konfirmuar.`:`${unknown} workers have active clocks with unconfirmed location.`);
   }
   if(summary.needsReview)lines.push(sq?`${summary.needsReview} regjistrime kërkojnë kontroll.`:`${summary.needsReview} records need review.`);
   // No second paid request, source pagination or output-budget increase.
   const text=lines.join('\n');if(new TextEncoder().encode(text).length>1800)return;
   canonical=text;
  },
  transformAnswer(original:string){if(!intent)return original;applied=true;return canonical??unavailable;},
  snapshot(){return {applied,unavailable:applied&&canonical===null};},
 };
}
