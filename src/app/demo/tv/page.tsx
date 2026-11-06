import { notFound } from "next/navigation";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { DemoWorkzoneContent } from "@/components/demo/demo-workzone-content";
import { DemoTvControls } from "@/components/demo/workshop/demo-tv-controls";
import DemoDashboardPage from "../dashboard/page";
import styles from "./tv.module.css";

export default async function DemoTvPage({ searchParams }: { searchParams: Promise<{ view?: string; week?: string }> }) {
  try { await requireWorkshopDemo(); } catch (e) { if (e instanceof SharedWorkshopError && e.status === 404) notFound(); throw e; }
  const params = await searchParams, dashboard = params.view === "dashboard";
  return <div className={`${styles.tv} space-y-5`} data-demo-tv><DemoTvControls lang={await resolveRequestLanguage()} dashboard={dashboard} />{dashboard ? <DemoDashboardPage searchParams={Promise.resolve({week:params.week})} /> : <DemoWorkzoneContent monitor />}</div>;
}
