import { TeamAssistantChat, WorkerAssistantChat } from "@/components/assistant/team-assistant";
import { hasAssistantAccess } from "@/lib/assistant/access";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { redirect } from "next/navigation";

export default async function WorkzoneAssistantPage() {
  const [admin, worker, companyId] = await Promise.all([getCurrentAdmin(), getCurrentWorker(), getCurrentCompanyId()]);

  if (admin) {
    const blocked = !companyId || !(await hasAssistantAccess({ kind: "admin", adminId: admin.id, companyId }));
    return <TeamAssistantChat blocked={blocked} />;
  }

  if (worker) {
    const blocked = !companyId || !(await hasAssistantAccess({ kind: "worker", workerId: worker.id, companyId }));
    return <WorkerAssistantChat blocked={blocked} />;
  }

  redirect("/workzone/login");
}
