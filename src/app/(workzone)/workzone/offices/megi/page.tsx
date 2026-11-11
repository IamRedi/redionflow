import { OfficePage } from '@/components/offices/OfficePage';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default function MegiOfficePage() { return <OfficePage room="megi" />; }
