import { notFound } from 'next/navigation';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { OfficeError } from '@/lib/offices/work-access';
import { officeWorkSnapshot } from '@/lib/offices/work-service';
import { OfficeWork } from './OfficeWork';

export async function OfficeWorkPage({view,compose=false,recipient}:{view:'mail'|'tasks';compose?:boolean;recipient?:string}){
  const initial=await officeWorkSnapshot().catch(error=>{if(error instanceof OfficeError)notFound();throw error;});
  return <OfficeWork initial={initial} view={view} lang={await resolveRequestLanguage()} initialCompose={compose} initialRecipient={recipient}/>;
}
