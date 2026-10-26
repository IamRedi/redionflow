import { TeamAssistantChat, WorkerAssistantChat } from "@/components/assistant/team-assistant";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { redirect } from "next/navigation";

export default async function WorkzoneAssistantPage() {
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);

  if (admin) {
    return <TeamAssistantChat />;
  }

  if (worker) {
    return <WorkerAssistantChat />;
  }

  redirect("/workzone/login");
}
