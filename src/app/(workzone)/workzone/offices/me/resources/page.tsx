import {OfficePlaces} from '@/components/offices/OfficeResources';
import {resolveRequestLanguage} from '@/lib/i18n/server';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){return <OfficePlaces lang={await resolveRequestLanguage()} query={(await searchParams).q?.slice(0,100)}/>;}
