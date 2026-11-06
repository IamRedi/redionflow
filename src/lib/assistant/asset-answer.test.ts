import {expect,it} from 'vitest';
import type {AssistantLanguageCode} from './language';
import {applyCanonicalAssetFilters,createCanonicalAssetAnswer,resolveCanonicalAssetIntent,type CanonicalAssetIntent} from './asset-answer';

const workshopQuestion='Cilat mjete janë tani në riparim? Përgjigju shkurt me emrat dhe targat, nëse ka.';
const custodyQuestion='Kujt i janë dorëzuar veglat e regjistruara? Jep deri në 3 emra me kodet dhe kantierin e caktuar, nëse figuron. Pa hamendësime.';
function intent(question:string){const value=resolveCanonicalAssetIntent(question);expect(value).not.toBeNull();return value!;}
const asset=(id='item-a',overrides:Record<string,unknown>={})=>({id,kind:'inventory',category:'tool',name:'Fictional drill',code:'DRILL-A',plate:null,operationalAvailability:'available',recordedHolder:null,assignedSite:null,activeRepair:null,pendingHandover:null,truncatedFields:[],...overrides});
function data(scope:CanonicalAssetIntent,items:unknown[],total=items.length){
 const metrics={reported:0,received:0,repairing:0};if(scope.domain==='workshop')metrics[scope.repairPhase==='active'?'received':scope.repairPhase!]=total;
 return {items,totalMatching:total,returned:items.length,complete:items.length===total,hasMore:items.length<total,nextCursor:items.length<total?'inventory:item-next':null,scope:items.length===total?'all_matching_rows':'first_page',countsScope:'all_matching_assets_before_pagination',countsByRepairPhase:metrics,filters:{query:null as string|null,assetId:null,holderWorkerId:null,assetKind:scope.assetKind??null,category:scope.category??null,repairPhase:scope.repairPhase??null,repairLocation:scope.repairLocation??null}};
}
function guard(question=custodyQuestion,language:AssistantLanguageCode='SQ'){const value=intent(question);return {value,answer:createCanonicalAssetAnswer({intent:value,language})};}
function observe(test:ReturnType<typeof guard>,payload:unknown,rawInput:unknown={}){test.answer.observe({toolName:test.value.toolName,status:'ok',input:rawInput,result:{ok:true,retrievedAt:'2026-11-06T10:00:00Z',data:payload}});}

it('recognizes the two real failure question shapes without copying private production payloads',()=>{
 expect(intent(workshopQuestion)).toMatchObject({global:true,toolName:'adminGetCompanyWorkshop',domain:'workshop',assetKind:'machine',category:'vehicle',repairPhase:'repairing'});
 expect(intent(custodyQuestion)).toMatchObject({global:true,toolName:'adminSearchCompanyAssets',domain:'custody',assetKind:'inventory',category:'tool',limit:3});
});
it.each([
 ['Which vehicles are currently under repair?','repairing'],['Welche Fahrzeuge sind gerade in Reparatur?','repairing'],
 ['Cilat mjete janë në oficinë?','active'],['What is in the workshop now?','active'],['Welche Fahrzeuge sind in der Werkstatt?','active'],
 ['Which vehicles are received in the workshop?','received'],['Welche Fahrzeuge sind in der Werkstatt gemeldet?','reported'],
])('derives explicit phase without equating workshop intake and repair: %s',(question,phase)=>expect(intent(question).repairPhase).toBe(phase));
it.each([
 'Kujt i është dorëzuar trapan Fictional?', 'Kujt i janë dorëzuar veglat për Demo?', 'Ku janë veglat e punëtorit Demo?',
 'Which vehicles are not in repair?', 'Cilat mjete nuk janë në riparim?', 'Cilat mjete janë jo vetëm në riparim?',
 'Which vehicles are under repair and received in the workshop?', 'Which vehicles were repaired yesterday?',
 'What did the workshop finish today?', 'How many repairs were completed?', 'Cilat mjete janë gati?',
 'Which vehicles have been repaired?',
 'Which unassigned tools are available?', 'Show tools without a holder', 'Where is the GPS location of the vehicles?',
 'Cilat mjete ishin në riparim më 2026-11-04?', 'Which tools are in project Demo?', 'How do I report a vehicle defect?',
 'Compare workshop vehicles', 'Which vehicles and tools are in the workshop?',
])('leaves unsupported, named, negated and historical questions on the normal grounded path: %s',question=>expect(resolveCanonicalAssetIntent(question)).toBeNull());
it('clears stale global scopes and contradictory model categories but preserves normal scoped inputs',()=>{
 const source={query:'Old named item',assetId:'old-id',assetKind:'machine' as const,category:'vehicle' as const,holderWorkerId:'old-worker',cursor:'machine:old-page',repairPhase:'active' as const,repairLocation:'external' as const,limit:20};
 expect(applyCanonicalAssetFilters(intent(custodyQuestion),'adminSearchCompanyAssets',source)).toEqual({assetKind:'inventory',category:'tool',limit:3});
 expect(applyCanonicalAssetFilters(intent(workshopQuestion),'adminGetCompanyWorkshop',source)).toEqual({assetKind:'machine',category:'vehicle',repairPhase:'repairing',limit:8});
 expect(applyCanonicalAssetFilters(null,'adminSearchCompanyAssets',source)).toBe(source);
 expect(applyCanonicalAssetFilters(intent(workshopQuestion),'adminSearchCompanyAssets',source)).toBe(source);
});
it('distinguishes explicit external repair routes and does not invent a location filter',()=>{
 expect(intent('Which vehicles are under repair external?')).toMatchObject({repairLocation:'external'});
 expect(intent(workshopQuestion).repairLocation).toBeUndefined();expect(resolveCanonicalAssetIntent('Which vehicles are under repair external and internal?')).toBeNull();
});
it('blocks active/received source rows for a strict repairing question, then accepts corrected execution despite raw active args',()=>{
 const test=guard(workshopQuestion),active={...test.value,repairPhase:'active' as const};
 const received=asset('vehicle-a',{kind:'machine',category:'vehicle',name:'Fictional van',plate:'ZZ 101 DM',code:null,operationalAvailability:'workshop',activeRepair:{phase:'received',location:'internal'}});
 observe(test,data(active,[received, {...received,id:'vehicle-b'}]),{repairPhase:'active'});
 expect(test.answer.transformAnswer('Both vehicles are being repaired.')).toContain('Nuk mund');expect(test.answer.snapshot().unavailable).toBe(true);
 observe(test,data(test.value,[]),{repairPhase:'active'});
 const answer=test.answer.transformAnswer('There are two vehicles in repair.');expect(answer).toContain('Në riparim: 0');expect(answer).toContain('të regjistruara');expect(answer).not.toContain('Pranuar');expect(test.answer.snapshot()).toEqual({applied:true,unavailable:false});
});
it('renders actual stages for generic workshop questions instead of calling every active case repairing',()=>{
 const test=guard('Cilat mjete janë në oficinë?');
 const rows=['reported','received','repairing'].map((phase,index)=>asset(`vehicle-${index}`,{kind:'machine',category:'vehicle',plate:`ZZ 10${index} DM`,operationalAvailability:phase==='reported'?'reported':'workshop',activeRepair:{phase,location:'internal'}}));
 const source=data(test.value,rows);source.countsByRepairPhase={reported:1,received:1,repairing:1};observe(test,source);
 const answer=test.answer.transformAnswer('All three vehicles are in repair.');expect(answer).toContain('raste aktive në oficinë: 3');for(const phase of ['Raportuar','Pranuar në oficinë','Në riparim'])expect(answer).toContain(phase);
});
it('rejects a partial vehicle catalog as evidence about tools and accurately labels a corrected partial tool page',()=>{
 const test=guard(),vehicleScope={...test.value,assetKind:'machine' as const,category:'vehicle' as const};
 observe(test,data(vehicleScope,[asset('van-a',{kind:'machine',category:'vehicle'})],41));expect(test.answer.transformAnswer('All tools have no holder.')).toContain('Nuk mund');
 const rows=[asset('tool-a'),asset('tool-b',{name:'Fictional saw',code:'SAW-B'}),asset('tool-c',{name:'Fictional driver',code:'DRIVER-C'})];observe(test,data(test.value,rows,41));
 const answer=test.answer.transformAnswer('All registered tools have no holder.');expect(answer).toContain('Shfaqur 3/41');expect(answer).toContain('lista vazhdon');expect(answer).toContain('nuk konfirmohet');expect(answer).not.toMatch(/warehouse|magazin|All registered/u);
});
it('keeps scope-specific zero evidence separate from a global no-assets claim',()=>{
 const test=guard(workshopQuestion);observe(test,data(test.value,[]));const answer=test.answer.transformAnswer('No assets exist.');expect(answer).toContain('Mjete');expect(answer).toContain('Në riparim: 0');expect(answer).not.toContain('No assets');
});
it('qualifies an externally filtered empty result instead of implying all repairs are absent',()=>{
 const test=guard('Which vehicles are under repair external?');observe(test,data(test.value,[]));const answer=test.answer.transformAnswer('No company repairs exist.');expect(answer).toContain('servis i jashtëm');expect(answer).toContain(': 0.');expect(answer).not.toContain('No company');
});
it('keeps duplicate global names distinguishable by recorded codes without choosing an arbitrary item',()=>{
 const test=guard();observe(test,data(test.value,[asset('a',{code:'D-A'}),asset('b',{code:'D-B'})]));const answer=test.answer.transformAnswer('Choose the first drill.');expect(answer).toContain('(D-A)');expect(answer).toContain('(D-B)');expect(answer).not.toContain('Choose');
});
it('distinguishes lost responsibility, current holder and pending recipient without inventing warehouse possession',()=>{
 const test=guard(),alice={id:'worker-a',name:'Fictional Alice'},bob={id:'worker-b',name:'Fictional Bob'};
 observe(test,data(test.value,[asset('a',{operationalAvailability:'lost',recordedHolder:alice}),asset('b',{operationalAvailability:'handover',recordedHolder:alice,assignedSite:{id:'site-a',name:'Fictional site'},pendingHandover:{status:'pending',to:bob}})]));
 const answer=test.answer.transformAnswer('Bob has both tools in the warehouse.');expect(answer).toContain('përgjegjësi e regjistruar: Fictional Alice');expect(answer).toContain('mbajtës i regjistruar: Fictional Alice');expect(answer).toContain('në pritje → Fictional Bob');expect(answer).toContain('kantier i caktuar: Fictional site');expect(answer).not.toContain('warehouse');
});
it.each(['failed','truncated','wrong-filter','wrong-count','continuation','missing-row','truncated-name'])('returns unavailable for %s source evidence rather than model inference',mode=>{
 const test=guard(),source=data(test.value,[asset()]);
 if(mode==='failed')test.answer.observe({toolName:test.value.toolName,status:'error',input:{},result:{ok:false,code:'DATA_UNAVAILABLE'}});
 else {if(mode==='truncated')Object.assign(source,{truncated:true});if(mode==='wrong-filter')source.filters.query='named item';if(mode==='wrong-count')source.returned=2;if(mode==='continuation')source.scope='continuation_page';if(mode==='missing-row'){source.items=[];source.returned=0;source.totalMatching=4;source.complete=false;source.hasMore=true;source.nextCursor='inventory:next';}if(mode==='truncated-name')source.items=[asset('a',{truncatedFields:['name']})];observe(test,source);}
 expect(test.answer.transformAnswer('Invented confident answer')).toContain('Nuk mund');expect(test.answer.snapshot().unavailable).toBe(true);
});
it('does not treat unrelated tools as evidence and preserves unsupported answers unchanged',()=>{
 const test=guard();test.answer.observe({toolName:'adminSearchCompanyFleet',status:'ok',input:{},result:{ok:true,data:data(test.value,[asset()])}});expect(test.answer.transformAnswer('Invented')).toContain('Nuk mund');
 const normal=createCanonicalAssetAnswer({intent:null,language:'SQ'});expect(normal.transformAnswer('Normal grounded response')).toBe('Normal grounded response');expect(normal.snapshot()).toEqual({applied:false,unavailable:false});
});
it('renders safe literal labels for the plain React chat, signals clipping and never invents an ID suffix code',()=>{
 const test=guard(),name='Fictional\n**drill**\u202e <label>';
 observe(test,data(test.value,[asset('id-is-not-an-asset-code',{name,code:'AB-123.CD',recordedHolder:{id:'worker-a',name:'A'.repeat(80)}})]));let answer=test.answer.transformAnswer('Wrong');expect(answer).toContain('(AB-123.CD)');expect(answer).not.toContain('\\-');expect(answer).not.toContain('\u202e');expect(answer).toContain('…');expect(answer.split('\n')).toHaveLength(2);
 observe(test,data(test.value,[asset('id-is-not-an-asset-code',{code:null,plate:null})]));answer=test.answer.transformAnswer('Wrong');expect(answer).not.toContain('#');expect(answer).not.toContain('asset-code');
});
it.each(['SQ','EN','DE','IT','RO','PL'] as AssistantLanguageCode[])('renders bounded source facts in %s',language=>{
 const test=guard('Which tools are registered?',language);observe(test,data(test.value,[asset()]));const answer=test.answer.transformAnswer('Wrong');expect(answer).toContain('DRILL-A');expect(answer).toContain(': 1.');expect(answer).not.toBe('Wrong');expect(test.answer.snapshot().unavailable).toBe(false);expect(new TextEncoder().encode(answer).length).toBeLessThanOrEqual(1000);
});
it('bounds deterministic output and reports the rendered prefix when a complete source list cannot fit',()=>{
 const test=guard('Which tools are registered?','PL'),rows=Array.from({length:8},(_,i)=>asset(`item-${i}`,{name:'Ż'.repeat(80),code:`CODE-${i}`,recordedHolder:{id:`worker-${i}`,name:'Ł'.repeat(60)},assignedSite:{id:'site-a',name:'Ś'.repeat(70)}}));observe(test,data(test.value,rows));const answer=test.answer.transformAnswer('Wrong');expect(new TextEncoder().encode(answer).length).toBeLessThanOrEqual(1000);expect(answer).toMatch(/Pokazano [1-7]\/8/u);expect(answer).toContain('pozostały kolejne');
});
