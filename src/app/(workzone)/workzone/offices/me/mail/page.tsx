import {OfficeWorkPage} from '@/components/offices/OfficeWorkPage';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{compose?:string;to?:string;thread?:string}>}){const q=await searchParams;return <OfficeWorkPage view="mail" compose={q.compose==='1'} recipient={q.to} thread={q.thread}/>;}
