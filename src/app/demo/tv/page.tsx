import { notFound } from "next/navigation";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { DemoDashboardContent } from "@/components/demo/demo-dashboard-content";
import { DemoTvRefresh } from "@/components/demo/workshop/demo-tv-controls";
import styles from "./tv.module.css";

export default async function DemoTvPage({searchParams}:{searchParams:Promise<{view?:string;week?:string}>}) {
  try { await requireWorkshopDemo(); } catch(error) { if(error instanceof SharedWorkshopError&&error.status===404)notFound();throw error; }
  const params=await searchParams;
  return <div className={styles.tv} data-demo-tv data-baum-environment="monitor"><DemoTvRefresh/><DemoDashboardContent searchParams={Promise.resolve({week:params.week})} monitor/></div>;
}
