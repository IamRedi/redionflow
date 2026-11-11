import { Suspense } from 'react';
import { currentOfficeAccess } from '@/lib/offices/access';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { OfficeReturnLinks } from './OfficeReturnLinks';
export async function OfficeReturnBar(){
  if(!await currentOfficeAccess())return null;
  return <Suspense fallback={null}><OfficeReturnLinks lang={await resolveRequestLanguage()}/></Suspense>;
}
