import { OfficePage } from '@/components/offices/OfficePage';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){return <OfficePage room="person" personId={(await params).id}/>;}
