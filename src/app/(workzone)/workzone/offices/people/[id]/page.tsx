import { OfficePage } from '@/components/offices/OfficePage';
import type {OfficePreviewQuery} from '@/components/offices/OfficePreviewPanel';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<OfficePreviewQuery>}){return <OfficePage room="person" personId={(await params).id} query={await searchParams}/>;}
