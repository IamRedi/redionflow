import { OfficePage } from '@/components/offices/OfficePage';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default function ReceptionPage() { return <OfficePage room="reception" />; }
