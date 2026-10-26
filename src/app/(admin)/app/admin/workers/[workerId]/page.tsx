import { redirect } from "next/navigation";

export default async function AdminWorkerDetailPage({ params }: { params: Promise<{ workerId: string }> }) {
  const { workerId } = await params;
  redirect(`/workzone/admin-workers/${workerId}`);
}
