import {streamText} from 'ai';
import {assistantLanguagePromptLabel,languageForTurn} from '@/lib/assistant/language';
import {ZodError} from 'zod';
import {rejectCrossOriginMutation} from '@/lib/auth/same-origin';
import {assistantGeneration} from '@/lib/assistant/generation';
import {reserveAssistantQuota,assistantQuotaResponse} from '@/lib/assistant/quota';
import {getRequesterContext} from '@/lib/assistant/requester';
import {categorizeAssistantFailure} from '@/lib/assistant/diagnostics';
import {officeAssistantActor,officeAssistantInput,officeAssistantEvidence,officeAssistantFiles,beginOfficeAssistantTurn,finishOfficeAssistantTurn,officeAssistantHistory,personalOfficePrompt} from '@/lib/offices/assistant-service';
import {OfficeError} from '@/lib/offices/work-access';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function input(req:Request){
 if(Number(req.headers.get('content-length'))>96*1024)throw new OfficeError('LIMIT');
 const reader=req.body?.getReader();if(!reader)throw new OfficeError('INVALID');
 let size=0,timedOut=false;const chunks:Uint8Array[]=[];
 const timer=setTimeout(()=>{timedOut=true;void reader.cancel().catch(()=>{});},10000);
 try{while(true){const {done,value}=await reader.read();if(timedOut)throw new OfficeError('INVALID');if(done)break;size+=value.byteLength;if(size>96*1024){void reader.cancel().catch(()=>{});throw new OfficeError('LIMIT');}chunks.push(value);}return officeAssistantInput.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));}finally{clearTimeout(timer);reader.releaseLock();}
}
export async function GET(req:Request){
 try{return json(await officeAssistantHistory(new URL(req.url).searchParams.get('conversation')??undefined));}
 catch{return json({error:'Nuk ka akses në bisedën personale.'},403);}
}
export async function POST(req:Request){
 const denied=rejectCrossOriginMutation(req);if(denied)return denied;
 let started:string|undefined;
 try{
  await officeAssistantActor();const data=await input(req);
  if(!process.env.OPENAI_API_KEY)return json({error:'Asistenti përkohësisht nuk është i disponueshëm.'},503);
  const begun=await beginOfficeAssistantTurn(data);started=data.requestId;
  if(begun.replay)return begun.turn.status==='pending'?json({error:'Kërkesa po përpunohet.'},409):json({id:begun.turn.id,answer:begun.turn.answer,status:begun.turn.status,sources:begun.turn.sources});
  const requester=await getRequesterContext();
  if(requester.kind!=='worker'||requester.workerId!==begun.actor.id||requester.companyId!==begun.actor.companyId)throw new OfficeError('DENIED');
  await officeAssistantActor();const quota=await reserveAssistantQuota(requester);
  if(!quota.ok){await finishOfficeAssistantTurn(data.requestId,{answer:'',status:'error',diagnostics:{code:'QUOTA_REJECTED'}});return assistantQuotaResponse(quota,requester.preferredLanguage);}
  const evidence=await officeAssistantEvidence(data);
  // Parsing can take time: recheck the selected document keys before the paid call.
  if(data.siteId){const current=await officeAssistantFiles(data.siteId);if(data.fileIds.some(id=>!current.files.some(f=>f.id===id)))throw new OfficeError('DENIED');}
  let text='',failed=false;const began=Date.now();
  const result=streamText({...assistantGeneration(req,'worker',quota.settle),system:personalOfficePrompt(begun.actor.workProfile,assistantLanguagePromptLabel(languageForTurn(requester,data.message))),messages:[{role:'user',content:JSON.stringify({question:begun.turn.question,authorizedSources:evidence.data})}]});
  for await(const part of result.fullStream){if(part.type==='text-delta')text+=part.text;if(part.type==='error'||part.type==='abort')failed=true;}
  const reason=await result.finishReason,status=failed||!text.trim()?'error':reason==='stop'?'completed':'partial';
  const answer=text.trim()||'Përgjigjja nuk u përfundua. Provo përsëri me një pyetje më të kufizuar.';
  const usage=await result.totalUsage;
  const stored=await finishOfficeAssistantTurn(data.requestId,{answer,status,sources:evidence.refs,diagnostics:{code:status==='completed'?'OK':'INCOMPLETE',finishReason:reason,elapsedMs:Date.now()-began,totalTokens:usage.totalTokens??null}});
  if(stored.count!==1)return json({error:'Përgjigjja nuk u ruajt. Hap bisedën sërish.'},503);
  return json({id:data.requestId,answer:stored.answer,status,sources:evidence.refs});
 }catch(error){
  if(started)await finishOfficeAssistantTurn(started,{answer:'',status:'error',diagnostics:{code:categorizeAssistantFailure(error).code}}).catch(()=>{});
  return json({error:error instanceof OfficeError&&error.code==='DENIED'?'Nuk ka akses në këtë burim.':'Kërkesa nuk u përfundua. Kontrollo dokumentet dhe provo përsëri.'},error instanceof OfficeError?(error.code==='DENIED'?403:error.code==='CONFLICT'?409:400):error instanceof ZodError||error instanceof SyntaxError?400:503);
 }
}
