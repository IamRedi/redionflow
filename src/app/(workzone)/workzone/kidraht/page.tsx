import { notFound, redirect } from "next/navigation";

import { KidrahtFrame } from "@/components/kidraht/kidraht-frame";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCompanyMode } from "@/lib/db/company";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { kidrahtAppUrl } from "@/lib/kidraht-demo";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

export default async function WorkzoneKidrahtPage() {
  const [admin, worker, currentLang, mode] = await Promise.all([
    getCurrentAdmin(),
    getCurrentWorker(),
    resolveRequestLanguage(),
    getCompanyMode(),
  ]);
  if (!admin && !worker) redirect("/workzone/login");
  const url = mode === "baumdienst" ? kidrahtAppUrl() : null;
  if (!url) notFound();
  return (
    <KidrahtFrame
      url={url}
      title={t("demo.kidrahtTitle", currentLang)}
      description={t("demo.kidrahtDescription", currentLang)}
      newTabLabel={t("demo.kidrahtNewTab", currentLang)}
    />
  );
}
