import { notFound } from "next/navigation";

import { KidrahtFrame } from "@/components/kidraht/kidraht-frame";
import { getCompanyMode } from "@/lib/db/company";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { kidrahtDemoUrl } from "@/lib/kidraht-demo";

export default async function DemoKidrahtPage() {
  const [currentLang, mode] = await Promise.all([resolveRequestLanguage(), getCompanyMode()]);
  const url = kidrahtDemoUrl(mode);
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
