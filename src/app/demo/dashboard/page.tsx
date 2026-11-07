import { DemoDashboardContent } from "@/components/demo/demo-dashboard-content";

export default function DemoDashboardPage({searchParams}:{searchParams:Promise<{week?:string}>}) {
  return <DemoDashboardContent searchParams={searchParams}/>;
}
