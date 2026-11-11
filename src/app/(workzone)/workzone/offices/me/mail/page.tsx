import { OfficeWorkPage } from '@/components/offices/OfficeWorkPage';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{compose?:string;to?:string}>}){return <OfficeWorkPage view="mail" compose={(await searchParams).compose==='1'} recipient={(await searchParams).to}/>;}
