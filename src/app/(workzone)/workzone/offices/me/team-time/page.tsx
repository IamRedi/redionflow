import { notFound } from 'next/navigation';
import { fieldTimeSnapshot } from '@/lib/offices/field-time';
import { OfficeError } from '@/lib/offices/work-access';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { OfficeFieldTime } from '@/components/offices/OfficeFieldTime';
export default async function Page(){
  const initial=await fieldTimeSnapshot().catch(e=>{if(e instanceof OfficeError)notFound();throw e;});
  return <OfficeFieldTime initial={initial} sq={await resolveRequestLanguage()==='sq'}/>;
}
