import type {CanonicalAssistantAssetInput} from '@/lib/company-assets/service';
import type {AssistantToolObservation} from './grounding';
import type {AssistantLanguageCode} from './language';

export type CanonicalAssetIntent={toolName:'adminSearchCompanyAssets'|'adminGetCompanyWorkshop';domain:'assets'|'custody'|'workshop';global:true;assetKind?:'machine'|'inventory';category?:'vehicle'|'tool'|'equipment';repairPhase?:'active'|'reported'|'received'|'repairing';repairLocation?:'internal'|'external';limit:number};
type Observation=Pick<AssistantToolObservation,'toolName'|'input'|'result'|'status'>;
const normalize=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').replace(/ł/g,'l').replace(/ß/g,'ss').toLowerCase().replace(/\s+/g,' ').trim();
// An unfamiliar word can be a person, brand, code or site: retain normal tools.
const allowed=new Set(('cilat cilet cili sa cfare ku kujt kush i jane eshte tani aktualisht ne riparim oficine oficina mjete mjetet makina makinat automjete automjetet vegla veglat pajisje pajisjet paisje paisjet kemi ka ndodhen dorezuar dorezuara regjistruar regjistruara te e me dhe pergjigju shkurt emrat emra targat targa kodet kodi kantierin kantieri caktuar jep deri nese figuron figurojne nje fjali vetem lista listo trego brendshem brendshme jashtem jashtme raportuar raportuara pranuar pranuara '
 +'which what where who whom to how many are is the a an current currently now in under being repaired repair workshop vehicles machines tools equipment registered held issued handed over have been list show give up first names name plates plate codes code assigned site if recorded any answer briefly short sentence only internal external reported received '
 +'welche welcher wie viele wo wem wer an wen sind ist die der das jetzt gerade aktuell in im reparatur werkstatt fahrzeuge maschinen werkzeuge ausrustung registriert registrierten ubergeben ausgegeben zeige zeig liste gib bis zu erste ersten namen kennzeichen codes code zugewiesene baustelle falls vorhanden antworte kurz einem satz intern interne extern externe gemeldet angenommen').split(/\s+/));

/** Only explicit global, current lists. No inference of named/entity/history filters. */
export function resolveCanonicalAssetIntent(question:string):CanonicalAssetIntent|null{
 if(typeof question!=='string'||question.length>500)return null;
 let text=normalize(question).replace(/\b(?:pa hamendesime|without guessing|do not guess|no assumptions|nicht raten|ohne vermutungen)\b/gu,'');
 if(/\b(?:jo|nuk|mos|not|no|without|nicht|keine\w*|ohne|except|excluding|unassigned|unheld|unbekannt|dje|neser|sot|yesterday|tomorrow|today|gestern|morgen|heute|last|previous|histor\w*|jav\w*|muaj\w*|week\w*|month\w*|woche\w*|monat\w*|krahas\w*|compar\w*|versus|vs|between|zwischen|finished|completed|ready|fertig|gati|gps|imei|latitude|longitude|koordinat\w*)\b/u.test(text))return null;
 if(!/^(?:cil\w*|sa\b|cfare\b|ku\b|kujt\b|kush\b|trego\b|listo\b|jep\b|me\b|which\b|what\b|where\b|who\b|to whom\b|how many\b|list\b|show\b|give\b|welche\w*|wie viele\b|wo\b|wem\b|wer\b|an wen\b|zeige?\b|liste\b|gib\b)/u.test(text))return null;
 const requested=/\b(?:deri ne|up to|bis zu|first|erste[n]?)\s+(\d{1,2})\b/u.exec(text),limit=requested?Math.max(1,Math.min(8,Number(requested[1]))):8;
 if(requested)text=text.replace(requested[0],requested[0].replace(/\d+/u,''));
 if(/\d|["'`@#/:=<>]/u.test(text))return null;
 const words=text.match(/\p{L}+/gu)??[];if(words.some(word=>!allowed.has(word)))return null;
 const vehicle=/\b(?:mjete|mjetet|makina|makinat|automjete|automjetet|vehicles|machines|fahrzeuge|maschinen)\b/u.test(text);
 const tool=/\b(?:vegla|veglat|tools|werkzeuge)\b/u.test(text),equipment=/\b(?:pajisje|pajisjet|paisje|paisjet|equipment|ausrustung)\b/u.test(text);
 if(Number(vehicle)+Number(tool)+Number(equipment)>1)return null;
 const strictRepair=/\b(?:ne riparim|under repair|being repaired|in repair(?!\s+workshop)|in reparatur)\b/u.test(text),reported=/\b(?:raportuar|raportuara|reported|gemeldet)\b/u.test(text),received=/\b(?:pranuar|pranuara|received|angenommen)\b/u.test(text);
 if(/\brepaired\b/u.test(text)&&!/\bbeing repaired\b/u.test(text))return null;
 if(Number(strictRepair)+Number(reported)+Number(received)>1)return null;
 const workshop=/\b(?:oficine|oficina|workshop|werkstatt)\b/u.test(text)||strictRepair;
 if(!workshop&&(reported||received)||!workshop&&!vehicle&&!tool&&!equipment)return null;
 const external=/\b(?:jashtem|jashtme|external|extern|externe)\b/u.test(text),internal=/\b(?:brendshem|brendshme|internal|intern|interne)\b/u.test(text);
 if(external&&internal||!workshop&&(external||internal))return null;
 const custody=/\b(?:ku|kujt|kush|dorezuar|dorezuara|where|who|whom|held|issued|handed|wo|wem|wer|ubergeben|ausgegeben)\b/u.test(text);
 return {toolName:workshop?'adminGetCompanyWorkshop':'adminSearchCompanyAssets',domain:workshop?'workshop':custody?'custody':'assets',global:true,...(vehicle?{assetKind:'machine' as const,category:'vehicle' as const}:tool?{assetKind:'inventory' as const,category:'tool' as const}:equipment?{assetKind:'inventory' as const,category:'equipment' as const}:{}),...(workshop?{repairPhase:strictRepair?'repairing' as const:reported?'reported' as const:received?'received' as const:'active' as const}:{}),...(external?{repairLocation:'external' as const}:internal?{repairLocation:'internal' as const}:{}),limit};
}

/** A recognized global question cannot inherit model-invented/stale entity filters. */
export function applyCanonicalAssetFilters(intent:CanonicalAssetIntent|null,toolName:string,input:CanonicalAssistantAssetInput):CanonicalAssistantAssetInput{
 if(!intent||!intent.global||toolName!==intent.toolName)return input;
 return {...(intent.assetKind?{assetKind:intent.assetKind}:{}),...(intent.category?{category:intent.category}:{}),...(intent.repairPhase?{repairPhase:intent.repairPhase}:{}),...(intent.repairLocation?{repairLocation:intent.repairLocation}:{}),limit:intent.limit};
}

const phases=['reported','received','repairing'] as const;
const routes:Record<AssistantLanguageCode,{internal:string;external:string}>={SQ:{internal:'oficina e firmës',external:'servis i jashtëm'},EN:{internal:'internal service',external:'external service'},DE:{internal:'interne Werkstatt',external:'externe Werkstatt'},IT:{internal:'officina interna',external:'officina esterna'},RO:{internal:'service intern',external:'service extern'},PL:{internal:'warsztat wewnętrzny',external:'warsztat zewnętrzny'}};
const states=['available','issued','handover','reported','workshop','loss_pending','retirement_pending','lost','retired','inactive'];
const copy={
 SQ:{types:['Asete','Mjete','Vegla','Pajisje'],recorded:'të regjistruara',active:'raste aktive në oficinë',phase:['Raportuar','Pranuar në oficinë','Në riparim'],state:['i disponueshëm në sistem','i dorëzuar','dorëzim në pritje','defekt i raportuar','në oficinë','humbje në pritje','dalje nga përdorimi në pritje','i humbur','jashtë përdorimit','joaktiv'],holder:'mbajtës i regjistruar',unknown:'mbajtësi i regjistruar nuk konfirmohet',responsibility:'përgjegjësi e regjistruar',site:'kantier i caktuar',noSite:'kantieri nuk figuron',pending:'në pritje',shown:'Shfaqur',more:'lista vazhdon',unavailable:'Nuk mund ta konfirmoj këtë listë nga të dhënat e marra.'},
 EN:{types:['Assets','Vehicles','Tools','Equipment'],recorded:'recorded',active:'active workshop cases',phase:['Reported','Received in workshop','Repairing'],state:['available in system','issued','handover pending','defect reported','in workshop','loss pending','retirement pending','lost','retired','inactive'],holder:'recorded holder',unknown:'recorded holder unknown',responsibility:'recorded responsibility',site:'assigned site',noSite:'site not recorded',pending:'pending',shown:'Shown',more:'more remain',unavailable:'I cannot confirm this list from the retrieved records.'},
 DE:{types:['Assets','Fahrzeuge','Werkzeuge','Ausrüstung'],recorded:'erfasst',active:'aktive Werkstattfälle',phase:['Gemeldet','In der Werkstatt angenommen','In Reparatur'],state:['im System verfügbar','ausgegeben','Übergabe ausstehend','Defekt gemeldet','in der Werkstatt','Verlust ungeklärt','Ausmusterung ausstehend','verloren','ausgemustert','inaktiv'],holder:'erfasster Besitzer',unknown:'erfasster Besitzer unbekannt',responsibility:'erfasste Verantwortung',site:'zugewiesene Baustelle',noSite:'Baustelle nicht erfasst',pending:'ausstehend',shown:'Angezeigt',more:'weitere vorhanden',unavailable:'Diese Liste lässt sich aus den abgerufenen Daten nicht bestätigen.'},
 IT:{types:['Beni','Veicoli','Utensili','Attrezzature'],recorded:'registrati',active:'casi attivi in officina',phase:['Segnalato','Ricevuto in officina','In riparazione'],state:['disponibile nel sistema','consegnato','consegna in attesa','guasto segnalato','in officina','perdita in attesa','dismissione in attesa','perso','dismesso','inattivo'],holder:'assegnatario registrato',unknown:'assegnatario registrato sconosciuto',responsibility:'responsabilità registrata',site:'cantiere assegnato',noSite:'cantiere non registrato',pending:'in attesa',shown:'Mostrati',more:'ne restano altri',unavailable:'Non posso confermare questa lista dai dati recuperati.'},
 RO:{types:['Bunuri','Vehicule','Unelte','Echipamente'],recorded:'înregistrate',active:'cazuri active în atelier',phase:['Raportat','Primit în atelier','În reparație'],state:['disponibil în sistem','predat','predare în așteptare','defect raportat','în atelier','pierdere în așteptare','casare în așteptare','pierdut','casat','inactiv'],holder:'deținător înregistrat',unknown:'deținător înregistrat necunoscut',responsibility:'responsabilitate înregistrată',site:'șantier alocat',noSite:'șantier neînregistrat',pending:'în așteptare',shown:'Afișate',more:'mai există',unavailable:'Nu pot confirma lista din datele recuperate.'},
 PL:{types:['Zasoby','Pojazdy','Narzędzia','Sprzęt'],recorded:'zarejestrowane',active:'aktywne sprawy warsztatowe',phase:['Zgłoszone','Przyjęte do warsztatu','W naprawie'],state:['dostępne w systemie','wydane','przekazanie oczekujące','zgłoszona usterka','w warsztacie','utrata oczekująca','wycofanie oczekujące','utracone','wycofane','nieaktywne'],holder:'zarejestrowany posiadacz',unknown:'zarejestrowany posiadacz nieznany',responsibility:'zarejestrowana odpowiedzialność',site:'przypisany plac budowy',noSite:'plac budowy niezarejestrowany',pending:'oczekuje',shown:'Pokazano',more:'pozostały kolejne',unavailable:'Nie mogę potwierdzić listy na podstawie pobranych danych.'},
} satisfies Record<AssistantLanguageCode,unknown>;
const record=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
// The chat renders literal React text, not Markdown/HTML. Preserve codes exactly.
const label=(value:unknown,max=48)=>{if(typeof value!=='string')return null;const chars=Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu,' ').replace(/\s+/g,' ').trim());return chars.length?chars.slice(0,max).join('')+(chars.length>max?'…':''):null;};
const bytes=(value:string)=>new TextEncoder().encode(value).length;

/** Replaces only the small current/global question family, before delivery/archive. */
export function createCanonicalAssetAnswer({intent,language}:{intent:CanonicalAssetIntent|null;language:AssistantLanguageCode}){
 const text=copy[language];let canonical:string|null=null,applied=false;
 return {
  observe(event:Observation){
   if(!intent||event.toolName!==intent.toolName)return;
   canonical=null;
   const result=record(event.result),data=record(result?.data),filters=record(data?.filters);
   if(event.status!=='ok'||result?.ok!==true||!data||!filters||result.truncated===true||data.truncated===true)return;
   // event.input is the raw model input; execution may have safely corrected it.
   for(const key of ['assetKind','category','repairPhase','repairLocation'] as const)if((filters[key]??null)!==(intent[key]??null))return;
   if(['query','assetId','holderWorkerId','cursor'].some(key=>filters[key]!=null&&filters[key]!==''))return;
   if(!Array.isArray(data.items)||!count(data.totalMatching)||!count(data.returned)||data.returned!==data.items.length||data.returned>20||data.returned>data.totalMatching||data.returned===0&&data.totalMatching>0||typeof data.complete!=='boolean'||typeof data.hasMore!=='boolean'||!['first_page','all_matching_rows'].includes(String(data.scope))||data.countsScope!=='all_matching_assets_before_pagination')return;
   if(data.hasMore?typeof data.nextCursor!=='string'||!data.nextCursor:data.nextCursor!==null)return;
   if(data.complete?data.hasMore||data.returned!==data.totalMatching:!data.hasMore)return;
   const metrics=record(data.countsByRepairPhase);
   if(intent.domain==='workshop'&&(!metrics||phases.some(phase=>!count(metrics[phase]))||phases.reduce((sum,phase)=>sum+(metrics[phase] as number),0)!==data.totalMatching||intent.repairPhase!=='active'&&metrics[intent.repairPhase!]!==data.totalMatching))return;
   const lines:string[]=[],seen=new Set<string>();
   for(const raw of data.items){
    const row=record(raw),holder=record(row?.recordedHolder),site=record(row?.assignedSite),repair=record(row?.activeRepair),pending=record(row?.pendingHandover);
    if(!row||typeof row.id!=='string'||!['machine','inventory'].includes(String(row.kind))||!['vehicle','tool','equipment','clothing'].includes(String(row.category))||!label(row.name)||!states.includes(String(row.operationalAvailability))||seen.has(`${row.kind}:${row.id}`)||intent.assetKind&&row.kind!==intent.assetKind||intent.category&&row.category!==intent.category)return;
    if(row.recordedHolder!==null&&!holder||row.assignedSite!==null&&!site||holder&&!label(holder.name)||site&&!label(site.name))return;
    seen.add(`${row.kind}:${row.id}`);
    if(intent.domain==='workshop'&&(!repair||!phases.includes(repair.phase as typeof phases[number])||intent.repairPhase!=='active'&&repair.phase!==intent.repairPhase||intent.repairLocation&&repair.location!==intent.repairLocation))return;
    if(Array.isArray(row.truncatedFields)&&row.truncatedFields.some(field=>typeof field==='string'&&/^(?:name|code|plate|recordedHolder|assignedSite)/u.test(field)))return;
    const identifier=label(row.plate??row.code,26);
    const status=intent.domain==='workshop'?text.phase[phases.indexOf(repair!.phase as typeof phases[number])]:text.state[states.indexOf(String(row.operationalAvailability))];
    const responsibility=['lost','retired'].includes(String(row.operationalAvailability));
    const details=[`${label(row.name)}${identifier?` (${identifier})`:''}`,status,holder?`${responsibility?text.responsibility:text.holder}: ${label(holder.name,36)}`:text.unknown];
    if(site)details.push(`${text.site}: ${label(site.name,40)}`);else if(intent.domain==='custody')details.push(text.noSite);
    if(pending){const recipient=record(pending.to);if(pending.status!=='pending'||pending.to!==null&&!recipient||recipient&&!label(recipient.name))return;details.push(`${text.pending}${recipient?` → ${label(recipient.name,36)}`:''}`);}
    if(intent.domain==='workshop'&&!['reported','workshop'].includes(String(row.operationalAvailability)))details.push(text.state[states.indexOf(String(row.operationalAvailability))]);
    lines.push(details.join(' · '));
   }
   const type=text.types[intent.category==='vehicle'?1:intent.category==='tool'?2:intent.category==='equipment'?3:0];
   const phase=intent.domain==='workshop'?intent.repairPhase==='active'?text.active:text.phase[phases.indexOf(intent.repairPhase as typeof phases[number])]:text.recorded;
   const route=intent.repairLocation?` · ${routes[language][intent.repairLocation]}`:'';
   const head=`${type} · ${text.recorded}${intent.domain==='workshop'?` · ${phase}`:''}${route}: ${data.totalMatching}.`,selected:string[]=[];
   // UTF-8 bytes are a conservative token upper bound; stay below1024 tokens.
   for(const line of lines.slice(0,intent.limit)){const next=[head,...selected,line,`${text.shown} ${selected.length+1}/${data.totalMatching}; ${text.more}.`].join('\n');if(bytes(next)>1000)break;selected.push(line);}
   if(lines.length&&!selected.length)return;
   canonical=[head,...selected,...(selected.length<data.totalMatching?[`${text.shown} ${selected.length}/${data.totalMatching}; ${text.more}.`]:[])].join('\n');
  },
  transformAnswer(original:string){if(!intent)return original;applied=true;return canonical??text.unavailable;},
  snapshot(){return {applied,unavailable:applied&&canonical===null};},
 };
}
