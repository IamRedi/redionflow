import { OfficeWorkPage } from '@/components/offices/OfficeWorkPage';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{task?:string}>}){return <OfficeWorkPage view="tasks" task={(await searchParams).task}/>;}
