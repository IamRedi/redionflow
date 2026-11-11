import { notFound } from 'next/navigation';
import { officeTeamSettings } from '@/lib/offices/team-service';
import { OfficeError } from '@/lib/offices/work-access';
import { OfficeTeam } from '@/components/offices/OfficeTeam';
import { resolveRequestLanguage } from '@/lib/i18n/server';
export const dynamic='force-dynamic';
export default async function Page(){
 const initial=await officeTeamSettings().catch(e=>{if(e instanceof OfficeError)notFound();throw e;});
 return <OfficeTeam initial={initial} sq={(await resolveRequestLanguage())==='sq'}/>;
}
