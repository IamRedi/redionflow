import {randomUUID} from 'node:crypto';
import {notFound} from 'next/navigation';
import {officeAssistantActor,officeAssistantHistory,officeAssistantFiles} from '@/lib/offices/assistant-service';
import {officeResources} from '@/lib/offices/resources';
import {resolveRequestLanguage} from '@/lib/i18n/server';
import {OfficeAssistant} from '@/components/offices/OfficeAssistant';
import {OfficeError,officeActor} from '@/lib/offices/work-access';
import Link from 'next/link';
import {TeamAssistantChat} from '@/components/assistant/team-assistant';
import {getRequesterContext} from '@/lib/assistant/requester';
import {hasAssistantAccess} from '@/lib/assistant/access';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{site?:string}>}){
 const actor=await officeActor(),lang=await resolveRequestLanguage(),sq=lang==='sq';
 if(actor.manager){const requester=await getRequesterContext();if(requester.kind!=='admin')notFound();return <section className="p-4"><Link className="inline-flex min-h-11 items-center text-sm" href="/workzone/offices/me">{sq?'← Zyra ime':'← My office'}</Link><TeamAssistantChat blocked={!await hasAssistantAccess(requester)}/></section>;}
 const {site}=await searchParams;
 const data=await (async()=>{try{await officeAssistantActor();return {resources:await officeResources(),files:site?(await officeAssistantFiles(site)).files:[],history:await officeAssistantHistory()};}catch(e){if(e instanceof OfficeError)notFound();throw e;}})();
 return <OfficeAssistant sq={(await resolveRequestLanguage())==='sq'} siteId={site} sites={data.resources.sites} files={data.files} initial={JSON.parse(JSON.stringify({...data.history,conversationId:data.history.conversationId??randomUUID()}))}/>;
}
