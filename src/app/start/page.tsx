import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentDisplayUser } from "@/lib/auth/display-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

export default async function AppStartPage() {
  const [worker, admin, displayUser] = await Promise.all([getCurrentWorker(), getCurrentAdmin(), getCurrentDisplayUser()]);

  if (worker && worker.status === "active") {
    redirect("/workzone");
  }

  if (admin) {
    redirect("/app/dashboard");
  }

  if (displayUser) {
    redirect("/display/workzone");
  }

  redirect("/zugang");
}
