import { notFound, redirect } from "next/navigation";

import { KidrahtFrame } from "@/components/kidraht/kidraht-frame";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { kidrahtLinkForCurrentPerson } from "@/lib/kidraht/company-link";
import { kidrahtEmbedded } from "@/lib/kidraht/platform";

export const dynamic = "force-dynamic";

export default async function WorkzoneKidrahtPage() {
  const [link, currentLang] = await Promise.all([kidrahtLinkForCurrentPerson(), resolveRequestLanguage()]);
  if ("error" in link) {
    if (link.error === "signed_out") redirect("/workzone/login");
    if (link.error === "off") notFound();
    return (
      <section className="mx-auto grid max-w-md place-items-center gap-2 rounded-3xl border bg-card p-8 text-center">
        <p className="text-sm font-medium">{t("kidraht.unreachable", currentLang)}</p>
      </section>
    );
  }
  // Opened in KiDraht itself unless KiDraht allows being shown inside this app.
  if (!kidrahtEmbedded()) redirect(link.url);
  return (
    <KidrahtFrame
      url={link.url}
      title={t("demo.kidrahtTitle", currentLang)}
      description={t("kidraht.description", currentLang)}
      newTabLabel={t("demo.kidrahtNewTab", currentLang)}
    />
  );
}
