import { OfficePage } from '@/components/offices/OfficePage';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function ReceptionPage({searchParams}:{searchParams:Promise<{doors?:string}>}) { return <OfficePage room="reception" query={await searchParams}/>; }
