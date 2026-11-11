import {OfficePlaces} from '@/components/offices/OfficeResources';
import {resolveRequestLanguage} from '@/lib/i18n/server';
export const dynamic='force-dynamic';
export default async function Page(){return <OfficePlaces lang={await resolveRequestLanguage()}/>;}
