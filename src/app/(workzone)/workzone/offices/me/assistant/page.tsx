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
import {OfficePage} from '@/components/offices/OfficePage';
import {OfficeDrawer} from '@/components/offices/OfficeDrawer';
import {MessageSquareText,X} from 'lucide-react';
import glass from '@/components/offices/surfaces.module.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{site?:string}>}){
 const actor=await officeActor(),lang=await resolveRequestLanguage(),sq=lang==='sq';
 if(actor.manager){const requester=await getRequesterContext();if(requester.kind!=='admin')notFound();const title=sq?'Asistenti i firmës':'Company assistant';return <><OfficePage room="me"/><OfficeDrawer placement="assistant" backHref="/workzone/offices/me#office-assistant" label={title}><header className={glass.assistantHeader}><MessageSquareText size={20} strokeWidth={1.3}/><div><h1>{title}</h1><p>{sq?'Vetëm lexim · Bisedat e mia':'Read only · My conversations'}</p></div><Link href="/workzone/offices/me#office-assistant" aria-label={sq?'Mbyll':'Close'}><X size={19}/></Link></header><div className={glass.chat} data-office-chat><TeamAssistantChat compact blocked={!await hasAssistantAccess(requester)}/></div></OfficeDrawer></>;}
 const {site}=await searchParams;
 const data=await (async()=>{try{await officeAssistantActor();return {resources:await officeResources(),files:site?(await officeAssistantFiles(site)).files:[],history:await officeAssistantHistory()};}catch(e){if(e instanceof OfficeError)notFound();throw e;}})();
 return <><OfficePage room="me"/><OfficeDrawer placement="assistant" backHref="/workzone/offices/me#office-assistant" label={sq?'Asistenti im i punës':'My work assistant'}><div className={glass.personal}><OfficeAssistant sq={sq} siteId={site} sites={data.resources.sites} files={data.files} initial={JSON.parse(JSON.stringify({...data.history,conversationId:data.history.conversationId??randomUUID()}))}/></div></OfficeDrawer></>;
}
